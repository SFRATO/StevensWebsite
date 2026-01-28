-- Email Campaign Database Schema
-- This migration creates all tables needed for the email drip campaign system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Interest types that determine campaign assignment
CREATE TYPE interest_type AS ENUM (
  'selling',
  'buying',
  'both',
  'investment',
  'consultation'
);

-- Lead status in the system
CREATE TYPE lead_status AS ENUM (
  'active',
  'paused',
  'unsubscribed',
  'bounced',
  'converted'
);

-- Email delivery status
CREATE TYPE email_status AS ENUM (
  'pending',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed'
);

-- Market type classification
CREATE TYPE market_type AS ENUM (
  'seller',
  'buyer',
  'balanced'
);

-- =============================================================================
-- CAMPAIGNS TABLE
-- =============================================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  interest_types interest_type[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default campaigns
INSERT INTO campaigns (name, slug, description, interest_types) VALUES
  ('Seller Nurture', 'seller', '5-email sequence focused on home selling strategies, pricing, and preparation', ARRAY['selling']::interest_type[]),
  ('Buyer Nurture', 'buyer', '5-email sequence for home buyers covering neighborhoods, strategy, and financing', ARRAY['buying']::interest_type[]),
  ('Buy & Sell Track', 'both', '6-email sequence for those buying and selling, focusing on timing and coordination', ARRAY['both']::interest_type[]),
  ('Investor Track', 'investor', '5-email sequence for real estate investors covering ROI, opportunities, and tax considerations', ARRAY['investment']::interest_type[]),
  ('General Track', 'general', '4-email sequence for general inquiries and consultations', ARRAY['consultation']::interest_type[]);

-- =============================================================================
-- CAMPAIGN STEPS TABLE
-- =============================================================================

CREATE TABLE campaign_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  template_id VARCHAR(50) NOT NULL,
  subject_template VARCHAR(200) NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  send_hour INTEGER NOT NULL DEFAULT 10, -- 10 AM default
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, step_number)
);

-- Seed campaign steps for Seller Track
INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 1, 'seller-1-welcome', 'Your {town} Market Report is Ready', 0, 'Welcome email with PDF download'
FROM campaigns WHERE slug = 'seller';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 2, 'seller-2-market-deep-dive', 'What {town}''s Market Data Means for You', 3, 'Deep dive into market metrics'
FROM campaigns WHERE slug = 'seller';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 3, 'seller-3-pricing-strategy', 'How to Price Your Home in Today''s {town} Market', 7, 'Pricing strategy guidance'
FROM campaigns WHERE slug = 'seller';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 4, 'seller-4-preparation-tips', '5 Things {town} Buyers Are Looking For Right Now', 11, 'Home preparation tips'
FROM campaigns WHERE slug = 'seller';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 5, 'seller-5-consultation', 'Ready to Discuss Your Options?', 14, 'Consultation CTA'
FROM campaigns WHERE slug = 'seller';

-- Seed campaign steps for Buyer Track
INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 1, 'buyer-1-welcome', 'Your Guide to Buying in {town}', 0, 'Welcome with inventory overview'
FROM campaigns WHERE slug = 'buyer';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 2, 'buyer-2-neighborhoods', 'Discovering {town}''s Best Neighborhoods', 3, 'Local area guide'
FROM campaigns WHERE slug = 'buyer';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 3, 'buyer-3-strategy', 'Smart Buying Strategies for {town}''s Market', 7, 'Market-conditional buying strategy'
FROM campaigns WHERE slug = 'buyer';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 4, 'buyer-4-financing', 'Maximizing Your Buying Power in {county}', 11, 'Financing overview'
FROM campaigns WHERE slug = 'buyer';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 5, 'buyer-5-consultation', 'Let''s Find Your Perfect {town} Home', 14, 'Buyer consultation CTA'
FROM campaigns WHERE slug = 'buyer';

-- Seed campaign steps for Both Track
INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 1, 'both-1-welcome', 'Your {town} Buy & Sell Strategy Starts Here', 0, 'Dual transaction overview'
FROM campaigns WHERE slug = 'both';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 2, 'both-2-timing', 'Timing Your Move: Buy First or Sell First?', 3, 'Timing strategies'
FROM campaigns WHERE slug = 'both';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 3, 'both-3-value', 'What''s Your {town} Home Worth Today?', 7, 'Current home value focus'
FROM campaigns WHERE slug = 'both';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 4, 'both-4-search', 'Finding Your Next Home in {county}', 10, 'Next home search'
FROM campaigns WHERE slug = 'both';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 5, 'both-5-coordination', 'Coordinating Your Buy & Sell Transaction', 12, 'Transaction coordination tips'
FROM campaigns WHERE slug = 'both';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 6, 'both-6-consultation', 'Let''s Plan Your {town} Move Together', 14, 'Strategy session CTA'
FROM campaigns WHERE slug = 'both';

