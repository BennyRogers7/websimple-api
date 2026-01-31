-- WebSimple AI Database Schema
-- Run this in your Neon Postgres console

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOMERS
-- One row per paying customer
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Stripe lookups
CREATE INDEX idx_customers_stripe_id ON customers(stripe_customer_id);

-- ============================================
-- SITES
-- One row per website
-- ============================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('pending', 'preview', 'active', 'suspended', 'cancelled')),
    plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'premium')),
    template_id TEXT NOT NULL,
    intake_data JSONB NOT NULL DEFAULT '{}',
    generated_content JSONB DEFAULT '{}',
    cloudflare_project_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX idx_sites_customer ON sites(customer_id);
CREATE INDEX idx_sites_slug ON sites(slug);
CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_sites_stripe_sub ON sites(stripe_subscription_id);

-- ============================================
-- SLUG RESERVATIONS
-- Temporary holds before payment (30 min TTL)
-- ============================================
CREATE TABLE slug_reservations (
    slug TEXT PRIMARY KEY,
    email TEXT,
    session_id TEXT,
    template_id TEXT,
    intake_data JSONB DEFAULT '{}',
    generated_content JSONB DEFAULT '{}',
    reserved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
    converted BOOLEAN DEFAULT FALSE
);

-- Index for cleanup job
CREATE INDEX idx_slug_reservations_expires ON slug_reservations(expires_at) WHERE converted = FALSE;

-- ============================================
-- PAYMENT EVENTS
-- Audit log of all Stripe webhooks
-- ============================================
CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    site_id UUID REFERENCES sites(id),
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_customer ON payment_events(customer_id);
CREATE INDEX idx_payment_events_created ON payment_events(created_at);

-- ============================================
-- DEPLOY QUEUE
-- Track deployment jobs
-- ============================================
CREATE TABLE deploy_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for job processing
CREATE INDEX idx_deploy_queue_status ON deploy_queue(status) WHERE status IN ('pending', 'processing');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to clean up expired slug reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM slug_reservations
    WHERE expires_at < NOW()
    AND converted = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a slug is available
CREATE OR REPLACE FUNCTION is_slug_available(check_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if slug exists in active sites
    IF EXISTS (SELECT 1 FROM sites WHERE slug = check_slug AND status != 'cancelled') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if slug is reserved and not expired
    IF EXISTS (
        SELECT 1 FROM slug_reservations 
        WHERE slug = check_slug 
        AND expires_at > NOW() 
        AND converted = FALSE
    ) THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reserve a slug
CREATE OR REPLACE FUNCTION reserve_slug(
    p_slug TEXT,
    p_email TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check availability first
    IF NOT is_slug_available(p_slug) THEN
        RETURN FALSE;
    END IF;
    
    -- Delete any old expired reservation for this slug
    DELETE FROM slug_reservations WHERE slug = p_slug;
    
    -- Create new reservation
    INSERT INTO slug_reservations (slug, email, session_id, expires_at)
    VALUES (p_slug, p_email, p_session_id, NOW() + INTERVAL '30 minutes');
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to extend reservation (when user is actively engaged)
CREATE OR REPLACE FUNCTION extend_reservation(p_slug TEXT, p_session_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE slug_reservations
    SET expires_at = NOW() + INTERVAL '30 minutes'
    WHERE slug = p_slug
    AND session_id = p_session_id
    AND converted = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE QUERIES FOR REFERENCE
-- ============================================

-- Check slug availability:
-- SELECT is_slug_available('smithplumbing');

-- Reserve a slug:
-- SELECT reserve_slug('smithplumbing', 'user@example.com', 'session_abc123');

-- Get all active sites:
-- SELECT * FROM sites WHERE status = 'active';

-- Get sites needing deployment:
-- SELECT * FROM deploy_queue WHERE status = 'pending' ORDER BY created_at LIMIT 10;

-- Clean up expired reservations (run via cron):
-- SELECT cleanup_expired_reservations();

-- Get customer with their sites:
-- SELECT c.*, json_agg(s.*) as sites
-- FROM customers c
-- LEFT JOIN sites s ON s.customer_id = c.id
-- WHERE c.email = 'user@example.com'
-- GROUP BY c.id;
