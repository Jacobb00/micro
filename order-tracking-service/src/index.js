require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const connectDB = require('./config/db');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { setupConsumers } = require('./services/messageConsumer');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./config/logger');
const { register, metricsMiddleware } = require('./config/metrics');
const orderRedisCache = require('./redis');

// Import routes
const orderRoutes = require('./routes/orderRoutes');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error(`Error generating metrics: ${err.message}`);
    res.status(500).end(err);
  }
});

// API Routes
app.use('/api/orders', orderRoutes);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisHealth = await orderRedisCache.healthCheck();
    res.status(200).json({ 
      status: 'OK', 
      service: 'order-tracking-service',
      redis: redisHealth
    });
  } catch (error) {
    res.status(200).json({ 
      status: 'OK', 
      service: 'order-tracking-service',
      redis: { status: 'disconnected', message: 'Redis kontrol edilemedi' }
    });
  }
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Connect to Redis - optional
    try {
      await orderRedisCache.connect();
      logger.info('Redis bağlantısı başarılı');
    } catch (error) {
      logger.error(`Redis bağlantı hatası: ${error.message}`);
      logger.info('Redis olmadan devam ediliyor...');
    }
    
    // Connect to RabbitMQ
    await connectRabbitMQ();
    
    // Setup message consumers
    await setupConsumers();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Order Tracking Service running on port ${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

startServer(); 