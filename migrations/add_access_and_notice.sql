-- 1. Create Restaurant Users Table (Whitelist)
CREATE TABLE IF NOT EXISTS restaurant_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- 'admin', 'staff', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, email)
);

-- RLS for restaurant_users
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for restaurant_users" ON restaurant_users;
CREATE POLICY "Enable all access for restaurant_users" ON restaurant_users FOR ALL USING (true) WITH CHECK (true);

-- 2. Insert Default 'min_notice_minutes' Setting
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM restaurants LOOP
    BEGIN
        -- Default: 1440 minutes (24 hours)
        INSERT INTO settings (restaurant_id, key, value) 
        VALUES (r.id, 'min_notice_minutes', '1440')
        ON CONFLICT (restaurant_id, key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
