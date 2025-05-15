const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'api-gateway'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Create a custom counter for HTTP requests
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Create a custom histogram for HTTP request durations
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Register the custom metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

// Create middleware to record metrics
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  // Record the end of the request
  res.on('finish', () => {
    const route = req.originalUrl.split('?')[0]; // Remove query params
    const method = req.method;
    const statusCode = res.statusCode;
    
    // Increment the counter
    httpRequestsTotal.labels(method, route, statusCode).inc();
    
    // Calculate duration
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    
    // Record duration
    httpRequestDurationSeconds.labels(method, route, statusCode).observe(durationInSeconds);
  });
  
  next();
};

module.exports = { register, metricsMiddleware }; 