const redis = require('redis');

class RedisCache {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            this.client = redis.createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    connectTimeout: 5000,
                    lazyConnect: true
                },
                retryStrategy: (retries) => {
                    if (retries > 10) {
                        return new Error('Redis yeniden bağlantı denemeleri tükendi');
                    }
                    return Math.min(retries * 100, 3000);
                }
            });

            this.client.on('error', (err) => {
                console.error('Redis bağlantı hatası:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Redis bağlantısı başarılı');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Redis kullanıma hazır');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Redis bağlantısı kapandı');
                this.isConnected = false;
            });

            await this.client.connect();
            
        } catch (error) {
            console.error('Redis bağlantı kurulurken hata:', error);
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
        }
    }

    // Basit get/set operasyonları
    async get(key) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return null;
        }

        try {
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            console.error('Redis GET hatası:', error);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return false;
        }

        try {
            const stringValue = JSON.stringify(value);
            if (ttl) {
                await this.client.setEx(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
            return true;
        } catch (error) {
            console.error('Redis SET hatası:', error);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return false;
        }

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL hatası:', error);
            return false;
        }
    }

    async delPattern(pattern) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return false;
        }

        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            console.error('Redis DEL pattern hatası:', error);
            return false;
        }
    }

    // Function caching decorator
    cache(keyGenerator, ttl = 3600) {
        return (target, propertyName, descriptor) => {
            const method = descriptor.value;

            descriptor.value = async function (...args) {
                const key = typeof keyGenerator === 'function' 
                    ? keyGenerator(...args) 
                    : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

                // Cache'den kontrol et
                const cached = await redisCache.get(key);
                if (cached !== null) {
                    console.log(`Cache hit: ${key}`);
                    return cached;
                }

                // Function'ı çalıştır ve cache'le
                console.log(`Cache miss: ${key}`);
                const result = await method.apply(this, args);
                
                if (result !== null && result !== undefined) {
                    await redisCache.set(key, result, ttl);
                }

                return result;
            };
        };
    }

    // Function caching helper
    async cacheFunction(key, fn, ttl = 3600) {
        const cached = await this.get(key);
        if (cached !== null) {
            console.log(`Cache hit: ${key}`);
            return cached;
        }

        console.log(`Cache miss: ${key}`);
        const result = await fn();
        
        if (result !== null && result !== undefined) {
            await this.set(key, result, ttl);
        }

        return result;
    }

    // Session caching (özellikle user profilleri için)
    async cacheUserSession(userId, userData, ttl = 1800) {
        const key = `user:session:${userId}`;
        return await this.set(key, userData, ttl);
    }

    async getUserSession(userId) {
        const key = `user:session:${userId}`;
        return await this.get(key);
    }

    async invalidateUserSession(userId) {
        const key = `user:session:${userId}`;
        return await this.del(key);
    }

    // Health check
    async healthCheck() {
        if (!this.isConnected) {
            return { status: 'disconnected', message: 'Redis bağlantısı yok' };
        }

        try {
            await this.client.ping();
            return { status: 'healthy', message: 'Redis bağlantısı aktif' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }
}

// Singleton instance
const redisCache = new RedisCache();

module.exports = redisCache; 