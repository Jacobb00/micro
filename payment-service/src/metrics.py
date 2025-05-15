from prometheus_client import Counter, Histogram, Gauge, Summary
import time
import functools

# Payment operations counter
payment_operations = Counter(
    'payment_operations_total',
    'Total number of payment operations',
    ['operation', 'status']
)

# Payment amounts
payment_amount_total = Counter(
    'payment_amount_total',
    'Total amount of payments processed',
    ['status']
)

# Database operation duration
db_operation_duration = Histogram(
    'payment_db_operation_duration_seconds',
    'Duration of database operations in seconds',
    ['operation'],
    buckets=(0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
)

# API request latency
request_latency = Histogram(
    'payment_request_latency_seconds',
    'Flask Request Latency',
    ['method', 'endpoint', 'status_code'],
    buckets=(0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
)

# Payment success rate
payment_success_rate = Gauge(
    'payment_success_rate',
    'Success rate of payment operations',
    ['operation']
)

# Payment processor stats
payment_processor_status = Gauge(
    'payment_processor_status',
    'Status of payment processor (1 = up, 0 = down)',
    ['processor']
)

# Transaction summary
transaction_summary = Summary(
    'payment_transaction_duration_seconds',
    'Time spent processing transactions',
    ['type']
)

def time_database_operation(operation_name):
    """Decorator to time database operations"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            db_operation_duration.labels(operation=operation_name).observe(duration)
            return result
        return wrapper
    return decorator

def observe_payment_operation(operation, status, amount=None):
    """Record a payment operation and update metrics"""
    payment_operations.labels(operation=operation, status=status).inc()
    
    if amount is not None and operation == 'process':
        payment_amount_total.labels(status=status).inc(amount)

def update_processor_status(processor, status):
    """Update payment processor status (1 = up, 0 = down)"""
    payment_processor_status.labels(processor=processor).set(1 if status else 0)

def track_success_rate(operation, total, success):
    """Update the success rate gauge"""
    if total > 0:
        rate = success / total
        payment_success_rate.labels(operation=operation).set(rate)

class RequestLatencyMiddleware:
    """Flask middleware to track request latency"""
    def __init__(self, app):
        self.app = app
        
    def __call__(self, environ, start_response):
        request_method = environ.get('REQUEST_METHOD')
        request_path = environ.get('PATH_INFO')
        
        start_time = time.time()
        
        def custom_start_response(status, headers, exc_info=None):
            status_code = int(status.split(' ')[0])
            request_latency.labels(
                method=request_method,
                endpoint=request_path,
                status_code=status_code
            ).observe(time.time() - start_time)
            return start_response(status, headers, exc_info)
        
        return self.app(environ, custom_start_response) 