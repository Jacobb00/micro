import os
import logging
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Configure logging
logger = logging.getLogger(__name__)

# Get environment variables
MYSQL_HOST = os.environ.get('MYSQL_HOST', 'mysql')
MYSQL_PORT = os.environ.get('MYSQL_PORT', '3306')
MYSQL_USER = os.environ.get('MYSQL_USER', 'payment_user')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'payment_password')
MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'payment_db')

# Create database connection string
DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"

# Create base class for declarative models
Base = declarative_base()

# Define Orders table
class Order(Base):
    __tablename__ = 'orders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(255), unique=True, nullable=False)
    user_id = Column(String(255), nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    def __repr__(self):
        return f"<Order(order_id='{self.order_id}', user_id='{self.user_id}', total_amount={self.total_amount})>"

# Define OrderItems table
class OrderItem(Base):
    __tablename__ = 'order_items'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(255), nullable=False)
    product_id = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=True)
    
    def __repr__(self):
        return f"<OrderItem(order_id='{self.order_id}', product_id='{self.product_id}', quantity={self.quantity})>"

# Create SQLAlchemy engine
engine = None
Session = None

def init_db():
    """Initialize database connection and create tables if they don't exist"""
    global engine, Session
    
    try:
        logger.info(f"Connecting to MySQL database at {MYSQL_HOST}:{MYSQL_PORT}")
        engine = create_engine(DATABASE_URL)
        
        # Create tables
        Base.metadata.create_all(engine)
        
        # Create session factory
        Session = sessionmaker(bind=engine)
        
        logger.info("Database connection established and tables created")
        return True
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        return False

def get_session():
    """Get a new session for database operations"""
    if Session is None:
        init_db()
    return Session()

def save_order(order_data):
    """
    Save an order to the database
    
    Args:
        order_data (dict): Order data containing order details and items
        
    Returns:
        bool: Success status
    """
    try:
        session = get_session()
        
        # Create order record
        order = Order(
            order_id=order_data.get('orderId'),
            user_id=order_data.get('userId'),
            total_amount=order_data.get('totalAmount', 0.0),
            payment_method=order_data.get('paymentMethod', 'card'),
            status='completed'
        )
        
        session.add(order)
        
        # Create order items
        for item in order_data.get('items', []):
            order_item = OrderItem(
                order_id=order_data.get('orderId'),
                product_id=item.get('productId'),
                quantity=item.get('quantity', 1),
                price=item.get('price', 0.0)
            )
            session.add(order_item)
        
        session.commit()
        logger.info(f"Saved order {order_data.get('orderId')} to database")
        return True
    except Exception as e:
        logger.error(f"Error saving order to database: {e}")
        session.rollback()
        return False
    finally:
        session.close()

def get_orders_by_user(user_id):
    """
    Get all orders for a specific user
    
    Args:
        user_id (str): User ID
        
    Returns:
        list: List of order records
    """
    try:
        session = get_session()
        orders = session.query(Order).filter(Order.user_id == user_id).all()
        return orders
    except Exception as e:
        logger.error(f"Error fetching orders for user {user_id}: {e}")
        return []
    finally:
        session.close()

def get_order_details(order_id):
    """
    Get detailed information about a specific order
    
    Args:
        order_id (str): Order ID
        
    Returns:
        dict: Order details with items
    """
    try:
        session = get_session()
        order = session.query(Order).filter(Order.order_id == order_id).first()
        
        if not order:
            return None
        
        # Get order items
        items = session.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        
        # Convert to dictionary
        result = {
            'order_id': order.order_id,
            'user_id': order.user_id,
            'total_amount': order.total_amount,
            'payment_method': order.payment_method,
            'status': order.status,
            'created_at': order.created_at.isoformat(),
            'items': [
                {
                    'product_id': item.product_id,
                    'quantity': item.quantity,
                    'price': item.price
                }
                for item in items
            ]
        }
        
        return result
    except Exception as e:
        logger.error(f"Error fetching order details for order {order_id}: {e}")
        return None
    finally:
        session.close() 