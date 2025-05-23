import redis
import json
import os
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

class PaymentRedisCache:
    def __init__(self):
        self.client = None
        self.is_connected = False
        
    def connect(self):
        """Redis bağlantısını başlat"""
        try:
            self.client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Bağlantıyı test et
            self.client.ping()
            self.is_connected = True
            logger.info("Payment Service - Redis bağlantısı başarılı")
            
        except Exception as e:
            logger.error(f"Payment Service - Redis bağlantı hatası: {e}")
            self.is_connected = False
            
    def disconnect(self):
        """Redis bağlantısını kapat"""
        if self.client and self.is_connected:
            self.client.close()
            self.is_connected = False
            
    def get(self, key: str) -> Optional[Any]:
        """Cache'den veri al"""
        if not self.is_connected:
            logger.warning("Redis bağlı değil, cache atlanıyor")
            return None
            
        try:
            result = self.client.get(key)
            if result:
                return json.loads(result)
            return None
        except Exception as e:
            logger.error(f"Redis GET hatası: {e}")
            return None
            
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Cache'e veri kaydet"""
        if not self.is_connected:
            logger.warning("Redis bağlı değil, cache atlanıyor")
            return False
            
        try:
            json_value = json.dumps(value, default=str)
            if ttl:
                self.client.setex(key, ttl, json_value)
            else:
                self.client.set(key, json_value)
            return True
        except Exception as e:
            logger.error(f"Redis SET hatası: {e}")
            return False
            
    def delete(self, key: str) -> bool:
        """Cache'den veri sil"""
        if not self.is_connected:
            logger.warning("Redis bağlı değil, cache atlanıyor")
            return False
            
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE hatası: {e}")
            return False
            
    def delete_pattern(self, pattern: str) -> bool:
        """Pattern'e uyan anahtarları sil"""
        if not self.is_connected:
            logger.warning("Redis bağlı değil, cache atlanıyor")
            return False
            
        try:
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE pattern hatası: {e}")
            return False
            
    def cache_function(self, key: str, func, ttl: int = 3600):
        """Function sonucunu cache'le"""
        cached = self.get(key)
        if cached is not None:
            logger.info(f"Cache hit: {key}")
            return cached
            
        logger.info(f"Cache miss: {key}")
        result = func()
        
        if result is not None:
            self.set(key, result, ttl)
            
        return result
        
    # Payment-specific cache methods
    def cache_payment_session(self, user_id: str, session_data: dict, ttl: int = 1800) -> bool:
        """Payment session'ı cache'le"""
        key = f"payment:session:{user_id}"
        return self.set(key, session_data, ttl)
        
    def get_payment_session(self, user_id: str) -> Optional[dict]:
        """Payment session'ı al"""
        key = f"payment:session:{user_id}"
        return self.get(key)
        
    def invalidate_payment_session(self, user_id: str) -> bool:
        """Payment session'ı invalidate et"""
        key = f"payment:session:{user_id}"
        return self.delete(key)
        
    def cache_product_price(self, product_id: str, price: float, ttl: int = 3600) -> bool:
        """Ürün fiyatını cache'le"""
        key = f"product:price:{product_id}"
        return self.set(key, {"price": price, "product_id": product_id}, ttl)
        
    def get_product_price(self, product_id: str) -> Optional[float]:
        """Cache'den ürün fiyatını al"""
        key = f"product:price:{product_id}"
        cached = self.get(key)
        return cached.get("price") if cached else None

    def health_check(self) -> dict:
        """Redis bağlantı durumunu kontrol et"""
        if not self.is_connected:
            return {"status": "disconnected", "message": "Redis bağlantısı yok"}
        
        try:
            self.client.ping()
            return {"status": "healthy", "message": "Redis bağlantısı aktif"}
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}

# Singleton instance
payment_redis_cache = PaymentRedisCache() 