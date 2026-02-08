import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
    console.log('--- APLICANDO FIX: RE-ENRUTAMIENTO A N8N ---');

    const restaurantId = '171ee012-0173-4ca4-8977-6d0e2b34497a';
    const n8nWebhookUrl = 'https://n8n.captialeads.com/webhook/nueva-reserva';

    const { data, error } = await supabase
        .from('tenant_integrations')
        .update({ ghl_webhook_url: n8nWebhookUrl })
        .eq('restaurant_id', restaurantId)
        .select();

    if (error) {
        console.error('Error al actualizar tenant_integrations:', error.message);
    } else {
        console.log('Actualización exitosa:');
        console.table(data.map(i => ({
            RestaurantID: i.restaurant_id,
            Nueva_URL: i.ghl_webhook_url
        })));
        console.log('\nAhora el trigger de Supabase enviará las confirmaciones a n8n en lugar de GHL directo.');
    }
}

applyFix();
