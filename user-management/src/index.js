const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const redisCache = require('./config/redis');
const User = require('./models/User');
const userController = require('./controllers/userController');
const auth = require('./middleware/auth');
const { register, metricsMiddleware } = require('./config/metrics');

const app = express();

app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const redisHealth = await redisCache.healthCheck();
        res.status(200).json({ 
            status: 'UP', 
            service: 'user-service',
            database: 'connected',
            redis: redisHealth
        });
    } catch (error) {
        res.status(200).json({ 
            status: 'UP', 
            service: 'user-service',
            database: 'connected',
            redis: { status: 'disconnected', message: 'Redis kontrol edilemedi' }
        });
    }
});

// Routes
app.post('/api/auth/register', userController.register);
app.post('/api/auth/login', userController.login);
app.get('/api/auth/profile', auth, userController.getProfile);
app.put('/api/auth/profile', auth, userController.updateProfile);

// Database ve RabbitMQ bağlantıları
const startServer = async () => {
    try {
        // Veritabanı bağlantısı
        await sequelize.authenticate();
        console.log('PostgreSQL bağlantısı başarılı');
        
        // Tabloları senkronize et
        await sequelize.sync({ force: true });
        console.log('Tablolar senkronize edildi');

        // Redis bağlantısı - optional
        try {
            await redisCache.connect();
            console.log('Redis bağlantısı başarılı');
        } catch (error) {
            console.error('Redis bağlantı hatası:', error);
            console.log('Redis olmadan devam ediliyor...');
        }

        // RabbitMQ bağlantısı - optional
        try {
            await rabbitmq.connect();
            
            // Test mesajları için consumer
            await rabbitmq.consumeMessage(
                'user_events',
                'user_service_queue',
                'user.*',
                (message) => {
                    console.log('Alınan mesaj:', message);
                }
            );
            console.log('RabbitMQ bağlantısı başarılı');
        } catch (error) {
            console.error('RabbitMQ bağlantı hatası:', error);
            console.log('RabbitMQ olmadan devam ediliyor...');
        }

        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Sunucu ${PORT} portunda çalışıyor`);
        });
    } catch (error) {
        console.error('Sunucu başlatma hatası:', error);
        process.exit(1);
    }
};

startServer(); 