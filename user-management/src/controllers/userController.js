const User = require('../models/User');
const jwt = require('jsonwebtoken');
const rabbitmq = require('../config/rabbitmq');
const redisCache = require('../config/redis');
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

            // Önce cache'den kullanıcıyı kontrol et
            const cacheKey = `user:login:${email}`;
            let user = await redisCache.get(cacheKey);
            
            if (!user) {
                user = await timeDbQuery('find_user', () => 
                    User.findOne({ where: { email } })
                );
                
                if (user) {
                    // Kullanıcıyı cache'le (5 dakika)
                    await redisCache.set(cacheKey, user, 300);
                }
            } else {
                console.log(`Cache hit for user login: ${email}`);
                // Cache'den gelen data için User instance oluştur
                user = User.build(user, { isNewRecord: false });
            }
            
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

            // User session'ı cache'le
            const userSessionData = {
                id: user.id,
                email: user.email,
                name: user.name
            };
            await redisCache.cacheUserSession(user.id, userSessionData);

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
                user: userSessionData
            });
        } catch (error) {
            console.error('Giriş hatası:', error);
            authRequests.inc({ type: 'login', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    },

    async getProfile(req, res) {
        try {
            // Önce session cache'den kontrol et
            let user = await redisCache.getUserSession(req.user.id);
            
            if (!user) {
                console.log(`Cache miss for user profile: ${req.user.id}`);
                user = await timeDbQuery('find_user', () => 
                    User.findByPk(req.user.id, {
                        attributes: { exclude: ['password'] }
                    })
                );
                
                if (user) {
                    // User session'ı cache'le
                    const userSessionData = {
                        id: user.id,
                        email: user.email,
                        name: user.name
                    };
                    await redisCache.cacheUserSession(user.id, userSessionData);
                    user = userSessionData;
                }
            } else {
                console.log(`Cache hit for user profile: ${req.user.id}`);
            }
            
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

            // Cache'i invalidate et
            await redisCache.invalidateUserSession(user.id);
            
            // Login cache'ini de temizle (eğer email değiştiyse)
            if (email && email !== user.email) {
                await redisCache.del(`user:login:${user.email}`);
                await redisCache.del(`user:login:${email}`);
            }

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

            const updatedUserData = {
                id: user.id,
                email: user.email,
                name: user.name
            };

            // Güncellenmiş user session'ı cache'le
            await redisCache.cacheUserSession(user.id, updatedUserData);

            userOperations.inc({ operation: 'profile_update', status: 'success' });
            res.json({
                message: 'Profil başarıyla güncellendi',
                user: updatedUserData
            });
        } catch (error) {
            console.error('Profil güncelleme hatası:', error);
            userOperations.inc({ operation: 'profile_update', status: 'error' });
            res.status(500).json({ message: 'Sunucu hatası' });
        }
    }
};

module.exports = userController; 