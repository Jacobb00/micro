# Product Service Testleri

Bu proje, Product Service için üç farklı kategoride test içermektedir:

1. **Unit Testler**: Bağımlılıkları simüle eden mock kullanarak, bileşenleri izole bir şekilde test eder
2. **Integration Testler**: Bileşenlerin birbirleriyle gerçekten etkileşimini test eder (örn. Repository ve veritabanı)
3. **End-to-End (E2E) Testler**: Tüm uygulamanın API seviyesinde, gerçek bir HTTP istemcisi kullanarak test edilmesi

## Gereksinimler

Testleri çalıştırmak için:
- .NET 9.0+ SDK
- Docker (Integration ve E2E testleri için)

## Testleri Çalıştırma

### Tüm Testleri Çalıştırma

```bash
dotnet test
```

### Belirli Bir Test Kategorisini Çalıştırma

```bash
# Sadece Unit Testleri Çalıştır
dotnet test --filter Category=Unit

# Sadece Integration Testleri Çalıştır
dotnet test --filter Category=Integration

# Sadece End-to-End Testleri Çalıştır
dotnet test --filter Category=E2E
```

## Test Yapısı

```
ProductService.Tests/
  ├── UnitTests/                # Unit testler 
  │   ├── Controllers/          # Controller testleri
  │   └── Repositories/         # Repository testleri
  │
  ├── IntegrationTests/         # Integration testler
  │   ├── MongoDbFixture.cs     # MongoDB test container'ı
  │   └── Repositories/         # Repository integration testleri  
  │
  └── EndToEndTests/            # End-to-End testler
      ├── CustomWebApplicationFactory.cs   # Test web uygulaması ve container'lar
      └── ProductApiTests.cs    # API end-to-end testleri
```

## Not

Integration ve End-to-End testleri Docker container'ları kullanır:
- MongoDB testleri için: MongoDB container
- RabbitMQ entegrasyonu için: RabbitMQ container

Bu testler Docker'ın çalışır durumda olmasını gerektirir ve gerçek container'lar oluşturduğundan ilk çalıştırmada biraz zaman alabilir.

## Unit Test Kapsamı

- ProductsController
  - GetProducts
    - Filtresiz tüm ürünleri döndürme
    - Boş ürün listesi döndürme
  - GetProduct
    - Var olan ürünü getirme
    - Var olmayan ürünü getirme
    - Boş ID ile getirme
  - CreateProduct
    - Geçerli verilerle ürün oluşturma
    - DTO'dan entity'ye tüm alanları doğru mapleme
  - UpdateProduct
    - Tüm alanları güncelleme
    - Yalnızca sağlanan alanları güncelleme
    - Var olmayan ürünü güncelleme
    - Güncelleme başarısız olması
  - DeleteProduct
    - Ürünü başarıyla silme
    - Var olmayan ürünü silme
    - Silme başarısız olması
    - Boş ID ile silme
  - UpdateStock
    - Stok başarıyla güncelleme
    - Var olmayan ürün stoğunu güncelleme
    - Stok güncellemesi başarısız olması

- ProductRepository  
  - GetByIdAsync
    - Var olan ürünü getirme
    - Var olmayan ürünü getirme
    - Pasif ürünü getirme
  - GetProductsAsync
    - Filtreleme işlemleri
    - Sıralama işlemleri
    - Sayfalama işlemleri
    - Aşırı değerlerle filtreleme
  - GetAllProductsAsync
    - Tüm aktif ürünleri getirme
    - Hiç ürün olmadığında boş liste döndürme
  - CreateAsync
    - Ürün oluşturma
    - Özel karakterler ve aşırı değerlerle ürün oluşturma
  - UpdateAsync
    - Ürün güncelleme
    - Var olmayan ürünü güncelleme
  - DeleteAsync
    - Ürünü silme (soft delete)
    - Var olmayan ürünü silme
  - UpdateStockAsync
    - Stok artırma
    - Stok azaltma
    - Stoku tam sıfıra indirme
    - Stoku negatife düşürmeye çalışma
  - ProductExistsAsync
    - Var olan ürün kontrolü
    - Pasif ürün kontrolü
    - Var olmayan ürün kontrolü

## Integration Test Kapsamı

- ProductRepository MongoDB entegrasyonu
  - Ürün filtreleme
    - Kategori ile filtreleme
    - Fiyat aralığı ile filtreleme
    - Stok durumu ile filtreleme
    - Birden çok filtre birleştirme
    - Arama terimi ile filtreleme
    - Geçersiz kategori ile filtreleme
  - Sayfalama
    - Doğru sayfa ve sayfa boyutu ile sonuçları getirme
  - Sıralama
    - Fiyata göre artan/azalan sıralama
  - Kategori listeleme
  - CRUD işlemleri
    - Aşırı değerlerle ürün oluşturma
    - Özel karakterlerle ürün oluşturma
  - Stok işlemleri
    - Stok tam sıfıra indirme
    - Stoku negatife düşürmeye çalışma

## End-to-End Test Kapsamı

- Tüm API Endpoint'leri
  - GET /api/products
    - Tüm ürünleri getirme
    - Filtrelerle ürün getirme
    - Fiyat aralığı ile ürün getirme
    - Sıralama ile ürün getirme
  - GET /api/products/{id}
    - Geçerli ID ile ürün getirme
    - Geçersiz ID ile ürün getirme
    - Boş ID ile ürün getirme
  - GET /api/products/categories
    - Kategorileri listeleme
  - POST /api/products
    - Geçerli verilerle ürün oluşturma
    - Aşırı değerlerle ürün oluşturma
    - Eksik gerekli alanlarla ürün oluşturma
  - PUT /api/products/{id}
    - Tüm alanları güncelleme
    - Kısmi alanları güncelleme
    - Var olmayan ürünü güncelleme
  - DELETE /api/products/{id}
    - Ürün silme
    - Var olmayan ürünü silme
  - PATCH /api/products/{id}/stock
    - Stok artırma
    - Stok azaltma (negatife düşürememe)
    - Var olmayan ürün stoğunu güncelleme
  - Paralel işlemler
    - Eşzamanlı stok güncelleme isteklerini doğru işleme

## Edge Case Testleri

Uygulamanın sınır durumlarında nasıl davrandığını test eden özel test durumları eklenmiştir:

1. **Aşırı Değerler**:
   - Çok uzun metinler (ad, açıklama, URL)
   - Çok büyük sayısal değerler (fiyat, stok)
   - Özel karakterler içeren metinler

2. **Stok İşlemleri**:
   - Stok miktarını tam sıfıra indirme
   - Stok miktarını negatife düşürmeye çalışma

3. **Sayfalama ve Filtreleme**:
   - Negatif sayfa numarası
   - Çok büyük sayfa boyutu
   - Var olmayan kategori ile filtreleme

4. **Eşzamanlılık (Concurrency)**:
   - Aynı ürüne paralel stok güncellemeleri

5. **Veri Doğrulama**:
   - Eksik zorunlu alanlarla ürün oluşturma
   - Geçersiz ID'lerle işlemler

6. **Kısmi Güncellemeler**:
   - Sadece belirli alanların güncellendiğini doğrulama 