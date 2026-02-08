-- Trigger para llamar al webhook de n8n cuando una reserva cambia a status 'confirmed'
-- Esto cubre el caso de pago completado via Stripe webhook o confirmación manual

-- Habilitar la extensión pg_net si no está habilitada (permite hacer HTTP requests desde Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función que envía la notificación al webhook de n8n
CREATE OR REPLACE FUNCTION notify_booking_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- Solo ejecutar si el status cambió a 'confirmed' (y antes no lo era)
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Obtener la URL del webhook desde tenant_integrations si existe, o usar la por defecto
    SELECT ghl_webhook_url INTO webhook_url
    FROM tenant_integrations
    WHERE restaurant_id = NEW.restaurant_id;
    
    -- Si no hay URL específica del tenant, usar la URL por defecto de n8n
    IF webhook_url IS NULL OR webhook_url = '' THEN
      webhook_url := 'https://n8n.captialeads.com/webhook/nueva-reserva';
    END IF;
    
    -- Construir el payload con toda la info de la reserva
    payload := jsonb_build_object(
      'event', 'booking_confirmed',
      'booking_id', NEW.id,
      'uuid', NEW.uuid,
      'restaurant_id', NEW.restaurant_id,
      'booking_date', NEW.booking_date,
      'turn', NEW.turn,
      'time', NEW.time,
      'pax', NEW.pax,
      'zone_id', NEW.zone_id,
      'zone_name', NEW.zone_name,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'comments', NEW.comments,
      'status', NEW.status,
      'deposit_amount', NEW.deposit_amount,
      'previous_status', OLD.status,
      'confirmed_at', NOW()
    );
    
    -- Enviar HTTP POST al webhook de n8n
    PERFORM net.http_post(
      webhook_url,
      payload,
      '{}',
      '{"Content-Type": "application/json"}'::jsonb
    );
    
    RAISE NOTICE 'Webhook sent to % for booking %', webhook_url, NEW.uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS on_booking_confirmed ON bookings;

-- Crear el trigger que se ejecuta después de UPDATE en la tabla bookings
CREATE TRIGGER on_booking_confirmed
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_confirmed();

-- Comentario para documentación
COMMENT ON FUNCTION notify_booking_confirmed() IS 'Envía webhook a n8n cuando una reserva cambia a status confirmed (ej: después de pago Stripe)';
