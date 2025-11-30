-- Drop both versions to avoid ambiguity
DROP FUNCTION IF EXISTS check_availability(date, text, integer);
DROP FUNCTION IF EXISTS check_availability(date, turn_type, integer);

-- Recreate using the correct type (turn_type) to match database schema
CREATE OR REPLACE FUNCTION check_availability(
  check_date DATE,
  check_turn turn_type,
  check_pax INT
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
     WHERE check_pax BETWEEN t.min_pax AND t.max_pax
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
     WHERE b.booking_date = check_date
     AND b.turn = check_turn
     -- CRITICAL FIX: Include 'blocked' and 'completed' statuses
     AND b.status IN ('confirmed', 'waiting_payment_link', 'blocked', 'completed')
     -- CRITICAL FIX: Check consumes_capacity (handle NULL as true)
     AND (b.consumes_capacity IS NULL OR b.consumes_capacity = true)
     AND EXISTS (
        SELECT 1 FROM valid_tables vt
        WHERE vt.zone_id = b.zone_id
        AND b.assigned_table_id = vt.id
     )
     GROUP BY b.zone_id
  )
  -- 4. Calculate available slots
  SELECT 
    z.id,
    z.name_es AS zone_name_es,
    z.name_en AS zone_name_en,
    (COALESCE(zc.total_tables, 0) - COALESCE(zo.booked_tables, 0)) AS available_slots
  FROM zones z
  JOIN zone_capacity zc ON zc.zone_id = z.id
  LEFT JOIN zone_occupancy zo ON zo.zone_id = z.id
  WHERE (COALESCE(zc.total_tables, 0) - COALESCE(zo.booked_tables, 0)) > 0;
END;
$$;
