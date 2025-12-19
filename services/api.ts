import { supabase } from './supabaseClient';
import { Booking, AvailabilityResponse, Turn, BookingFormData, BookingStatus, Zone, Table } from '../types';
import { DEPOSIT_PER_PAX, RESTAURANT_ID as ENV_RESTAURANT_ID } from '../constants';

// Mutable variable for the current Tenant ID (Initialized with ENV fallback)
let activeRestaurantId = ENV_RESTAURANT_ID;

export const setApiRestaurantId = (id: string) => {
  activeRestaurantId = id;
  console.log('[API] Restaurant ID set to:', id);
};

export const getApiRestaurantId = () => activeRestaurantId;

// Validate Restaurant ID on load (Warn only, since it might be set later via setApiRestaurantId)
if (!activeRestaurantId) {
  console.warn('WARN: VITE_RESTAURANT_ID is missing. App expects setApiRestaurantId to be called.');
}

/**
 * Checks availability using the Postgres RPC function
 * If RPC fails (e.g. SQL error on backend), falls back to client-side calculation.
 */
export const checkAvailability = async (date: string, turn: Turn, pax: number): Promise<AvailabilityResponse[]> => {
  const R_ID = getApiRestaurantId();
  try {
    // 0. PRE-CHECK: Check Blocked Days
    const { data: blocked } = await supabase
      .from('blocked_days')
      .select('date')
      .eq('restaurant_id', R_ID)
      .eq('date', date)
      .maybeSingle();

    if (blocked) {
      return []; // Date is blocked
    }

    // 0.a PRE-CHECK: Check Recurring Closed Weekdays
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('restaurant_id', R_ID)
      .eq('key', 'closed_weekdays')
      .maybeSingle();

    if (settingsData && settingsData.value) {
      const closedDays = settingsData.value.split(',').map(Number); // 0=Sun, 1=Mon...
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      if (closedDays.includes(dayOfWeek)) {
        return [];
      }
    }

    // 0.b PRE-CHECK: Check for Blocked Zones
    const { data: blockedZones } = await supabase
      .from('bookings')
      .select('zone_id')
      .eq('restaurant_id', R_ID)
      .eq('booking_date', date)
      .eq('turn', turn)
      .eq('status', 'blocked');

    const blockedZoneIds = new Set((blockedZones || []).map((b: any) => b.zone_id));

    // 1. Try RPC first (UPDATED SIGNATURE)
    const { data, error } = await supabase.rpc('check_availability', {
      check_date: date,
      check_turn: turn,
      check_pax: pax,
      check_restaurant_id: R_ID
    });

    if (error) {
      console.warn('RPC Error (switching to client-side fallback):', error.message);
      return await checkAvailabilityFallback(date, turn, pax, blockedZoneIds);
    }

    // 2. Fetch Zones to ensure we have names
    const { data: allZones } = await supabase
      .from('zones')
      .select('id, name_es, name_en, name')
      .eq('restaurant_id', R_ID);

    const zoneMap = new Map((allZones || []).map((z: any) => [
      z.id,
      { es: z.name_es || z.name, en: z.name_en || z.name }
    ]));

    // 3. Filter and Enrich data
    return (data as any[]).filter(z => !blockedZoneIds.has(z.zone_id)).map(z => ({
      ...z,
      zone_name_es: z.zone_name_es || zoneMap.get(z.zone_id)?.es || 'Zona ' + z.zone_id,
      zone_name_en: z.zone_name_en || zoneMap.get(z.zone_id)?.en || 'Zone ' + z.zone_id
    }));
  } catch (e) {
    console.error('Unexpected error in checkAvailability, using fallback:', e);
    return await checkAvailabilityFallback(date, turn, pax);
  }
};

/**
 * Client-Side Fallback for Availability
 */
