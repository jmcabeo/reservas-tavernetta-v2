-- Drop previous version to avoid signature ambiguity (optional but recommended)
DROP FUNCTION IF EXISTS check_availability(DATE, TEXT, INT);

-- Updated RPC to accepts restaurant_id
CREATE OR REPLACE FUNCTION check_availability(check_date DATE, check_turn TEXT, check_pax INT, check_restaurant_id UUID)
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
  -- Iterate all zones BELONGING to this restaurant
  FOR var_zone IN 
    SELECT id, name_es, name_en 
    FROM zones 
    WHERE restaurant_id = check_restaurant_id
  LOOP
    
    -- 1. Calculate Total Capacity (tables in this zone & restaurant)
    SELECT COUNT(*) INTO total_capacity
    FROM tables t
    WHERE t.zone_id = var_zone.id
      AND t.restaurant_id = check_restaurant_id -- Redundant if zone is checked, but safe
      AND t.min_pax <= check_pax
      AND t.max_pax >= check_pax;

    -- 2. Calculate Used Capacity
    SELECT COUNT(DISTINCT b.assigned_table_id) INTO used_capacity
    FROM bookings b
    JOIN tables t ON b.assigned_table_id = t.id
    WHERE b.booking_date = check_date
      AND b.turn = check_turn
      AND b.restaurant_id = check_restaurant_id -- Filter by restaurant
      AND b.status NOT IN ('cancelled', 'waiting_list')
      AND t.zone_id = var_zone.id
      AND t.min_pax <= check_pax
      AND t.max_pax >= check_pax
      AND (b.consumes_capacity IS NULL OR b.consumes_capacity = true);

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
