import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'cart-service'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const cartOperations = new client.Counter({
  name: 'cart_operations_total',
  help: 'Total number of cart operations',
  labelNames: ['operation', 'status']
});

const cartItems = new client.Gauge({
  name: 'cart_items_count',
  help: 'Number of items in carts',
  labelNames: ['user_id']
});

// Register the custom metrics
register.registerMetric(cartOperations);
register.registerMetric(cartItems);

// Metrics middleware
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    
    const path = req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    
    // Track specific operations based on path
    if (path.includes('/add') || path.includes('/api/cart/add')) {
      cartOperations.inc({ 
        operation: 'add_item', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    } else if (path.includes('/remove') || path.includes('/api/cart/remove')) {
      cartOperations.inc({ 
        operation: 'remove_item', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    } else if ((path === '/' || path === '/api/cart') && method === 'GET') {
      cartOperations.inc({ 
        operation: 'get_cart', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    } else if (path.includes('/clear') || path.includes('/api/cart/clear')) {
      cartOperations.inc({ 
        operation: 'clear_cart', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    }
  });
  
  next();
};

// Function to update cart items count
const updateCartItemsMetric = (userId, itemCount) => {
  cartItems.labels(userId).set(itemCount);
};

export { register, metricsMiddleware, cartOperations, updateCartItemsMetric }; 