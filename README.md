# Mikro Servisler - Veritabanı Bağlantı Kılavuzu

Bu belge, projedeki farklı veritabanlarına nasıl bağlanılacağını ve temel sorguları nasıl yapabileceğinizi gösterir.

## MySQL Bağlantısı

```bash
docker exec -it micro-mysql-1 mysql -u payment_user -ppayment_password payment_db
```

Temel MySQL Komutları:
- `SHOW TABLES;` - Tüm tabloları listeler
- `SELECT * FROM orders;` - Siparişleri gösterir
- `DESCRIBE orders;` - Tablo yapısını gösterir

## MongoDB Bağlantısı

```bash
docker exec -it micro-mongodb-1 mongosh
```

Temel MongoDB Komutları:
- `show dbs` - Kullanılabilir veritabanlarını listeler
- `use admin` - Admin veritabanına geçer
- `show collections` - Koleksiyonları gösterir
- `db.products.find().pretty()` - Ürünleri görüntüler

## PostgreSQL Bağlantısı

```bash
docker exec -it micro-postgres-1 psql -U postgres
```

Temel PostgreSQL Komutları:
- `\l` - Mevcut veritabanlarını listeler
- `\c user_service_db` - Kullanıcı servis veritabanına geçer
- `\dt` - Tabloları listeler
- `SELECT * FROM public."Users";` - Kullanıcıları görüntüler

## Servisler Hakkında

Bu proje, her biri farklı veritabanı kullanan mikroservislerden oluşmaktadır:
- **Kullanıcı Servisi**: PostgreSQL
- **Ürün Servisi**: MongoDB
- **Ödeme Servisi**: MySQL