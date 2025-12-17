-- REPAIR MISSING LINK: BOOKINGS -> ZONES (WITH CLEANUP)
-- Fixes error: "insert or update on table bookings violates foreign key constraint"
-- Also fixes: "Could not find a relationship between 'bookings' and 'zones'"

DO $$
BEGIN
    -- 1. Remove old constraint if it exists (to avoid conflicts)
    BEGIN
        ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_zone_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 2. CRITICAL FIX: Unassign orphaned zones
    -- Since we recreated the 'zones' table, old zone_ids (like 2) don't exist anymore.
    -- We must set them to NULL, otherwise the constraint will fail.
    UPDATE bookings SET zone_id = NULL WHERE zone_id IS NOT NULL;

    -- 3. Restore the Foreign Key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'zone_id') THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_zone_id_fkey 
        FOREIGN KEY (zone_id) 
        REFERENCES zones(id) 
        ON DELETE SET NULL;
    END IF;

END $$;

-- 4. Final Schema Reload
NOTIFY pgrst, 'reload schema';
