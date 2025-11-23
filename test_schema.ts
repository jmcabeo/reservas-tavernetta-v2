import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'sb_publishable_D6wodVCQSH62x-SNI_HYZQ_rUVtlefy';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking schema via select *...');

    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
            if ('table_id' in data[0]) {
                console.log('✅ table_id column EXISTS');
            } else {
                console.error('❌ table_id column MISSING in result');
            }
        } else {
            console.log('No bookings found to check columns.');
        }
    }
}

checkSchema();