const checkAvailabilityFallback = async (date: string, turn: Turn, pax: number, blockedZoneIds?: Set<number>): Promise<AvailabilityResponse[]> => {
  const R_ID = getApiRestaurantId();
  try {
    // 1. Check Blocked Days
    const { data: blocked } = await supabase
      .from('blocked_days')
      .select('date')
      .eq('restaurant_id', R_ID)
      .eq('date', date)
      .maybeSingle();

    if (blocked) {
      return [];
    }

    // 2. Get All Zones
    const { data: zones } = await supabase
      .from('zones')
      .select('*')
      .eq('restaurant_id', R_ID);

    if (!zones) return [];

    // 3. Get Suitable Tables
    const { data: suitableTables } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', R_ID)
      .gte('max_pax', pax)
      .lte('min_pax', pax);

    if (!suitableTables || suitableTables.length === 0) return [];

    // 4. Get Existing Bookings
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('assigned_table_id, consumes_capacity')
      .eq('restaurant_id', R_ID)
      .eq('booking_date', date)
      .eq('turn', turn)
      .not('status', 'in', '("cancelled","waiting_list")');

    const activeBookings = (existingBookings || []).filter((b: any) =>
      b.consumes_capacity !== false
    );

    const bookedTableIds = new Set(activeBookings.map((b: any) => b.assigned_table_id).filter(Boolean));

    // 5. Calculate Availability per Zone
    const availabilityMap = new Map<number, number>();
    zones.forEach((z: Zone) => availabilityMap.set(z.id, 0));

    suitableTables.forEach((t: Table) => {
      if (blockedZoneIds && blockedZoneIds.has(t.zone_id)) return;

      if (!bookedTableIds.has(t.id)) {
        const currentCount = availabilityMap.get(t.zone_id) || 0;
        availabilityMap.set(t.zone_id, currentCount + 1);
      }
    });

    const result: AvailabilityResponse[] = zones
      .map((z: Zone) => ({
        zone_id: z.id,
        zone_name_es: (z as any).zone_name_es || (z as any).name_es || z.name,
        zone_name_en: (z as any).zone_name_en || (z as any).name_en || z.name,
        available_slots: availabilityMap.get(z.id) || 0
      }))
      .filter(item => item.available_slots > 0);

    return result;

  } catch (err) {
    console.error('Fallback calculation failed:', err);
    return [];
  }
};

/**
 * Creates a booking or waiting list entry
 */
