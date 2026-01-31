const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const db = require('../db/queries');

router.post('/create-checkout', async (req, res) => {
    try {
        const { slug, email, templateId, intakeData, generatedContent } = req.body;
        
        if (!slug || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer_email: email,
            line_items: [{
                price: process.env.STRIPE_PRICE_ID,
                quantity: 1
            }],
            metadata: {
                slug: slug,
                templateId: templateId || 'starter',
                intakeData: JSON.stringify(intakeData || {}).substring(0, 500)
            },
            success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/building.html?canceled=true`
        });

        // Update slug reservation with intake data
        try {
            await db.query(
                `UPDATE slug_reservations 
                 SET intake_data = $1, generated_content = $2, template_id = $3
                 WHERE slug = $4`,
                [JSON.stringify(intakeData), JSON.stringify(generatedContent), templateId, slug]
            );
        } catch (dbError) {
            console.error('DB update error:', dbError);
        }

        res.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

router.get('/verify-session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'customer']
        });

        if (session.payment_status === 'paid') {
            res.json({
                success: true,
                email: session.customer_email,
                slug: session.metadata.slug,
                subscriptionId: session.subscription?.id
            });
        } else {
            res.json({ success: false, status: session.payment_status });
        }
    } catch (error) {
        console.error('Verify session error:', error);
        res.status(500).json({ error: 'Failed to verify session' });
    }
});

module.exports = router;
