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