# Microservices E-Commerce Platform

Bu proje, e-ticaret platformu için mikroservis mimarisi kullanılarak geliştirilmiş bir uygulamadır.

## Servisler

- **User Service**: Kullanıcı yönetimi ve kimlik doğrulama
- **Product Service**: Ürün yönetimi
- **Order Tracking Service**: Sipariş takibi
- **Cart Service**: Alışveriş sepeti yönetimi
- **Payment Service**: Ödeme işlemleri
- **API Gateway**: Servisler arası iletişim ve yönlendirme
- **Frontend**: React tabanlı web arayüzü

## Monitoring

- **Prometheus**: Metrik toplama
- **Grafana**: Metrik görselleştirme
- **Node Exporter**: Sistem metrikleri
- **AlertManager**: Uyarı yönetimi

## Veritabanları

- **PostgreSQL**: Kullanıcı servisi için
- **MongoDB**: Ürün ve sipariş servisleri için
- **MySQL**: Ödeme servisi için
- **RabbitMQ**: Mesaj kuyruğu
- **Redis**: Cache ve session yönetimi

## Veritabanı Bağlantıları ve Komutlar

### MongoDB Bağlantısı
```bash
# MongoDB'ye bağlanma
docker exec -it micro-mongodb-1 mongosh

# Kullanılabilir veritabanlarını listeleme
show dbs

# Admin veritabanına geçiş
use admin,cart_service_db,ProductsDb order-tracking

# Koleksiyonları listeleme
show collections

# Ürünleri görüntüleme
db.products.find().pretty()

# Siparişleri görüntüleme
db.orders.find().pretty()
```

### PostgreSQL Bağlantısı
```bash
# PostgreSQL'e bağlanma
docker exec -it micro-postgres-1 psql -U postgres

# Mevcut veritabanlarını listeleme
\l

# user_service_db veritabanına geçiş
\c user_service_db

# Tabloları listeleme
\dt

# Kullanıcıları görüntüleme
SELECT * FROM public."Users";
```

### MySQL Bağlantısı
```bash
# MySQL'e bağlanma
docker exec -it micro-mysql-1 mysql -u payment_user -ppayment_password payment_db

# Veritabanlarını listeleme
SHOW DATABASES;

# Tabloları listeleme
SHOW TABLES;

# Siparişleri görüntüleme
SELECT * FROM orders;

# Sipariş detaylarını görüntüleme
SELECT * FROM order_items;

# Örnek sorgular:
# Son 10 siparişi görüntüleme
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

# Tamamlanmış siparişleri görüntüleme
SELECT * FROM orders WHERE status = 'completed';

# Belirli bir kullanıcının siparişlerini görüntüleme
SELECT * FROM orders WHERE user_id = 'id girilecek';
```

### Redis Bağlantısı
```bash
# Redis'e bağlanma
docker exec -it micro-redis-1 redis-cli

# Redis bilgilerini görüntüleme
info

# Tüm anahtarları listeleme
keys *

# Belirli pattern'deki anahtarları listeleme
keys user:*
keys product:*
keys cart:*
keys payment:*

# Anahtar değerini görüntüleme
get user:session:123
get product:price:456

# Cache istatistiklerini görüntüleme
info stats

# Memory kullanımını görüntüleme
info memory

# Veritabanı boyutunu görüntüleme
dbsize

# Belirli TTL'e sahip anahtarları görüntüleme
ttl user:session:123

# Cache'i temizleme (dikkatli kullanın!)
flushdb

# Örnek cache sorguları:
# Kullanıcı session'larını görüntüleme
keys user:session:*

# Product cache'lerini görüntüleme
keys product:*

# Cart cache'lerini görüntüleme
keys cart:*

# Payment session'larını görüntüleme
keys payment:session:*
```

## Environment Değişkenleri

