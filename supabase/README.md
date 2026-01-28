# Supabase Email Campaign System

This directory contains the Supabase configuration for the email drip campaign system.

## Architecture

```
Form Submit → Netlify → Supabase Edge Function → Database + SES (Day 0)
                                                       ↓
                             pg_cron (hourly) → Edge Function → SES (Days 3,7,11,14)
                                                       ↓
                              SES Events → SNS → Edge Function → Event Tracking
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys

### 2. Initialize Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Run Database Migration

```bash
# Push the schema to your database
supabase db push
```

This will create:
- `campaigns` - Campaign definitions
- `campaign_steps` - Individual emails with timing
- `leads` - Contact information and status
- `scheduled_emails` - Email queue
- `email_events` - Delivery tracking
- `zipcode_data` - Market data cache

### 4. Set Edge Function Secrets

```bash
supabase secrets set AWS_ACCESS_KEY_ID=AKIA...
supabase secrets set AWS_SECRET_ACCESS_KEY=...
supabase secrets set AWS_REGION=us-east-1
supabase secrets set SES_SENDER_EMAIL=reports@stevenfrato.com
supabase secrets set SES_CONFIGURATION_SET=steven-frato-emails
supabase secrets set SITE_URL=https://stevenfrato.com
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy handle-form-submission
supabase functions deploy send-scheduled-emails
supabase functions deploy ses-webhook-handler
supabase functions deploy unsubscribe
```

### 6. Configure AWS SES

#### Domain Verification
```bash
aws ses verify-domain-identity --domain stevenfrato.com
# Add the TXT record to DNS
```

#### DKIM Setup
```bash
aws ses verify-domain-dkim --domain stevenfrato.com
# Add the 3 CNAME records to DNS
```

#### Configuration Set for Event Tracking
```bash
# Create configuration set
aws sesv2 create-configuration-set --configuration-set-name steven-frato-emails

# Create SNS topic
aws sns create-topic --name ses-delivery-notifications

# Add event destination
aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name steven-frato-emails \
  --event-destination-name sns-notifications \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "OPEN", "CLICK"],
    "SnsDestination": {
      "TopicArn": "arn:aws:sns:us-east-1:ACCOUNT_ID:ses-delivery-notifications"
    }
  }'

# Subscribe the webhook to SNS
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ses-delivery-notifications \
  --protocol https \
  --notification-endpoint https://YOUR_PROJECT.supabase.co/functions/v1/ses-webhook-handler
```

### 7. Enable pg_cron for Scheduled Emails

In the Supabase Dashboard > SQL Editor, run:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule email processing every hour
SELECT cron.schedule(
  'process-email-queue',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-scheduled-emails',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### 8. Configure Netlify Environment Variables

Add these to your Netlify site settings:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `handle-form-submission` | Netlify webhook | Process form submissions, create leads, schedule emails |
| `send-scheduled-emails` | pg_cron (hourly) | Process email queue, send via SES |
| `ses-webhook-handler` | SNS notifications | Track delivery events, handle bounces/complaints |
| `unsubscribe` | Email link click | Process unsubscribe requests |

## Campaign Tracks

| Track | Interest Type | Emails | Duration |
|-------|--------------|--------|----------|
| Seller | selling | 5 | 14 days |
| Buyer | buying | 5 | 14 days |
| Both | both | 6 | 14 days |
| Investor | investment | 5 | 14 days |
| General | consultation | 4 | 14 days |

## Monitoring

### Check Campaign Metrics
```sql
SELECT * FROM campaign_metrics;
```

### Check Pending Emails
```sql
SELECT * FROM scheduled_emails
WHERE status = 'pending'
ORDER BY scheduled_for
LIMIT 20;
```

### Check Recent Events
```sql
SELECT * FROM email_events
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Emails Not Sending
1. Check pg_cron is running: `SELECT * FROM cron.job;`
2. Check function logs: `supabase functions log send-scheduled-emails`
3. Verify SES credentials in secrets
4. Check SES sending limits in AWS console

### Bounces Not Recorded
1. Verify SNS subscription is confirmed
2. Check ses-webhook-handler function logs
3. Ensure ConfigurationSet is used when sending

### Lead Not Created
1. Check handle-form-submission function logs
2. Verify Supabase URL/key in Netlify env vars
3. Check for duplicate email (unique constraint)
