-- Drop previous version (v6)
DROP FUNCTION IF EXISTS check_availability(date, turn_type, integer);

-- Recreate with flexible_capacity parameter
CREATE OR REPLACE FUNCTION check_availability(
  check_date DATE,
  check_turn turn_type,
  check_pax INT,
  check_restaurant_id UUID,
  flexible_capacity BOOLEAN DEFAULT false
)
RETURNS TABLE (
  zone_id BIGINT,
  zone_name_es TEXT,
  zone_name_en TEXT,
  available_slots BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- 1. Identify valid tables for this number of people
  valid_tables AS (
     SELECT t.id, t.zone_id, t.min_pax, t.max_pax
     FROM tables t
     WHERE t.restaurant_id = check_restaurant_id
     AND check_pax BETWEEN t.min_pax AND t.max_pax
  ),
  -- 2. Count total tables per zone
  zone_capacity AS (
     SELECT vt.zone_id, COUNT(*) AS total_tables
     FROM valid_tables vt
     GROUP BY vt.zone_id
  ),
  -- 3. Count occupied tables
  zone_occupancy AS (
     SELECT b.zone_id, COUNT(*) AS booked_tables
     FROM bookings b
     WHERE b.restaurant_id = check_restaurant_id
     AND b.booking_date = check_date
     AND b.turn = check_turn
     AND b.status IN ('confirmed', 'waiting_payment_link', 'blocked', 'completed', 'pending_payment', 'pending_approval')
     AND (b.consumes_capacity IS NULL OR b.consumes_capacity = true)
     GROUP BY b.zone_id
  ),
  -- 4. Check for blocking bookings (status = 'blocked') specifically
  blocked_zones AS (
     SELECT DISTINCT b.zone_id
     FROM bookings b
     WHERE b.restaurant_id = check_restaurant_id
     AND b.booking_date = check_date
     AND b.turn = check_turn
     AND b.status = 'blocked'
  )
  -- 5. Calculate available slots
  SELECT 
    z.id,
    z.name_es AS zone_name_es,
    z.name_en AS zone_name_en,
    (COALESCE(zc.total_tables, 0) - COALESCE(zo.booked_tables, 0)) AS available_slots
  FROM zones z
  LEFT JOIN zone_capacity zc ON zc.zone_id = z.id
  LEFT JOIN zone_occupancy zo ON zo.zone_id = z.id
  WHERE z.restaurant_id = check_restaurant_id
  -- Exclude blocked zones
  AND z.id NOT IN (SELECT zone_id FROM blocked_zones)
  -- If flexible_capacity is TRUE, ignore table limits (return zone even if slots <= 0)
  -- Otherwise, enforce table limits (slots > 0)
  AND (flexible_capacity = TRUE OR (COALESCE(zc.total_tables, 0) - COALESCE(zo.booked_tables, 0)) > 0);
END;
$$;
