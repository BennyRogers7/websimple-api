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
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Routes
app.use('/api', slugRoutes);
app.use('/api', generateRoutes);
app.use('/api', deployRoutes);
app.use('/api', checkoutRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`WebSimple API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;