-- 1. Create Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ghl_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed Default Restaurant 'La Tavernetta'
-- We use DO block to prevent duplicate inserts if run multiple times
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE slug = 'la-tavernetta') THEN
    INSERT INTO restaurants (name, slug) VALUES ('La Tavernetta', 'la-tavernetta');
  END IF;
END $$;

-- 3. Add restaurant_id to all tables
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);
ALTER TABLE zones ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);
ALTER TABLE blocked_days ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);

-- 4. Backfill Data
-- Assign all existing orphan rows to 'La Tavernetta'
DO $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  SELECT id INTO v_restaurant_id FROM restaurants WHERE slug = 'la-tavernetta';

  UPDATE bookings SET restaurant_id = v_restaurant_id WHERE restaurant_id IS NULL;
  UPDATE zones SET restaurant_id = v_restaurant_id WHERE restaurant_id IS NULL;
  UPDATE tables SET restaurant_id = v_restaurant_id WHERE restaurant_id IS NULL;
  UPDATE settings SET restaurant_id = v_restaurant_id WHERE restaurant_id IS NULL;
  UPDATE blocked_days SET restaurant_id = v_restaurant_id WHERE restaurant_id IS NULL;
END $$;

-- 5. Set NOT NULL Constraints
ALTER TABLE bookings ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE zones ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE tables ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE blocked_days ALTER COLUMN restaurant_id SET NOT NULL;

-- 6. Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_days ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies
-- For V1 (Simple SaaS), we are trusting the application to filter by ID via the API code.
-- Truly secure RLS requires Authentication Context (JWT claims), which we might not have fully set up yet.
-- For now, we allow ALL ops but the code MUST filter.
-- A stricter policy would be: USING (restaurant_id = (current_setting('app.current_restaurant_id')::uuid)) but that requires extra setup.

-- Allow public read access to restaurants (so we can resolve ID by slug if needed)
CREATE POLICY "Enable read access for all users" ON restaurants FOR SELECT USING (true);

-- Allow full access to related tables (Application logic is responsible for filtering for now)
-- In a stricter SaaS, we would bind this to auth.uid()
CREATE POLICY "Enable all access for bookings" ON bookings USING (true);
CREATE POLICY "Enable all access for zones" ON zones USING (true);
CREATE POLICY "Enable all access for tables" ON tables USING (true);
CREATE POLICY "Enable all access for settings" ON settings USING (true);
CREATE POLICY "Enable all access for blocked_days" ON blocked_days USING (true);
