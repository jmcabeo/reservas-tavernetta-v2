import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase configuration
const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';
const restaurantId = '171ee012-0173-4ca4-8977-6d0e2b34497a'; // Extracted from apply_fix.js/env

const supabase = createClient(supabaseUrl, supabaseKey);

// Utils
const getSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('restaurant_id', restaurantId);
    const settings = {};
    data?.forEach(row => { settings[row.key] = row.value; });
    return settings;
};

const updateSetting = async (key, value) => {
    console.log(`Setting ${key} = ${value}...`);
    const { error } = await supabase.from('settings').upsert({ key, value, restaurant_id: restaurantId }, { onConflict: 'key, restaurant_id' });
    if (error) console.error('Error updating setting:', error);
};

const checkAvailability = async (date, turn, pax, flexibleCapacity) => {
    console.log(`Checking availability for ${date} (${turn}) with flexible_capacity=${flexibleCapacity}...`);
    // We call the RPC directly to test the database logic primarily
    const { data, error } = await supabase.rpc('check_availability', {
        check_date: date,
        check_turn: turn,
        check_pax: pax,
        check_restaurant_id: restaurantId,
        flexible_capacity: flexibleCapacity
    });

    if (error) {
        console.error('RPC Error:', error);
        return [];
    }
    return data;
};

const createBlock = async (date, turn, zoneId) => {
    console.log(`Creating block for zone ${zoneId} on ${date}...`);
    const { error } = await supabase.from('bookings').insert([{
        uuid: crypto.randomUUID(),
        restaurant_id: restaurantId,
        booking_date: date,
        turn: turn,
        time: '13:00',
        pax: 10,
        zone_id: zoneId,
        customer_name: 'TEST BLOCK',
        customer_email: 'test@block.com',
        customer_phone: '000',
        status: 'blocked',
        deposit_amount: 0
    }]);
    if (error) console.error('Error creating block:', error);
};

const deleteBlock = async (date, zoneId) => {
    console.log('Cleaning up block...');
    await supabase.from('bookings').delete().eq('booking_date', date).eq('customer_name', 'TEST BLOCK');
};

async function runTest() {
    console.log('--- STARTING FLEXIBLE CAPACITY TEST ---');

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7); // 1 week from now
    const dateStr = testDate.toISOString().split('T')[0];
    const turn = 'lunch';
    const zoneId = 1; // Assuming Zone 1 exists (Main Room/Interior)

    // 1. Enable Flexible Capacity
    await updateSetting('flexible_capacity', 'true');

    // 2. Create Block
    await createBlock(dateStr, turn, zoneId);

    // 3. Check Availability
    // We expect the blocked zone to be MISSING from results, even with flexible capacity
    const results = await checkAvailability(dateStr, turn, 4, true);

    console.log('Results:', results);

    const blockedZoneFound = results.find(z => z.zone_id === zoneId);

    if (blockedZoneFound) {
        console.error('❌ FAILURE: Blocked zone was returned despite block!');
    } else {
        console.log('✅ SUCCESS: Blocked zone was correctly filtered out.');
    }

    // 4. Cleanup
    await deleteBlock(dateStr, zoneId);
    // await updateSetting('flexible_capacity', 'false'); // Optional: revert setting

    console.log('--- TEST FINISHED ---');
}

runTest();
