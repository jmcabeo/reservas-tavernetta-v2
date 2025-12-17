
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
    // CORS check
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
    }

    try {
        const { booking_id } = await req.json();
        if (!booking_id) return new Response(JSON.stringify({ error: "Missing booking_id" }), { status: 400, headers: { "Content-Type": "application/json" } });

        // Sanitize input
        const cleanId = String(booking_id).trim();
        console.log(`Received auto-cancel request for: '${cleanId}'`);

        // Initialize Supabase Client with Service Role Key to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        console.log(`[DEBUG] Connecting to Supabase URL: ${supabaseUrl}`);

        const supabaseAdmin = createClient(
            supabaseUrl,
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        );

        // DEBUG: Fetch FULL booking object to check for zone_name
        let query = supabaseAdmin.from('bookings').select('*');

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

        if (isUUID) {
            query = query.eq('uuid', cleanId);
        } else {
            query = query.eq('id', cleanId);
        }

        const { data: booking, error: fetchError } = await query.single();

        if (fetchError || !booking) {
            console.error("Booking not found:", fetchError);
            return new Response(JSON.stringify({ error: "Booking not found", searched_for: cleanId }), { status: 404, headers: { "Content-Type": "application/json" } });
        }

        // LOG THE FULL BOOKING OBJECT
        console.log('[DEBUG] Full Booking Object:', JSON.stringify(booking));

        // Check availability of zone_name
        const zoneNameExists = 'zone_name' in booking;
        const zoneNameValue = (booking as any).zone_name;

        console.log(`[DEBUG] zone_name check: Exists=${zoneNameExists}, Value=${zoneNameValue}`);

        // 2. SAFETY CHECK: Only cancel if status is pending
        const safeStatuses = ['pending_payment', 'waiting_payment_link'];
        if (!safeStatuses.includes(booking.status)) {
            return new Response(JSON.stringify({
                message: "Booking skipped. Status is not pending.",
                current_status: booking.status,
                skipped: true,
                debug_zone_name_exists: zoneNameExists,
                debug_zone_name_value: zoneNameValue
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. Update to cancelled
        const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', booking.id);

        if (updateError) {
            throw updateError;
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Booking cancelled",
            debug_zone_name_exists: zoneNameExists,
            debug_zone_name_value: zoneNameValue
        }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        });
    }
});
