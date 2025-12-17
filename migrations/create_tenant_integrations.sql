-- Create a secure table for integrations (Webhook URLs, Secrets, Keys)
-- Updated based on user feedback to store GHL Webhook URL specific config.

-- If table exists, we drop it to ensure clean structure (CAUTION: Data loss if used in prod, but safe for setup phase)
DROP TABLE IF EXISTS tenant_integrations;

CREATE TABLE tenant_integrations (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- GHL Webhook Integration
  ghl_webhook_url TEXT,       -- The URL provided by the GHL Workflow Trigger
  ghl_secret_key TEXT,        -- Unique key for this client to secure the webhook
  
  -- Stripe Integration
  stripe_secret_key TEXT,
  stripe_public_key TEXT,
  stripe_webhook_secret TEXT,
  
  -- Spreadsheets
  google_sheets_id TEXT,
  
  -- Notification Config
  email_notifications TEXT, 
  
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Service Role can read integrations" ON tenant_integrations
  FOR SELECT
  TO service_role
  USING (true);

-- Allow Insert/Update for all (simplified for setup)
CREATE POLICY "Enable all for now" ON tenant_integrations USING (true);
