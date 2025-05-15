import os
import json
import logging
import time
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import pika
import jwt
import requests
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from metrics import (
    RequestLatencyMiddleware, observe_payment_operation, 
    time_database_operation, update_processor_status,
    track_success_rate
)
from database import init_db, save_order, get_orders_by_user, get_order_details

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Add metrics middleware
app.wsgi_app = RequestLatencyMiddleware(app.wsgi_app)

# Metrics endpoint
@app.route('/metrics', methods=['GET'])
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

# Get environment variables
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret-key')
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_PORT = int(os.environ.get('RABBITMQ_PORT', 5672))
PRODUCT_SERVICE_URL = os.environ.get('PRODUCT_SERVICE_URL', 'http://product-service:80/api/products')

# RabbitMQ configuration
def get_rabbitmq_connection():
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )
        update_processor_status('rabbitmq', True)
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        update_processor_status('rabbitmq', False)
        return None

def publish_payment_event(event_type, data):
    try:
        connection = get_rabbitmq_connection()
        if not connection:
            logger.error("Could not publish event: no RabbitMQ connection")
            return False
        
        channel = connection.channel()
        channel.exchange_declare(exchange='payment_events', exchange_type='topic', durable=True)
        
        message = {
            'event_type': event_type,
            'data': data
        }
        
        channel.basic_publish(
            exchange='payment_events',
            routing_key=event_type,
            body=json.dumps(message),
            properties=pika.BasicProperties(delivery_mode=2)  # Make message persistent
        )
        
        connection.close()
        logger.info(f"Published {event_type} event to RabbitMQ")
        return True
    except Exception as e:
        logger.error(f"Error publishing event to RabbitMQ: {e}")
        return False

# Authentication middleware
def authenticate_jwt(token):
    try:
        if not token or not token.startswith('Bearer '):
            return None
        
        token = token.split(' ')[1]
        user = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return user
    except Exception as e:
        logger.error(f"JWT authentication error: {e}")
        return None

# Payment processing logic
def process_payment(payment_data):
    """
    Simulate payment processing
    Return (success, message)
    """
    card_number = payment_data.get('cardNumber', '')
    card_number = card_number.replace(' ', '')
    
    # Simple test card validation
    if not card_number.isdigit() or len(card_number) != 16:
        observe_payment_operation('validate', 'failure')
        return False, "Invalid card number"
    
    # Test cards
    if card_number == '4111111111111111':
        observe_payment_operation('process', 'success', payment_data.get('amount', 0))
        return True, "Payment successful"
    elif card_number == '4242424242424242':
        observe_payment_operation('process', 'success', payment_data.get('amount', 0))
        return True, "Payment successful"
    elif card_number == '4000000000000002':
        observe_payment_operation('process', 'failure')
        return False, "Card declined"
        
    # Process based on last digit for testing
    last_digit = int(card_number[-1])
    if last_digit % 2 == 0:
        observe_payment_operation('process', 'success', payment_data.get('amount', 0))
        return True, "Payment successful"
    else:
        observe_payment_operation('process', 'failure')
        return False, "Card declined"

# Check product stock availability
def check_stock(product_id, quantity):
    try:
        response = requests.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
        if response.status_code != 200:
            observe_payment_operation('stock_check', 'failure')
            return False, "Product not found"
        
        product = response.json()
        if product['stockQuantity'] < quantity:
            observe_payment_operation('stock_check', 'failure')
            return False, f"Not enough stock. Available: {product['stockQuantity']}"
        
        observe_payment_operation('stock_check', 'success')
        return True, product
    except Exception as e:
        logger.error(f"Error checking product stock: {e}")
        observe_payment_operation('stock_check', 'error')
        return False, "Error checking product stock"

@time_database_operation('save_order')
def db_save_order(order_data):
    return save_order(order_data)

@time_database_operation('get_orders')
def db_get_orders_by_user(user_id):
    return get_orders_by_user(user_id)

@time_database_operation('get_order_details')
def db_get_order_details(order_id):
    return get_order_details(order_id)

