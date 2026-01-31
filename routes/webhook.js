const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { deploySite } = require('../services/cloudflare');
const { compileWebsite } = require('../services/compile');
const db = require('../db/queries');

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // For testing without signature verification
            event = JSON.parse(req.body);
            console.log('⚠️  No webhook secret - skipping signature verification');
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log(`📥 Received Stripe event: ${event.type}`);
    
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutComplete(event.data.object);
            break;
            
        case 'customer.subscription.created':
            console.log('Subscription created:', event.data.object.id);
            break;
            
        case 'invoice.payment_succeeded':
            console.log('Payment succeeded for subscription:', event.data.object.subscription);
            break;
            
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object);
            break;
            
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
});

async function handleCheckoutComplete(session) {
    console.log('🎉 Checkout completed!');
    console.log('  Email:', session.customer_email);
    console.log('  Slug:', session.metadata?.slug);
    
    const slug = session.metadata?.slug;
    
    if (!slug) {
        console.error('No slug in session metadata');
        return;
    }
    
    try {
        // Get site data from database
        const site = await db.getReservation(slug);
        
        if (!site) {
            console.error('Site not found for slug:', slug);
            return;
        }
        
        console.log('📦 Compiling site...');
        const html = compileWebsite(site.template_id || 'starter', site.content || site.generated_content);
        
        console.log('🚀 Deploying to Cloudflare...');
        const deployment = await deploySite(slug, html);
        
        if (deployment.success) {
            console.log('✅ Site deployed:', deployment.url);
            
            // Update database with deployment info
            await db.query(
                `UPDATE slug_reservations 
                 SET status = 'deployed', 
                     deployed_url = $1,
                     deployed_at = NOW()
                 WHERE slug = $2`,
                [deployment.url, slug]
            );
        } else {
            console.error('❌ Deploy failed:', deployment.error);
        }
    } catch (error) {
        console.error('Error in handleCheckoutComplete:', error);
    }
}

async function handleSubscriptionDeleted(subscription) {
    console.log('🛑 Subscription cancelled:', subscription.id);
    // TODO: Take down site, notify customer
}

module.exports = router;
