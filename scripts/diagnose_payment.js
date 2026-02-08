
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
// Using the anon key found in .env
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- DIAGNÓSTICO DE RESERVAS RECIENTES ---');

    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .ilike('customer_name', '%Serafín%')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al obtener reservas:', error.message);
        return;
    }

    if (!bookings || bookings.length === 0) {
        console.log('No se encontraron reservas para Serafín.');
        return;
    }

    console.table(bookings.map(b => ({
        ID: b.id,
        Estado: b.status,
        PI_ID: b.stripe_payment_intent_id,
        Creada: b.created_at,
        Fecha: b.booking_date,
        Hora: b.time
    })));

    const stuck = bookings.filter(b => b.status === 'pending_payment' && b.stripe_payment_intent_id);
    const confirmed = bookings.filter(b => b.status === 'confirmed');

    // Check integration config
    console.log('\n--- CONFIGURACIÓN DE INTEGRACIONES ---');
    const { data: integrations, error: intError } = await supabase
        .from('tenant_integrations')
        .select('*')
        .limit(5);

    if (intError) {
        console.error('Error al obtener integraciones:', intError.message);
    } else if (integrations && integrations.length > 0) {
        console.table(integrations.map(i => ({
            RestaurantID: i.restaurant_id,
            GHL_Webhook: i.ghl_webhook_url ? 'CONFIGURADO' : 'VACÍO',
            GHL_URL: i.ghl_webhook_url || 'N/A',
            Updated: i.updated_at
        })));
    } else {
        console.log('No se encontraron configuraciones en tenant_integrations. Se usará el webhook por defecto.');
    }
}

diagnose();
