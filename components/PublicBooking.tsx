
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, CheckCircle, AlertCircle, ChevronRight, CreditCard, ChevronDown, ChevronUp, Sun, Armchair, Utensils, Wine, Star } from 'lucide-react';
import { BookingFormData, Turn, AvailabilityResponse } from '../types';
import { TRANSLATIONS, DEPOSIT_PER_PAX, generateTimeSlots, LUNCH_START, LUNCH_END, DINNER_START, DINNER_END } from '../constants';
import { checkAvailability, createBooking, getSettings } from '../services/api';

interface Props {
  lang: 'es' | 'en';
}

// Custom Animated Spaghetti Fork Loader
const SpaghettiLoader = () => (
  <div className="flex flex-col items-center justify-center">
    <svg width="60" height="100" viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">
      {/* Fork Handle and Tines */}
      <g className="text-tav-black" fill="currentColor">
        <rect x="28" y="40" width="4" height="60" rx="2" />
        <path d="M20 40 C20 50 40 50 40 40 L40 10 L36 10 L36 35 L34 35 L34 10 L30 10 L30 35 L26 35 L26 10 L22 10 L22 40 Z" />
      </g>
      {/* Spinning Pasta/Noodle */}
      <g>
        <path
          d="M15 25 Q30 40 45 25 Q30 10 15 25"
          fill="none"
          stroke="#caba9d"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 30 25"
            to="360 30 25"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
        {/* Falling strand */}
        <path d="M30 25 L30 80" stroke="#caba9d" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 5">
          <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-tav-gold animate-pulse">Loading...</span>
  </div>
);

