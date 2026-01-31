const express = require('express');
const router = express.Router();
const { deploySite } = require('../services/cloudflare');
const { compileWebsite } = require('../services/compile');
const db = require('../db/queries');

// Deploy a site after payment
router.post('/deploy/:slug', async (req, res) => {
    const { slug } = req.params;
    
    try {
        // Get site data from database
        const site = await db.getReservation(slug);
        
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }
        
        // Compile the HTML
        const html = compileWebsite(site.template_id, site.content);
        
        // Deploy to Cloudflare
        const deployment = await deploySite(slug, html);
        
        if (deployment.success) {
            res.json({
                success: true,
                url: deployment.url,
                message: 'Site deployed successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: deployment.error
            });
        }
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;