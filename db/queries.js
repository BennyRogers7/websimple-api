// WebSimple AI - Database Queries
// Uses node-postgres (pg) with Neon

const { Pool } = require('pg');

// Connection pool - uses DATABASE_URL from environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon
});

// ============================================
// SLUG OPERATIONS
// ============================================

async function isSlugAvailable(slug) {
    const result = await pool.query(
        'SELECT is_slug_available($1) as available',
        [slug.toLowerCase()]
    );
    return result.rows[0].available;
}

async function reserveSlug(slug, email = null, sessionId = null) {
    const result = await pool.query(
        'SELECT reserve_slug($1, $2, $3) as success',
        [slug.toLowerCase(), email, sessionId]
    );
    return result.rows[0].success;
}

async function extendReservation(slug, sessionId) {
    const result = await pool.query(
        'SELECT extend_reservation($1, $2) as success',
        [slug.toLowerCase(), sessionId]
    );
    return result.rows[0].success;
}

async function updateReservation(slug, data) {
    const { templateId, intakeData, generatedContent } = data;
    
    const result = await pool.query(`
        UPDATE slug_reservations
        SET 
            template_id = COALESCE($2, template_id),
            intake_data = COALESCE($3, intake_data),
            generated_content = COALESCE($4, generated_content)
        WHERE slug = $1
        RETURNING *
    `, [slug.toLowerCase(), templateId, intakeData, generatedContent]);
    
    return result.rows[0];
}

async function getReservation(slug) {
    const result = await pool.query(
        'SELECT * FROM slug_reservations WHERE slug = $1',
        [slug.toLowerCase()]
    );
    return result.rows[0];
}

