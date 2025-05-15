const User = require('../models/User');
const jwt = require('jsonwebtoken');
const rabbitmq = require('../config/rabbitmq');
const { authRequests, userOperations, timeDbQuery } = require('../config/metrics');

const userController = {
    async register(req, res) {
        try {
            const { email, password, name } = req.body;
            
            const existingUser = await timeDbQuery('find_user', () => 
                User.findOne({ where: { email } })
            );
            
            if (existingUser) {
                authRequests.inc({ type: 'register', status: 'failure' });
                return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda' });
            }

            const user = await timeDbQuery('create_user', () => 
                User.create({
                    email,
                    password,
                    name
                })
            );

            // RabbitMQ'ya yeni kullanıcı mesajı gönder
            await rabbitmq.publishMessage(
                'user_events',
                'user.created',
                {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            );

            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            authRequests.inc({ type: 'register', status: 'success' });
            res.status(201).json({
                message: 'Kullanıcı başarıyla oluşturuldu',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        } catch (error) {
            console.error('Kayıt hatası:', error);
            authRequests.inc({ type: 'register', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await timeDbQuery('find_user', () => 
                User.findOne({ where: { email } })
            );
            
            if (!user) {
                authRequests.inc({ type: 'login', status: 'failure' });
                return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
            }

            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
                authRequests.inc({ type: 'login', status: 'failure' });
                return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // RabbitMQ'ya giriş olayı mesajı gönder
            await rabbitmq.publishMessage(
                'user_events',
                'user.logged_in',
                {
                    id: user.id,
                    email: user.email,
                    timestamp: new Date()
                }
            );

            authRequests.inc({ type: 'login', status: 'success' });
            res.json({
                message: 'Giriş başarılı',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        } catch (error) {
            console.error('Giriş hatası:', error);
            authRequests.inc({ type: 'login', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async getProfile(req, res) {
        try {
            const user = await timeDbQuery('find_user', () => 
                User.findByPk(req.user.id, {
                    attributes: { exclude: ['password'] }
                })
            );
            
            if (!user) {
                userOperations.inc({ operation: 'profile_get', status: 'failure' });
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
            }

            userOperations.inc({ operation: 'profile_get', status: 'success' });
            res.json(user);
        } catch (error) {
            console.error('Profil getirme hatası:', error);
            userOperations.inc({ operation: 'profile_get', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async updateProfile(req, res) {
        try {
            const { name, email } = req.body;
            
            const user = await timeDbQuery('find_user', () => 
                User.findByPk(req.user.id)
            );
            
            if (!user) {
                userOperations.inc({ operation: 'profile_update', status: 'failure' });
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
            }

            await timeDbQuery('update_user', () => 
                user.update({
                    name: name || user.name,
                    email: email || user.email
                })
            );

            // RabbitMQ'ya profil güncelleme mesajı gönder
            await rabbitmq.publishMessage(
                'user_events',
                'user.updated',
                {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            );

            userOperations.inc({ operation: 'profile_update', status: 'success' });
            res.json({
                message: 'Profil başarıyla güncellendi',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        } catch (error) {
            console.error('Profil güncelleme hatası:', error);
            userOperations.inc({ operation: 'profile_update', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    }
};

module.exports = userController; 