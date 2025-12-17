-- Enable DELETE for all tables to allow SuperAdmin cascade
-- (In production, you would restrict this to specific roles, but for now we open it to ensure functionality)

-- Settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for settings" ON settings;
CREATE POLICY "Enable all access for settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Zones
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for zones" ON zones;
CREATE POLICY "Enable all access for zones" ON zones FOR ALL USING (true) WITH CHECK (true);

-- Tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for tables" ON tables;
CREATE POLICY "Enable all access for tables" ON tables FOR ALL USING (true) WITH CHECK (true);

-- Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for bookings" ON bookings;
CREATE POLICY "Enable all access for bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);

-- Restaurants (already done but good to ensure)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for restaurants" ON restaurants;
CREATE POLICY "Enable all access for restaurants" ON restaurants FOR ALL USING (true) WITH CHECK (true);
