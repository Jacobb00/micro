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
from redis_cache import payment_redis_cache  # Redis cache eklendi

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
        # Önce cache'den stok bilgisini kontrol et
        cache_key = f"stock:{product_id}"
        cached_stock = payment_redis_cache.get(cache_key)
        
        if cached_stock is not None:
            logger.info(f"Stock data for product {product_id} cache'den alındı")
            cached_quantity = cached_stock.get('stockQuantity', 0)
            
            if cached_quantity < quantity:
                observe_payment_operation('stock_check', 'failure')
                return False, f"Not enough stock. Available: {cached_quantity}"
            
            observe_payment_operation('stock_check', 'success')
            return True, cached_stock
        
        # Cache miss - API'den stok bilgisini al
        response = requests.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
        if response.status_code != 200:
            observe_payment_operation('stock_check', 'failure')
            return False, "Product not found"
        
        product = response.json()
        
        # Stok bilgisini cache'le (5 dakika - stok sık değişebilir)
        payment_redis_cache.set(cache_key, product, 300)
        
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

def get_product_prices(cart_items):
    """Get product prices to store in the order database"""
    items_with_prices = []
    
    for item in cart_items:
        try:
            product_id = item['productId']
            
            # Önce cache'den fiyatı kontrol et
            cached_price = payment_redis_cache.get_product_price(product_id)
            if cached_price is not None:
                logger.info(f"Product {product_id} fiyatı cache'den alındı")
                item_with_price = item.copy()
                item_with_price['price'] = cached_price
                items_with_prices.append(item_with_price)
                continue
            
            # Cache miss - API'den al
            response = requests.get(f"{PRODUCT_SERVICE_URL}/{product_id}")
            if response.status_code == 200:
                product = response.json()
                price = product.get('price', 0)
                
                # Fiyatı cache'le (1 saat)
                payment_redis_cache.cache_product_price(product_id, price, 3600)
                
                item_with_price = item.copy()
                item_with_price['price'] = price
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
    
    user_id = user['id']
    
    # Payment session'ı cache'le (işlem süreci boyunca)
    payment_session = {
        "userId": user_id,
        "cartItems": cart_items,
        "paymentInfo": payment_info,
        "totalAmount": data.get('totalAmount', 0),
        "status": "processing",
        "timestamp": int(time.time())
    }
    payment_redis_cache.cache_payment_session(user_id, payment_session, 1800)  # 30 dakika
    
    # Check stock for all items
    for item in cart_items:
        stock_ok, stock_data = check_stock(item['productId'], item['quantity'])
        if not stock_ok:
            # Payment başarısız - session'ı güncelle
            payment_session["status"] = "failed"
            payment_session["error"] = stock_data
            payment_redis_cache.cache_payment_session(user_id, payment_session, 300)  # 5 dakika
            return jsonify({"error": stock_data}), 400
    
    # Process payment
    payment_success, payment_message = process_payment(payment_info)
    
    if not payment_success:
        logger.info(f"Payment failed: {payment_message}")
        # Payment başarısız - session'ı güncelle
        payment_session["status"] = "failed"
        payment_session["error"] = payment_message
        payment_redis_cache.cache_payment_session(user_id, payment_session, 300)  # 5 dakika
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
        
        # Payment başarılı - session'ı güncelle
        payment_session["status"] = "completed"
        payment_session["orderId"] = order_id
        payment_redis_cache.cache_payment_session(user_id, payment_session, 3600)  # 1 saat
        
        # Cache invalidation - yeni sipariş eklendi
        payment_redis_cache.delete(f"user:orders:{user_id}")  # User orders cache'ini temizle
        
        # Publish event to update stock and clear cart
        publish_payment_event('payment.successful', order_data)
        
        return jsonify({
            "success": True,
            "message": "Payment processed successfully",
            "orderId": order_id
        }), 200
    except Exception as e:
        logger.error(f"Error processing payment: {e}")
        # Payment başarısız - session'ı güncelle
        payment_session["status"] = "error"
        payment_session["error"] = str(e)
        payment_redis_cache.cache_payment_session(user_id, payment_session, 300)  # 5 dakika
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
    
    user_id = user['id']
    cache_key = f"user:orders:{user_id}"
    
    # Önce cache'den kontrol et
    cached_orders = payment_redis_cache.get(cache_key)
    if cached_orders is not None:
        logger.info(f"User {user_id} orders cache'den alındı")
        return jsonify({"orders": cached_orders}), 200
    
    # Cache miss - veritabanından al
    orders = db_get_orders_by_user(user_id)
    
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
    
    # Cache'le (10 dakika)
    payment_redis_cache.set(cache_key, orders_data, 600)
    
    return jsonify({"orders": orders_data}), 200

@app.route('/api/payments/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get detailed information for a specific order"""
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    cache_key = f"order:details:{order_id}"
    
    # Önce cache'den kontrol et
    cached_order = payment_redis_cache.get(cache_key)
    if cached_order is not None:
        # Check if order belongs to authenticated user
        if cached_order['user_id'] != user['id']:
            return jsonify({"error": "Unauthorized"}), 403
        
        logger.info(f"Order {order_id} details cache'den alındı")
        return jsonify(cached_order), 200
    
    # Cache miss - veritabanından al
    order_details = db_get_order_details(order_id)
    
    if not order_details:
        return jsonify({"error": "Order not found"}), 404
    
    # Check if order belongs to authenticated user
    if order_details['user_id'] != user['id']:
        return jsonify({"error": "Unauthorized"}), 403
    
    # Cache'le (30 dakika)
    payment_redis_cache.set(cache_key, order_details, 1800)
    
    return jsonify(order_details), 200

@app.route('/api/payments/session', methods=['GET'])
def get_payment_session():
    """Get current payment session for the authenticated user"""
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = user['id']
    session_data = payment_redis_cache.get_payment_session(user_id)
    
    if not session_data:
        return jsonify({"error": "No active payment session found"}), 404
    
    # Remove sensitive payment info from response
    safe_session = session_data.copy()
    if 'paymentInfo' in safe_session:
        safe_session['paymentInfo'] = {
            'paymentMethod': safe_session['paymentInfo'].get('paymentMethod', 'unknown')
        }
    
    return jsonify({"session": safe_session}), 200

@app.route('/api/payments/session', methods=['DELETE'])
def clear_payment_session():
    """Clear current payment session for the authenticated user"""
    auth_header = request.headers.get('Authorization')
    user = authenticate_jwt(auth_header)
    
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = user['id']
    success = payment_redis_cache.invalidate_payment_session(user_id)
    
    if success:
        return jsonify({"message": "Payment session cleared successfully"}), 200
    else:
        return jsonify({"error": "Failed to clear payment session"}), 500

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
    redis_status = "healthy" if payment_redis_cache.is_connected else "disconnected"
    return jsonify({
        "status": "healthy",
        "redis": redis_status
    })

if __name__ == '__main__':
    import time
    
    # Redis bağlantısını başlat
    try:
        payment_redis_cache.connect()
        logger.info("Redis bağlantısı kuruldu")
    except Exception as e:
        logger.error(f"Redis bağlantı hatası: {e}")
        logger.info("Redis olmadan devam ediliyor...")
    
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