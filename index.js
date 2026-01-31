// WebSimple AI - API Server
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import routes
const slugRoutes = require('./routes/slug');
const generateRoutes = require('./routes/generate');
const checkoutRoutes = require('./routes/checkout');
const deployRoutes = require('./routes/deploy');
const webhookRoutes = require('./routes/webhook');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://websimple.ai'],
    credentials: true
}));
app.use('/api/webhook', webhookRoutes);
app.use(express.json());
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method}     console.log(`${newt(    console.log(`${newk
app.get('/api/health', (req, res) app.get('/api/health', (req, res) s:app.get('/api/health', (req,ewapp.get('/api/health', (req    versapp.get('/ap
    });
});

// Routes
app.use('/api', slugRoutes);
app.use('/api', generateRoutes);
app.use('/api', deployRoutes);
app.use('/api', checkoutRoutes);

// 40// 40// 40// 40// 40// 40// 40// 40// 40// 40/us(// 40// 40// 40// 40// 40// 40// 40// 40// 40// 4han// 40// 40// 40// 4req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
                                     ',
                                      =                    rr.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`WebSimple API running on port ${PORT}`);
    console.log(`Env    console.log(`Env    console.log(`Eev    console.log(`Enmodule.exports = app;
