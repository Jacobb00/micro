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

## Veritabanı Bağlantıları ve Komutlar

### MongoDB Bağlantısı
```bash
# MongoDB'ye bağlanma
docker exec -it micro-mongodb-1 mongosh

# Kullanılabilir veritabanlarını listeleme
show dbs

# Admin veritabanına geçiş
use admin

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
SELECT * FROM orders WHERE user_id = '3f94c78a-f80c-4113-b04e-d141830dfb85';
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

### Product Service
- `ASPNETCORE_ENVIRONMENT`: Development
- `MongoDbSettings__ConnectionString`: mongodb://mongodb:27017
- `MongoDbSettings__DatabaseName`: ProductsDb
- `MongoDbSettings__ProductsCollectionName`: Products
- `RabbitMQ__Host`: rabbitmq
- `RabbitMQ__Username`: guest
- `RabbitMQ__Password`: guest

### Order Tracking Service
- `PORT`: 5000
- `MONGODB_URI`: mongodb://mongodb:27017/order-tracking
- `RABBITMQ_URL`: amqp://guest:guest@rabbitmq:5672
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH
- `NODE_ENV`: development

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

### API Gateway
- `PORT`: 4000
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH

### Cart Service
- `PORT`: 4003
- `JWT_SECRET`: V58XuK9zPq4sDwjEbCfa7hJLgMrTn2YH

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
- Node Exporter: 9100

## Monitoring Erişimi

- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672 (guest/guest)

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

## Güvenlik Notları

1. Production ortamında JWT_SECRET değerini değiştirin
2. Veritabanı şifrelerini güçlü şifrelerle değiştirin
3. RabbitMQ kullanıcı adı ve şifresini değiştirin
4. Grafana admin şifresini değiştirin

## Sorun Giderme

1. Servisler başlamazsa:
   - Docker loglarını kontrol edin: `docker logs <container-name>`
   - Environment değişkenlerinin doğru ayarlandığından emin olun
   - Port çakışmalarını kontrol edin

2. Veritabanı bağlantı sorunları:
   - Veritabanı servislerinin çalıştığından emin olun
   - Bağlantı bilgilerini kontrol edin
   - Firewall ayarlarını kontrol edin

3. Monitoring sorunları:
   - Prometheus ve Grafana servislerinin çalıştığından emin olun
   - Metrik endpoint'lerinin erişilebilir olduğunu kontrol edin
   - Grafana datasource ayarlarını kontrol edin

## Lisans

MIT


