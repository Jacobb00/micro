const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock Express uygulamaları oluştur
const userApp = express();
const productApp = express();

userApp.use(cors());
userApp.use(express.json());
productApp.use(cors());
productApp.use(express.json());

// User Service Mock Endpoints
userApp.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    res.status(201).json({
        token: 'test_token',
        user: { id: 'user123', email, name }
    });
});

userApp.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'test@example.com' && password === 'Test123!') {
        res.json({
            token: 'test_token',
            user: { id: 'user123', email, name: 'Test User' }
        });
    } else {
        res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
    }
});

// Product Service Mock Endpoints
let products = [];

productApp.post('/api/products', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme gerekli' });
    }

    const product = {
        id: `prod_${Date.now()}`,
        ...req.body,
        createdBy: 'user123'
    };
    products.push(product);
    res.status(201).json(product);
});

productApp.get('/api/products', (req, res) => {
    res.json(products);
});

productApp.get('/api/products/user/:userId', (req, res) => {
    const userProducts = products.filter(p => p.createdBy === req.params.userId);
    res.json(userProducts);
});

describe('Kullanıcı ve Ürün Servisleri Entegrasyon Testleri', () => {
    const testUser = {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User'
    };

    const testProduct = {
        name: 'Test Ürün',
        description: 'Test ürün açıklaması',
        price: 99.99,
        stock: 100
    };

    let authToken;

    before(async () => {
        // Test öncesi products dizisini temizle
        products = [];
    });

    describe('Kullanıcı Kaydı ve Ürün Yönetimi', () => {
        it('Yeni kullanıcı kaydı yapılabilmeli', async () => {
            const res = await request(userApp)
                .post('/api/auth/register')
                .send(testUser);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('id');
            authToken = res.body.token;
        });

        it('Kayıtlı kullanıcı ürün ekleyebilmeli', async () => {
            const res = await request(productApp)
                .post('/api/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testProduct);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('name', testProduct.name);
            expect(res.body).to.have.property('createdBy', 'user123');
        });

        it('Yetkisiz kullanıcı ürün ekleyememeli', async () => {
            const res = await request(productApp)
                .post('/api/products')
                .send(testProduct);

            expect(res.status).to.equal(401);
        });
    });

    describe('Kullanıcıya Özel Ürün Listeleme', () => {
        before(async () => {
            // Test kullanıcısı için birden fazla ürün ekle
            const products = [
                { ...testProduct, name: 'Ürün 1' },
                { ...testProduct, name: 'Ürün 2' },
                { ...testProduct, name: 'Ürün 3' }
            ];

            for (const product of products) {
                await request(productApp)
                    .post('/api/products')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(product);
            }
        });

        it('Kullanıcı kendi ürünlerini listeleyebilmeli', async () => {
            const res = await request(productApp)
                .get('/api/products/user/user123');

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.equal(4); // Önceki test + 3 yeni ürün
            res.body.forEach(product => {
                expect(product.createdBy).to.equal('user123');
            });
        });

        it('Tüm ürünler listelenebilmeli', async () => {
            const res = await request(productApp)
                .get('/api/products');

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.equal(4);
        });
    });

    describe('Kullanıcı Girişi ve Ürün İşlemleri', () => {
        it('Kullanıcı giriş yapıp token alabilmeli', async () => {
            const res = await request(userApp)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('id', 'user123');
        });

        it('Yanlış kimlik bilgileriyle giriş yapılamamalı', async () => {
            const res = await request(userApp)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                });

            expect(res.status).to.equal(401);
        });
    });
}); 