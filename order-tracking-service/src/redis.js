const redis = require('redis');

class OrderRedisCache {
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
                console.error('Order Service - Redis bağlantı hatası:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Order Service - Redis bağlantısı başarılı');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Order Service - Redis kullanıma hazır');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Order Service - Redis bağlantısı kapandı');
                this.isConnected = false;
            });

            await this.client.connect();
            
        } catch (error) {
            console.error('Order Service - Redis bağlantı kurulurken hata:', error);
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
        }
    }

    // Basic cache operations
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

    // Order-specific cache methods
    async cacheOrder(orderId, orderData, ttl = 3600) {
        const key = `order:${orderId}`;
        return await this.set(key, orderData, ttl);
    }

    async getOrder(orderId) {
        const key = `order:${orderId}`;
        return await this.get(key);
    }

    async deleteOrder(orderId) {
        const key = `order:${orderId}`;
        return await this.del(key);
    }

    async cacheOrderStatus(orderId, status, ttl = 1800) {
        const key = `order:status:${orderId}`;
        return await this.set(key, { status, timestamp: new Date() }, ttl);
    }

    async getOrderStatus(orderId) {
        const key = `order:status:${orderId}`;
        return await this.get(key);
    }

    // Function caching helper
    async cacheFunction(key, fn, ttl = 3600) {
        const cached = await this.get(key);
        if (cached !== null) {
            console.log(`Order Service - Cache hit: ${key}`);
            return cached;
        }

        console.log(`Order Service - Cache miss: ${key}`);
        const result = await fn();
        
        if (result !== null && result !== undefined) {
            await this.set(key, result, ttl);
        }

        return result;
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
const orderRedisCache = new OrderRedisCache();

module.exports = orderRedisCache; 