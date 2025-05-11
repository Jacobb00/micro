# Mikroservis E-Ticaret Projesi

Bu proje, modern bir e-ticaret sistemini mikroservis mimarisi kullanarak oluşturmayı amaçlamaktadır. Sistem, birbirinden bağımsız çalışan ve kendi veritabanlarına sahip mikroservislerden oluşmaktadır.

## Servisler

Proje aşağıdaki mikroservislerden oluşmaktadır:

- **Kullanıcı Yönetimi Servisi (Port: 5002)**
  - Kullanıcı kaydı ve kimlik doğrulama
  - PostgreSQL veritabanı kullanımı
  - JWT tabanlı kimlik doğrulama

- **Ürün Servisi (Port: 5001)**
  - Ürün yönetimi ve kataloğu
  - MongoDB veritabanı kullanımı
  - .NET Core tabanlı

- **Sipariş Takip Servisi (Port: 5000)**
  - Sipariş durumu takibi
  - MongoDB veritabanı kullanımı
  - Node.js tabanlı

- **Sepet Servisi (Port: 4003)**
  - Alışveriş sepeti yönetimi
  - JWT tabanlı kimlik doğrulama

- **Ödeme Servisi (Port: 4004)**
  - Ödeme işlemleri
  - MySQL veritabanı kullanımı
  - Stok güncelleme işlemleri

- **API Gateway (Port: 4001)**
  - Tüm servislerin tek bir noktadan yönetimi
  - İstek yönlendirme ve yük dengeleme

- **Frontend (Port: 3000)**
  - Kullanıcı arayüzü
  - React tabanlı web uygulaması

## Veritabanları

- PostgreSQL (Port: 5432)
- MongoDB (Port: 27017)
- MySQL (Port: 3306)
- RabbitMQ (Port: 5672, Yönetim Paneli: 15672)

## Kurulum

1. Docker ve Docker Compose'un yüklü olduğundan emin olun
2. Projeyi klonlayın
3. Proje dizininde aşağıdaki komutu çalıştırın:

```bash
docker-compose up -d
```

## Test

Entegrasyon testlerini çalıştırmak için:

```bash
npm test
```

## Teknolojiler

- Node.js
- .NET Core
- React
- Docker
- MongoDB
- PostgreSQL
- MySQL
- RabbitMQ
- JWT Authentication

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

MYSQL BAĞLANTISI
MySQL docker exec -it micro-mysql-1 mysql -u payment_user -ppayment_password payment_db

MONGO-DB
docker exec -it micro-mongodb-1 mongosh.... mongodyb ye bağlanır
show dbs = kullanılabilir veritabanları 
use admin = admine geçer
show collections
db.products.find().pretty()


PostgreSQL


docker exec -it micro-postgres-1 psql -U postgres
\l mevcut veritabanlarını listeler
\c user_service_db === bu database e geçer
\dt tabloları kontrol eder
SELECT * FROM public."Users"; güncel usersları gösterir