// Helper to get Zone Icon
// Checks specific keywords in the name to assign an appropriate icon
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
  const [isWaitlist, setIsWaitlist] = useState<boolean>(false);
  const [depositEnabled, setDepositEnabled] = useState<boolean>(true);

  React.useEffect(() => {
    getSettings().then(settings => {
      setDepositEnabled(settings['enable_deposit'] !== 'false');
    });
  }, []);

  // Form State
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

  // Expanded state for turn accordions
  const [expandedTurn, setExpandedTurn] = useState<Turn | null>(null);

  // Constants for slots - filter out past times if selected date is today
  const allLunchSlots = generateTimeSlots(LUNCH_START, LUNCH_END);
  const allDinnerSlots = generateTimeSlots(DINNER_START, DINNER_END);

  // Filter slots based on current time if date is today
  const lunchSlots = (() => {
    const isToday = formData.date === new Date().toISOString().split('T')[0];
    if (!isToday) return allLunchSlots;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    return allLunchSlots.filter(time => {
      const [hour, minute] = time.split(':').map(Number);
      return hour > currentHour || (hour === currentHour && minute > currentMinute);
    });
  })();

  const dinnerSlots = (() => {
    const isToday = formData.date === new Date().toISOString().split('T')[0];
    if (!isToday) return allDinnerSlots;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    return allDinnerSlots.filter(time => {
      const [hour, minute] = time.split(':').map(Number);
      return hour > currentHour || (hour === currentHour && minute > currentMinute);
    });
  })();

  // Helper to check availability
  const handleCheckAvailability = async () => {
    if (!formData.date || !formData.turn || !formData.time) return;

    setLoading(true);
    setError(null);

    // Availability is checked by TURN, not by specific time
    const availableZones = await checkAvailability(formData.date, formData.turn, formData.pax);
    setZones(availableZones || []);

    setLoading(false);
    setStep(2);
  };

  // Handle Booking Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1️⃣ Crear la reserva en la base de datos
    const result = await createBooking(formData, isWaitlist);

    // 2️⃣ Si la reserva se creó correctamente
    if (result.success) {
      // Si es una lista de espera, solo mostramos el mensaje de éxito
      if (isWaitlist) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // 3️⃣ Para reservas normales, verificamos si hay fianza
      if (!depositEnabled) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // 4️⃣ Si hay fianza, llamamos al webhook de n8n
      try {
        const payload = {
          bookingId: result.bookingId,
          amount: formData.pax * DEPOSIT_PER_PAX, // importe de la fianza
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          date: formData.date,
          time: formData.time,
          pax: formData.pax,
        };

        const resp = await fetch('https://n8n.captialeads.com/webhook/crear-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          throw new Error('Webhook responded with status ' + resp.status);
        }

        const data = await resp.json();
        // n8n suele devolver la URL en la propiedad `url` (ajusta si tu flujo usa otro nombre)
        const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;
        if (!checkoutUrl) {
          throw new Error('No checkout URL returned from webhook');
        }

        // 4️⃣ Redirigir al cliente a Stripe Checkout
        window.location.href = checkoutUrl;
        // No marcamos success aquí porque la página cambiará
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error creating Stripe session:', err);
        setError('Error al iniciar el pago. Por favor, intente de nuevo.');
        setLoading(false);
        return;
      }
    } else {
      // 5️⃣ Si la reserva falló en la base de datos
      setError(result.error || 'Unknown error');
      setLoading(false);
    }
  };

  const handleTurnSelect = (turn: Turn) => {
    if (expandedTurn === turn) {
      setExpandedTurn(null);
    } else {
      setExpandedTurn(turn);
      // Reset time if switching turns
      if (formData.turn !== turn) {
        setFormData(prev => ({ ...prev, turn: turn, time: null }));
      }
    }
  };

  const handleTimeSelect = (time: string, turn: Turn) => {
    setFormData(prev => ({ ...prev, turn: turn, time: time }));
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-none shadow-2xl text-center border-t-4 border-tav-gold">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-tav-gold" />
        </div>
        <h2 className="text-3xl font-serif font-bold text-tav-black mb-2">
          {isWaitlist ? t.successWaitlist : t.success}
        </h2>
        <p className="text-gray-500 mb-2 font-light">
          {new Date(formData.date).toLocaleDateString()} - {formData.time}
        </p>
        <p className="text-gray-500 mb-8 font-light text-sm">
          {isWaitlist
            ? "Te avisaremos si una mesa se libera."
            : "Hemos enviado los detalles a tu correo electrónico."}
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setStep(1);
            setFormData({
              date: new Date().toISOString().split('T')[0],
              turn: null,
              time: null,
              pax: 2,
              zone_id: null,
              name: '',
              email: '',
              phone: ''
            });
            setIsWaitlist(false);
            navigate('/');
          }}
          className="px-8 py-3 bg-tav-black text-white text-sm tracking-widest uppercase hover:bg-gray-800 transition-colors"
        >
          Volver / Return
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded-sm overflow-hidden border border-gray-100">
      {/* Progress Bar */}
      <div className="bg-tav-black px-6 py-4 border-b border-gray-800 flex items-center justify-between text-xs font-bold tracking-widest uppercase text-gray-500">
        <span className={`${step >= 1 ? 'text-tav-gold' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 1 ? 'border-tav-gold text-tav-gold' : 'border-gray-600'}`}>1</span>
          <span className="hidden sm:inline">{t.step1}</span>
        </span>
        <div className="h-px w-8 bg-gray-800"></div>
        <span className={`${step >= 2 ? 'text-tav-gold' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 2 ? 'border-tav-gold text-tav-gold' : 'border-gray-600'}`}>2</span>
          <span className="hidden sm:inline">{t.step2}</span>
        </span>
        <div className="h-px w-8 bg-gray-800"></div>
        <span className={`${step >= 3 ? 'text-tav-gold' : ''} flex items-center gap-2`}>
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${step >= 3 ? 'border-tav-gold text-tav-gold' : 'border-gray-600'}`}>3</span>
          <span className="hidden sm:inline">{t.step3}</span>
        </span>
      </div>

      <div className="p-6 md:p-10 min-h-[450px] relative">

        {/* Global Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
            <SpaghettiLoader />
          </div>
        )}

        {/* STEP 1: DATE & PAX & TIME */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-serif text-tav-black mb-1">{t.step1}</h2>
              <div className="w-16 h-0.5 bg-tav-gold mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Date Picker */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <Calendar className="w-4 h-4 text-tav-gold" /> {t.date}
                </label>
                <input
                  type="date"
                  className="w-full p-4 border-b-2 border-gray-200 bg-gray-50 focus:border-tav-gold focus:bg-white transition-all outline-none font-serif text-lg"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Pax Selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <Users className="w-4 h-4 text-tav-gold" /> {t.pax}
                </label>

                {isWaitlist ? (
                  <input
                    type="number"
                    min="1"
                    className="w-full p-4 border-b-2 border-gray-200 bg-gray-50 focus:border-tav-gold focus:bg-white transition-all outline-none font-serif text-lg"
                    value={formData.pax}
                    onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) || 1 })}
                    placeholder="Número de personas"
                  />
                ) : (
                  <select
                    className="w-full p-4 border-b-2 border-gray-200 bg-gray-50 focus:border-tav-gold focus:bg-white transition-all outline-none font-serif text-lg"
                    value={formData.pax}
                    onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) })}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i} value={i + 1}>{i + 1} {t.pax}</option>
                    ))}
                    <option value={11}>10+</option>
                  </select>
                )}

                <p className="text-xs text-amber-600 font-medium mt-2 flex items-start gap-2">
                  <span className="text-amber-500 text-base">⚠️</span>
                  <span>Los carritos de bebé cuentan como una persona adicional</span>
                </p>
              </div>
            </div>

            {/* Turn & Time Selection */}
            <div className="space-y-4 pt-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 justify-center">
                <Clock className="w-4 h-4 text-tav-gold" /> {t.time}
              </label>

              {/* Lunch Section */}
              <div className={`border rounded-sm overflow-hidden transition-all ${expandedTurn === 'lunch' ? 'border-tav-gold ring-1 ring-tav-gold' : 'border-gray-200'}`}>
                <button
                  onClick={() => handleTurnSelect('lunch')}
                  className={`w-full flex items-center justify-between p-5 ${expandedTurn === 'lunch' ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${expandedTurn === 'lunch' ? 'bg-tav-gold' : 'bg-gray-300'}`}></div>
                    <div className="text-left">
                      <span className="block font-serif text-lg text-tav-black">{t.lunch}</span>
                      <span className="text-xs text-gray-400">{LUNCH_START} - {LUNCH_END}</span>
                    </div>
                  </div>
                  {expandedTurn === 'lunch' ? <ChevronUp className="text-tav-gold w-5 h-5" /> : <ChevronDown className="text-gray-300 w-5 h-5" />}
                </button>

                {expandedTurn === 'lunch' && (
                  <div className="p-5 pt-0 bg-gray-50 grid grid-cols-4 sm:grid-cols-5 gap-2 animate-in slide-in-from-top-2">
                    <div className="col-span-full h-px bg-gray-200 my-2"></div>
                    {lunchSlots.map(time => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time, 'lunch')}
                        className={`py-2 px-1 text-sm font-medium rounded-sm transition-all
                                    ${formData.time === time && formData.turn === 'lunch'
                            ? 'bg-tav-black text-tav-gold shadow-lg scale-105'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-tav-gold hover:text-tav-black'}
                                `}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dinner Section */}
              <div className={`border rounded-sm overflow-hidden transition-all ${expandedTurn === 'dinner' ? 'border-tav-gold ring-1 ring-tav-gold' : 'border-gray-200'}`}>
                <button
                  onClick={() => handleTurnSelect('dinner')}
                  className={`w-full flex items-center justify-between p-5 ${expandedTurn === 'dinner' ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${expandedTurn === 'dinner' ? 'bg-tav-gold' : 'bg-gray-300'}`}></div>
                    <div className="text-left">
                      <span className="block font-serif text-lg text-tav-black">{t.dinner}</span>
                      <span className="text-xs text-gray-400">{DINNER_START} - {DINNER_END}</span>
                    </div>
                  </div>
                  {expandedTurn === 'dinner' ? <ChevronUp className="text-tav-gold w-5 h-5" /> : <ChevronDown className="text-gray-300 w-5 h-5" />}
                </button>

                {expandedTurn === 'dinner' && (
                  <div className="p-5 pt-0 bg-gray-50 grid grid-cols-4 sm:grid-cols-5 gap-2 animate-in slide-in-from-top-2">
                    <div className="col-span-full h-px bg-gray-200 my-2"></div>
                    {dinnerSlots.map(time => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time, 'dinner')}
                        className={`py-2 px-1 text-sm font-medium rounded-sm transition-all
                                    ${formData.time === time && formData.turn === 'dinner'
                            ? 'bg-tav-black text-tav-gold shadow-lg scale-105'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-tav-gold hover:text-tav-black'}
                                `}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              disabled={!formData.turn || !formData.time || loading}
              onClick={handleCheckAvailability}
              className="w-full mt-8 py-4 bg-tav-gold text-tav-black font-bold text-sm tracking-widest uppercase hover:bg-[#bfa080] transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {t.search}
            </button>
          </div>
        )}

        {/* STEP 2: ZONES */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-serif text-tav-black">{t.step2}</h2>
              <button onClick={() => setStep(1)} className="text-xs font-bold uppercase text-gray-400 hover:text-tav-gold transition-colors">Volver</button>
            </div>

            {zones && zones.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {zones.map(zone => {
                  // Dynamically select name based on current language preference
                  const displayName = lang === 'es' ? zone.zone_name_es : zone.zone_name_en;

                  return (
                    <button
                      key={zone.zone_id}
                      onClick={() => {
                        setFormData({ ...formData, zone_id: zone.zone_id });
                        setIsWaitlist(false);
                        setStep(3);
                      }}
                      className="p-6 border border-gray-200 hover:border-tav-gold hover:bg-gray-50 transition-all text-left flex justify-between items-center group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-gray-100 rounded-full text-tav-gold group-hover:bg-tav-gold group-hover:text-tav-black transition-colors shadow-sm">
                          {getZoneIcon(displayName)}
                        </div>
                        <div>
                          <h3 className="text-xl font-serif text-tav-black">{displayName}</h3>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                            {zone.available_slots} {t.tablesLeft}
                          </p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full text-gray-300 group-hover:text-tav-gold flex items-center justify-center transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-6 font-light">{t.noAvailability}</p>
                <button
                  onClick={() => {
                    setIsWaitlist(true);
                    setFormData({ ...formData, zone_id: null });
                    setStep(3);
                  }}
                  className="px-8 py-3 bg-tav-black text-tav-gold text-sm font-bold uppercase tracking-widest hover:bg-gray-900"
                >
                  {t.joinWaitlist}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: DETAILS & PAYMENT */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-serif text-tav-black">
                {isWaitlist ? t.waitingList : t.details}
              </h2>
              <button onClick={() => setStep(2)} className="text-xs font-bold uppercase text-gray-400 hover:text-tav-gold transition-colors">Volver</button>
            </div>

            <div className="bg-gray-50 p-4 flex justify-between items-center text-sm border border-gray-200">
              <span className="text-gray-500 uppercase text-xs font-bold tracking-wider">Resumen</span>
              <span className="font-serif font-bold text-tav-black">
                {new Date(formData.date).toLocaleDateString()} @ {formData.time} ({formData.pax} pax)
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isWaitlist && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-tav-gold" />
                    Número de Personas
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full p-3 border border-gray-300 focus:border-tav-gold focus:ring-1 focus:ring-tav-gold outline-none transition-all bg-gray-50 focus:bg-white font-serif text-lg"
                    value={formData.pax}
                    onChange={e => setFormData({ ...formData, pax: parseInt(e.target.value) || 1 })}
                    placeholder="Ej: 15"
                  />
                  <p className="text-xs text-amber-600 font-medium mt-2 flex items-start gap-2">
                    <span className="text-amber-500 text-base">⚠️</span>
                    <span>Los carritos de bebé cuentan como una persona adicional</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.name}</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 border border-gray-300 focus:border-tav-gold focus:ring-1 focus:ring-tav-gold outline-none transition-all bg-gray-50 focus:bg-white"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.email}</label>
                  <input
                    required
                    type="email"
                    className="w-full p-3 border border-gray-300 focus:border-tav-gold focus:ring-1 focus:ring-tav-gold outline-none transition-all bg-gray-50 focus:bg-white"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.phone}</label>
                  <input
                    required
                    type="tel"
                    className="w-full p-3 border border-gray-300 focus:border-tav-gold focus:ring-1 focus:ring-tav-gold outline-none transition-all bg-gray-50 focus:bg-white"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              {!isWaitlist && depositEnabled && (
                <div className="bg-gray-50 p-6 border border-gray-200 mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-tav-black font-serif font-bold text-lg flex items-center gap-2">
                      {t.payment}
                    </h3>
                    <CreditCard className="text-tav-gold w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500 mb-6 italic">{t.depositNotice}</p>

                  <div className="flex justify-between items-end border-t border-gray-200 pt-4 mb-4">
                    <span className="text-xs font-bold uppercase text-gray-400">Total Fianza</span>
                    <span className="text-2xl font-serif font-bold text-tav-black">€{formData.pax * DEPOSIT_PER_PAX}.00</span>
                  </div>

                  {/* Mock Stripe Element Placeholder */}
                  <div className="p-4 border border-gray-300 bg-white text-gray-400 text-sm flex items-center gap-2">
                    <div className="w-full h-4 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-800 text-sm border-l-4 border-red-500">
                  {error}
                </div>
              )}

              {isWaitlist && (
                <div className="p-4 bg-amber-50 text-amber-800 text-sm border-l-4 border-amber-400 flex items-start gap-3">
                  <span className="text-xl">ℹ️</span>
                  <p>
                    <strong>Un miembro de nuestro equipo se pondrá en contacto contigo lo antes posible</strong> para gestionar tu reserva y confirmar todos los detalles.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 text-white font-bold text-sm tracking-widest uppercase transition-colors flex justify-center items-center gap-2
                  ${isWaitlist ? 'bg-gray-800 hover:bg-black' : 'bg-tav-black hover:bg-gray-800'}
                `}
              >
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
