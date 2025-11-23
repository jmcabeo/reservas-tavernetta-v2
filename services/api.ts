
import { supabase } from './supabaseClient';
import { Booking, AvailabilityResponse, Turn, BookingFormData, BookingStatus, Zone, Table } from '../types';
import { DEPOSIT_PER_PAX } from '../constants';

/**
 * Checks availability using the Postgres RPC function
 * If RPC fails (e.g. SQL error on backend), falls back to client-side calculation.
 */
export const checkAvailability = async (date: string, turn: Turn, pax: number): Promise<AvailabilityResponse[]> => {
  try {
    // 0. PRE-CHECK: Check Blocked Days (Client-side override)
    // This ensures blocked days are respected even if the RPC doesn't check them
    const { data: blocked } = await supabase
      .from('blocked_days')
      .select('date')
      .eq('date', date)
      .maybeSingle();

    if (blocked) {
      return []; // Date is blocked
    }

    // 0.a PRE-CHECK: Check Recurring Closed Weekdays
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'closed_weekdays')
      .maybeSingle();

    if (settingsData && settingsData.value) {
      const closedDays = settingsData.value.split(',').map(Number); // 0=Sun, 1=Mon...
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      if (closedDays.includes(dayOfWeek)) {
        return []; // Date is on a closed weekday
      }
    }

    // 0.b PRE-CHECK: Check for Blocked Zones (Bookings with status 'blocked')
    const { data: blockedZones } = await supabase
      .from('bookings')
      .select('zone_id')
      .eq('booking_date', date)
      .eq('turn', turn)
      .eq('status', 'blocked');

    const blockedZoneIds = new Set((blockedZones || []).map((b: any) => b.zone_id));

    // 1. Try RPC first
    const { data, error } = await supabase.rpc('check_availability', {
      check_date: date,
      check_turn: turn,
      check_pax: pax
    });

    if (error) {
      console.warn('RPC Error (switching to client-side fallback):', error.message);
      return await checkAvailabilityFallback(date, turn, pax, blockedZoneIds);
    }

    // Filter out blocked zones from RPC result
    return (data as AvailabilityResponse[]).filter(z => !blockedZoneIds.has(z.zone_id));
  } catch (e) {
    console.error('Unexpected error in checkAvailability, using fallback:', e);
    return await checkAvailabilityFallback(date, turn, pax);
  }
};

/**
 * Client-Side Fallback for Availability
 * Replicates the logic of 'check_availability' using standard Supabase Selects.
 * Adapts the output to match the RPC signature (zone_name_es, etc)
 */
