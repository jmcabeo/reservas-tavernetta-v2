
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, CheckCircle, AlertCircle, ChevronRight, CreditCard, ChevronDown, ChevronUp, Sun, Armchair, Utensils, Wine, Star } from 'lucide-react';
import { BookingFormData, Turn, AvailabilityResponse } from '../types';
import { TRANSLATIONS, DEPOSIT_PER_PAX, generateTimeSlots, LUNCH_START, LUNCH_END, DINNER_START, DINNER_END, RESTAURANT_ID } from '../constants';
import { checkAvailability, createBooking, getSettings, getApiRestaurantId } from '../services/api';
import { supabase } from '../services/supabaseClient';

interface Props {
  lang: 'es' | 'en';
}

// Custom Animated Spaghetti Fork Loader
const SpaghettiLoader = () => (
  <div className="flex flex-col items-center justify-center">
    <svg width="60" height="100" viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">
      <g className="text-primary" fill="currentColor">
        <rect x="28" y="40" width="4" height="60" rx="2" />
        <path d="M20 40 C20 50 40 50 40 40 L40 10 L36 10 L36 35 L34 35 L34 10 L30 10 L30 35 L26 35 L26 10 L22 10 L22 40 Z" />
      </g>
      <g>
        <path d="M15 25 Q30 40 45 25 Q30 10 15 25" fill="none" stroke="currentColor" className="text-secondary" strokeWidth="3" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 30 25" to="360 30 25" dur="1s" repeatCount="indefinite" />
        </path>
        <path d="M30 25 L30 80" stroke="currentColor" className="text-secondary" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 5">
          <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-secondary animate-pulse">Loading...</span>
  </div>
);

const getZoneIcon = (name: string | undefined | null) => {
  const n = (name || '').toLowerCase();
  if (n.includes('terraza') || n.includes('terrace') || n.includes('exterior')) return <Sun className="w-6 h-6" />;
  if (n.includes('salon') || n.includes('salón') || n.includes('interior') || n.includes('main')) return <Armchair className="w-6 h-6" />;
  if (n.includes('barra') || n.includes('bar')) return <Wine className="w-6 h-6" />;
  if (n.includes('privado') || n.includes('vip')) return <Star className="w-6 h-6" />;
  return <Utensils className="w-6 h-6" />;
};

