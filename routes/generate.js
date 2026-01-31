// WebSimple AI - Content Generation Route
const express = require('express');
const router = express.Router();
const { generateContent, enhanceContent } = require('../services/gemini');
const { updateReservation, getReservation } = require('../db/queries');
const { compileWebsite } = require('../services/compile');

/**
 * POST /api/generate-content
 * Generate website content from intake form
 * 
 * Body: {
 *   slug: "smithplumbing",
 *   templateId: "classic",
 *   intakeData: {
 *     businessName: "Smith Plumbing",
 *     phone: "(555) 123-4567",
 *     email: "info@smithplumbing.com",
 *     serviceArea: "Twin Cities metro",
 *     services: "Residential plumbing, water heaters, drain cleaning",
 *     years: "15"
 *   }
 * }
 */
router.post('/generate-content', async (req, res) => {
    try {
        const { slug, templateId, intakeData } = req.body;
        
        // Validate required fields
        if (!slug || !templateId || !intakeData) {
            return res.status(400).json({ 
                error: 'Missing required fields: slug, templateId, intakeData' 
            });
        }
        
        const { businessName, phone, email, serviceArea, services, years } = intakeData;
        
        if (!businessName || !phone || !email || !serviceArea || !services || !years) {
            return res.status(400).json({ 
                error: 'Missing intake fields. Required: businessName, phone, email, serviceArea, services, years' 
            });
        }
        
        // Generate content via Gemini
        console.log(`Generating content for ${businessName}...`);
        const startTime = Date.now();
        
        intakeData.industry = templateId;
        const generatedContent = await generateContent(intakeData, templateId);
        
        const duration = Date.now() - startTime;
        console.log(`Content generated in ${duration}ms`);
        
        // Update the slug reservation with the generated content
        await updateReservation(slug, {
            templateId,
            intakeData,
            generatedContent
        });
        
        res.json({
            success: true,
            content: generatedContent,
            generationTime: duration
        });
        
    } catch (error) {
        console.error('Generate content error:', error);
        res.status(500).json({ 
            error: 'Failed to generate content',
            message: error.message 
        });
    }
});

/**
 * POST /api/enhance-content
 * Enhance existing content with additional details (post-purchase)
 * 
 * Body: {
 *   slug: "smithplumbing",
 *   additionalData: {
 *     differentiator: "Family-owned since 1985",
 *     promotion: "$50 off first service",
 *     hours: "Mon-Fri 7am-6pm",
 *     license: "PM-123456"
 *   }
 * }
 */
router.post('/enhance-content', async (req, res) => {
    try {
        const { slug, additionalData } = req.body;
        
        if (!slug || !additionalData) {
            return res.status(400).json({ 
                error: 'Missing required fields: slug, additionalData' 
            });
        }
        
        // Get existing content from reservation
        const reservation = await getReservation(slug);
        
        if (!reservation || !reservation.generated_content) {
            return res.status(404).json({ 
                error: 'No existing content found for this slug' 
            });
        }
        
        // Enhance the content
        console.log(`Enhancing content for ${slug}...`);
        const startTime = Date.now();
        
        const enhancedContent = await enhanceContent(
            reservation.generated_content, 
            additionalData
        );
        
        const duration = Date.now() - startTime;
        console.log(`Content enhanced in ${duration}ms`);
        
        // Update reservation with enhanced content
        await updateReservation(slug, {
            generatedContent: enhancedContent
        });
        
        res.json({
            success: true,
            content: enhancedContent,
            generationTime: duration
        });
        
    } catch (error) {
        console.error('Enhance content error:', error);
        res.status(500).json({ 
            error: 'Failed to enhance content',
            message: error.message 
        });
    }
});

/**
 * GET /api/preview-content/:slug
 * Get generated content for preview rendering
 */
router.get('/preview-content/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const reservation = await getReservation(slug);
        
        if (!reservation) {
            return res.status(404).json({ 
                error: 'Reservation not found' 
            });
        }
        
        if (!reservation.generated_content) {
            return res.status(404).json({ 
                error: 'No content generated yet' 
            });
        }
        
        res.json({
            success: true,
            content: reservation.generated_content,
            templateId: reservation.template_id,
            intakeData: reservation.intake_data
        });
        
    } catch (error) {
        console.error('Get preview content error:', error);
        res.status(500).json({ 
            error: 'Failed to get content',
            message: error.message 
        });
    }
});

/**
 * GET /api/preview-html/:slug
 * Get compiled HTML preview using actual template
 */
router.get('/preview-html/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const reservation = await getReservation(slug);
        
        if (!reservation || !reservation.generated_content) {
            return res.status(404).json({ error: 'No content found' });
        }
        
        const templateId = reservation.template_id || 'electrician';
        const html = compileWebsite(reservation.generated_content, templateId, templateId);
        
        res.type('html').send(html);
        
    } catch (error) {
        console.error('Preview HTML error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

module.exports = router;
