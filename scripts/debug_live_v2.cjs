const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// HARDCODED ENV VARS
const supabaseUrl = 'https://ttaoejgrwqlkleknsdkt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YW9lamdyd3Fsa2xla25zZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM1MzQsImV4cCI6MjA3OTE5OTUzNH0.hmmTdyhZbBZnbdlm6H7S2XAlIJUk0vKePSxzKiicEXg';
const restaurantId = '171ee012-0173-4ca4-8977-6d0e2b34497a';

const supabase = createClient(supabaseUrl, supabaseKey);

const CHECK_DATE = '2026-02-14';
const CHECK_TURN = 'dinner';

function log(msg) {
    console.log(msg);
    fs.appendFileSync('debug_output.txt', msg + '\n');
}

async function runDebug() {
    fs.writeFileSync('debug_output.txt', '');
    log(`\n🔎 DIAGNOSING: ${CHECK_DATE} (${CHECK_TURN})`);
    log(`Restaurant ID: ${restaurantId}`);

    // Fetch Zone Names FIRST
    const { data: zones } = await supabase.from('zones').select('id, name, name_es, name_en').eq('restaurant_id', restaurantId);
    const zoneMap = {};
    if (zones) zones.forEach(z => zoneMap[z.id] = z.name_es || z.name || z.name_en || 'Unknown');
    log('🗺️ ZONES MAP: ' + JSON.stringify(zoneMap));

    // 1. Check Settings
    const { data: settings } = await supabase.from('settings').select('*').eq('restaurant_id', restaurantId);
    const flexSetting = (settings || []).find(s => s.key === 'flexible_capacity');
    log(`⚙️ Settings: flexible_capacity=${flexSetting?.value}`);
    const isFlex = flexSetting?.value === 'true';

    // 2. Check Raw Bookings
    log('\n📦 RAW BOOKINGS (Status=blocked):');
    const { data: blocks, error: blockErr } = await supabase
        .from('bookings')
        .select('id, zone_id, status, customer_name, assigned_table_id, booking_date, turn')
        .eq('restaurant_id', restaurantId)
        .eq('booking_date', CHECK_DATE)
        .eq('turn', CHECK_TURN)
        .eq('status', 'blocked');

    if (blockErr) log('Error fetching blocks: ' + JSON.stringify(blockErr));
    else {
        if (!blocks || blocks.length === 0) log('   ⚠️ NO BLOCKS FOUND IN DB FOR THIS DATE/TURN!');
        else blocks.forEach(b => log(`   - [${b.id}] Zone: ${b.zone_id} (${zoneMap[b.zone_id]}) | Status: ${b.status}`));
    }

    const blockedZoneIds = blocks ? blocks.map(b => Number(b.zone_id)) : [];
    log('   Blocked Zone IDs: ' + blockedZoneIds.join(', '));

    // 3. Run RPC Check
    log('\n🚀 RUNNING RPC (check_availability):');
    const params = {
        check_date: CHECK_DATE,
        check_turn: CHECK_TURN,
        check_pax: 2,
        check_restaurant_id: restaurantId,
        flexible_capacity: isFlex
    };

    // log('   RPC Params: ' + JSON.stringify(params));

    const { data: rpcData, error: rpcError } = await supabase.rpc('check_availability', params);

    if (rpcError) {
        log('   ❌ RPC ERROR: ' + JSON.stringify(rpcError));
    } else {
        log(`   ✅ RPC returned ${rpcData.length} zones.`);
        const zoneIds = rpcData.map(z => z.zone_id);
        const zoneNames = rpcData.map(z => zoneMap[z.zone_id] || z.zone_id); // Map IDs to names

        log('   Available Zone IDs: ' + zoneIds.join(', '));
        log('   Available Zone NAMES: ' + zoneNames.join(', '));

        const leakingBlocks = blockedZoneIds.filter(id => {
            return zoneIds.some(zid => String(zid) === String(id));
        });

        if (leakingBlocks.length > 0) {
            log(`\n   ❌ FAIL: Leaking IDs: ${leakingBlocks.join(', ')} (${leakingBlocks.map(id => zoneMap[id]).join(', ')})`);
        } else {
            log('\n   ✅ SUCCESS: No blocked zones found.');
        }
    }
}

runDebug().catch(e => {
    console.error(e);
    fs.appendFileSync('debug_output.txt', '\nFATAL ERROR: ' + e.message);
});
