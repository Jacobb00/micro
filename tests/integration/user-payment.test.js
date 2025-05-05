const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock Express uygulamaları oluştur
const userApp = express();
const paymentApp = express();

userApp.use(cors());
userApp.use(express.json());
paymentApp.use(cors());
paymentApp.use(express.json());

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

// Payment Service Mock Endpoints
let payments = [];
let wallets = {
    'user123': { balance: 1000 }
};

paymentApp.post('/api/payments/process', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme gerekli' });
    }

    const { amount, orderId } = req.body;
    const userId = 'user123'; // Token'dan alınacak

    // Cüzdan kontrolü
    const wallet = wallets[userId];
    if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: 'Yetersiz bakiye' });
    }

    // Ödeme işlemi
    const payment = {
        id: `pay_${Date.now()}`,
        userId,
        orderId,
        amount,
        status: 'completed',
        createdAt: new Date()
    };

    // Cüzdan bakiyesini güncelle
    wallet.balance -= amount;
    payments.push(payment);

    res.status(201).json(payment);
});

paymentApp.get('/api/payments/user/:userId', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme gerekli' });
    }

    const userPayments = payments.filter(p => p.userId === req.params.userId);
    res.json(userPayments);
});

paymentApp.get('/api/wallet/:userId/balance', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme gerekli' });
    }

    const wallet = wallets[req.params.userId];
    if (!wallet) {
        return res.status(404).json({ message: 'Cüzdan bulunamadı' });
    }

    res.json({ balance: wallet.balance });
});

paymentApp.post('/api/wallet/deposit', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yetkilendirme gerekli' });
    }

    const { amount } = req.body;
    const userId = 'user123'; // Token'dan alınacak

    if (!wallets[userId]) {
        wallets[userId] = { balance: 0 };
    }

    wallets[userId].balance += amount;

    res.json({ balance: wallets[userId].balance });
});

describe('Kullanıcı ve Ödeme Servisleri Entegrasyon Testleri', () => {
    const testUser = {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User'
    };

    const testOrder = {
        id: 'order123',
        amount: 500
    };

    let authToken;

    before(async () => {
        // Test öncesi verileri sıfırla
        payments = [];
        wallets = {
            'user123': { balance: 1000 }
        };
    });

    describe('Kullanıcı Kaydı ve Ödeme İşlemleri', () => {
        it('Yeni kullanıcı kaydı yapılabilmeli', async () => {
            const res = await request(userApp)
                .post('/api/auth/register')
                .send(testUser);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('id');
            authToken = res.body.token;
        });

        it('Kullanıcı cüzdan bakiyesini görüntüleyebilmeli', async () => {
            const res = await request(paymentApp)
                .get('/api/wallet/user123/balance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('balance', 1000);
        });

        it('Kullanıcı para yatırabilmeli', async () => {
            const depositAmount = 500;
            const res = await request(paymentApp)
                .post('/api/wallet/deposit')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ amount: depositAmount });

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('balance', 1500);
        });
    });

    describe('Ödeme İşlemleri', () => {
        it('Yeterli bakiye ile ödeme yapılabilmeli', async () => {
            const res = await request(paymentApp)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testOrder);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('status', 'completed');
            expect(res.body).to.have.property('amount', testOrder.amount);
        });

        it('Yetersiz bakiye ile ödeme yapılamamalı', async () => {
            const largeOrder = {
                id: 'order124',
                amount: 2000 // Mevcut bakiyeden fazla
            };

            const res = await request(paymentApp)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send(largeOrder);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('message', 'Yetersiz bakiye');
        });

        it('Kullanıcı ödeme geçmişini görüntüleyebilmeli', async () => {
            const res = await request(paymentApp)
                .get('/api/payments/user/user123')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.equal(1);
            expect(res.body[0]).to.have.property('amount', testOrder.amount);
            expect(res.body[0]).to.have.property('status', 'completed');
        });
    });

    describe('Yetkilendirme Kontrolleri', () => {
        it('Token olmadan ödeme yapılamamalı', async () => {
            const res = await request(paymentApp)
                .post('/api/payments/process')
                .send(testOrder);

            expect(res.status).to.equal(401);
        });

        it('Token olmadan bakiye görüntülenememeli', async () => {
            const res = await request(paymentApp)
                .get('/api/wallet/user123/balance');

            expect(res.status).to.equal(401);
        });

        it('Token olmadan para yatırılamamalı', async () => {
            const res = await request(paymentApp)
                .post('/api/wallet/deposit')
                .send({ amount: 100 });

            expect(res.status).to.equal(401);
        });
    });
}); 