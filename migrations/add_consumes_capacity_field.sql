-- Add consumes_capacity field to bookings table
-- This allows admins to create bookings that don't affect table availability
-- Useful for internal reservations, tests, or special cases

-- Add the new column with default value of true (maintains current behavior)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS consumes_capacity BOOLEAN DEFAULT true;

-- Add comment to document the purpose
COMMENT ON COLUMN bookings.consumes_capacity IS 
'Indicates whether this booking should consume table capacity. 
Set to false for internal/test bookings that should not affect availability.';

-- Update any existing NULL values to true for safety
UPDATE bookings 
SET consumes_capacity = true 
WHERE consumes_capacity IS NULL;
