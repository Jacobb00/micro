const redis = require('redis');

class GatewayRedisCache {
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
                console.error('API Gateway - Redis bağlantı hatası:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('API Gateway - Redis bağlantısı başarılı');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('API Gateway - Redis kullanıma hazır');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('API Gateway - Redis bağlantısı kapandı');
                this.isConnected = false;
            });

            await this.client.connect();
            
        } catch (error) {
            console.error('API Gateway - Redis bağlantı kurulurken hata:', error);
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

    // Rate limiting
    async checkRateLimit(identifier, limit, windowSeconds) {
        if (!this.isConnected) {
            return { allowed: true, remaining: limit };
        }

        try {
            const key = `rate_limit:${identifier}`;
            const current = await this.client.incr(key);
            
            if (current === 1) {
                await this.client.expire(key, windowSeconds);
            }
            
            const remaining = Math.max(0, limit - current);
            const allowed = current <= limit;
            
            return { allowed, remaining, current };
        } catch (error) {
            console.error('API Gateway - Rate limit check hatası:', error);
            return { allowed: true, remaining: limit };
        }
    }

    // API Response caching
    async cacheApiResponse(endpoint, params, response, ttl = 300) {
        const key = `api:${endpoint}:${JSON.stringify(params)}`;
        return await this.set(key, response, ttl);
    }

    async getCachedApiResponse(endpoint, params) {
        const key = `api:${endpoint}:${JSON.stringify(params)}`;
        return await this.get(key);
    }

    // JWT Token blacklist
    async blacklistToken(token, ttl = 86400) {
        const key = `blacklist:${token}`;
        return await this.set(key, { blacklisted: true }, ttl);
    }

    async isTokenBlacklisted(token) {
        const key = `blacklist:${token}`;
        const result = await this.get(key);
        return result !== null;
    }

    // Function caching helper
    async cacheFunction(key, fn, ttl = 3600) {
        const cached = await this.get(key);
        if (cached !== null) {
            console.log(`API Gateway - Cache hit: ${key}`);
            return cached;
        }

        console.log(`API Gateway - Cache miss: ${key}`);
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
const gatewayRedisCache = new GatewayRedisCache();

module.exports = gatewayRedisCache; 