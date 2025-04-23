import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

app.use(cors());
app.use(bodyParser.json());

// CORS preflight global handler
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// JWT authentication middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
}

// User Service
app.use('/user', createProxyMiddleware({
  target: 'http://user-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/user': '/' },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['access-control-allow-origin'] = undefined;
  }
}));

// Product Service
app.use('/product', createProxyMiddleware({
  target: 'http://product-service:80',
  changeOrigin: true,
  pathRewrite: { '^/product': '/' },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['access-control-allow-origin'] = undefined;
  }
}));

// Cart Service
app.use('/cart', authenticateJWT, createProxyMiddleware({
  target: 'http://cart-service:4003',
  changeOrigin: true,
  pathRewrite: { '^/cart': '/' },
  onProxyReq: (proxyReq, req) => {
    console.log(`Forwarding cart request to cart-service: ${req.method} ${req.url}`);
    if (req.headers['authorization']) {
      proxyReq.setHeader('authorization', req.headers['authorization']);
    }
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['access-control-allow-origin'] = undefined;
  }
}));

// Payment Service
app.use('/payments', authenticateJWT, createProxyMiddleware({
  target: 'http://payment-service:4004',
  changeOrigin: true,
  pathRewrite: { '^/payments': '/api/payments' },
  onProxyReq: (proxyReq, req) => {
    console.log(`Forwarding payment request to payment-service: ${req.method} ${req.url}`);
    if (req.headers['authorization']) {
      proxyReq.setHeader('authorization', req.headers['authorization']);
    }
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['access-control-allow-origin'] = undefined;
  }
}));

app.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});
