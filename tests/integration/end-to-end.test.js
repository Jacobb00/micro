const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock Express uygulamaları oluştur
const userApp = express();
const productApp = express();
const cartApp = express();
const orderApp = express();
const paymentApp = express();

// Middleware'leri ekle
[userApp, productApp, cartApp, orderApp, paymentApp].forEach(app => {
    app.use(cors());
    app.use(express.json());
});

// Test verileri
let testData = {
    users: new Map(),
    products: new Map(),
    carts: new Map(),
    orders: new Map(),
    payments: new Map(),
    wallets: new Map()
};

// Test context - test adımları arasında veri paylaşımı için
let context = {};

// Mock endpoint'leri tanımla
function setupMockEndpoints() {
    // User Service Endpoints
    userApp.post('/api/auth/register', (req, res) => {
        const { email, password, name } = req.body;
        const userId = `user_${Date.now()}`;
        const user = { id: userId, email, name };
        testData.users.set(userId, user);
        res.status(201).json({
            token: 'test_token',
            user
        });
    });

    // Product Service Endpoints
    productApp.get('/api/products', (req, res) => {
        const products = Array.from(testData.products.values());
        res.json(products);
    });

    productApp.get('/api/products/:id', (req, res) => {
        const product = testData.products.get(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı' });
        }
        res.json(product);
    });

    // Cart Service Endpoints
    cartApp.post('/api/cart/items', (req, res) => {
        const { productId, quantity } = req.body;
        const product = testData.products.get(productId);
        
        if (quantity > product.stock) {
            return res.status(400).json({ message: 'yetersiz stok' });
        }

        const cartId = `cart_${Date.now()}`;
        const cart = {
            id: cartId,
            items: [{ productId, quantity, price: product.price }],
            totalAmount: product.price * quantity
        };
        testData.carts.set(cartId, cart);
        
        res.status(201).json({ cartId });
    });

    cartApp.get('/api/cart', (req, res) => {
        // Son oluşturulan sepeti dön
        const cart = Array.from(testData.carts.values()).pop();
        res.json(cart);
    });

    // Order Service Endpoints
    orderApp.post('/api/orders', (req, res) => {
        const { cartId } = req.body;
        const cart = testData.carts.get(cartId);
        const orderId = `order_${Date.now()}`;
        const order = {
            id: orderId,
            items: cart.items,
            totalAmount: cart.totalAmount,
            status: 'pending'
        };
        testData.orders.set(orderId, order);
        res.status(201).json(order);
    });

    orderApp.get('/api/orders/:id', (req, res) => {
        const order = testData.orders.get(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Sipariş bulunamadı' });
        }
        res.json(order);
    });

    orderApp.post('/api/orders/:id/cancel', (req, res) => {
        const order = testData.orders.get(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Sipariş bulunamadı' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'Sipariş zaten iptal edilmiş' });
        }

        if (order.status !== 'paid') {
            return res.status(400).json({ message: 'Sadece ödemesi yapılmış siparişler iptal edilebilir' });
        }

        // Stok iadesi
        order.items.forEach(item => {
            const product = testData.products.get(item.productId);
            if (product) {
                product.stock += item.quantity;
            }
        });

        // Ödeme iadesi
        const wallet = testData.wallets.get('user123');
        wallet.balance += order.totalAmount;

        // Sipariş durumunu güncelle
        order.status = 'cancelled';
        
        res.json(order);
    });

    // Payment Service Endpoints
    paymentApp.post('/api/wallet/deposit', (req, res) => {
        const { amount } = req.body;
        const wallet = testData.wallets.get('user123');
        wallet.balance += amount;
        res.json({ balance: wallet.balance });
    });

    paymentApp.get('/api/wallet/balance', (req, res) => {
        const wallet = testData.wallets.get('user123');
        res.json({ balance: wallet.balance });
    });

    paymentApp.post('/api/payments/process', (req, res) => {
        const { orderId, amount } = req.body;
        const wallet = testData.wallets.get('user123');
        
        if (wallet.balance < amount) {
            return res.status(400).json({ message: 'Yetersiz bakiye' });
        }

        wallet.balance -= amount;
        const order = testData.orders.get(orderId);
        order.status = 'paid';

        const payment = {
            id: `pay_${Date.now()}`,
            orderId,
            amount,
            status: 'completed'
        };
        testData.payments.set(payment.id, payment);

        res.status(201).json(payment);
    });
}