-- Seed campaign steps for Investor Track
INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 1, 'investor-1-welcome', '{county} Investment Property Overview', 0, 'Investment market overview'
FROM campaigns WHERE slug = 'investor';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 2, 'investor-2-roi', 'ROI Analysis: What to Expect in {town}', 3, 'ROI analysis framework'
FROM campaigns WHERE slug = 'investor';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 3, 'investor-3-opportunities', 'Investment Hotspots in {county}', 7, 'Local investment opportunities'
FROM campaigns WHERE slug = 'investor';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 4, 'investor-4-tax', 'Tax Considerations for {county} Investors', 11, 'Tax and legal considerations'
FROM campaigns WHERE slug = 'investor';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 5, 'investor-5-consultation', 'Let''s Discuss Your Investment Strategy', 14, 'Investor consultation CTA'
FROM campaigns WHERE slug = 'investor';

-- Seed campaign steps for General Track
INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 1, 'general-1-welcome', 'Thank You for Your Interest in {town} Real Estate', 0, 'Introduction'
FROM campaigns WHERE slug = 'general';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 2, 'general-2-overview', '{county} Market Overview: What You Should Know', 4, 'Market overview'
FROM campaigns WHERE slug = 'general';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 3, 'general-3-services', 'How I Can Help With Your Real Estate Goals', 8, 'Services overview'
FROM campaigns WHERE slug = 'general';

INSERT INTO campaign_steps (campaign_id, step_number, template_id, subject_template, delay_days, description)
SELECT id, 4, 'general-4-available', 'I''m Here When You''re Ready', 14, 'Open invitation'
FROM campaigns WHERE slug = 'general';

-- =============================================================================
-- LEADS TABLE
-- =============================================================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Contact information
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),

  -- Property/location information
  address VARCHAR(255),
  town VARCHAR(100),
  zipcode VARCHAR(10),
  county VARCHAR(100),

  -- Interest and campaign assignment
  interest_type interest_type NOT NULL DEFAULT 'selling',
  campaign_id UUID REFERENCES campaigns(id),
  current_step INTEGER DEFAULT 0,

  -- Status tracking
  status lead_status DEFAULT 'active',
  next_email_at TIMESTAMPTZ,

  -- Source tracking (UTM parameters)
  source_url VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,

  -- Ensure unique emails (case-insensitive)
  CONSTRAINT leads_email_unique UNIQUE (email)
);

-- Create case-insensitive email index
CREATE UNIQUE INDEX leads_email_lower_idx ON leads (LOWER(email));

-- Index for email queue processing (critical for performance)
CREATE INDEX leads_email_queue_idx ON leads (status, next_email_at)
  WHERE status = 'active' AND next_email_at IS NOT NULL;

-- Index for campaign queries
CREATE INDEX leads_campaign_idx ON leads (campaign_id, current_step);

-- Index for interest type segmentation
CREATE INDEX leads_interest_type_idx ON leads (interest_type);

-- =============================================================================
-- SCHEDULED EMAILS TABLE
-- =============================================================================

CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_step_id UUID NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,

  -- Status tracking
  status email_status DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- SES tracking
  ses_message_id VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Prevent duplicate emails
  UNIQUE(lead_id, campaign_step_id)
);

-- Index for processing pending emails
CREATE INDEX scheduled_emails_pending_idx ON scheduled_emails (status, scheduled_for)
  WHERE status = 'pending';