async function convertReservation(slug) {
    const result = await pool.query(`
        UPDATE slug_reservations
        SET converted = TRUE
        WHERE slug = $1
        RETURNING *
    `, [slug.toLowerCase()]);
    
    return result.rows[0];
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

async function createCustomer(email, stripeCustomerId) {
    const result = await pool.query(`
        INSERT INTO customers (email, stripe_customer_id)
        VALUES ($1, $2)
        ON CONFLICT (email) DO UPDATE SET stripe_customer_id = $2
        RETURNING *
    `, [email.toLowerCase(), stripeCustomerId]);
    
    return result.rows[0];
}

async function getCustomerByEmail(email) {
    const result = await pool.query(
        'SELECT * FROM customers WHERE email = $1',
        [email.toLowerCase()]
    );
    return result.rows[0];
}

async function getCustomerByStripeId(stripeCustomerId) {
    const result = await pool.query(
        'SELECT * FROM customers WHERE stripe_customer_id = $1',
        [stripeCustomerId]
    );
    return result.rows[0];
}

// ============================================
// SITE OPERATIONS
// ============================================

async function createSite(data) {
    const {
        customerId,
        slug,
        plan,
        templateId,
        intakeData,
        generatedContent,
        stripeSubscriptionId
    } = data;
    
    const result = await pool.query(`
        INSERT INTO sites (
            customer_id, slug, plan, template_id, 
            intake_data, generated_content, stripe_subscription_id,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING *
    `, [
        customerId,
        slug.toLowerCase(),
        plan,
        templateId,
        intakeData,
        generatedContent,
        stripeSubscriptionId
    ]);
    
    return result.rows[0];
}

async function getSiteBySlug(slug) {
    const result = await pool.query(
        'SELECT * FROM sites WHERE slug = $1',
        [slug.toLowerCase()]
    );
    return result.rows[0];
}

async function getSiteBySubscriptionId(subscriptionId) {
    const result = await pool.query(
        'SELECT * FROM sites WHERE stripe_subscription_id = $1',
        [subscriptionId]
    );
    return result.rows[0];
}

async function getSitesByCustomer(customerId) {
    const result = await pool.query(
        'SELECT * FROM sites WHERE customer_id = $1 ORDER BY created_at DESC',
        [customerId]
    );
    return result.rows;
}

async function updateSiteStatus(siteId, status) {
    const updates = { status };
    
    if (status === 'active') {
        updates.deployed_at = new Date();
        updates.suspended_at = null;
    } else if (status === 'suspended') {
        updates.suspended_at = new Date();
    }
    
    const result = await pool.query(`
        UPDATE sites
        SET status = $2,
            deployed_at = COALESCE($3, deployed_at),
            suspended_at = $4
        WHERE id = $1
        RETURNING *
    `, [siteId, status, updates.deployed_at, updates.suspended_at]);
    
    return result.rows[0];
}

async function updateSiteCloudflare(siteId, cloudflareProjectId) {
    const result = await pool.query(`
        UPDATE sites
        SET cloudflare_project_id = $2, deployed_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [siteId, cloudflareProjectId]);
    
    return result.rows[0];
}

async function updateSiteContent(siteId, generatedContent) {
    const result = await pool.query(`
        UPDATE sites
        SET generated_content = $2
        WHERE id = $1
        RETURNING *
    `, [siteId, generatedContent]);
    
    return result.rows[0];
}

// ============================================
// PAYMENT EVENTS
// ============================================

async function logPaymentEvent(event) {
    const result = await pool.query(`
        INSERT INTO payment_events (stripe_event_id, event_type, payload)
        VALUES ($1, $2, $3)
        ON CONFLICT (stripe_event_id) DO NOTHING
        RETURNING *
    `, [event.id, event.type, event]);
    
    return result.rows[0];
}

async function markEventProcessed(stripeEventId, customerId = null, siteId = null) {
    const result = await pool.query(`
        UPDATE payment_events
        SET processed = TRUE, customer_id = $2, site_id = $3
        WHERE stripe_event_id = $1
        RETURNING *
    `, [stripeEventId, customerId, siteId]);
    
    return result.rows[0];
}

async function isEventProcessed(stripeEventId) {
    const result = await pool.query(
        'SELECT processed FROM payment_events WHERE stripe_event_id = $1',
        [stripeEventId]
    );
    return result.rows[0]?.processed || false;
}

// ============================================
// DEPLOY QUEUE
// ============================================

async function queueDeploy(siteId) {
    const result = await pool.query(`
        INSERT INTO deploy_queue (site_id)
        VALUES ($1)
        RETURNING *
    `, [siteId]);
    
    return result.rows[0];
}

async function getNextDeployJob() {
    const result = await pool.query(`
        UPDATE deploy_queue
        SET status = 'processing', started_at = NOW(), attempts = attempts + 1
        WHERE id = (
            SELECT id FROM deploy_queue
            WHERE status = 'pending'
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING *
    `);
    
    return result.rows[0];
}

async function completeDeployJob(jobId, success, errorMessage = null) {
    const status = success ? 'completed' : 'failed';
    
    const result = await pool.query(`
        UPDATE deploy_queue
        SET status = $2, completed_at = NOW(), error_message = $3
        WHERE id = $1
        RETURNING *
    `, [jobId, status, errorMessage]);
    
    return result.rows[0];
}

async function retryFailedDeploys(maxAttempts = 3) {
    const result = await pool.query(`
        UPDATE deploy_queue
        SET status = 'pending'
        WHERE status = 'failed'
        AND attempts < $1
        RETURNING *
    `, [maxAttempts]);
    
    return result.rows;
}

// ============================================
// CLEANUP OPERATIONS
// ============================================

async function cleanupExpiredReservations() {
    const result = await pool.query('SELECT cleanup_expired_reservations() as count');
    return result.rows[0].count;
}

async function getSitesForSuspension(gracePeriodDays = 7) {
    const result = await pool.query(`
        SELECT s.* FROM sites s
        JOIN payment_events pe ON pe.site_id = s.id
        WHERE s.status = 'active'
        AND pe.event_type = 'invoice.payment_failed'
        AND pe.created_at < NOW() - INTERVAL '${gracePeriodDays} days'
        AND NOT EXISTS (
            SELECT 1 FROM payment_events pe2
            WHERE pe2.site_id = s.id
            AND pe2.event_type = 'invoice.payment_succeeded'
            AND pe2.created_at > pe.created_at
        )
    `);
    
    return result.rows;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    pool,
    
    // Slugs
    isSlugAvailable,
    reserveSlug,
    extendReservation,
    updateReservation,
    getReservation,
    convertReservation,
    
    // Customers
    createCustomer,
    getCustomerByEmail,
    getCustomerByStripeId,
    
    // Sites
    createSite,
    getSiteBySlug,
    getSiteBySubscriptionId,
    getSitesByCustomer,
    updateSiteStatus,
    updateSiteCloudflare,
    updateSiteContent,
    
    // Payment events
    logPaymentEvent,
    markEventProcessed,
    isEventProcessed,
    
    // Deploy queue
    queueDeploy,
    getNextDeployJob,
    completeDeployJob,
    retryFailedDeploys,
    
    // Cleanup
    cleanupExpiredReservations,
    getSitesForSuspension
};
