// WebSimple AI - Slug Availability Route
const express = require('express');
const router = express.Router();
const { isSlugAvailable, reserveSlug, extendReservation } = require('../db/queries');

/**
 * Sanitize and validate slug
 * - lowercase
 * - alphanumeric and hyphens only
 * - no leading/trailing hyphens
 * - 3-50 characters
 */
function sanitizeSlug(input) {
    if (!input || typeof input !== 'string') return null;
    
    let slug = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')  // Replace invalid chars with hyphens
        .replace(/-+/g, '-')           // Collapse multiple hyphens
        .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
    
    if (slug.length < 3 || slug.length > 50) return null;
    
    return slug;
}

/**
 * POST /api/check-slug
 * Check if a slug is available and optionally reserve it
 * 
 * Body: {
 *   slug: "smith-plumbing",
 *   reserve: true,          // optional, default false
 *   email: "user@email.com", // optional, for reservation
 *   sessionId: "abc123"      // optional, for reservation
 * }
 */
router.post('/check-slug', async (req, res) => {
    try {
        const { slug: rawSlug, reserve = false, email, sessionId } = req.body;
        
        // Sanitize the slug
        const slug = sanitizeSlug(rawSlug);
        
        if (!slug) {
            return res.status(400).json({
                available: false,
                error: 'Invalid slug. Must be 3-50 characters, letters, numbers, and hyphens only.',
                slug: null,
                url: null
            });
        }
        
        // Check availability
        const available = await isSlugAvailable(slug);
        
        const response = {
            available,
            slug,
            url: `${slug}.llc-us.com`,
            reserved: false
        };
        
        // If available and reserve requested, reserve it
        if (available && reserve) {
            const reserved = await reserveSlug(slug, email, sessionId);
            response.reserved = reserved;
            response.expiresIn = '30 minutes';
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('Check slug error:', error);
        res.status(500).json({
            available: false,
            error: 'Failed to check availability',
            message: error.message
        });
    }
});

/**
 * POST /api/extend-reservation
 * Extend a slug reservation (call while user is active in form)
 * 
 * Body: {
 *   slug: "smith-plumbing",
 *   sessionId: "abc123"
 * }
 */
router.post('/extend-reservation', async (req, res) => {
    try {
        const { slug: rawSlug, sessionId } = req.body;
        
        const slug = sanitizeSlug(rawSlug);
        
        if (!slug || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing slug or sessionId'
            });
        }
        
        const extended = await extendReservation(slug, sessionId);
        
        res.json({
            success: extended,
            slug,
            message: extended ? 'Reservation extended' : 'Reservation not found or expired'
        });
        
    } catch (error) {
        console.error('Extend reservation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to extend reservation',
            message: error.message
        });
    }
});

/**
 * GET /api/suggest-slugs/:name
 * Suggest alternative slugs if preferred one is taken
 */
router.get('/suggest-slugs/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const baseSlug = sanitizeSlug(name);
        
        if (!baseSlug) {
            return res.status(400).json({
                error: 'Invalid name provided'
            });
        }
        
        const suggestions = [];
        const variations = [
            baseSlug,
            `${baseSlug}-co`,
            `${baseSlug}-llc`,
            `the-${baseSlug}`,
            `${baseSlug}-services`,
            `${baseSlug}-pro`
        ];
        
        for (const variation of variations) {
            if (await isSlugAvailable(variation)) {
                suggestions.push({
                    slug: variation,
                    url: `${variation}.llc-us.com`
                });
            }
            if (suggestions.length >= 3) break;
        }
        
        res.json({
            original: baseSlug,
            originalAvailable: await isSlugAvailable(baseSlug),
            suggestions
        });
        
    } catch (error) {
        console.error('Suggest slugs error:', error);
        res.status(500).json({
            error: 'Failed to generate suggestions',
            message: error.message
        });
    }
});

module.exports = router;
