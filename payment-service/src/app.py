import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import pika
import jwt
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

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
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
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
        return False, "Invalid card number"
    
    # Test cards
    if card_number == '4111111111111111':
        return True, "Payment successful"
    elif card_number == '4242424242424242':
        return True, "Payment successful"
    elif card_number == '4000000000000002':
        return False, "Card declined"
        
    # Process based on last digit for testing
    last_digit = int(card_number[-1])
    if last_digit % 2 == 0:
        return True, "Payment successful"
    else:
        return False, "Card declined"

# Check product stock availability
def check_stock(product_id, quantity):
    try:
        response = requests.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
        if response.status_code != 200:
            return False, "Product not found"
        
        product = response.json()
        if product['stockQuantity'] < quantity:
            return False, f"Not enough stock. Available: {product['stockQuantity']}"
        
        return True, product
    except Exception as e:
        logger.error(f"Error checking product stock: {e}")
        return False, "Error checking product stock"

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
    
    # Payment succeeded, publish events to update stock and clear cart
    payment_data = {
        "userId": user['id'],
        "orderId": data.get('orderId', f"order-{user['id']}-{int(time.time())}"),
        "items": cart_items,
        "totalAmount": data.get('totalAmount', 0),
        "paymentMethod": payment_info.get('paymentMethod', 'card')
    }
    
    publish_payment_event('payment.successful', payment_data)
    
    return jsonify({
        "success": True,
        "message": "Payment processed successfully",
        "orderId": payment_data['orderId']
    }), 200

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
    
    logger.info("Payment service started")
    app.run(host='0.0.0.0', port=4004) 