-- Index for finding emails by SES message ID
CREATE INDEX scheduled_emails_ses_id_idx ON scheduled_emails (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

-- =============================================================================
-- EMAIL EVENTS TABLE (for SES delivery tracking)
-- =============================================================================

CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_email_id UUID REFERENCES scheduled_emails(id) ON DELETE CASCADE,
  ses_message_id VARCHAR(100),

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- SEND, DELIVERY, BOUNCE, COMPLAINT, OPEN, CLICK
  event_timestamp TIMESTAMPTZ NOT NULL,

  -- Additional event data
  bounce_type VARCHAR(50),       -- For bounces: Permanent, Transient
  bounce_subtype VARCHAR(100),   -- For bounces: General, NoEmail, etc.
  complaint_type VARCHAR(50),    -- For complaints: abuse, auth-failure, etc.
  link_url VARCHAR(500),         -- For click events
  user_agent TEXT,               -- For open/click events
  ip_address VARCHAR(45),        -- For open/click events

  -- Raw event data for debugging
  raw_event JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding events by scheduled email
CREATE INDEX email_events_scheduled_email_idx ON email_events (scheduled_email_id);

-- Index for finding events by SES message ID
CREATE INDEX email_events_ses_id_idx ON email_events (ses_message_id);

-- Index for event type queries
CREATE INDEX email_events_type_idx ON email_events (event_type, event_timestamp);

-- =============================================================================
-- ZIPCODE MARKET DATA CACHE TABLE
-- =============================================================================

CREATE TABLE zipcode_data (
  zipcode VARCHAR(10) PRIMARY KEY,
  town VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(50) DEFAULT 'New Jersey',

  -- Market metrics
  median_sale_price NUMERIC(12, 2),
  median_sale_price_yoy NUMERIC(8, 4),
  median_list_price NUMERIC(12, 2),
  inventory INTEGER,
  inventory_yoy NUMERIC(8, 4),
  median_dom INTEGER,
  median_dom_yoy NUMERIC(8, 4),
  homes_sold INTEGER,
  homes_sold_yoy NUMERIC(8, 4),
  sold_above_list_pct NUMERIC(6, 2),
  months_of_supply NUMERIC(6, 2),

  -- Market classification
  market_type market_type DEFAULT 'balanced',
  trend_direction VARCHAR(10),

  -- AI-generated content
  ai_insight TEXT,

  -- Nearby zipcodes for comparison
  nearby_zips VARCHAR(10)[] DEFAULT '{}',

  -- Data freshness
  period_end DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for county queries
CREATE INDEX zipcode_data_county_idx ON zipcode_data (county);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to assign campaign based on interest type
CREATE OR REPLACE FUNCTION assign_campaign_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  assigned_campaign_id UUID;
BEGIN
  -- Find matching campaign for the interest type
  SELECT id INTO assigned_campaign_id
  FROM campaigns
  WHERE NEW.interest_type = ANY(interest_types)
    AND is_active = true
  LIMIT 1;

  NEW.campaign_id = assigned_campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply campaign assignment trigger
CREATE TRIGGER assign_campaign_on_lead_insert
  BEFORE INSERT ON leads
  FOR EACH ROW
  WHEN (NEW.campaign_id IS NULL)
  EXECUTE FUNCTION assign_campaign_to_lead();

-- Function to generate unsubscribe token
CREATE OR REPLACE FUNCTION generate_unsubscribe_token(lead_id UUID)
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  -- Create HMAC-signed token with lead_id
  token := encode(
    hmac(
      lead_id::text || extract(epoch from now())::text,
      current_setting('app.settings.secret_key', true),
      'sha256'
    ),
    'hex'
  );
  RETURN lead_id::text || '.' || token;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE zipcode_data ENABLE ROW LEVEL SECURITY;

-- Campaigns and steps are readable by all, but only service role can modify
CREATE POLICY "Campaigns are viewable by everyone"
  ON campaigns FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Campaign steps are viewable by everyone"
  ON campaign_steps FOR SELECT
  TO authenticated, anon
  USING (true);

-- Zipcode data is publicly readable
CREATE POLICY "Zipcode data is viewable by everyone"
  ON zipcode_data FOR SELECT
  TO authenticated, anon
  USING (true);

-- Service role policies for full access (edge functions use service role)
CREATE POLICY "Service role has full access to leads"
  ON leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to scheduled_emails"
  ON scheduled_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to email_events"
  ON email_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to campaigns"
  ON campaigns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to campaign_steps"
  ON campaign_steps FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to zipcode_data"
  ON zipcode_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- View for campaign performance metrics
CREATE OR REPLACE VIEW campaign_metrics AS
SELECT
  c.name as campaign_name,
  c.slug as campaign_slug,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'active') as active_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted') as converted_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'unsubscribed') as unsubscribed_leads,
  COUNT(se.id) as total_emails_scheduled,
  COUNT(se.id) FILTER (WHERE se.status = 'sent' OR se.status = 'delivered') as emails_sent,
  COUNT(se.id) FILTER (WHERE se.status = 'opened' OR se.status = 'clicked') as emails_opened,
  COUNT(se.id) FILTER (WHERE se.status = 'clicked') as emails_clicked,
  COUNT(se.id) FILTER (WHERE se.status = 'bounced') as emails_bounced,
  ROUND(
    COUNT(se.id) FILTER (WHERE se.status = 'opened' OR se.status = 'clicked')::NUMERIC /
    NULLIF(COUNT(se.id) FILTER (WHERE se.status = 'sent' OR se.status = 'delivered'), 0) * 100,
    2
  ) as open_rate,
  ROUND(
    COUNT(se.id) FILTER (WHERE se.status = 'clicked')::NUMERIC /
    NULLIF(COUNT(se.id) FILTER (WHERE se.status = 'opened' OR se.status = 'clicked'), 0) * 100,
    2
  ) as click_rate
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.id
LEFT JOIN scheduled_emails se ON se.lead_id = l.id
GROUP BY c.id, c.name, c.slug;

-- =============================================================================
-- CRON JOB FOR EMAIL PROCESSING (requires pg_cron extension)
-- =============================================================================

-- Note: Run this separately after enabling pg_cron extension
-- This schedules the email processor to run every hour at minute 0

-- SELECT cron.schedule(
--   'process-email-queue',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/send-scheduled-emails',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
--   );
--   $$
-- );
