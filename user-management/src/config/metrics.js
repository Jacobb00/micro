const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'user-service'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const authRequests = new client.Counter({
  name: 'auth_requests_total',
  help: 'Total number of authentication requests',
  labelNames: ['type', 'status']
});

const userOperations = new client.Counter({
  name: 'user_operations_total',
  help: 'Total number of user operations',
  labelNames: ['operation', 'status']
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Register the custom metrics
register.registerMetric(authRequests);
register.registerMetric(userOperations);
register.registerMetric(dbQueryDuration);

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
    if (path.includes('/api/auth/login')) {
      authRequests.inc({ 
        type: 'login', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    } else if (path.includes('/api/auth/register')) {
      authRequests.inc({ 
        type: 'register', 
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
      });
    } else if (path.includes('/api/auth/profile')) {
      if (method === 'GET') {
        userOperations.inc({ 
          operation: 'profile_get', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      } else if (method === 'PUT') {
        userOperations.inc({ 
          operation: 'profile_update', 
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure' 
        });
      }
    }
  });
  
  next();
};

// Function to time database queries
const timeDbQuery = async (queryType, queryFn) => {
  const end = dbQueryDuration.startTimer({ query_type: queryType });
  try {
    return await queryFn();
  } finally {
    end();
  }
};

module.exports = { 
  register, 
  metricsMiddleware, 
  authRequests, 
  userOperations, 
  timeDbQuery 
}; 