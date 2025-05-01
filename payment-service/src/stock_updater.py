import os
import json
import time
import logging
import pika
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get environment variables
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_PORT = int(os.environ.get('RABBITMQ_PORT', 5672))
PRODUCT_SERVICE_URL = os.environ.get('PRODUCT_SERVICE_URL', 'http://product-service:80/api/products')
CART_SERVICE_URL = os.environ.get('CART_SERVICE_URL', 'http://cart-service:4003')

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

def update_product_stock(product_id, quantity, is_increment=False):
    """
    Update product stock by incrementing or decrementing the available quantity
    """
    try:
        url = f"{PRODUCT_SERVICE_URL}/{product_id}/stock"
        payload = {
            "quantity": quantity,
            "isIncrement": is_increment
        }
        
        response = requests.patch(url, json=payload)
        
        if response.status_code == 200:
            action = "incremented" if is_increment else "decremented"
            logger.info(f"Successfully updated stock for product {product_id} ({action} by {quantity})")
            return True
        else:
            logger.error(f"Failed to update stock: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"Error updating product stock: {e}")
        return False

def clear_user_cart(user_id):
    """
    Clear user's cart after successful payment
    """
    try:
        url = f"{CART_SERVICE_URL}/api/cart/clear"
        headers = {
            "Content-Type": "application/json",
            # We need a valid JWT token for the user, but we don't have it in this context
            # This is a limitation of our current design
            # In a real-world scenario, we would need to use service-to-service auth
            # or store the user's token in the payment event
            # For now, we'll just log this limitation
        }
        
        logger.info(f"Would clear cart for user {user_id} (Service-to-service auth not implemented)")
        
        # In a real implementation, we would do:
        # response = requests.post(url, headers=headers)
        # return response.status_code == 200
        
        return True
    except Exception as e:
        logger.error(f"Error clearing user cart: {e}")
        return False

def handle_payment_success(data):
    """Handle payment.successful event"""
    user_id = data.get('userId')
    items = data.get('items', [])
    
    # Update stock for each product (decrement)
    for item in items:
        product_id = item.get('productId')
        quantity = item.get('quantity', 1)
        
        if product_id and quantity:
            update_product_stock(product_id, quantity, is_increment=False)
    
    # Clear the user's cart
    if user_id:
        clear_user_cart(user_id)
        
    logger.info(f"Processed payment.successful event for order {data.get('orderId')}")

def handle_stock_rollback(data):
    """Handle stock.rollback event"""
    order_id = data.get('orderId')
    items = data.get('items', [])
    
    logger.info(f"Processing stock rollback for order: {order_id}")
    
    # Increment stock for each product (return items to inventory)
    for item in items:
        product_id = item.get('productId')
        quantity = item.get('quantity', 1)
        
        if product_id and quantity:
            success = update_product_stock(product_id, quantity, is_increment=True)
            if success:
                logger.info(f"Successfully rolled back stock for product {product_id} (+{quantity})")
            else:
                logger.error(f"Failed to roll back stock for product {product_id}")
    
    # Send response back to order-tracking-service
    try:
        connection = get_rabbitmq_connection()
        if connection:
            channel = connection.channel()
            channel.queue_declare(queue='stock.rollback.response', durable=True)
            
            response = {
                'orderId': order_id,
                'success': True,
                'message': 'Stock rollback completed successfully'
            }
            
            channel.basic_publish(
                exchange='',
                routing_key='stock.rollback.response',
                body=json.dumps(response),
                properties=pika.BasicProperties(delivery_mode=2)  # Persistent message
            )
            
            connection.close()
            logger.info(f"Sent stock rollback response for order: {order_id}")
    except Exception as e:
        logger.error(f"Error sending stock rollback response: {e}")

def callback(ch, method, properties, body):
    try:
        logger.info(f"Received message: {body}")
        message = json.loads(body)
        
        # Handle different message formats
        if isinstance(message, dict) and 'event_type' in message:
            # Format: { event_type: '...', data: {...} }
            event_type = message.get('event_type')
            data = message.get('data', {})
            
            if event_type == 'payment.successful':
                handle_payment_success(data)
        else:
            # Direct message format
            queue_name = method.routing_key
            
            if queue_name == 'stock.rollback':
                handle_stock_rollback(message)
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Negative acknowledgement, message will be requeued
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """
    Main function to start the stock updater service
    """
    # Wait for RabbitMQ to be ready
    retries = 5
    connection = None
    
    while retries > 0:
        connection = get_rabbitmq_connection()
        if connection:
            break
        logger.info(f"Waiting for RabbitMQ to be ready. Retries left: {retries}")
        retries -= 1
        time.sleep(5)
    
    if not connection:
        logger.error("Could not connect to RabbitMQ after multiple attempts. Exiting.")
        return
    
    try:
        channel = connection.channel()
        
        # Declare exchange for payment events
        channel.exchange_declare(exchange='payment_events', exchange_type='topic', durable=True)
        
        # Declare queue for payment success events
        payment_queue = channel.queue_declare(queue='stock_updates', durable=True).method.queue
        channel.queue_bind(exchange='payment_events', queue=payment_queue, routing_key='payment.successful')
        
        # Declare queue for stock rollback (from order cancellations)
        rollback_queue = channel.queue_declare(queue='stock.rollback', durable=True).method.queue
        
        # Declare response queue for stock rollback confirmations
        channel.queue_declare(queue='stock.rollback.response', durable=True)
        
        # Set up consumers
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=payment_queue, on_message_callback=callback)
        channel.basic_consume(queue=rollback_queue, on_message_callback=callback)
        
        logger.info("Stock updater service started. Waiting for messages...")
        channel.start_consuming()
    except Exception as e:
        logger.error(f"Error in stock updater service: {e}")
        if connection and connection.is_open:
            connection.close()

if __name__ == '__main__':
    main() 