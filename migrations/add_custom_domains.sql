-- Add custom_domain column to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

-- Index for faster lookups (since we query by domain on every load)
CREATE INDEX IF NOT EXISTS idx_restaurants_custom_domain ON restaurants(custom_domain);