export const createBooking = async (formData: BookingFormData, isWaitlist: boolean = false): Promise<{ success: boolean; error?: string; bookingId?: string }> => {
  const R_ID = getApiRestaurantId();
  let status: BookingStatus = 'confirmed';

  // 1. Determine Initial Status via Settings
  if (formData.is_manual && formData.status) {
    // Admin/Manual override: Trust the provided status
    status = formData.status;
  } else if (isWaitlist) {
    status = 'waiting_list';
  } else {
    // Check Settings for Logic Mode
    const settings = await getSettings();
    const requireApproval = settings['require_manual_approval'] === 'true';

    // Check Payment requirement (Assuming DEPOSIT_PER_PAX global for now, could be setting)
    const needsPayment = formData.pax * DEPOSIT_PER_PAX > 0;

    // Priority: Manual Approval > Payment > Confirmed
    if (requireApproval) {
      status = 'pending_approval';
    } else if (needsPayment) {
      status = 'pending_payment'; // Payment flow precedence
    } else {
      status = 'confirmed'; // Auto-confirm
    }
  }

  const deposit = isWaitlist ? 0 : formData.pax * DEPOSIT_PER_PAX;

  // 2. Stripe Mock (only if pending_payment logic wasn't fully blocking usage, but here creating booking first)
  // Logic tweak: If status is 'pending_payment', we usually Create ID -> Pay -> Update status.
  // For this mock, we simulate payment success BEFORE insert if logic dictates.
  // But to be consistent with Typescript 'status' logic above:
  // REMOVED: Mock Payment Auto-Confirm logic. Status should remain 'pending_payment' until webhook updates it.
  // if (status === 'pending_payment') { ... }

  // Generate UUID
  const newBookingUUID = self.crypto.randomUUID();

  // AUTO-ASSIGNMENT LOGIC
  let finalAssignedTableId = formData.assigned_table_id;

  if (!finalAssignedTableId && (formData.consumes_capacity !== false) && formData.zone_id) {
    try {
      const { data: suitableTables } = await supabase
        .from('tables')
        .select('id')
        .eq('restaurant_id', R_ID)
        .eq('zone_id', formData.zone_id)
        .gte('max_pax', formData.pax)
        .lte('min_pax', formData.pax);

      if (suitableTables && suitableTables.length > 0) {
        const { data: occupied } = await supabase
          .from('bookings')
          .select('assigned_table_id')
          .eq('restaurant_id', R_ID)
          .eq('booking_date', formData.date)
          .eq('turn', formData.turn)
          .not('status', 'in', '("cancelled","waiting_list")') // Also exclude pending_approval? Maybe reserve table still? Yes.
          .not('assigned_table_id', 'is', null);

        const occupiedIds = new Set(occupied?.map((b: any) => b.assigned_table_id) || []);
        const freeTable = suitableTables.find(t => !occupiedIds.has(t.id));

        if (freeTable) finalAssignedTableId = freeTable.id;
      }
    } catch (err) { console.error('Auto-assign error', err); }
  }

  const { error } = await supabase
    .from('bookings')
    .insert([
      {
        uuid: newBookingUUID,
        restaurant_id: R_ID,       // Multi-tenant ID
        booking_date: formData.date,
        turn: formData.turn,
        time: formData.time,
        pax: formData.pax,
        zone_id: formData.zone_id,
        zone_name: formData.zone_name,
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        comments: formData.comments,
        status: status,                     // Determined status
        deposit_amount: deposit,
        is_manual: formData.is_manual || false,
        stripe_payment_intent_id: deposit > 0 ? `pi_sim_${Date.now()}` : null,
        assigned_table_id: finalAssignedTableId,
        consumes_capacity: formData.consumes_capacity
      }
    ]);

  if (error) {
    console.error('DB Insert Error:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }

  return { success: true, bookingId: newBookingUUID };
};

/**
 * Admin: Get bookings
 */
export const getBookingsByDate = async (date: string): Promise<Booking[]> => {
  const R_ID = getApiRestaurantId();
  const { data, error } = await supabase
    .from('bookings')
    .select('*, zones(name_es, name_en)')
    .eq('restaurant_id', R_ID)
    .eq('booking_date', date)
    .order('time', { ascending: true });

  if (error) { console.error('Error fetching bookings:', error); return []; }
  return data as Booking[];
};

/**
 * Admin: Check-in
 */
export const checkInBooking = async (bookingId: string): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('restaurant_id', R_ID)
    .eq('id', bookingId);
  return !error;
};

/**
 * Admin: No Show
 */
export const markNoShow = async (bookingId: string): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('restaurant_id', R_ID)
    .eq('id', bookingId);
  return !error;
};

/**
 * Admin: Update Booking
 */
export const updateBooking = async (bookingId: string, updates: Partial<BookingFormData>): Promise<{ success: boolean; error?: string }> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('bookings')
    .update({
      booking_date: updates.date,
      turn: updates.turn,
      time: updates.time,
      pax: updates.pax,
      zone_id: updates.zone_id,
      customer_name: updates.name,
      customer_email: updates.email,
      customer_phone: updates.phone,
      comments: updates.comments,
      deposit_amount: updates.deposit_amount,
      status: updates.status
    })
    .eq('restaurant_id', R_ID)
    .eq('id', bookingId);

  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const deleteBooking = async (bookingId: string): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('restaurant_id', R_ID)
    .eq('id', bookingId);
  return !error;
};

/**
 * Blocked Days
 */
