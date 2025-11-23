import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'sb_publishable_D6wodVCQSH62x-SNI_HYZQ_rUVtlefy';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBlockTable() {
    console.log('Testing table block...');

    // 1. Get a valid zone and table
    const { data: tables } = await supabase.from('tables').select('*').limit(1);
    if (!tables || tables.length === 0) {
        console.error('No tables found to test with');
        return;
    }
    const table = tables[0];
    console.log('Using table:', table);

    const bookingData = {
        booking_date: '2025-12-31', // Future date
        turn: 'lunch',
        time: '13:00',
        pax: 4,
        zone_id: table.zone_id,
        table_id: table.id,
        customer_name: 'TEST BLOCK SCRIPT',
        customer_email: 'bloqueo@admin.com',
        customer_phone: '000000000',
        status: 'blocked',
        deposit_amount: 0
    };

    console.log('Inserting:', bookingData);

    const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select();

    if (error) {
        console.error('❌ Error blocking table:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Success! Block created:', data);
        // Cleanup
        if (data && data[0]) {
            await supabase.from('bookings').delete().eq('id', data[0].id);
        }
    }
}

testBlockTable();
