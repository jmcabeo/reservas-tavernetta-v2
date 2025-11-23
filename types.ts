
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'waiting_list' | 'blocked' | 'pending_payment';

export type Turn = 'lunch' | 'dinner';

export interface Zone {
  id: number;
  name: string;
  name_es?: string;
  name_en?: string;
  description?: string;
  capacity?: number;
}

export interface Table {
  id: number;
  zone_id: number;
  table_number: string;
  min_pax: number;
  max_pax: number;
}

export interface Booking {
  id: string; // UUID
  created_at: string;
  date: string; // YYYY-MM-DD
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
}

export interface BookingFormData {
  date: string;
  turn: Turn | null;
  time: string | null;
  pax: number;
  zone_id: number | null;
  name: string;
  email: string;
  phone: string;
  comments?: string;
  deposit_amount?: number;
  status?: BookingStatus;
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