const checkAvailabilityFallback = async (date: string, turn: Turn, pax: number, blockedZoneIds?: Set<number>): Promise<AvailabilityResponse[]> => {
  try {
    // 1. Check Blocked Days
    const { data: blocked } = await supabase
      .from('blocked_days')
      .select('date')
      .eq('date', date)
      .maybeSingle();

    if (blocked) {
      return []; // Date is blocked
    }

    // 2. Get All Zones
    const { data: zones } = await supabase.from('zones').select('*');
    if (!zones) return [];

    // 3. Get Suitable Tables (capacity check)
    const { data: suitableTables } = await supabase
      .from('tables')
      .select('*')
      .gte('max_pax', pax)
      .lte('min_pax', pax);

    if (!suitableTables || suitableTables.length === 0) return [];

    // 4. Get Existing Bookings for this Date/Turn
    // We exclude cancelled and waiting_list
    // NOTE: Using 'booking_date' column
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('table_id')
      .eq('booking_date', date)
      .eq('turn', turn)
      .not('status', 'in', '("cancelled","waiting_list")');

    const bookedTableIds = new Set((existingBookings || []).map((b: any) => b.table_id).filter(Boolean));

    // 5. Calculate Availability per Zone
    const availabilityMap = new Map<number, number>();

    // Initialize counts
    zones.forEach((z: Zone) => availabilityMap.set(z.id, 0));

    // Count free tables
    suitableTables.forEach((t: Table) => {
      // Skip if zone is explicitly blocked
      if (blockedZoneIds && blockedZoneIds.has(t.zone_id)) return;

      if (!bookedTableIds.has(t.id)) {
        const currentCount = availabilityMap.get(t.zone_id) || 0;
        availabilityMap.set(t.zone_id, currentCount + 1);
      }
    });

    // Format Response to match RPC signature
    const result: AvailabilityResponse[] = zones
      .map((z: Zone) => ({
        zone_id: z.id,
        // Fallback: try to use specific cols if available in select *, otherwise fallback to name
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
  const status: BookingStatus = formData.status || (isWaitlist ? 'waiting_list' : 'confirmed');
  const deposit = isWaitlist ? 0 : formData.pax * DEPOSIT_PER_PAX;

  // 1. If not waitlist, we process payment via Stripe
  if (!isWaitlist) {
    const paymentResult = await mockStripePayment(deposit);
    if (!paymentResult.success) {
      return { success: false, error: 'El pago ha fallado. Por favor intente de nuevo.' };
    }
  }

  // Generate UUID client-side
  const newBookingUUID = self.crypto.randomUUID();

  // CRITICAL FIX: Map newBookingUUID to 'uuid' column, NOT 'id'.
  // 'id' is typically a bigint identity column and should be auto-generated by DB.
  const { error } = await supabase
    .from('bookings')
    .insert([
      {
        uuid: newBookingUUID,               // Correct UUID column
        booking_date: formData.date,
        turn: formData.turn,
        time: formData.time,
        pax: formData.pax,
        zone_id: formData.zone_id,
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        comments: formData.comments,
        status: status,
        deposit_amount: deposit,
        stripe_payment_intent_id: !isWaitlist ? `pi_sim_${Date.now()}` : null
      }
    ]);

  if (error) {
    console.error('DB Insert Error:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message || 'Database error' };
  }

  return { success: true, bookingId: newBookingUUID };
};

/**
 * Admin: Get bookings for a specific date
 * MUST INCLUDE JOIN to 'zones'
 */
export const getBookingsByDate = async (date: string): Promise<Booking[]> => {
  console.log(`[Admin] Fetching bookings for date: ${date}...`);

  // CRITICAL: Including zones join to get name_es
  const { data, error } = await supabase
    .from('bookings')
    .select('*, zones(name_es, name_en)')
    .eq('booking_date', date)
    .order('time', { ascending: true });

  if (error) {
    console.error('[Admin] Error fetching bookings:', JSON.stringify(error, null, 2));
    return [];
  }

  console.log('[Admin] Bookings data with zones:', data);

  return data as Booking[];
};

/**
 * Admin: Check-in (Triggers Refund)
 */
export const checkInBooking = async (bookingId: string): Promise<boolean> => {
  console.log('Processing Check-in for:', bookingId);

  // 1. Update status
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId);

  if (error) {
    console.error('Check-in DB Error:', JSON.stringify(error, null, 2));
    return false;
  }

  // 2. Trigger Refund (Mocked)
  await mockStripeRefund(bookingId);

  return true;
};

/**
 * Admin: No Show
 */
export const markNoShow = async (bookingId: string): Promise<boolean> => {
  console.log('Processing No-Show for:', bookingId);

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' }) // Money is kept
    .eq('id', bookingId);

  if (error) {
    console.error('No-Show DB Error:', JSON.stringify(error, null, 2));
    return false;
  }

  return true;
};

/**
 * Admin: Update Booking
 */
export const updateBooking = async (bookingId: string, updates: Partial<BookingFormData>): Promise<{ success: boolean; error?: string }> => {
  console.log('Updating booking:', bookingId, updates);

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
    .eq('id', bookingId);

  if (error) {
    console.error('Update Booking Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/**
 * Admin: Delete Booking (Hard Delete)
 * WARNING: This will trigger any DELETE webhooks configured in Supabase
 */
export const deleteBooking = async (bookingId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', bookingId);

  if (error) {
    console.error('Error deleting booking:', error);
    return false;
  }
  return true;
};

/**
 * Admin: Block Day Management
 */
export const getBlockedDays = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('blocked_days')
    .select('date')
    .gte('date', new Date().toISOString().split('T')[0]); // Only future blocks

  if (error) {
    console.error('Error fetching blocked days:', error);
    return [];
  }

  return data.map((d: any) => d.date);
};

export const blockDay = async (date: string, reason: string = 'Closed by Admin'): Promise<boolean> => {
  const { error } = await supabase
    .from('blocked_days')
    .insert([{ date, reason }]);

  if (error) {
    console.error('Error blocking day:', error);
    return false;
  }
  return true;
};

export const unblockDay = async (date: string): Promise<boolean> => {
  const { error } = await supabase
    .from('blocked_days')
    .delete()
    .eq('date', date);

  if (error) {
    console.error('Error unblocking day:', error);
    return false;
  }
  return true;
};

export const createBlockingBooking = async (date: string, turn: Turn, zoneId: number, reason: string, tableId?: number): Promise<boolean | string> => {
  // Simple UUID generator to avoid crypto issues
  const newBookingUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const bookingData: any = {
    uuid: newBookingUUID,
    booking_date: date,
    turn: turn,
    time: turn === 'lunch' ? '13:00' : '20:00', // Default time for block
    pax: 10, // Reduced from 100 to avoid potential constraint issues
    zone_id: zoneId,
    customer_name: `BLOQUEO: ${reason}`,
    customer_email: 'bloqueo@admin.com', // Valid email format
    customer_phone: '000000000',
    status: 'blocked',
    deposit_amount: 0
  };

  if (tableId && tableId > 0) {
    bookingData.table_id = tableId;
    bookingData.pax = 4; // Reasonable pax for table block
    bookingData.customer_name = `BLOQUEO MESA ${tableId}: ${reason}`;
  }

  console.log('Creating blocking booking:', bookingData);
  const { error } = await supabase
    .from('bookings')
    .insert([bookingData]);

  if (error) {
    console.error('Error creating blocking booking:', error);
    return error.message || JSON.stringify(error);
  }
  console.log('Blocking booking created successfully');
  return true;
};

/**
 * STRIPE SERVICES (Simulation Only - Required as no backend provided)
 */
const mockStripePayment = async (amount: number): Promise<{ success: boolean }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 1000);
  });
};

const mockStripeRefund = async (bookingId: string): Promise<{ success: boolean }> => {
  console.log(`Refunding deposit for booking ${bookingId}...`);
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Refund processed successfully.');
      resolve({ success: true });
    }, 1000);
  });
};

/**
 * Settings Management
 */
export const getSettings = async (): Promise<Record<string, any>> => {
  const { data, error } = await supabase
    .from('settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error);
    return {};
  }

  const settings: Record<string, any> = {};
  data.forEach((row: any) => {
    settings[row.key] = row.value;
  });
  return settings;
};

export const updateSetting = async (key: string, value: string): Promise<boolean> => {
  // Upsert to handle both insert and update
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value });

  if (error) {
    console.error('Error updating setting:', error);
    return false;
  }
  return true;
};

export const cancelBookingByUUID = async (uuid: string): Promise<{ success: boolean; error?: string }> => {
  // 1. Fetch booking details first
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('booking_date, time')
    .eq('uuid', uuid)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'Reserva no encontrada' };
  }

  // 2. Check 24h rule
  const bookingDateTime = new Date(`${booking.booking_date}T${booking.time}`);
  const now = new Date();
  const diffInHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return { success: false, error: 'LATE_CANCELLATION' };
  }

  // 3. Proceed with cancellation
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('uuid', uuid);

  if (error) {
    console.error('Error cancelling booking by UUID:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};