async def get_product_prices(cart_items):
    """Get product prices to store in the order database"""
    items_with_prices = []
    
    for item in cart_items:
        try:
            product_id = item['productId']
            response = requests.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
            if response.status_code == 200:
                product = response.json()
                item_with_price = item.copy()
                item_with_price['price'] = product.get('price', 0)
                items_with_prices.append(item_with_price)
            else:
                # If product not found, add without price
                items_with_prices.append(item)
        except Exception as e:
            logger.error(f"Error fetching product price: {e}")
            items_with_prices.append(item)
    
    return items_with_prices

# API routes
@app.route('/api/payments/process', methods=['POST'])
def process_payment_request():
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    if not data:
        return jsonify({"error": "Invalid request data"}), 400
    
    cart_items = data.get('cartItems', [])
    payment_info = data.get('paymentInfo', {})
    
    if not cart_items or not payment_info:
        return jsonify({"error": "Missing cart items or payment information"}), 400
    
    # Check stock for all items
    for item in cart_items:
        stock_ok, stock_data = check_stock(item['productId'], item['quantity'])
        if not stock_ok:
            return jsonify({"error": stock_data}), 400
    
    # Process payment
    payment_success, payment_message = process_payment(payment_info)
    
    if not payment_success:
        logger.info(f"Payment failed: {payment_message}")
        return jsonify({
            "success": False,
            "message": payment_message
        }), 400
    
    # Get product prices for the items
    try:
        # Create order data for storage and events
        order_id = f"order-{user['id']}-{int(time.time())}"
        
        # Payment succeeded, save order to database
        order_data = {
            "userId": user['id'],
            "orderId": order_id,
            "items": cart_items,  # Will add prices when saving to database
            "totalAmount": data.get('totalAmount', 0),
            "paymentMethod": payment_info.get('paymentMethod', 'card')
        }
        
        # Save order to MySQL database
        db_save_success = db_save_order(order_data)
        if not db_save_success:
            logger.warning("Failed to save order to database, but payment was successful")
        
        # Publish event to update stock and clear cart
        publish_payment_event('payment.successful', order_data)
        
        return jsonify({
            "success": True,
            "message": "Payment processed successfully",
            "orderId": order_id
        }), 200
    except Exception as e:
        logger.error(f"Error processing payment: {e}")
        return jsonify({
            "success": False,
            "message": "An error occurred during payment processing"
        }), 500

@app.route('/api/payments/orders', methods=['GET'])
def get_user_orders():
    """Get all orders for the authenticated user"""
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    orders = db_get_orders_by_user(user['id'])
    
    # Convert SQLAlchemy objects to dictionaries
    orders_data = []
    for order in orders:
        orders_data.append({
            "orderId": order.order_id,
            "totalAmount": order.total_amount,
            "status": order.status,
            "createdAt": order.created_at.isoformat(),
            "paymentMethod": order.payment_method
        })
    
    return jsonify({"orders": orders_data}), 200

@app.route('/api/payments/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get detailed information for a specific order"""
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    order_details = db_get_order_details(order_id)
    
    if not order_details:
        return jsonify({"error": "Order not found"}), 404
    
    # Check if order belongs to authenticated user
    if order_details['user_id'] != user['id']:
        return jsonify({"error": "Unauthorized"}), 403
    
    return jsonify(order_details), 200

@app.route('/api/payments/test-cards', methods=['GET'])
def get_test_cards():
    """Return a list of test card numbers that can be used for testing"""
    return jsonify({
        "testCards": [
            {"number": "4111111111111111", "result": "Success"},
            {"number": "4242424242424242", "result": "Success"},
            {"number": "4000000000000002", "result": "Declined"}
        ]
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    import time
    # Wait for RabbitMQ to be ready
    retries = 5
    while retries > 0:
        connection = get_rabbitmq_connection()
        if connection:
            connection.close()
            break
        logger.info(f"Waiting for RabbitMQ to be ready. Retries left: {retries}")
        retries -= 1
        time.sleep(5)
    
    # Initialize database connection
    db_initialized = init_db()
    if not db_initialized:
        logger.warning("Failed to initialize database connection. Order storage will not work.")
    
    logger.info("Payment service started")
    app.run(host='0.0.0.0', port=4004) 