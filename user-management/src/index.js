const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const User = require('./models/User');
const userController = require('./controllers/userController');
const auth = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

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