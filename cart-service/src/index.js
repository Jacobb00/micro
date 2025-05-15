import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import { register, metricsMiddleware, updateCartItemsMetric } from './metrics.js';

const app = express();
const port = process.env.PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

// Enable CORS for all routes with proper options
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json());
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'cart-service'
    });
});

// Log all requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers));
    if (req.method !== 'GET') {
        console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

// JWT authentication middleware
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        console.log('Authenticating token:', token.substring(0, 15) + '...');
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.sendStatus(403);
            }
            req.user = user;
            console.log('Authenticated user:', user);
            next();
        });
    } else {
        console.error('No authorization header or incorrect format');
        res.sendStatus(401);
    }
}

// In-memory cart storage: { userId: [ { productId, quantity }, ... ] }
const userCarts = {};

// Add routes to handle both direct paths and paths via API gateway
// Add product to cart - Frontend path
app.post('/api/cart/add', authenticateJWT, addToCartHandler);
// Add product to cart - Direct path
app.post('/add', authenticateJWT, addToCartHandler);

// Get user's cart - Frontend path
app.get('/api/cart', authenticateJWT, getCartHandler);
// Get user's cart - Direct path
app.get('/', authenticateJWT, getCartHandler);

// Remove product from cart - Frontend path
app.delete('/api/cart/remove', authenticateJWT, removeFromCartHandler);
// Remove product from cart - Direct path
app.delete('/remove', authenticateJWT, removeFromCartHandler);

// Clear user's cart after successful payment
app.post('/clear', authenticateJWT, clearCartHandler);

// Also add API gateway path
app.post('/api/cart/clear', authenticateJWT, clearCartHandler);

// Handler functions
function addToCartHandler(req, res) {
    const userId = req.user.id;
    const { productId, quantity } = req.body;
    
    console.log(`Adding to cart for user ${userId}: product=${productId}, quantity=${quantity}`);
    
    if (!userId || !productId || !quantity) {
        return res.status(400).json({ error: 'userId, productId, and quantity required' });
    }
    if (!userCarts[userId]) userCarts[userId] = [];
    const existing = userCarts[userId].find(item => item.productId === productId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        userCarts[userId].push({ productId, quantity });
    }
    
    console.log(`Cart for user ${userId} now has ${userCarts[userId].length} items`);
    
    // Update metrics
    updateCartItemsMetric(userId, userCarts[userId].length);
    
    res.status(200).json({ message: 'Product added to cart', cart: userCarts[userId] });
}

function getCartHandler(req, res) {
    const userId = req.user.id;
    
    console.log(`Getting cart for user ${userId}`);
    
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const cart = userCarts[userId] || [];
    
    console.log(`Returning cart with ${cart.length} items for user ${userId}`);
    
    res.status(200).json({ cart: cart });
}

function removeFromCartHandler(req, res) {
    const userId = req.user.id;
    const { productId } = req.body;
    if (!userId || !productId) {
        return res.status(400).json({ error: 'userId and productId required' });
    }
    if (!userCarts[userId]) return res.status(404).json({ error: 'Cart not found' });
    userCarts[userId] = userCarts[userId].filter(item => item.productId !== productId);
    
    // Update metrics
    updateCartItemsMetric(userId, userCarts[userId].length);
    
    res.status(200).json({ message: 'Product removed', cart: userCarts[userId] });
}

function clearCartHandler(req, res) {
    const userId = req.user.id;
    
    console.log(`Clearing cart for user ${userId}`);
    
    if (!userId) return res.status(400).json({ error: 'userId required' });
    
    // Clear the cart
    userCarts[userId] = [];
    
    // Update metrics
    updateCartItemsMetric(userId, 0);
    
    console.log(`Cart cleared for user ${userId}`);
    
    res.status(200).json({ message: 'Cart cleared', cart: [] });
}

// User-specific cart debugging
app.get('/debug/carts', (req, res) => {
    // Return all user carts for debugging
    res.json({ userCarts });
});

// Clear cart for testing
app.post('/debug/clear-cart', authenticateJWT, (req, res) => {
    const userId = req.user.id;
    console.log(`Clearing cart for user ${userId}`);
    userCarts[userId] = [];
    
    // Update metrics
    updateCartItemsMetric(userId, 0);
    
    res.json({ message: 'Cart cleared', cart: [] });
});

app.listen(port, () => {
    console.log(`Cart Service running on port ${port}`);
});
