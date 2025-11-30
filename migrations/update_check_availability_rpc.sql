-- Update check_availability RPC to respect consumes_capacity flag
-- This ensures that manual bookings with consumes_capacity = false do NOT reduce availability

CREATE OR REPLACE FUNCTION check_availability(check_date DATE, check_turn TEXT, check_pax INT)
RETURNS TABLE (
  zone_id INT,
  zone_name_es TEXT,
  zone_name_en TEXT,
  available_slots INT
) AS $$
DECLARE
  var_zone RECORD;
  total_capacity INT;
  used_capacity INT;
BEGIN
  -- Iterate over all zones
  FOR var_zone IN SELECT id, name_es, name_en FROM zones LOOP
    
    -- 1. Calculate Total Capacity for this zone (count of suitable tables)
    SELECT COUNT(*) INTO total_capacity
    FROM tables t
    WHERE t.zone_id = var_zone.id
      AND t.min_pax <= check_pax
      AND t.max_pax >= check_pax;

    -- 2. Calculate Used Capacity (count of occupied suitable tables)
    -- CRITICAL UPDATE: Added check for consumes_capacity
    SELECT COUNT(DISTINCT b.assigned_table_id) INTO used_capacity
    FROM bookings b
    JOIN tables t ON b.assigned_table_id = t.id
    WHERE b.booking_date = check_date
      AND b.turn = check_turn
      AND b.status NOT IN ('cancelled', 'waiting_list')
      AND t.zone_id = var_zone.id
      AND t.min_pax <= check_pax
      AND t.max_pax >= check_pax
      AND (b.consumes_capacity IS NULL OR b.consumes_capacity = true); -- Only count if consumes_capacity is true

    -- 3. Return result if there is availability
    IF (total_capacity - used_capacity) > 0 THEN
      zone_id := var_zone.id;
      zone_name_es := var_zone.name_es;
      zone_name_en := var_zone.name_en;
      available_slots := total_capacity - used_capacity;
      RETURN NEXT;
    END IF;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;
