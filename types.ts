
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'waiting_list' | 'blocked' | 'pending_payment' | 'pending_approval';

export type Turn = 'lunch' | 'dinner';

export interface Zone {
  id: number;
  restaurant_id: string; // UUID
  name: string;
  name_es?: string;
  name_en?: string;
  description?: string;
  capacity?: number;
}

export interface Table {
  id: number;
  restaurant_id: string; // UUID
  zone_id: number;
  table_number: string;
  min_pax: number;
  max_pax: number;
}

export interface Booking {
  id: string; // UUID
  restaurant_id: string; // UUID
  created_at: string;
  booking_date: string; // YYYY-MM-DD (From DB)
  date?: string; // Legacy field mapping
  turn: Turn;
  time: string; // HH:MM
  pax: number;
  status: BookingStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  comments?: string;
  assigned_table_id?: number;
  zone_id?: number;
  payment_id?: string; // Stripe Payment Intent ID
  deposit_amount: number;
  is_manual?: boolean;
  consumes_capacity?: boolean; // Whether this booking affects availability
  // Joined data
  zones?: {
    name_es: string;
    name_en?: string;
  };
}

// Updated to match RPC: check_availability
export interface AvailabilityResponse {
  zone_id: number;
  zone_name_es: string;
  zone_name_en: string;
  available_slots: number;
}

export interface BlockedDay {
  date: string;
  reason?: string;
  restaurant_id: string;
}

export interface BookingFormData {
  date: string;
  turn: Turn | null;
  time: string | null;
  pax: number;
  zone_id: number | null;
  zone_name?: string;
  name: string;
  email: string;
  phone: string;
  comments?: string;
  deposit_amount?: number;
  status?: BookingStatus;
  consumes_capacity?: boolean;
  is_manual?: boolean;
  assigned_table_id?: number;
  restaurant_id?: string;
}

export interface Translation {
  title: string;
  subtitle: string;
  step1: string;
  step2: string;
  step3: string;
  date: string;
  turn: string;
  time: string;
  pax: string;
  lunch: string;
  dinner: string;
  search: string;
  zones: string;
  tablesLeft: string;
  noAvailability: string;
  waitingList: string;
  details: string;
  name: string;
  email: string;
  phone: string;
  payment: string;
  depositNotice: string;
  book: string;
  joinWaitlist: string;
  success: string;
  successWaitlist: string;
  adminLogin: string;
}