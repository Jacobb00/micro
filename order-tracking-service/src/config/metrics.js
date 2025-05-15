const promClient = require('prom-client');
const logger = require('./logger');

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'order-tracking-service'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const orderOperations = new promClient.Counter({
  name: 'order_operations_total',
  help: 'Total number of order operations',
  labelNames: ['operation', 'status']
});

const orderStatusCount = new promClient.Gauge({
  name: 'order_status_count',
  help: 'Count of orders by status',
  labelNames: ['status']
});

// Message processing metrics
const messageProcessing = new promClient.Counter({
  name: 'order_message_processing_total',
  help: 'Total number of order-related messages processed',
  labelNames: ['type', 'status']
});

const dbOperationDuration = new promClient.Histogram({
  name: 'order_db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Register the custom metrics
register.registerMetric(orderOperations);
register.registerMetric(orderStatusCount);
register.registerMetric(messageProcessing);
register.registerMetric(dbOperationDuration);

// Metrics middleware
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    
    const path = req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    
    // Track specific operations based on path and method
    if (path.startsWith('/api/orders')) {
      if (method === 'GET' && !path.includes('/:id')) {
        orderOperations.inc({ 
          operation: 'list_orders', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      } else if (method === 'GET' && path.includes('/:id')) {
        orderOperations.inc({ 
          operation: 'get_order', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      } else if (method === 'POST') {
        orderOperations.inc({ 
          operation: 'create_order', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      } else if (method === 'PATCH' || method === 'PUT') {
        orderOperations.inc({ 
          operation: 'update_order', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      }
    }
  });
  
  next();
};

// Function to time database operations
const timeDbOperation = async (operation, operationFn) => {
  const end = dbOperationDuration.startTimer({ operation });
  try {
    return await operationFn();
  } catch (error) {
    logger.error(`Database operation ${operation} failed: ${error.message}`);
    throw error;
  } finally {
    end();
  }
};

// Function to record message processing
const recordMessageProcessing = (type, status) => {
  messageProcessing.inc({ type, status });
};

// Function to update order status counts
const updateOrderStatusCount = async (statuses) => {
  for (const [status, count] of Object.entries(statuses)) {
    orderStatusCount.set({ status }, count);
  }
};

module.exports = {
  register,
  metricsMiddleware,
  orderOperations,
  timeDbOperation,
  recordMessageProcessing,
  updateOrderStatusCount
}; 