### User Service
- `PORT`: 3001
- `DB_HOST`: postgres
- `DB_PORT`: 5432
- `DB_NAME`: user_service_db
- `DB_USER`: postgres
- `DB_PASSWORD`: postgres
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `RABBITMQ_URL`: amqp://rabbitmq:5672
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### Product Service
- `ASPNETCORE_ENVIRONMENT`: Development
- `MongoDbSettings__ConnectionString`: mongodb://mongodb:27017
- `MongoDbSettings__DatabaseName`: ProductsDb
- `MongoDbSettings__ProductsCollectionName`: Products
- `RabbitMQ__Host`: rabbitmq
- `RabbitMQ__Username`: guest
- `RabbitMQ__Password`: guest
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### Order Tracking Service
- `PORT`: 5000
- `MONGODB_URI`: mongodb://mongodb:27017/order-tracking
- `RABBITMQ_URL`: amqp://guest:guest@rabbitmq:5672
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `NODE_ENV`: development
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### Payment Service
- `PORT`: 4004
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `RABBITMQ_HOST`: rabbitmq
- `RABBITMQ_PORT`: 5672
- `PRODUCT_SERVICE_URL`: http://product-service:80/api/products
- `CART_SERVICE_URL`: http://cart-service:4003
- `MYSQL_HOST`: mysql
- `MYSQL_PORT`: 3306
- `MYSQL_USER`: payment_user
- `MYSQL_PASSWORD`: payment_password
- `MYSQL_DATABASE`: payment_db
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### API Gateway
- `PORT`: 4000
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### Cart Service
- `PORT`: 4003
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `REDIS_HOST`: redis
- `REDIS_PORT`: 6379

### Monitoring
- `GF_SECURITY_ADMIN_PASSWORD`: admin
- `GF_SECURITY_ADMIN_USER`: admin

## Portlar

- Frontend: 3000
- API Gateway: 4001
- User Service: 5002
- Product Service: 5001
- Order Tracking Service: 5000
- Cart Service: 4003
- Payment Service: 4004
- Prometheus: 9090
- Grafana: 3001
- RabbitMQ Management: 15672
- RabbitMQ: 5672
- MongoDB: 27017
- PostgreSQL: 5432
- MySQL: 3306
- Redis: 6379
- Redis Commander: 8081
- Node Exporter: 9100

## Monitoring Erişimi

- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- Redis Commander: http://localhost:8081

## Veritabanı Bağlantıları

### PostgreSQL
- Host: localhost
- Port: 5432
- Database: user_service_db
- Username: postgres
- Password: postgres

### MongoDB
- Host: localhost
- Port: 27017
- Database: ProductsDb, order-tracking

### MySQL
- Host: localhost
- Port: 3306
- Database: payment_db
- Username: payment_user
- Password: payment_password

### Redis
- Host: localhost
- Port: 6379
- Web UI: http://localhost:8081 (Redis Commander)

## Redis Cache Yapısı

### Cache Anahtarları
- **User Sessions**: `user:session:{userId}` (TTL: 30 dakika)
- **User Profiles**: `user:profile:{userId}` (TTL: 30 dakika)
- **Product Data**: `product:{productId}` (TTL: 30 dakika)
- **Product Prices**: `product:price:{productId}` (TTL: 1 saat)
- **Cart Data**: `cart:{userId}` (TTL: 1 saat)
- **Order Data**: `order:{orderId}` (TTL: 1 saat)
- **Payment Sessions**: `payment:session:{userId}` (TTL: 30 dakika)
- **API Responses**: `api:response:{endpoint}:{params}` (TTL: 10 dakika)
- **Rate Limiting**: `rate_limit:{userId}:{endpoint}` (TTL: 1 dakika)

### Cache Stratejileri
- **Cache-Aside**: Veri önce cache'den kontrol edilir, yoksa veritabanından alınıp cache'e konur
- **Write-Through**: Veri hem veritabanına hem cache'e eş zamanlı yazılır
- **Write-Behind**: Veri önce cache'e yazılır, daha sonra asenkron olarak veritabanına yazılır
- **TTL (Time To Live)**: Tüm cache verilerinin otomatik sona erme süreleri vardır



