
import { Translation } from './types';

// Helper to safely get environment variables from Vite (import.meta.env) or standard (process.env)
const getEnvVar = (key: string, viteKey: string): string => {
  try {
    // Check for Vite
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[viteKey] || import.meta.env[key];
      if (val) return val;
    }

    // Check for Process (Webpack/CRA/Node)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      const val = process.env[viteKey] || process.env[key];
      if (val) return val;
    }
  } catch (e) {
    console.warn('Error reading env vars', e);
  }
  return '';
};

// Environment variables
export const SUPABASE_URL = getEnvVar('REACT_APP_SUPABASE_URL', 'VITE_SUPABASE_URL') || ''; // Hardcoded fallback removed for safety
export const SUPABASE_ANON_KEY = getEnvVar('REACT_APP_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || ''; // Hardcoded fallback removed for safety
export const STRIPE_PUBLIC_KEY = getEnvVar('REACT_APP_STRIPE_PUBLIC_KEY', 'VITE_STRIPE_PUBLIC_KEY');

// Project Isolation / Multi-tenancy
// If not provided in env, we could default to hardcoded "Tavernetta" ID for backward compatibility during dev,
// BUT for strict safety, we should ideally require it.
// For now, I'll put a placeholder. USER MUST SET THIS IN .ENV
export const RESTAURANT_ID = getEnvVar('REACT_APP_RESTAURANT_ID', 'VITE_RESTAURANT_ID');
// SuperAdmin Email for Route Protection
export const SUPERADMIN_EMAIL = getEnvVar('REACT_APP_SUPERADMIN_EMAIL', 'VITE_SUPERADMIN_EMAIL') || 'admin@portal.com';
// Site URL for Redirects (Password Reset)
export const SITE_URL = getEnvVar('REACT_APP_SITE_URL', 'VITE_SITE_URL') || (typeof window !== 'undefined' ? window.location.origin : '');

export const DEPOSIT_PER_PAX = 5;

// Time Slots Configuration
export const LUNCH_START = "13:00";
export const LUNCH_END = "15:30";
export const DINNER_START = "20:00";
export const DINNER_END = "22:30";

export const generateTimeSlots = (start: string, end: string) => {
  const slots = [];
  let [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
    const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push(timeString);

    currentMinute += 15;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour += 1;
    }
  }
  return slots;
};

export const TRANSLATIONS: Record<'es' | 'en', Translation> = {
  es: {
    title: "Portal de Reservas",
    subtitle: "Gestión de Reservas",
    step1: "Selecciona Fecha y Hora",
    step2: "Elige tu Zona",
    step3: "Tus Datos",
    date: "Fecha",
    turn: "Turno",
    time: "Hora de Llegada",
    pax: "Personas",
    lunch: "Comida",
    dinner: "Cena",
    search: "Buscar Mesa",
    zones: "Zonas Disponibles",
    tablesLeft: "mesas disponibles",
    noAvailability: "Lo sentimos, no hay mesas disponibles para esta selección.",
    waitingList: "Lista de Espera",
    details: "Datos de Contacto",
    name: "Nombre Completo",
    email: "Correo Electrónico",
    phone: "Teléfono",
    payment: "Pago de Fianza",
    depositNotice: `Se cobrará una fianza de ${DEPOSIT_PER_PAX}€ por persona. Este importe se devolverá automáticamente al hacer check-in en el restaurante.`,
    book: "Confirmar y Pagar",
    joinWaitlist: "Unirse a Lista de Espera",
    success: "¡Reserva Confirmada!",
    successWaitlist: "Te hemos añadido a la lista de espera.",
    adminLogin: "Acceso Administrativo",
  },
  en: {
    title: "Reservation Portal",
    subtitle: "Bookings Management",
    step1: "Select Date & Time",
    step2: "Choose Your Zone",
    step3: "Your Details",
    date: "Date",
    turn: "Shift",
    time: "Arrival Time",
    pax: "Guests",
    lunch: "Lunch",
    dinner: "Dinner",
    search: "Find Table",
    zones: "Available Zones",
    tablesLeft: "tables left",
    noAvailability: "Sorry, no tables available for this selection.",
    waitingList: "Waiting List",
    details: "Contact Details",
    name: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    payment: "Deposit Payment",
    depositNotice: `A deposit of €${DEPOSIT_PER_PAX} per person will be charged. This will be automatically refunded upon check-in.`,
    book: "Confirm & Pay",
    joinWaitlist: "Join Waiting List",
    success: "Booking Confirmed!",
    successWaitlist: "You have been added to the waiting list.",
    adminLogin: "Admin Access",
  }
};