const PublicBooking: React.FC<Props> = ({ lang }) => {
  const navigate = useNavigate();
  const t = TRANSLATIONS[lang];
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [zones, setZones] = useState<AvailabilityResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);
  const [isWaitlist, setIsWaitlist] = useState<boolean>(false);

  // Settings State
  const [depositEnabled, setDepositEnabled] = useState<boolean>(true);
  const [flexibleCapacity, setFlexibleCapacity] = useState<boolean>(false);
  const [requireManualApproval, setRequireManualApproval] = useState<boolean>(false);
  const [manualValidationMessage, setManualValidationMessage] = useState<string>('');
  const [minNoticeMinutes, setMinNoticeMinutes] = useState<number>(1440); // Default 24h

  React.useEffect(() => {
    getSettings().then(settings => {
      setDepositEnabled(settings['enable_deposit'] !== 'false');
      setFlexibleCapacity(settings['flexible_capacity'] === 'true');
      setRequireManualApproval(settings['require_manual_approval'] === 'true');
      setManualValidationMessage(settings['manual_validation_message'] || '');
      if (settings['min_notice_minutes']) setMinNoticeMinutes(parseInt(settings['min_notice_minutes']));
    });
  }, []);

  const [formData, setFormData] = useState<BookingFormData>({
    date: new Date().toISOString().split('T')[0],
    turn: null,
    time: null,
    pax: 2,
    zone_id: null,
    name: '',
    email: '',
    phone: '',
    comments: ''
  });

  const [expandedTurn, setExpandedTurn] = useState<Turn | null>(null);

  const allLunchSlots = generateTimeSlots(LUNCH_START, LUNCH_END);
  const allDinnerSlots = generateTimeSlots(DINNER_START, DINNER_END);

  const lunchSlots = (() => {
    const minDate = new Date(Date.now() + minNoticeMinutes * 60000);
    const minDateString = minDate.toISOString().split('T')[0];

    // If selected date is BEFORE the min date (should be prevented by input min, but safety check)
    if (formData.date < minDateString) return [];

    // If selected date is AFTER min date, all slots are open (within global limits)
    if (formData.date > minDateString) return allLunchSlots;

    // If selected date IS the min date (e.g. Today or Tomorrow depending on offset)
    // Filter slots later than minDate's time
    const cutOffHour = minDate.getHours();
    const cutOffMinute = minDate.getMinutes();

    return allLunchSlots.filter(time => {
      const [hour, minute] = time.split(':').map(Number);
      // Strictly greater than cutOffTime
      return hour > cutOffHour || (hour === cutOffHour && minute >= cutOffMinute);
    });
  })();

  const dinnerSlots = (() => {
    const minDate = new Date(Date.now() + minNoticeMinutes * 60000);
    const minDateString = minDate.toISOString().split('T')[0];

    if (formData.date < minDateString) return [];
    if (formData.date > minDateString) return allDinnerSlots;

    const cutOffHour = minDate.getHours();
    const cutOffMinute = minDate.getMinutes();

    return allDinnerSlots.filter(time => {
      const [hour, minute] = time.split(':').map(Number);
      return hour > cutOffHour || (hour === cutOffHour && minute >= cutOffMinute);
    });
  })();

  const handleCheckAvailability = async () => {
    if (!formData.date || !formData.turn || !formData.time) return;

    setLoading(true);
    setError(null);

    // If Flexible Capacity is ON, bypass strict table checking
    if (flexibleCapacity) {
      // Fetch All Zones directly
      const { data } = await supabase.from('zones').select('*').eq('restaurant_id', RESTAURANT_ID);
      if (data) {
        setZones(data.map(z => ({
          zone_id: z.id,
          zone_name_es: z.name_es || z.name,
          zone_name_en: z.name_en || z.name,
          available_slots: 999
        })));
      }
    } else {
      // Normal Flow (Strict Capacity)
      const availableZones = await checkAvailability(formData.date, formData.turn, formData.pax);
      setZones(availableZones || []);
    }

    setLoading(false);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Determine status logic based on settings
    let statusToUse = 'confirmed';

    if (isWaitlist) {
      statusToUse = 'waiting_list';
    } else if (requireManualApproval) {
      // Validation Required mode Takes Precedence over Deposit
      statusToUse = 'pending_approval';
    } else if (depositEnabled) {
      statusToUse = 'pending_payment';
    }

    const selectedZone = zones.find(z => z.zone_id === formData.zone_id);
    const zoneName = selectedZone ? selectedZone.zone_name_es : '';
    const dataWithStatus = { ...formData, status: statusToUse, zone_name: zoneName };

    const result = await createBooking(dataWithStatus, isWaitlist);

    if (result.success) {
      // --- WEBHOOK CALL (Non-payment flows) ---
      try {
        const bookingData = {
          id: result.bookingId,
          uuid: result.bookingId,
          bookingId: result.bookingId,
          restaurant_id: getApiRestaurantId(),
          date: formData.date,
          booking_date: formData.date,
          time: formData.time,
          turn: formData.turn,
          pax: formData.pax,
          name: formData.name,
          customer_name: formData.name,
          email: formData.email,
          customer_email: formData.email,
          phone: formData.phone,
          customer_phone: formData.phone,
          zone_name: zoneName,
          status: statusToUse,
          comments: formData.comments,
          is_manual: false
        };

        const payload = {
          event: 'booking_created',
          booking: bookingData,
          restaurant_id: getApiRestaurantId()
        };

        // Fire and forget (don't block UI)
        fetch('https://n8n.captialeads.com/webhook/nueva-reserva', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': import.meta.env.VITE_WEBHOOK_SECRET || 'omnia_secret_key'
          },
          body: JSON.stringify(payload),
        }).catch(err => console.error('Webhook error:', err));

      } catch (e) { console.error('Webhook setup error', e); }

      if (isWaitlist) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Check for Manual Approval / Pending
      if (statusToUse === 'pending_approval') {
        setSuccess(true);
        setPendingApproval(true);
        setLoading(false);
        return;
      }

      if (!depositEnabled) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Handle Deposit Payment
      try {
        const payload = {
          bookingId: result.bookingId,
          amount: formData.pax * DEPOSIT_PER_PAX,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          date: formData.date,
          time: formData.time,
          pax: formData.pax,
          zone_id: formData.zone_id,
          zone_name: zoneName,
          restaurant_id: getApiRestaurantId(),
          is_manual: false,
        };

        const resp = await fetch('https://n8n.captialeads.com/webhook/crear-pago', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': import.meta.env.VITE_WEBHOOK_SECRET || 'omnia_secret_key'
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error('Webhook error ' + resp.status);
        const data = await resp.json();
        const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;

        if (!checkoutUrl) throw new Error('No checkout URL');

        window.location.href = checkoutUrl;
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error creating Stripe session:', err);
        setError('Error al iniciar el pago.');
        setLoading(false);
        return;
      }
    } else {
      setError(result.error || 'Unknown error');
      setLoading(false);
    }
  };

  const handleTurnSelect = (turn: Turn) => {
    if (expandedTurn === turn) setExpandedTurn(null);
    else {
      setExpandedTurn(turn);
      if (formData.turn !== turn) setFormData(prev => ({ ...prev, turn: turn, time: null }));
    }
  };

  const handleTimeSelect = (time: string, turn: Turn) => setFormData(prev => ({ ...prev, turn: turn, time: time }));

  if (success) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-none shadow-xl text-center border-t-4 border-secondary">
        <div className="flex justify-center mb-6">
          <CheckCircle className={`w-20 h-20 ${pendingApproval ? 'text-blue-500' : 'text-secondary'}`} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {pendingApproval ? 'Solicitud Recibida' : (isWaitlist ? t.successWaitlist : t.success)}
        </h2>
        <p className="text-gray-500 mb-2 font-light">
          {new Date(formData.date).toLocaleDateString()} - {formData.time}
        </p>

        {pendingApproval ? (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded text-sm text-blue-800 my-6">
            <p><strong>{manualValidationMessage || 'Tu reserva está pendiente de validación.'}</strong></p>
            <p className="mt-2 text-xs opacity-80">Te confirmaremos por email en breve.</p>
          </div>
        ) : (
          <p className="text-gray-500 mb-8 font-light text-sm">
            {isWaitlist ? "Te avisaremos si una mesa se libera." : "Hemos enviado los detalles a tu correo electrónico."}
          </p>
        )}

        <button
          onClick={() => {
            setSuccess(false);
            setPendingApproval(false);
            setStep(1);
            setFormData({
              date: new Date().toISOString().split('T')[0], turn: null, time: null, pax: 2, zone_id: null, name: '', email: '', phone: ''
            });
            setIsWaitlist(false);
            navigate('/');
          }}
          className="px-8 py-3 bg-primary text-white text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          Volver / Return
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between text-xs font-bold tracking-widest uppercase text-gray-500">
        <span className={`${step >= 1 ? 'text-secondary' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 1 ? 'border-secondary text-secondary' : 'border-gray-300'}`}>1</span>
          <span className="hidden sm:inline">{t.step1}</span>
        </span>
        <div className="h-px w-8 bg-gray-200"></div>
        <span className={`${step >= 2 ? 'text-secondary' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 2 ? 'border-secondary text-secondary' : 'border-gray-300'}`}>2</span>
          <span className="hidden sm:inline">{t.step2}</span>
        </span>
        <div className="h-px w-8 bg-gray-200"></div>
        <span className={`${step >= 3 ? 'text-secondary' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 3 ? 'border-secondary text-secondary' : 'border-gray-300'}`}>3</span>
          <span className="hidden sm:inline">{t.step3}</span>
        </span>
      </div>

      <div className="p-6 md:p-10 min-h-[450px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
            <SpaghettiLoader />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t.step1}</h2>
              <div className="w-16 h-1 bg-secondary mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <Calendar className="w-4 h-4 text-secondary" /> {t.date}
                </label>
                <input
                  type="date"
                  className="w-full p-4 border border-gray-200 rounded bg-gray-50 focus:border-secondary focus:ring-1 focus:ring-secondary transition-all outline-none text-lg"
                  min={new Date(Date.now() + minNoticeMinutes * 60000).toISOString().split('T')[0]}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <Users className="w-4 h-4 text-secondary" /> {t.pax}
                </label>
                {isWaitlist ? (
                  <input
                    type="number"
                    min="1"
                    className="w-full p-4 border border-gray-200 rounded bg-gray-50 focus:border-secondary focus:ring-1 focus:ring-secondary transition-all outline-none text-lg"
                    value={formData.pax}
                    onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) || 1 })}
                    placeholder="Número de personas"
                  />
                ) : (
                  <select
                    className="w-full p-4 border border-gray-200 rounded bg-gray-50 focus:border-secondary focus:ring-1 focus:ring-secondary transition-all outline-none text-lg"
                    value={formData.pax}
                    onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) })}
                  >
                    {[...Array(10)].map((_, i) => <option key={i} value={i + 1}>{i + 1} {t.pax}</option>)}
                    <option value={11}>10+</option>
                  </select>
                )}
                <p className="text-xs text-amber-600 font-medium mt-2 flex items-start gap-2">
                  <span className="text-amber-500 text-base">⚠️</span>
                  <span>Los carritos de bebé cuentan como una persona adicional</span>
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 justify-center">
                <Clock className="w-4 h-4 text-secondary" /> {t.time}
              </label>

              {['lunch', 'dinner'].map(turn => (
                <div key={turn} className={`border rounded-lg overflow-hidden transition-all ${expandedTurn === turn ? 'border-secondary ring-1 ring-secondary' : 'border-gray-200'}`}>
                  <button
                    onClick={() => handleTurnSelect(turn as Turn)}
                    className={`w-full flex items-center justify-between p-5 ${expandedTurn === turn ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${expandedTurn === turn ? 'bg-secondary' : 'bg-gray-300'}`}></div>
                      <div className="text-left">
                        <span className="block font-bold text-lg text-gray-900">{turn === 'lunch' ? t.lunch : t.dinner}</span>
                        <span className="text-xs text-gray-400">{turn === 'lunch' ? `${LUNCH_START} - ${LUNCH_END}` : `${DINNER_START} - ${DINNER_END}`}</span>
                      </div>
                    </div>
                    {expandedTurn === turn ? <ChevronUp className="text-secondary w-5 h-5" /> : <ChevronDown className="text-gray-300 w-5 h-5" />}
                  </button>
                  {expandedTurn === turn && (
                    <div className="p-5 pt-0 bg-gray-50 grid grid-cols-4 sm:grid-cols-5 gap-2 animate-in slide-in-from-top-2">
                      <div className="col-span-full h-px bg-gray-200 my-2"></div>
                      {(turn === 'lunch' ? lunchSlots : dinnerSlots).length > 0 ? (
                        (turn === 'lunch' ? lunchSlots : dinnerSlots).map(time => (
                          <button
                            key={time}
                            onClick={() => handleTimeSelect(time, turn as Turn)}
                            className={`py-2 px-1 text-sm font-medium rounded transition-all ${formData.time === time && formData.turn === turn ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-gray-600 border border-gray-200 hover:border-secondary hover:text-secondary'}`}
                          >
                            {time}
                          </button>
                        ))
                      ) : (
                        <div className="col-span-full py-4 text-center">
                          <p className="text-xs text-amber-600 font-bold flex flex-col items-center gap-2">
                            <span>⚠️ Antelación mínima requerida: {Math.floor(minNoticeMinutes / 60)}h {minNoticeMinutes % 60 > 0 ? `${minNoticeMinutes % 60}m` : ''}</span>
                            <span className="font-normal opacity-80">Por favor, selecciona otra fecha.</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              disabled={!formData.turn || !formData.time || loading}
              onClick={handleCheckAvailability}
              className="w-full mt-8 py-4 bg-secondary text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2 rounded shadow-lg shadow-orange-100"
            >
              {t.search}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-gray-900">{t.step2}</h2>
              <button onClick={() => setStep(1)} className="text-xs font-bold uppercase text-gray-400 hover:text-secondary transition-colors">Volver</button>
            </div>

            {zones && zones.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {zones.map(zone => {
                  const displayName = lang === 'es' ? zone.zone_name_es : zone.zone_name_en;
                  return (
                    <button
                      key={zone.zone_id}
                      onClick={() => {
                        setFormData({ ...formData, zone_id: zone.zone_id });
                        setIsWaitlist(false);
                        setStep(3);
                      }}
                      className="p-6 border border-gray-200 hover:border-secondary hover:bg-gray-50 rounded-lg transition-all text-left flex justify-between items-center group shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-gray-100 rounded-full text-secondary group-hover:bg-secondary group-hover:text-white transition-colors shadow-sm">
                          {getZoneIcon(displayName)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                          {!flexibleCapacity ? (
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                              {zone.available_slots} {t.tablesLeft}
                            </p>
                          ) : (
                            <p className="text-xs text-green-600 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Disponible
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full text-gray-300 group-hover:text-secondary flex items-center justify-center transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-6 font-light">{t.noAvailability}</p>
                <button
                  onClick={() => { setIsWaitlist(true); setFormData({ ...formData, zone_id: null }); setStep(3); }}
                  className="px-8 py-3 bg-primary text-white text-sm font-bold uppercase tracking-widest hover:opacity-90 rounded"
                >
                  {t.joinWaitlist}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-gray-900">{isWaitlist ? t.waitingList : t.details}</h2>
              <button onClick={() => setStep(2)} className="text-xs font-bold uppercase text-gray-400 hover:text-secondary transition-colors">Volver</button>
            </div>
            <div className="bg-gray-50 p-4 flex justify-between items-center text-sm border border-gray-200 rounded">
              <span className="text-gray-500 uppercase text-xs font-bold tracking-wider">Resumen</span>
              <span className="font-bold text-gray-900">{new Date(formData.date).toLocaleDateString()} @ {formData.time} ({formData.pax} pax)</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.name}</label>
                  <input required type="text" className="w-full p-3 border border-gray-300 bg-gray-50" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.email}</label>
                  <input required type="email" className="w-full p-3 border border-gray-300 bg-gray-50" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.phone}</label>
                <input required type="tel" className="w-full p-3 border border-gray-300 bg-gray-50" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              {!isWaitlist && depositEnabled && (
                <div className="bg-gray-50 p-6 border border-gray-200 mt-8 rounded">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">{t.payment} <CreditCard className="text-secondary w-5 h-5" /></h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-6 italic">{t.depositNotice}</p>
                  <div className="flex justify-between items-end border-t border-gray-200 pt-4 mb-4">
                    <span className="text-xs font-bold uppercase text-gray-400">Total Fianza</span>
                    <span className="text-2xl font-bold text-gray-900">€{formData.pax * DEPOSIT_PER_PAX}.00</span>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className={`w-full py-4 text-white font-bold text-sm tracking-widest uppercase transition-colors flex justify-center items-center gap-2 rounded ${isWaitlist ? 'bg-gray-800 hover:bg-black' : 'bg-primary hover:opacity-90'}`}>
                {isWaitlist ? t.joinWaitlist : (depositEnabled ? t.book : 'Confirmar Reserva')}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
