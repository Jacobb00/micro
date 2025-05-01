const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Servis versiyonu
const VERSION = '2.2.5';

// Express app oluştur
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Kimlik doğrulama fonksiyonu
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Kimlik doğrulama hatası: Token yok' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Kimlik doğrulama hatası: Geçersiz token' });
  }
};

// Servis proxy endpoint'leri
// User service
app.use('/api/auth', async (req, res) => {
  try {
    const response = await axios.post('http://user-service:3001/api/auth/login', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

app.use('/api/users', async (req, res) => {
  try {
    const response = await axios.post('http://user-service:3001/api/users/register', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

// Product service
app.use('/api/products', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `http://product-service:80/api/products${req.path}`,
      data: req.body,
      headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {}
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

// Cart service
app.use('/api/cart', authenticate, async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `http://cart-service:4003/api/cart${req.path}`,
      data: req.body,
      headers: { Authorization: req.headers.authorization }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

// Payment service
app.use('/api/payments', authenticate, async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `http://payment-service:4004/api/payments${req.path}`,
      data: req.body,
      headers: { Authorization: req.headers.authorization }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

// Order tracking service
app.use('/api/orders', authenticate, async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `http://order-tracking-service:5000/api/orders${req.path}`,
      data: req.body,
      headers: { Authorization: req.headers.authorization }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Sunucu hatası' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    version: VERSION,
    services: {
      user: 'http://user-service:3001',
      product: 'http://product-service:80',
      cart: 'http://cart-service:4003',
      payment: 'http://payment-service:4004',
      orderTracking: 'http://order-tracking-service:5000'
    }
  });
});

// Server başlat
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
