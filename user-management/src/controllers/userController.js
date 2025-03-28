const User = require('../models/User');
const jwt = require('jsonwebtoken');
const rabbitmq = require('../config/rabbitmq');

const userController = {
    async register(req, res) {
        try {
            const { email, password, name } = req.body;
            
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanımda' });
            }

            const user = await User.create({
                email,
                password,
                name
            });

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
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
            }

            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
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
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async getProfile(req, res) {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: { exclude: ['password'] }
            });
            
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
            }

            res.json(user);
        } catch (error) {
            console.error('Profil getirme hatası:', error);
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async updateProfile(req, res) {
        try {
            const { name, email } = req.body;
            
            const user = await User.findByPk(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
            }

            await user.update({
                name: name || user.name,
                email: email || user.email
            });

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
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    }
};

module.exports = userController; 