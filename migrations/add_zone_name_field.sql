-- Add zone_name field to bookings table
-- This allows storing the zone name directly in the booking record
-- so it can be easily accessed in webhooks without joins

-- Add the new column
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS zone_name TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN bookings.zone_name IS 
'Name of the zone in Spanish for easy access in webhooks and integrations. 
Examples: Salón, Terraza, Terraza Exterior, Barra';
