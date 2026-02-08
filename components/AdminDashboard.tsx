
import React, { useState, useEffect } from 'react';
import { LogOut, Calendar as CalendarIcon, Users, CheckCircle, XCircle, Loader2, Utensils, Plus, Eye, Phone, Mail, DollarSign, Settings } from 'lucide-react';
import { Booking, BookingStatus, Turn, Zone, Table, BookingFormData } from '../types';
import { getBookingsByDate, checkInBooking, markNoShow, createBooking, updateBooking, blockDay, unblockDay, getBlockedDays, createBlockingBooking, deleteBooking, getSettings, updateSetting, getApiRestaurantId, getUpcomingBookings } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { generateTimeSlots, LUNCH_START, LUNCH_END, DINNER_START, DINNER_END } from '../constants';
import AdminSettings from './AdminSettings';

interface Props {
  onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [turnFilter, setTurnFilter] = useState<Turn | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all' | 'waitlist' | 'cancelled' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'settings' | 'upcoming'>('table');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Booking Detail Modal State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Manual Booking Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState<BookingFormData>({
    date: new Date().toISOString().split('T')[0],
    turn: 'lunch',
    time: '13:00',
    pax: 2,
    zone_id: 1,
    name: '',
    email: '',
    phone: '',
    deposit_amount: 0,
    status: 'confirmed',
    consumes_capacity: localStorage.getItem('consumes_capacity_pref') !== 'false'
  });

  // Edit Booking State
  const [isEditing, setIsEditing] = useState(false);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Blocking Management State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockedDays, setBlockedDays] = useState<string[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');

  // Settings State
  const [depositEnabled, setDepositEnabled] = useState<boolean>(true);
  const [flexibleCapacity, setFlexibleCapacity] = useState<boolean>(false);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');

  // Zone Blocking State
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [blockZoneForm, setBlockZoneForm] = useState<{
    date: string;
    turn: Turn;
    zoneId: number;
    reason: string;
    tableId?: number;
  }>({
    date: new Date().toISOString().split('T')[0],
    turn: 'lunch',
    zoneId: 1,
    reason: '',
    tableId: undefined
  });

  // New state for dynamic table availability in manual form
  const [occupiedTables, setOccupiedTables] = useState<Set<number>>(new Set());

  // Effect to fetch occupied tables when manual form date/turn changes
  useEffect(() => {
    const fetchOccupiedTables = async () => {
      if (!showManualModal && !isEditing) return;

      // Always fetch fresh bookings for the specific date to ensure accuracy
      // This prevents issues where the local 'bookings' state might be stale (e.g. realtime lag)
      try {
        console.log(`[Admin] Fetching occupied tables for ${manualForm.date} ${manualForm.turn}`);
        const bookingsForDate = await getBookingsByDate(manualForm.date);
        console.log('[Admin] Bookings for date:', bookingsForDate);

        const occupied = new Set(
          bookingsForDate
            .filter(b => {
              const isTurn = b.turn === manualForm.turn;
              const isStatus = b.status !== 'cancelled' && b.status !== 'waiting_list';
              const hasTable = !!b.assigned_table_id;
              // console.log(`Booking ${b.id}: Turn=${isTurn}, Status=${isStatus}, Table=${b.assigned_table_id}`);
              return isTurn && isStatus && hasTable;
            })
            .map(b => Number(b.assigned_table_id)) // Force number conversion
        );
        console.log('[Admin] Occupied Table IDs:', Array.from(occupied));
        setOccupiedTables(occupied);
      } catch (err) {
        console.error("Error fetching occupied tables:", err);
      }
    };

    fetchOccupiedTables();
  }, [manualForm.date, manualForm.turn, showManualModal, isEditing, date, bookings]);

  // New state for occupied tables in Block Modal
  const [occupiedTablesBlock, setOccupiedTablesBlock] = useState<Set<number>>(new Set());

  // Effect to fetch occupied tables when block modal date/turn changes
  useEffect(() => {
    const fetchOccupiedTablesBlock = async () => {
      if (!showBlockModal) return;

      try {
        console.log(`[Admin Block] Fetching occupied tables for ${blockZoneForm.date} ${blockZoneForm.turn}`);
        const bookingsForDate = await getBookingsByDate(blockZoneForm.date);

        const occupied = new Set(
          bookingsForDate
            .filter(b => {
              const isTurn = b.turn === blockZoneForm.turn;
              const isStatus = b.status !== 'cancelled' && b.status !== 'waiting_list';
              const hasTable = !!b.assigned_table_id;
              return isTurn && isStatus && hasTable;
            })
            .map(b => Number(b.assigned_table_id))
        );
        console.log('[Admin Block] Occupied Table IDs:', Array.from(occupied));
        setOccupiedTablesBlock(occupied);
      } catch (err) {
        console.error("Error fetching occupied tables for block:", err);
      }
    };

    fetchOccupiedTablesBlock();
  }, [blockZoneForm.date, blockZoneForm.turn, showBlockModal, date, bookings]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Calendar helper functions
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: '', day: 0, isCurrentMonth: false });
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date: dateStr, day, isCurrentMonth: true });
    }

    return days;
  };

  // Update manual time options when turn changes
  const manualTimeSlots = manualForm.turn === 'lunch'
    ? generateTimeSlots(LUNCH_START, LUNCH_END)
    : generateTimeSlots(DINNER_START, DINNER_END);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      let data;
      if (viewMode === 'upcoming') {
        data = await getUpcomingBookings(50);
      } else {
        data = await getBookingsByDate(date);
      }

      // Normalize data: ensure date is always set from booking_date for legacy UI
      const normalizedData = (data || []).map(b => ({
        ...b,
        date: b.date || (b as any).booking_date
      }));

      setBookings(normalizedData);
    } catch (e) {
      console.error("Error loading bookings:", e);
      showToast("Error cargando reservas", "error");
    }
    setLoading(false);
  };

  const fetchBlockedDays = async () => {
    const days = await getBlockedDays();
    setBlockedDays(days);
  };

  const fetchZones = async () => {
    const { data, error } = await supabase.from('zones').select('*');
    console.log('Fetching Zones:', data, error);
    if (data && data.length > 0) {
      console.log('First Zone:', data[0]);
      setZones(data);
      // Set default zone ID to the first zone found
      setBlockZoneForm(prev => ({ ...prev, zoneId: data[0].id }));
    }
  };

  const fetchTables = async () => {
    const { data, error } = await supabase.from('tables').select('*');
    console.log('Fetching Tables:', data, error);
    if (data) setTables(data);
  };

  const fetchSettings = async () => {
    const settings = await getSettings();
    // Default to true if not set
    setDepositEnabled(settings['enable_deposit'] !== 'false');
    setFlexibleCapacity(settings['flexible_capacity'] === 'true');
    if (settings['closed_weekdays']) {
      setClosedWeekdays(settings['closed_weekdays'].split(',').map(Number));
    }
    if (settings['logo_url']) {
      setLogoUrl(settings['logo_url']);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchZones();
    fetchTables();
    fetchSettings();
    fetchBlockedDays(); // Added this call

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('bookings_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, viewMode]);

  const handleCheckIn = async (id: string) => {
    console.log("Click on Check-in for ID:", id);
    // Removed confirm() dialog to prevent blocking in preview
    const success = await checkInBooking(id);
    if (success) {
      showToast('Check-in realizado con éxito. Fianza devuelta.', 'success');
      fetchBookings(); // Reload table
    } else {
      showToast('Error al realizar check-in. Revisa la consola.', 'error');
    }
  };

  const handleNoShow = async (id: string) => {
    console.log("Click on No-Show for ID:", id);
    // Removed confirm() dialog to prevent blocking in preview
    const success = await markNoShow(id);
    if (success) {
      showToast('Reserva marcada como No-Show.', 'success');
      fetchBookings(); // Reload table
    } else {
      showToast('Error al actualizar estado. Revisa la consola.', 'error');
    }
  };

  const handleQuickApprove = async (booking: Booking) => {
    // Determine next status based on whether deposit is required
    // Logic: If deposit is enabled, it goes to 'pending_payment' so user receives link.
    // If no deposit, it goes straight to 'confirmed'.
    const nextStatus = depositEnabled ? 'pending_payment' : 'confirmed';

    const res = await updateBooking(booking.id, { status: nextStatus });
    if (res.success) {
      showToast(`Reserva aprobada. Pasa a: ${nextStatus === 'pending_payment' ? 'PENDIENTE PAGO' : 'CONFIRMADA'}`, 'success');

      // Trigger Webhook for n8n to send email/link
      try {
        const webhookUrl = 'https://n8n.captialeads.com/webhook/nueva-reserva';
        const updatedBooking = { ...booking, status: nextStatus };

        // We need to fetch current restaurant_id or assume context.
        // Assuming booking object has what we need or we can construct minimal payload.
        // Ideally we should have the full payload structure PublicBooking sends.
        // Let's send the updated booking object which n8n should handle.

        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': import.meta.env.VITE_WEBHOOK_SECRET || 'omnia_secret_key'
          },
          body: JSON.stringify({
            event: 'booking_updated',
            booking: updatedBooking,
            restaurant_id: booking.restaurant_id // Ensure this exists in Booking type
          })
        });
        console.log('Webhook triggered for Quick Approve');
      } catch (err) {
        console.error('Webhook trigger failed', err);
      }

      fetchBookings();
    } else {
      showToast('Error al aprobar reserva', 'error');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que no sea una hora pasada para hoy
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (manualForm.date === todayStr) {
      // Convertir hora seleccionada a minutos para comparar
      const [selectedHour, selectedMinute] = manualForm.time ? manualForm.time.split(':').map(Number) : [0, 0];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const selectedTimeInMinutes = selectedHour * 60 + selectedMinute;
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Permitir un margen de error? No, el usuario pidió estricto ("no deberia dejarme")
      if (selectedTimeInMinutes < currentTimeInMinutes) {
        showToast('No puedes crear una reserva en una hora que ya ha pasado.', 'error');
        return;
      }
    }

    // Extract zone name from zones array
    const selectedZone = zones.find(z => z.id === Number(manualForm.zone_id));
    const zoneName = selectedZone ? (selectedZone.name_es || selectedZone.name) : '';

    // Mark as manual booking from admin and include zone name
    const manualBookingData = {
      ...manualForm,
      is_manual: true,
      zone_name: zoneName
    };

    const res = await createBooking(manualBookingData, false);
    if (res.success) {
      showToast('Reserva manual creada correctamente', 'success');

      // Trigger Webhook
      try {
        const webhookUrl = 'https://n8n.captialeads.com/webhook/nueva-reserva';
        // Construct booking object with ID if available (res.bookingId)
        const bookingForWebhook = {
          ...manualBookingData,
          id: res.bookingId,
          uuid: res.bookingId,
          booking_date: manualBookingData.date,
          customer_name: manualBookingData.name,
          customer_email: manualBookingData.email,
          customer_phone: manualBookingData.phone,
          status: manualBookingData.status || 'confirmed',
          restaurant_id: getApiRestaurantId()
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': import.meta.env.VITE_WEBHOOK_SECRET || 'omnia_secret_key'
          },
          body: JSON.stringify({
            event: 'booking_created', // Use created event for new bookings
            booking: bookingForWebhook,
            restaurant_id: getApiRestaurantId() // Redundant but consistent
          })
        });
        console.log('Webhook booking_created trigger sent');
      } catch (err) { console.error('Webhook trigger error', err); }

      setShowManualModal(false);
      fetchBookings();
    } else {
      showToast(res.error || 'Error creando reserva', 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    // Use manualForm as the container for edit data
    const res = await updateBooking(selectedBooking.id, manualForm);
    if (res.success) {
      showToast('Reserva actualizada correctamente', 'success');

      // Trigger Webhook
      try {
        const webhookUrl = 'https://n8n.captialeads.com/webhook/nueva-reserva';
        const updatedBooking = { ...selectedBooking, ...manualForm };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': import.meta.env.VITE_WEBHOOK_SECRET || 'omnia_secret_key'
          },
          body: JSON.stringify({
            event: 'booking_updated',
            booking: updatedBooking,
            restaurant_id: selectedBooking.restaurant_id
          })
        });
      } catch (err) { console.error('Webhook trigger error', err); }

      setIsEditing(false);
      setSelectedBooking(null);
      fetchBookings();
    } else {
      showToast(res.error || 'Error actualizando reserva', 'error');
    }
  };

  const openEditModal = (booking: Booking) => {
    console.log("[DEBUG] Opening Edit Modal v2.1 for booking:", booking);

    // Determine date - map booking_date to date if needed
    let bDateRaw = booking.date || (booking as any).booking_date;
    let bDate = '';

    if (bDateRaw) {
      bDate = String(bDateRaw).split('T')[0];
    } else {
      bDate = new Date().toISOString().split('T')[0];
    }

    // Determine capacity consumption
    // PRIORITY: If flexibleCapacity is ON, we force it to OFF (false).
    const shouldConsume = flexibleCapacity ? false : (booking.consumes_capacity ?? true);

    console.log("[DEBUG] Final Date for form:", bDate);
    console.log("[DEBUG] Final Consumes Capacity:", shouldConsume);

    setManualForm({
      date: bDate,
      turn: booking.turn || 'lunch',
      time: booking.time || '13:00',
      pax: booking.pax || 2,
      zone_id: booking.zone_id || 1,
      name: booking.customer_name || '',
      email: booking.customer_email || '',
      phone: booking.customer_phone || '',
      comments: booking.comments || '',
      deposit_amount: booking.deposit_amount || 0,
      status: booking.status || 'confirmed',
      consumes_capacity: shouldConsume
    });
    setSelectedBooking(booking);
    setIsEditing(true);
  };

  const handleDeleteBooking = async () => {
    console.warn('🔴 DELETE BUTTON CLICKED');
    if (!selectedBooking) {
      console.error('No selectedBooking!');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedBooking) return;

    console.log('Calling deleteBooking with id:', selectedBooking.id);
    const success = await deleteBooking(selectedBooking.id);
    console.log('deleteBooking result:', success);

    if (success) {
      showToast('Reserva eliminada correctamente', 'success');
      setSelectedBooking(null);
      setIsEditing(false);
      setShowManualModal(false);
      setShowDeleteConfirm(false);
      fetchBookings();
    } else {
      showToast('Error al eliminar la reserva', 'error');
      setShowDeleteConfirm(false);
    }
  };

  const handleBlockDay = async () => {
    if (!newBlockDate) return;
    const success = await blockDay(newBlockDate);
    if (success) {
      showToast('Día bloqueado correctamente', 'success');
      setNewBlockDate('');
      fetchBlockedDays();
    } else {
      showToast('Error al bloquear día', 'error');
    }
  };

  const handleUnblockDay = async (dateToUnblock: string) => {
    const success = await unblockDay(dateToUnblock);
    if (success) {
      showToast('Día desbloqueado', 'success');
      fetchBlockedDays();
    } else {
      showToast('Error al desbloquear', 'error');
    }
  };

  const handleBlockZone = async () => {
    console.warn('🔴 BLOQUEAR ZONA BUTTON CLICKED!');
    console.log('handleBlockZone called', blockZoneForm);
    if (!blockZoneForm.reason) {
      showToast("Introduce una razón", "error");
      return;
    }
    console.log('Blocking Zone/Table:', blockZoneForm);

    // Validate Table ID if in table blocking mode
    if (blockZoneForm.tableId !== undefined && (blockZoneForm.tableId <= 0 || isNaN(blockZoneForm.tableId))) {
      showToast("Error: Selecciona una mesa válida", "error");
      return;
    }

    try {
      const result = await createBlockingBooking(
        blockZoneForm.date,
        blockZoneForm.turn,
        blockZoneForm.zoneId,
        blockZoneForm.reason,
        blockZoneForm.tableId
      );

      if (result === true) {
        showToast(blockZoneForm.tableId ? "Mesa bloqueada" : "Zona bloqueada", "success");
        setShowBlockModal(false);
        fetchBookings();
      } else {
        // result is the error message
        showToast("Error: " + result, "error");
      }
    } catch (error) {
      console.error('Error blocking:', error);
      const msg = "Error al bloquear: " + ((error as any).message || JSON.stringify(error));
      showToast(msg, "error");
    }
  };

  const filteredBookings = bookings.filter(b => {
    // Turn filter
    if (turnFilter !== 'all' && b.turn !== turnFilter) return false;

    // Status filter
    if (statusFilter === 'waitlist') {
      if (b.status !== 'waiting_list') return false;
    } else if (statusFilter !== 'all') {
      if (b.status !== statusFilter) return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = b.customer_name.toLowerCase().includes(query);
      const matchesEmail = b.customer_email.toLowerCase().includes(query);
      const matchesPhone = b.customer_phone.toLowerCase().includes(query);
      const matchesId = String(b.id).toLowerCase().includes(query);

      if (!matchesName && !matchesEmail && !matchesPhone && !matchesId) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // If showing waitlist, sort by created_at (FIFO)
    if (statusFilter === 'waitlist') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
  });

  const stats = {
    lunch: bookings.filter(b => b.turn === 'lunch' && b.status !== 'cancelled').reduce((acc, b) => acc + b.pax, 0),
    dinner: bookings.filter(b => b.turn === 'dinner' && b.status !== 'cancelled').reduce((acc, b) => acc + b.pax, 0),
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded shadow-xl text-white font-bold text-sm animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.message}
        </div>
      )}

      <nav className="bg-primary shadow-md border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain bg-white/10 rounded px-2" />
          ) : (
            <Utensils className="text-secondary" />
          )}
          <span className="font-bold text-xl text-white">Admin Panel <span className="text-secondary font-sans text-xs uppercase tracking-widest ml-2">Manager</span></span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setViewMode(viewMode === 'settings' ? 'table' : 'settings')}
            className={`flex items-center gap-2 text-xs uppercase font-bold tracking-wider transition-colors ${viewMode === 'settings' ? 'text-secondary' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" /> Configuración
          </button>
          <button onClick={onLogout} className="text-gray-400 hover:text-white flex items-center gap-2 text-xs uppercase font-bold tracking-wider">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Settings View */}
        {viewMode === 'settings' ? (
          <AdminSettings onSettingsChange={fetchSettings} />
        ) : (
          <div>
            {/* Controls Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6 border-l-4 border-secondary">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Fecha</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-3 w-4 h-4 text-secondary" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (viewMode === 'upcoming') setViewMode('table');
                      }}
                      className={`pl-10 pr-4 py-2 border rounded focus:ring-1 focus:ring-secondary outline-none bg-gray-50 ${viewMode === 'upcoming' ? 'opacity-50' : ''}`}
                    />
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <label className="text-xs font-bold uppercase text-gray-500 block mb-2">Buscar</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nombre, email, teléfono o ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-4 pr-10 py-2 border rounded focus:ring-1 focus:ring-secondary outline-none bg-gray-50"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded">
                    <span className="text-xs font-bold uppercase block text-gray-500">Pax Comida</span>
                    <span className="text-2xl font-bold text-gray-900">{stats.lunch}</span>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded">
                    <span className="text-xs font-bold uppercase block text-gray-500">Pax Cena</span>
                    <span className="text-2xl font-bold text-gray-900">{stats.dinner}</span>
                  </div>

                  {/* Deposit Toggle Moved Here */}
                  <div className="flex flex-col justify-center items-center px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm">
                    <span className="text-xs font-bold uppercase block text-gray-500 mb-1">Fianza</span>
                    <button
                      onClick={async () => {
                        const newValue = !depositEnabled;
                        setDepositEnabled(newValue);
                        await updateSetting('enable_deposit', String(newValue));
                        showToast(`Fianza ${newValue ? 'activada' : 'desactivada'}`, 'success');
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${depositEnabled ? 'bg-secondary' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${depositEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                  {/* Turn Filter Select */}
                  <div className="w-full md:w-auto">
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1 md:hidden">Turno</label>
                    <select
                      value={turnFilter}
                      onChange={(e) => setTurnFilter(e.target.value as any)}
                      className="w-full md:w-auto px-3 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 bg-white focus:border-secondary outline-none rounded"
                    >
                      <option value="all">Todos los Turnos</option>
                      <option value="lunch">Comida</option>
                      <option value="dinner">Cena</option>
                    </select>
                  </div>

                  {/* Status Filter Select */}
                  <div className="w-full md:w-auto">
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1 md:hidden">Estado</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full md:w-auto px-3 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 bg-white focus:border-secondary outline-none rounded"
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="waitlist">Lista de Espera</option>
                      <option value="confirmed">Confirmadas</option>
                      <option value="pending_payment">Pendiente Pago</option>
                      <option value="pending_approval">Pendiente Aprobación</option>
                      <option value="cancelled">Canceladas</option>
                      <option value="blocked">Bloqueos</option>
                    </select>
                  </div>
                </div>



                <div className="flex gap-2 ml-auto items-center mt-4 md:mt-0">

                  <button
                    type="button"
                    onClick={() => { fetchBlockedDays(); setShowBlockModal(true); }}
                    className="bg-white border border-gray-300 text-gray-600 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Bloqueos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualForm({
                        date: new Date().toISOString().split('T')[0],
                        turn: 'lunch',
                        time: '13:00',
                        pax: 2,
                        zone_id: 1,
                        name: '',
                        email: '',
                        phone: '',
                        deposit_amount: 0,
                        status: 'confirmed',
                        consumes_capacity: !flexibleCapacity
                      });
                      setShowManualModal(true);
                    }}
                    className="bg-primary text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2 transition-opacity rounded"
                  >
                    <Plus className="w-4 h-4" /> Nueva Reserva
                  </button>
                </div>

                <div className="flex gap-2 ml-auto items-center mt-4 md:mt-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (viewMode === 'upcoming') {
                        setViewMode('table');
                      } else {
                        setViewMode('upcoming');
                      }
                    }}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors border ${viewMode === 'upcoming' ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {viewMode === 'upcoming' ? 'Ver por Día' : 'Ver Próximas'}
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar View */}
            {
              viewMode === 'calendar' && (
                <div className="bg-white shadow-lg p-6 border-t border-gray-100">
                  {(() => {
                    const currentDate = new Date(date);
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const calendarDays = generateCalendarDays(year, month);
                    const monthName = new Date(year, month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

                    return (
                      <>
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-2xl font-bold text-gray-900 capitalize">{monthName}</h3>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const prev = new Date(year, month - 1, 1);
                                setDate(prev.toISOString().split('T')[0]);
                              }}
                              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 font-bold text-xs uppercase"
                            >
                              ← Anterior
                            </button>
                            <button
                              type="button"
                              onClick={() => setDate(new Date().toISOString().split('T')[0])}
                              className="px-4 py-2 border border-secondary bg-secondary text-white font-bold text-xs uppercase hover:opacity-90 rounded"
                            >
                              Hoy
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Date(year, month + 1, 1);
                                setDate(next.toISOString().split('T')[0]);
                              }}
                              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 font-bold text-xs uppercase"
                            >
                              Siguiente →
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                            <div key={day} className="text-center font-bold text-xs uppercase text-gray-500 py-2">
                              {day}
                            </div>
                          ))}

                          {calendarDays.map((dayInfo, index) => {
                            if (!dayInfo.isCurrentMonth) {
                              return <div key={index} className="aspect-square" />;
                            }

                            const isToday = dayInfo.date === new Date().toISOString().split('T')[0];
                            const isSelected = dayInfo.date === date;

                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setDate(dayInfo.date);
                                  setViewMode('table');
                                }}
                                className={`aspect-square border rounded p-2 flex flex-col items-center justify-center transition-all hover:shadow-md
                            ${isSelected ? 'border-secondary bg-secondary text-white ring-2 ring-secondary' : 'border-gray-200 hover:border-secondary'}
                            ${isToday && !isSelected ? 'bg-blue-50 border-blue-300' : ''}
                          `}
                              >
                                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                  {dayInfo.day}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )
            }

            {/* Table */}
            {
              (viewMode === 'table' || viewMode === 'upcoming') && (
                <div className="bg-white shadow-lg overflow-hidden border-t border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                        <tr>
                          {statusFilter === 'waitlist' && <th className="p-4 font-medium">#</th>}
                          {viewMode === 'upcoming' && <th className="p-4 font-medium">Fecha</th>}
                          <th className="p-4 font-medium">Hora</th>
                          <th className="p-4 font-medium">Cliente</th>
                          <th className="p-4 font-medium">Pax</th>
                          <th className="p-4 font-medium">Zona</th>
                          <th className="p-4 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                          <tr><td colSpan={statusFilter === 'waitlist' ? 7 : 6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-secondary" /></td></tr>
                        ) : filteredBookings.length === 0 ? (
                          <tr><td colSpan={statusFilter === 'waitlist' || viewMode === 'upcoming' ? 7 : 6} className="p-8 text-center text-gray-500 italic">No hay reservas para este {viewMode === 'upcoming' ? 'periodo' : 'día/turno'}.</td></tr>
                        ) : (
                          filteredBookings.map((b, index) => {
                            // Safely handle ID as string
                            const bookingId = String(b.id);
                            // Safely handle Zone Name
                            const zoneName = b.zones?.name_es || `Zona ${b.zone_id}`;

                            return (
                              <tr key={bookingId} className="hover:bg-gray-50 transition-colors">
                                {statusFilter === 'waitlist' && (
                                  <td className="p-4">
                                    <div className="w-8 h-8 bg-amber-500 text-white font-bold rounded-full flex items-center justify-center">
                                      {index + 1}
                                    </div>
                                  </td>
                                )}
                                {viewMode === 'upcoming' && (
                                  <td className="p-4">
                                    <div className="text-xs font-bold text-gray-500 uppercase">
                                      {new Date(b.booking_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </div>
                                  </td>
                                )}
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    {b.turn === 'lunch' ? <span className="w-2 h-2 rounded-full bg-secondary" title="Comida"></span> : <span className="w-2 h-2 rounded-full bg-primary" title="Cena"></span>}
                                    <span className="font-bold text-gray-900 text-lg">{b.time}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="font-bold text-gray-900">{b.customer_name}</div>
                                  <div className="text-xs text-gray-400 tracking-wide hidden sm:block">#{bookingId.slice(0, 8)}</div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <Users className="w-4 h-4 text-secondary" /> {b.pax}
                                  </div>
                                </td>
                                <td className="p-4 text-gray-600 italic">
                                  {zoneName}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border
                           ${b.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                           ${b.status === 'completed' ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
                           ${b.status === 'pending_payment' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                           ${b.status === 'pending_approval' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                           ${b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' : ''}
                           ${b.status === 'waiting_list' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : ''}
                           ${b.status === 'blocked' ? 'bg-gray-800 text-white border-gray-800' : ''}
`}>
                                    {b.status === 'waiting_list' ? 'LISTA ESPERA' :
                                      b.status === 'pending_payment' ? 'PENDIENTE PAGO' :
                                        b.status === 'pending_approval' ? 'PENDIENTE APROBAR' :
                                          b.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setSelectedBooking(b)}
                                      title="Ver Detalles"
                                      className="p-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors rounded-sm"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>

                                    {b.status === 'pending_approval' && (
                                      <button
                                        onClick={() => handleQuickApprove(b)}
                                        title="Aprobar Rápido"
                                        className="p-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors rounded-sm"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    )}

                                    {b.status === 'confirmed' && (
                                      <>
                                        <button
                                          onClick={() => handleCheckIn(bookingId)}
                                          title="Check In"
                                          className="p-2 bg-white border border-green-200 text-green-600 hover:bg-green-50 transition-colors rounded-sm"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleNoShow(bookingId)}
                                          title="No Show"
                                          className="p-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors rounded-sm"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </div>
        )}
      </main>

      {/* DETAILS MODAL */}
      {
        selectedBooking && !isEditing && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedBooking(null)}>
            <div className="bg-white p-8 max-w-md w-full border-t-4 border-tav-gold shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif font-bold text-tav-black">Detalle Reserva</h3>
                <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-tav-black"><XCircle /></button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-tav-gold font-bold text-xl">
                    {selectedBooking.customer_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedBooking.customer_name}</p>
                    <p className="text-sm text-gray-500">ID: #{String(selectedBooking.id)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-100">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-tav-gold" />
                    <a href={`tel:${selectedBooking.customer_phone} `} className="hover:underline">{selectedBooking.customer_phone}</a>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-tav-gold" />
                    <a href={`mailto:${selectedBooking.customer_email} `} className="hover:underline truncate">{selectedBooking.customer_email}</a>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-tav-gold" />
                    <span>{selectedBooking.pax} Personas</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <DollarSign className="w-4 h-4 text-tav-gold" />
                    <span>Fianza: €{selectedBooking.deposit_amount}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 text-sm text-gray-600 space-y-1">
                  <p><strong>Zona:</strong> {selectedBooking.zones?.name_es || ('Zona ' + selectedBooking.zone_id)}</p>
                  <p><strong>Fecha:</strong> {selectedBooking.date}</p>
                  <p><strong>Hora:</strong> {selectedBooking.time}</p>
                  <p><strong>Estado:</strong> <span className="uppercase font-bold">{selectedBooking.status}</span></p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {selectedBooking.status === 'confirmed' && (
                      <>
                        <button onClick={() => { handleCheckIn(String(selectedBooking.id)); setSelectedBooking(null); }} className="flex-1 py-3 bg-green-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-green-700">Check-in</button>
                        <button onClick={() => { handleNoShow(String(selectedBooking.id)); setSelectedBooking(null); }} className="flex-1 py-3 bg-red-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-700">No-Show</button>
                      </>
                    )}
                  </div>
                  <button onClick={() => openEditModal(selectedBooking)} className="w-full py-3 bg-tav-black text-tav-gold text-xs font-bold uppercase tracking-widest hover:bg-gray-900">Editar Reserva</button>
                  <button onClick={() => setSelectedBooking(null)} className="w-full py-3 border border-gray-300 text-gray-500 text-xs font-bold uppercase tracking-widest hover:bg-gray-100">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* EDIT / MANUAL BOOKING MODAL */}
      {
        (showManualModal || isEditing) && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-8 max-w-md w-full border-t-4 border-tav-gold shadow-2xl">
              <h3 className="text-xl font-serif font-bold mb-6 text-tav-black">
                {isEditing ? 'Editar Reserva v2.1' : 'Nueva Reserva Manual'}
              </h3>
              <form onSubmit={isEditing ? handleEditSubmit : handleManualSubmit} className="space-y-4">
                <input
                  type="text" placeholder="Nombre Cliente" required
                  className="w-full border-b p-2 focus:border-tav-gold outline-none"
                  value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                />
                <input
                  type="email" placeholder="Email Cliente"
                  className="w-full border-b p-2 focus:border-tav-gold outline-none"
                  value={manualForm.email} onChange={e => setManualForm({ ...manualForm, email: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="tel" placeholder="Teléfono" required
                    className="w-full border-b p-2 focus:border-tav-gold outline-none"
                    value={manualForm.phone} onChange={e => setManualForm({ ...manualForm, phone: e.target.value })}
                  />
                  <input
                    type="number" placeholder="Pax" required min="1"
                    className="w-full border-b p-2 focus:border-tav-gold outline-none"
                    value={manualForm.pax} onChange={e => setManualForm({ ...manualForm, pax: parseInt(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select className="border-b p-2 focus:border-tav-gold outline-none bg-white" value={manualForm.turn!} onChange={e => setManualForm({ ...manualForm, turn: e.target.value as Turn, time: e.target.value === 'lunch' ? LUNCH_START : DINNER_START })}>
                    <option value="lunch">Comida</option>
                    <option value="dinner">Cena</option>
                  </select>
                  <select className="border-b p-2 focus:border-tav-gold outline-none bg-white" value={manualForm.time!} onChange={e => setManualForm({ ...manualForm, time: e.target.value })}>
                    {manualTimeSlots.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1">
                  <input type="date" className="border-b p-2 focus:border-tav-gold outline-none" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} />
                </div>

                <div className="grid grid-cols-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Zona</label>
                  <select
                    className="w-full border-b p-2 focus:border-tav-gold outline-none bg-white"
                    value={manualForm.zone_id || ''}
                    onChange={e => setManualForm({ ...manualForm, zone_id: parseInt(e.target.value) })}
                  >
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name_es || z.name || ('Zona ' + z.id)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">Estado</label>
                    <select
                      className="w-full border-b p-2 focus:border-tav-gold outline-none bg-white uppercase font-bold text-xs"
                      value={manualForm.status || 'confirmed'}
                      onChange={e => setManualForm({ ...manualForm, status: e.target.value as BookingStatus })}
                    >
                      <option value="confirmed">CONFIRMADA</option>
                      <option value="waiting_list">LISTA DE ESPERA</option>
                      <option value="pending_payment">PENDIENTE DE PAGO</option>
                      <option value="pending_approval">PENDIENTE DE APROBACIÓN</option>
                      <option value="cancelled">CANCELADA</option>
                      <option value="completed">COMPLETADA</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">Fianza (€)</label>
                    <input
                      type="number"
                      placeholder="Fianza"
                      className="w-full border-b p-2 focus:border-tav-gold outline-none"
                      value={manualForm.deposit_amount || 0}
                      onChange={e => setManualForm({ ...manualForm, deposit_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1">
                  <textarea
                    placeholder="Comentarios / Notas"
                    className="w-full border p-2 focus:border-tav-gold outline-none h-20 resize-none bg-gray-50"
                    value={manualForm.comments || ''}
                    onChange={e => setManualForm({ ...manualForm, comments: e.target.value })}
                  />
                </div>

                {/* Capacity Consumption Toggle */}
                <div className="bg-amber-50 border border-amber-200 rounded p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <label className="text-sm font-bold text-gray-700 block mb-1">Asignar Mesa y Consumir Capacidad</label>
                      <p className="text-xs text-gray-500">
                        {(manualForm.consumes_capacity ?? true)
                          ? 'Activado: Selecciona una mesa disponible. La reserva contará para la disponibilidad.'
                          : 'Desactivado: Reserva libre sin mesa asignada. NO afecta la disponibilidad.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newVal = !(manualForm.consumes_capacity ?? true);
                        setManualForm({ ...manualForm, consumes_capacity: newVal, assigned_table_id: undefined });
                        localStorage.setItem('consumes_capacity_pref', String(newVal));
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ml-4 ${(manualForm.consumes_capacity ?? true) ? 'bg-tav-gold' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(manualForm.consumes_capacity ?? true) ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {/* Table Selector - Only shown when toggle is ON */}
                  {(manualForm.consumes_capacity ?? true) && (
                    <div className="mt-3 pt-3 border-t border-amber-300">
                      <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Mesa Asignada</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded focus:border-tav-gold focus:ring-1 focus:ring-tav-gold outline-none bg-white"
                        value={manualForm.assigned_table_id || ''}
                        onChange={e => setManualForm({ ...manualForm, assigned_table_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      >
                        <option value="">Seleccionar mesa...</option>
                        {tables
                          .filter(t => t.zone_id === (manualForm.zone_id || 1))
                          .filter(t => manualForm.pax >= t.min_pax && manualForm.pax <= t.max_pax)
                          .filter(t => {
                            // Filter out occupied tables using the dynamic state
                            return !occupiedTables.has(t.id);
                          })
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              Mesa {t.table_number || t.id} ({t.min_pax}-{t.max_pax} personas)
                            </option>
                          ))
                        }
                      </select>
                      {tables.filter(t => t.zone_id === (manualForm.zone_id || 1)).filter(t => manualForm.pax >= t.min_pax && manualForm.pax <= t.max_pax).length === 0 && (
                        <p className="text-xs text-amber-700 mt-2">⚠️ No hay mesas disponibles en esta zona para {manualForm.pax} personas</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-8">
                  <button
                    type="button"
                    onClick={handleDeleteBooking}
                    className="px-4 py-2 bg-red-500 text-white text-sm uppercase font-bold tracking-wider hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => { setShowManualModal(false); setIsEditing(false); setSelectedBooking(null); }} className="px-4 py-2 text-gray-400 hover:text-gray-600 text-sm uppercase font-bold tracking-wider">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-tav-black text-tav-gold text-sm uppercase font-bold tracking-widest hover:bg-gray-900">{isEditing ? 'Guardar Cambios' : 'Crear'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* BLOCKING MODAL */}
      {
        showBlockModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-8 max-w-lg w-full border-t-4 border-red-500 shadow-2xl">
              <h3 className="text-xl font-serif font-bold mb-6 text-tav-black flex items-center gap-2">
                <XCircle className="text-red-500" /> Gestión de Bloqueos
              </h3>

              <div className="space-y-6">
                {/* Block Day */}
                <div className="bg-gray-50 p-4 border border-gray-200">
                  <h4 className="text-sm font-bold uppercase mb-2 text-gray-600">Días de Descanso Semanal (Recurrente)</h4>
                  <p className="text-xs text-gray-500 mb-4">Selecciona los días de la semana que el restaurante cierra siempre.</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dayName, index) => {
                      const isClosed = closedWeekdays.includes(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={async () => {
                            let newClosed = [...closedWeekdays];
                            if (isClosed) {
                              newClosed = newClosed.filter(d => d !== index);
                            } else {
                              newClosed.push(index);
                            }
                            setClosedWeekdays(newClosed);
                            await updateSetting('closed_weekdays', newClosed.join(','));
                            showToast('Días de descanso actualizados', 'success');
                          }}
                          className={`px-3 py-2 text-xs font-bold uppercase border rounded transition-colors ${isClosed ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-300 hover:border-red-300'}`}
                        >
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 border border-gray-200">
                  <h4 className="text-sm font-bold uppercase mb-2 text-gray-600">Bloquear Día Específico (Excepción)</h4>
                  <p className="text-xs text-gray-500 mb-4">Selecciona una fecha concreta para cerrarla (ej: festivo).</p>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="date"
                      className="flex-1 p-2 border border-gray-300"
                      value={newBlockDate}
                      onChange={e => setNewBlockDate(e.target.value)}
                    />
                    <button type="button" onClick={handleBlockDay} className="bg-red-500 text-white px-4 py-2 text-xs font-bold uppercase hover:bg-red-600">Bloquear Fecha</button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 uppercase font-bold">Fechas Bloqueadas</p>
                    {blockedDays.length === 0 ? (
                      <p className="text-sm italic text-gray-400">No hay fechas bloqueadas.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {blockedDays.map(d => (
                          <span key={d} className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded flex items-center gap-2">
                            {d} <button type="button" onClick={() => handleUnblockDay(d)} className="hover:text-red-900"><XCircle className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Block Zone / Table */}
              <div className="bg-gray-50 p-4 border border-gray-200">
                <h4 className="text-sm font-bold uppercase mb-2 text-gray-600">Bloquear Sala o Mesa</h4>

                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="blockType"
                      checked={!blockZoneForm.tableId}
                      onChange={() => setBlockZoneForm({ ...blockZoneForm, tableId: undefined })}
                    />
                    Bloquear Zona Completa
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="blockType"
                      checked={blockZoneForm.tableId !== undefined}
                      onChange={() => {
                        const firstTableId = tables.filter(t => t.zone_id === blockZoneForm.zoneId)[0]?.id;
                        setBlockZoneForm({ ...blockZoneForm, tableId: firstTableId || 0 });
                      }}
                    />
                    Bloquear Mesa Específica
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className="p-2 border border-gray-300 w-full"
                      value={blockZoneForm.date}
                      onChange={e => setBlockZoneForm({ ...blockZoneForm, date: e.target.value })}
                    />
                    <select
                      className="p-2 border border-gray-300 w-full"
                      value={blockZoneForm.turn}
                      onChange={e => setBlockZoneForm({ ...blockZoneForm, turn: e.target.value as Turn })}
                    >
                      <option value="lunch">Comida</option>
                      <option value="dinner">Cena</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-xs font-bold text-gray-500">Zona</label>
                    <select
                      className="p-2 border border-gray-300 w-full"
                      value={blockZoneForm.zoneId}
                      onChange={e => {
                        const newZoneId = parseInt(e.target.value);
                        const firstTableId = tables.filter(t => t.zone_id === newZoneId)[0]?.id;
                        setBlockZoneForm({
                          ...blockZoneForm,
                          zoneId: newZoneId,
                          tableId: blockZoneForm.tableId !== undefined ? (firstTableId || 0) : undefined
                        });
                      }}
                    >
                      {zones.map(z => (
                        <option key={z.id} value={z.id}>{(z as any).name || (z as any).name_es || (z as any).zone_name || 'Zona ' + z.id}</option>
                      ))}
                    </select>
                  </div>

                  {blockZoneForm.tableId !== undefined && (
                    <div className="grid grid-cols-1 gap-2">
                      <label className="text-xs font-bold text-gray-500">Mesa (Capacidad)</label>
                      <select
                        className="p-2 border border-gray-300 w-full"
                        value={blockZoneForm.tableId}
                        onChange={e => setBlockZoneForm({ ...blockZoneForm, tableId: parseInt(e.target.value) })}
                      >
                        {tables
                          .filter(t => t.zone_id === blockZoneForm.zoneId)
                          .filter(t => !occupiedTablesBlock.has(t.id)) // Filter occupied tables
                          .map(t => (
                            <option key={t.id} value={t.id}>Mesa {(t as any).table_number || t.id} ({t.min_pax}-{t.max_pax} pax)</option>
                          ))
                        }
                      </select>
                      {tables.filter(t => t.zone_id === blockZoneForm.zoneId).filter(t => !occupiedTablesBlock.has(t.id)).length === 0 && (
                        <p className="text-xs text-red-500 mt-1">⚠️ No hay mesas libres en esta zona/turno.</p>
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Razón (ej: Mantenimiento, Reservado VIP)"
                    className="p-2 border border-gray-300 w-full"
                    value={blockZoneForm.reason}
                    onChange={e => setBlockZoneForm({ ...blockZoneForm, reason: e.target.value })}
                  />

                  <button type="button" onClick={handleBlockZone} className="w-full bg-gray-800 text-white px-4 py-2 text-xs font-bold uppercase hover:bg-black">
                    {blockZoneForm.tableId ? 'Bloquear Mesa' : 'Bloquear Zona'}
                  </button>
                </div>
              </div>

              <div className="text-center">
                <button type="button" onClick={() => setShowBlockModal(false)} className="text-gray-400 hover:text-gray-600 text-sm uppercase font-bold tracking-wider">Cerrar</button>
              </div>
            </div>
          </div>
        )
      }

      {/* DELETE CONFIRMATION MODAL */}
      {
        showDeleteConfirm && selectedBooking && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-8 max-w-md w-full border-t-4 border-red-500 shadow-2xl">
              <h3 className="text-xl font-serif font-bold mb-4 text-tav-black flex items-center gap-2">
                <XCircle className="text-red-500" /> Confirmar Eliminación
              </h3>
              <p className="text-gray-700 mb-6">
                {selectedBooking.status === 'blocked'
                  ? '¿Eliminar este bloqueo permanentemente?'
                  : '¿Estás seguro de eliminar esta reserva? Esta acción no se puede deshacer y liberará la mesa.'}
              </p>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-gray-600 text-sm uppercase font-bold tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-6 py-2 bg-red-500 text-white text-sm uppercase font-bold tracking-widest hover:bg-red-600"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminDashboard;
