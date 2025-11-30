DO $$
DECLARE
    booking_record RECORD;
    table_record RECORD;
BEGIN
    -- Iterate over all bookings that consume capacity but have no assigned table
    FOR booking_record IN 
        SELECT * FROM bookings 
        WHERE assigned_table_id IS NULL 
        AND (consumes_capacity IS NULL OR consumes_capacity = true)
        AND status NOT IN ('cancelled', 'waiting_list')
        ORDER BY created_at ASC
    LOOP
        -- Find a suitable free table for this booking
        SELECT t.id INTO table_record
        FROM tables t
        WHERE t.zone_id = booking_record.zone_id
        AND t.max_pax >= booking_record.pax
        AND t.min_pax <= booking_record.pax
        AND t.id NOT IN (
            SELECT b.assigned_table_id 
            FROM bookings b 
            WHERE b.booking_date = booking_record.booking_date 
            AND b.turn = booking_record.turn 
            AND b.assigned_table_id IS NOT NULL
            AND b.status NOT IN ('cancelled', 'waiting_list')
        )
        LIMIT 1;

        -- If a table is found, assign it
        IF table_record.id IS NOT NULL THEN
            UPDATE bookings 
            SET assigned_table_id = table_record.id 
            WHERE id = booking_record.id;
            
            RAISE NOTICE 'Assigned booking % to table %', booking_record.id, table_record.id;
        ELSE
            RAISE NOTICE 'Could not find free table for booking % (Date: %, Turn: %, Pax: %)', 
                booking_record.id, booking_record.booking_date, booking_record.turn, booking_record.pax;
        END IF;
    END LOOP;
END $$;
