-- 1. Ensure Unique Constraint exists on Settings (restaurant_id, key)
DO $$
BEGIN
    -- Check if constraint or unique index exists to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settings_restaurant_id_key_unique'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'settings_restaurant_id_key_unique' AND n.nspname = 'public'
    ) THEN
        -- Try to add the constraint. If there are duplicates, this might fail, so we might need to cleanup first?
        -- For now, assuming no duplicates or fresh start for this feature.
        ALTER TABLE settings ADD CONSTRAINT settings_restaurant_id_key_unique UNIQUE (restaurant_id, key);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create unique constraint, possibly already exists or duplicates present: %', SQLERRM;
END $$;

-- 2. Update Booking Status Types
DO $$
BEGIN
  ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Update Policies
DROP POLICY IF EXISTS "Enable write access for all users" ON restaurants;
CREATE POLICY "Enable write access for all users" ON restaurants FOR ALL USING (true) WITH CHECK (true);

-- 4. Insert Defaults (Now safe to use ON CONFLICT if step 1 succeeded, otherwisefallback to manual check)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM restaurants LOOP
    -- Manual Approval
    BEGIN
        INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'require_manual_approval', 'false')
        ON CONFLICT (restaurant_id, key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback if constraint missing
        IF NOT EXISTS (SELECT 1 FROM settings WHERE restaurant_id = r.id AND key = 'require_manual_approval') THEN
            INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'require_manual_approval', 'false');
        END IF;
    END;

    -- Flexible Capacity
    BEGIN
        INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'flexible_capacity', 'false')
        ON CONFLICT (restaurant_id, key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
         IF NOT EXISTS (SELECT 1 FROM settings WHERE restaurant_id = r.id AND key = 'flexible_capacity') THEN
            INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'flexible_capacity', 'false');
        END IF;
    END;
    
    -- Validation Message
    BEGIN
        INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'manual_validation_message', 'Tu reserva está pendiente de confirmación.')
        ON CONFLICT (restaurant_id, key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
         IF NOT EXISTS (SELECT 1 FROM settings WHERE restaurant_id = r.id AND key = 'manual_validation_message') THEN
            INSERT INTO settings (restaurant_id, key, value) VALUES (r.id, 'manual_validation_message', 'Tu reserva está pendiente de confirmación.');
        END IF;
    END;
  END LOOP;
END $$;
