
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateConfirmation() {
    console.log('--- SIMULANDO CONFIRMACIÓN DE RESERVA ---');

    // Cambiamos el estado de una reserva de prueba (ID 176) a 'confirmed'
    // Esto debería disparar el trigger notify_booking_confirmed
    const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', 176)
        .select();

    if (error) {
        console.error('Error al actualizar reserva:', error.message);
    } else {
        console.log('Reserva 176 actualizada a "confirmed".');
        console.log('El trigger de Supabase debería haber enviado el webhook a n8n/GHL.');
    }
}

simulateConfirmation();
