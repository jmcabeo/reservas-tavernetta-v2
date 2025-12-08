import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
import PublicBooking from './components/PublicBooking';
import AdminDashboard from './components/AdminDashboard';
import Auth from './components/Auth';
import CancelBooking from './components/CancelBooking';
import Maintenance from './components/Maintenance';
import { TRANSLATIONS } from './constants';

function App() {
  const [session, setSession] = useState<any>(null);
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Maintenance Mode Logic
  const [isMaintenance, setIsMaintenance] = useState(() => {
    // Check if we are in a browser environment
    if (typeof window === 'undefined') return true;

    const params = new URLSearchParams(window.location.search);
    const bypassParam = params.get('bypass');
    const storedBypass = localStorage.getItem('tav_maintenance_bypass');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (bypassParam === 'tavernetta2024') {
      localStorage.setItem('tav_maintenance_bypass', 'true');
      return false;
    }

    return !(storedBypass === 'true' || isLocal);
  });

  useEffect(() => {
    // Clean URL if bypass was used
    const params = new URLSearchParams(window.location.search);
    if (params.get('bypass') === 'tavernetta2024') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const t = TRANSLATIONS[lang];



  if (isMaintenance) {
    return <Maintenance />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tav-gold"></div>
      </div>
    );
  }

  // Component for the Public Homepage (Header + Booking + Footer)
  const Home = () => (
    <>
      {/* Header */}
      <header className="bg-tav-black text-white py-8 px-4 shadow-lg border-b-4 border-tav-gold">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-serif font-bold text-tav-gold tracking-wider uppercase">{t.title}</h1>
            <div className="h-0.5 w-12 bg-tav-gold mt-2 mb-1 mx-auto md:mx-0"></div>
            <p className="text-xs text-gray-400 font-light tracking-[0.2em] uppercase">{t.subtitle}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setLang('es')}
              className={`px-3 py-1 text-xs font-bold tracking-widest border transition-colors ${lang === 'es' ? 'bg-tav-gold border-tav-gold text-tav-black' : 'text-gray-400 border-gray-700 hover:border-tav-gold hover:text-tav-gold'}`}
            >
              ES
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-bold tracking-widest border transition-colors ${lang === 'en' ? 'bg-tav-gold border-tav-gold text-tav-black' : 'text-gray-400 border-gray-700 hover:border-tav-gold hover:text-tav-gold'}`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        <PublicBooking lang={lang} />
      </main>

      {/* Footer */}
      <footer className="bg-tav-black text-gray-500 py-12 text-center text-sm border-t border-gray-800">
        <p className="font-serif italic mb-4 text-gray-400">"Cucina italiana autentica"</p>
        <p>&copy; {new Date().getFullYear()} La Tavernetta.</p>
        {/* CRITICAL FIX: Using Link instead of <a> to prevent page reload */}
        <Link to="/admin" className="mt-6 inline-block text-xs text-gray-700 hover:text-tav-gold transition-colors uppercase tracking-widest">
          {t.adminLogin}
        </Link>
      </footer>
    </>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-tav-black">
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Home />} />
        <Route path="/cancelar" element={<CancelBooking />} />

        {/* Login Route - Redirects to admin if already logged in */}
        <Route
          path="/login"
          element={!session ? <Auth onLogin={() => navigate('/admin')} /> : <Navigate to="/admin" />}
        />

        {/* Admin Protected Route */}
        <Route
          path="/admin"
          element={
            session ? (
              <AdminDashboard
                onLogout={async () => {
                  await supabase.auth.signOut();
                  navigate('/');
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </div>
  );
}

export default App;