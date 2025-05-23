import redis from 'redis';

class CartRedisCache {
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
                console.log('Cart Service - Redis bağlantısı başarılı');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Cart Service - Redis kullanıma hazır');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Cart Service - Redis bağlantısı kapandı');
                this.isConnected = false;
            });

            await this.client.connect();
            
        } catch (error) {
            console.error('Cart Service - Redis bağlantı kurulurken hata:', error);
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
        }
    }

    // Cart-specific caching methods
    async getCart(userId) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return null;
        }

        try {
            const key = `cart:${userId}`;
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            console.error('Redis GET hatası:', error);
            return null;
        }
    }

    async setCart(userId, cartData, ttl = 3600) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return false;
        }

        try {
            const key = `cart:${userId}`;
            const stringValue = JSON.stringify(cartData);
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

    async deleteCart(userId) {
        if (!this.isConnected) {
            console.log('Redis bağlı değil, cache atlanıyor');
            return false;
        }

        try {
            const key = `cart:${userId}`;
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL hatası:', error);
            return false;
        }
    }

    // Generic cache methods
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

    // Cart session management
    async cacheCartSession(userId, sessionData, ttl = 1800) {
        const key = `cart:session:${userId}`;
        return await this.set(key, sessionData, ttl);
    }

    async getCartSession(userId) {
        const key = `cart:session:${userId}`;
        return await this.get(key);
    }

    async invalidateCartSession(userId) {
        const key = `cart:session:${userId}`;
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
const cartRedisCache = new CartRedisCache();

export default cartRedisCache; 