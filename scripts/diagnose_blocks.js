import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';
const restaurantId = '171ee012-0173-4ca4-8977-6d0e2b34497a';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- DIAGNOSTIC START ---');

    const targetDate = '2026-02-14';
    console.log(`Diagnosing for date: ${targetDate}`);

    // 1. Fetch ALL bookings for this date (blocks and normal)
    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_date, turn, status, zone_id, zone_name, pax')
        .eq('restaurant_id', restaurantId)
        .eq('booking_date', targetDate);

    if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        return;
    }

    const blocks = bookings.filter(b => b.status === 'blocked');
    console.log(`Found ${bookings.length} total bookings, ${blocks.length} are BLOCKS.`);

    if (blocks.length > 0) {
        console.log('Blocks found:', blocks);
    } else {
        console.warn('⚠️ NO BLOCKS FOUND for this date. The user might have set it for a different date or it was deleted?');
    }

    // 2. Check Availability RPC for both turns
    const turns = ['lunch', 'dinner'];

    for (const turn of turns) {
        console.log(`\n--- Checking Turn: ${turn} ---`);

        // Check DB Block status for this turn
        const blocksForTurn = blocks.filter(b => b.turn === turn);
        const blockedZoneIds = new Set(blocksForTurn.map(b => b.zone_id));
        if (blockedZoneIds.size > 0) {
            console.log(`Zones blocked in DB for ${turn}:`, Array.from(blockedZoneIds));
        } else {
            console.log(`No blocks in DB for ${turn}.`);
        }

        // Call RPC
        console.log(`Calling RPC check_availability(${targetDate}, ${turn}, 2, ..., flexible=TRUE)`);

        const { data: availability, error: rpcError } = await supabase.rpc('check_availability', {
            check_date: targetDate,
            check_turn: turn,
            check_pax: 2,
            check_restaurant_id: restaurantId,
            flexible_capacity: true
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError.message);
        } else {
            console.log('RPC Availability Result:', availability);

            // Verification
            if (blockedZoneIds.size > 0) {
                const leakedZones = availability.filter(z => blockedZoneIds.has(z.zone_id));
                if (leakedZones.length > 0) {
                    console.error('❌ FAILURE: The following BLOCKED zones are returned as available:', leakedZones);
                } else {
                    console.log('✅ SUCCESS: Blocked zones are NOT present in availability result.');
                }
            }
        }
    }
    console.log('--- DIAGNOSTIC END ---');
}

diagnose();