export const getBlockedDays = async (): Promise<string[]> => {
  const R_ID = getApiRestaurantId();
  const { data, error } = await supabase
    .from('blocked_days')
    .select('date')
    .eq('restaurant_id', R_ID)
    .gte('date', new Date().toISOString().split('T')[0]);
  if (error) return [];
  return data.map((d: any) => d.date);
};

export const blockDay = async (date: string, reason: string = 'Closed'): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('blocked_days')
    .insert([{ date, reason, restaurant_id: R_ID }]);
  return !error;
};

export const unblockDay = async (date: string): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('blocked_days')
    .delete()
    .eq('restaurant_id', R_ID)
    .eq('date', date);
  return !error;
};

export const createBlockingBooking = async (date: string, turn: Turn, zoneId: number, reason: string, tableId?: number): Promise<boolean | string> => {
  const R_ID = getApiRestaurantId();
  const newBookingUUID = self.crypto.randomUUID();
  const bookingData: any = {
    uuid: newBookingUUID,
    restaurant_id: R_ID,
    booking_date: date,
    turn: turn,
    time: turn === 'lunch' ? '13:00' : '20:00',
    pax: 10,
    zone_id: zoneId,
    customer_name: `BLOQUEO: ${reason}`,
    customer_email: 'bloqueo@admin.com',
    customer_phone: '000000000',
    status: 'blocked',
    deposit_amount: 0
  };
  if (tableId) {
    bookingData.assigned_table_id = tableId;
    bookingData.pax = 4;
    bookingData.customer_name = `BLOQUEO MESA ${tableId}: ${reason}`;
  }
  const { error } = await supabase.from('bookings').insert([bookingData]);
  if (error) return error.message;
  return true;
};

/**
 * Settings
 */
export const getSettings = async (): Promise<Record<string, any>> => {
  const R_ID = getApiRestaurantId();
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('restaurant_id', R_ID);
  if (error) return {};

  const settings: Record<string, any> = {};
  data.forEach((row: any) => { settings[row.key] = row.value; });
  return settings;
};

export const updateSetting = async (key: string, value: string): Promise<boolean> => {
  const R_ID = getApiRestaurantId();
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, restaurant_id: R_ID }, { onConflict: 'key, restaurant_id' });
  return !error;
};

export const cancelBookingByUUID = async (uuid: string): Promise<{ success: boolean; error?: string }> => {
  const R_ID = getApiRestaurantId();
  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_date, time, restaurant_id, status')
    .eq('uuid', uuid)
    .single();

  if (!booking) return { success: false, error: 'Reserva no encontrada' };

  if (booking.restaurant_id !== R_ID) {
    return { success: false, error: 'Reserva no encontrada' };
  }

  // Check if already cancelled
  if (booking.status === 'cancelled') {
    return { success: true }; // Already cancelled
  }

  // Time-based cancellation check
  try {
    const settings = await getSettings();
    const minNoticeMinutes = parseInt(settings['min_notice_minutes'] || '1440');

    const bookingDateTime = new Date(`${booking.booking_date}T${booking.time}`);
    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes < minNoticeMinutes) {
      console.warn(`[API] Late cancellation attempt for booking ${uuid}. Diff: ${diffMinutes}m, Min: ${minNoticeMinutes}m`);
      return { success: false, error: 'LATE_CANCELLATION' };
    }
  } catch (err) {
    console.error('Error checking cancellation time limit:', err);
    // Continue despite error as fallback, or block? Blocking is safer for the business.
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('uuid', uuid);

  if (error) return { success: false, error: error.message };
  return { success: true };
};

/**
 * Stripe Mock
 */
const mockStripePayment = async (amount: number): Promise<{ success: boolean }> => new Promise(r => setTimeout(() => r({ success: true }), 1000));
const mockStripeRefund = async (id: string): Promise<{ success: boolean }> => new Promise(r => setTimeout(() => r({ success: true }), 1000));
