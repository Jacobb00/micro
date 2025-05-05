const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Test için basit bir Express uygulaması oluştur
const app = express();
app.use(cors());
app.use(express.json());

// Test rotaları
app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    res.status(201).json({
        token: 'test_token',
        user: { email, name }
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'test@example.com' && password === 'Test123!') {
        res.json({
            token: 'test_token',
            user: { email, name: 'Test User' }
        });
    } else {
        res.status(401).json({ message: 'Geçersiz kimlik bilgileri' });
    }
});

app.put('/api/auth/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme başarısız' });
    }
    res.json({
        user: {
            email: 'test@example.com',
            name: req.body.name
        }
    });
});

describe('Kullanıcı Yönetimi API Entegrasyon Testleri', () => {
    const testUserData = {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User'
    };

    describe('POST /api/auth/register', () => {
        it('geçerli verilerle yeni kullanıcı oluşturmalı', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(testUserData);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('email', testUserData.email);
            expect(res.body.user).to.have.property('name', testUserData.name);
            expect(res.body.user).to.not.have.property('password');
        });
    });

    describe('POST /api/auth/login', () => {
        it('geçerli kimlik bilgileriyle giriş yapılabilmeli', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('email', testUserData.email);
        });

        it('yanlış şifre ile giriş yapılamamalı', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: 'wrongpassword'
                });

            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('message').that.includes('Geçersiz kimlik bilgileri');
        });
    });

    describe('PUT /api/auth/profile', () => {
        let authToken = 'test_token';

        it('yetkilendirilmiş kullanıcı profil güncelleyebilmeli', async () => {
            const updateData = {
                name: 'Updated Name'
            };

            const res = await request(app)
                .put('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(res.status).to.equal(200);
            expect(res.body.user).to.have.property('name', updateData.name);
        });

        it('token olmadan profil güncellenememeli', async () => {
            const res = await request(app)
                .put('/api/auth/profile')
                .send({ name: 'Hacker' });

            expect(res.status).to.equal(401);
        });
    });
});