describe('E-Ticaret Uçtan Uca Testler', () => {
    before(() => {
        setupTestData();
        setupMockEndpoints();
    });

    describe('Ürün Satın Alma Süreci', () => {
        it('Başarılı sipariş süreci', async () => {
            // 1. Kullanıcı Kaydı
            const registerRes = await request(userApp)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!',
                    name: 'Test User'
                });

            expect(registerRes.status).to.equal(201);
            expect(registerRes.body).to.have.property('token');
            context.authToken = registerRes.body.token;
            context.userId = registerRes.body.user.id;

            // 2. Cüzdana Para Yükleme
            const depositRes = await request(paymentApp)
                .post('/api/wallet/deposit')
                .set('Authorization', `Bearer ${context.authToken}`)
                .send({ amount: 2000 });

            expect(depositRes.status).to.equal(200);
            expect(depositRes.body.balance).to.equal(2000);

            // 3. Ürünleri Listeleme
            const productsRes = await request(productApp)
                .get('/api/products');

            expect(productsRes.status).to.equal(200);
            expect(productsRes.body).to.be.an('array').that.is.not.empty;
            context.productId = productsRes.body[0].id;

            // 4. Sepete Ürün Ekleme
            const addToCartRes = await request(cartApp)
                .post('/api/cart/items')
                .set('Authorization', `Bearer ${context.authToken}`)
                .send({
                    productId: context.productId,
                    quantity: 10
                });

            expect(addToCartRes.status).to.equal(201);
            context.cartId = addToCartRes.body.cartId;

            // 5. Sepeti Kontrol Etme
            const cartRes = await request(cartApp)
                .get('/api/cart')
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(cartRes.status).to.equal(200);
            expect(cartRes.body.items).to.have.lengthOf(1);
            expect(cartRes.body.items[0].quantity).to.equal(10);
            context.orderAmount = cartRes.body.totalAmount;

            // 6. Sipariş Oluşturma
            const orderRes = await request(orderApp)
                .post('/api/orders')
                .set('Authorization', `Bearer ${context.authToken}`)
                .send({ cartId: context.cartId });

            expect(orderRes.status).to.equal(201);
            context.orderId = orderRes.body.id;

            // 7. Ödeme Yapma
            const paymentRes = await request(paymentApp)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${context.authToken}`)
                .send({
                    orderId: context.orderId,
                    amount: context.orderAmount
                });

            expect(paymentRes.status).to.equal(201);
            expect(paymentRes.body.status).to.equal('completed');

            // 8. Sipariş Durumu Kontrolü
            const orderStatusRes = await request(orderApp)
                .get(`/api/orders/${context.orderId}`)
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(orderStatusRes.status).to.equal(200);
            expect(orderStatusRes.body.status).to.equal('paid');
            expect(orderStatusRes.body.items).to.have.lengthOf(1);
            expect(orderStatusRes.body.totalAmount).to.equal(context.orderAmount);
        });
    });

    describe('Stok ve İptal Senaryoları', () => {
        it('Stok yetersizliği kontrolü', async () => {
            const stockRes = await request(productApp)
                .get(`/api/products/${context.productId}`);

            expect(stockRes.status).to.equal(200);
            const currentStock = stockRes.body.stock;

            const addToCartRes = await request(cartApp)
                .post('/api/cart/items')
                .set('Authorization', `Bearer ${context.authToken}`)
                .send({
                    productId: context.productId,
                    quantity: currentStock + 1
                });

            expect(addToCartRes.status).to.equal(400);
            expect(addToCartRes.body.message).to.include('yetersiz stok');
        });

        it('Sipariş iptal süreci', async () => {
            // İptal öncesi bakiye kontrolü
            const balanceBeforeRes = await request(paymentApp)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${context.authToken}`);
            const balanceBefore = balanceBeforeRes.body.balance;

            // Siparişi iptal et
            const cancelRes = await request(orderApp)
                .post(`/api/orders/${context.orderId}/cancel`)
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(cancelRes.status).to.equal(200);
            expect(cancelRes.body.status).to.equal('cancelled');

            // İade sonrası bakiye kontrolü
            const balanceAfterRes = await request(paymentApp)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(balanceAfterRes.body.balance).to.be.greaterThan(balanceBefore);

            // Stok güncellemesi kontrolü
            const stockAfterRes = await request(productApp)
                .get(`/api/products/${context.productId}`);

            expect(stockAfterRes.body.stock).to.equal(stockAfterRes.body.initialStock);
        });
    });

    describe('Sipariş İptal Testleri', () => {
        let orderId, initialBalance, productStock;

        beforeEach(async () => {
            // Test öncesi sipariş oluştur ve öde
            const registerRes = await request(userApp)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!',
                    name: 'Test User'
                });

            const authToken = registerRes.body.token;

            // Para yükle
            await request(paymentApp)
                .post('/api/wallet/deposit')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ amount: 2000 });

            // Ürün seç
            const productsRes = await request(productApp)
                .get('/api/products');
            const productId = productsRes.body[0].id;
            productStock = productsRes.body[0].stock;

            // Sepete ekle
            const addToCartRes = await request(cartApp)
                .post('/api/cart/items')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    productId: productId,
                    quantity: 2
                });

            // Sipariş oluştur
            const orderRes = await request(orderApp)
                .post('/api/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ cartId: addToCartRes.body.cartId });

            orderId = orderRes.body.id;

            // Ödeme yap
            await request(paymentApp)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: orderId,
                    amount: orderRes.body.totalAmount
                });

            // Başlangıç bakiyesini kaydet
            const balanceRes = await request(paymentApp)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${authToken}`);
            initialBalance = balanceRes.body.balance;
        });

        it('Başarılı sipariş iptali', async () => {
            const cancelRes = await request(orderApp)
                .post(`/api/orders/${orderId}/cancel`)
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(cancelRes.status).to.equal(200);
            expect(cancelRes.body.status).to.equal('cancelled');

            // Bakiye kontrolü
            const balanceRes = await request(paymentApp)
                .get('/api/wallet/balance')
                .set('Authorization', `Bearer ${context.authToken}`);
            expect(balanceRes.body.balance).to.be.greaterThan(initialBalance);

            // Stok kontrolü
            const productRes = await request(productApp)
                .get('/api/products');
            const updatedProduct = productRes.body[0];
            expect(updatedProduct.stock).to.equal(productStock);
        });

        it('Var olmayan sipariş iptali', async () => {
            const cancelRes = await request(orderApp)
                .post('/api/orders/nonexistent-order/cancel')
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(cancelRes.status).to.equal(404);
            expect(cancelRes.body.message).to.include('Sipariş bulunamadı');
        });

        it('Zaten iptal edilmiş sipariş', async () => {
            // İlk iptal
            await request(orderApp)
                .post(`/api/orders/${orderId}/cancel`)
                .set('Authorization', `Bearer ${context.authToken}`);

            // İkinci iptal denemesi
            const cancelRes = await request(orderApp)
                .post(`/api/orders/${orderId}/cancel`)
                .set('Authorization', `Bearer ${context.authToken}`);

            expect(cancelRes.status).to.equal(400);
            expect(cancelRes.body.message).to.include('Sipariş zaten iptal edilmiş');
        });
    });
});

// Test verilerini hazırla
function setupTestData() {
    // Örnek ürün
    const product = {
        id: 'prod1',
        name: 'Test Ürün',
        price: 100,
        stock: 50,
        initialStock: 50
    };
    testData.products.set(product.id, product);

    // Örnek cüzdan
    testData.wallets.set('user123', {
        balance: 0
    });
} 