-- Add is_manual field to bookings table
-- This allows differentiating between admin-created bookings and client bookings
-- Essential for n8n webhooks to handle pending payments correctly

-- Add the new column with default value of false
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false;

-- Add comment to document the purpose
COMMENT ON COLUMN bookings.is_manual IS 
'Indicates if the booking was created manually by an admin (true) or by a customer (false).';

-- Update any existing NULL values to false for safety
UPDATE bookings 
SET is_manual = false 
WHERE is_manual IS NULL;
