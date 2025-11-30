-- Fix Row Level Security policies for the settings table
-- This allows authenticated users to read and modify settings

-- First, enable RLS on settings table if not already enabled
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert settings" ON settings;
DROP POLICY IF EXISTS "Allow authenticated users to update settings" ON settings;

-- Create new policies that allow authenticated users full access to settings
CREATE POLICY "Allow authenticated users to read settings"
ON settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert settings"
ON settings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update settings"
ON settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
