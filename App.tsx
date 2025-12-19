import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import PublicBooking from './components/PublicBooking';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Auth';
import AdminSettings from './components/AdminSettings';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import CancelBooking from './components/CancelBooking';
import UpdatePassword from './components/UpdatePassword';
import { Key } from 'lucide-react';
import { TRANSLATIONS } from './constants';
import { SUPERADMIN_EMAIL } from './constants';
import { resolveTenant, Tenant } from './services/TenantResolver';
import { getApiRestaurantId, setApiRestaurantId, getSettings } from './services/api';
import { supabase } from './services/supabaseClient';

// Create a Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// SuperAdmin Protected Route
const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === SUPERADMIN_EMAIL) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    });
  }, []);

  if (authorized === null) return <div className="p-10 text-center">Verificando acceso...</div>;
  if (authorized === false) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App: React.FC = () => {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [appReady, setAppReady] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    const initApp = async () => {
      try {
        const currentTenant = await resolveTenant();

        if (currentTenant) {
          console.log('Tenant Resolved:', currentTenant.name);
          setTenant(currentTenant);
          // Initialize API service with the resolved ID
          setApiRestaurantId(currentTenant.id);

          // Fetch and Apply Theme Settings
          getSettings().then(settings => {
            if (settings.theme_primary_color) {
              document.documentElement.style.setProperty('--color-primary', settings.theme_primary_color);
            }
            if (settings.theme_secondary_color) {
              document.documentElement.style.setProperty('--color-secondary', settings.theme_secondary_color);
            }
            if (settings.logo_url) {
              setLogoUrl(settings.logo_url);
            }
            if (settings.favicon_url) {
              const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
              link.type = 'image/png';
              link.rel = 'icon';
              link.href = settings.favicon_url;
              document.getElementsByTagName('head')[0].appendChild(link);
            }
          });

          setAppReady(true);

          // Optional: Update document title
          document.title = `${currentTenant.name} - Reservas`;
        } else {
          setResolveError('Restaurante no encontrado o configuración inválida.');
        }
      } catch (e) {
        console.error('Failed to resolve tenant', e);
        setResolveError('Error crítico iniciando la aplicación.');
      }
    };

    initApp();
  }, []);

  if (resolveError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col p-4 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Error de Configuración</h1>
        <p className="text-red-600">{resolveError}</p>
        <p className="text-sm text-gray-500 mt-4">Contacte con el administrador del sistema.</p>
      </div>
    );
  }

  if (!appReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 border-4 border-t-amber-500 border-gray-200 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Cargando Restaurante...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Routes>
        {/* Public Booking Route */}
        <Route path="/" element={
          <>
            {/* Header inside Route to allow separate layouts if needed */}
            <header className="bg-primary text-white py-6 px-4 shadow-lg border-b border-white/10">
              <div className="max-w-4xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt={tenant?.name} className="h-16 w-auto object-contain" />
                  ) : (
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-secondary">
                        {tenant?.name || TRANSLATIONS[lang].title}
                      </h1>
                      <p className="text-xs md:text-sm text-gray-400 tracking-widest uppercase mt-1">
                        {TRANSLATIONS[lang].subtitle}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
                    className="text-xs font-bold uppercase tracking-widest hover:text-secondary transition-colors border border-gray-600 px-3 py-1 rounded"
                  >
                    {lang === 'es' ? 'EN' : 'ES'}
                  </button>
                  {/* Admin Link (Hidden/Subtle) */}
                  <Link to="/login" className="text-gray-600 hover:text-white transition-colors">
                    <Key className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </header>

            <main className="container mx-auto px-4 py-8">
              <PublicBooking lang={lang} />
            </main>

            <footer className="bg-gray-900 text-gray-500 py-8 text-center text-xs mt-12">
              <p>&copy; {new Date().getFullYear()} {tenant?.name || 'La Tavernetta'}. All rights reserved.</p>
            </footer>
          </>
        } />

        {/* Login Route */}
        <Route path="/login" element={<Login tenant={tenant} onLogin={(user) => {
          sessionStorage.setItem('isAuthenticated', 'true');
          const params = window.location.search;

          // Check if SuperAdmin
          if (user?.email === SUPERADMIN_EMAIL) {
            window.location.href = `/superadmin`;
            return;
          }

          window.location.href = `/admin${params}`;
        }} />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard onLogout={() => window.location.reload()} />
          </ProtectedRoute>
        } />

        <Route path="/admin/settings" element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        } />

        {/* Super Admin Route */}
        <Route path="/superadmin" element={
          <SuperAdminRoute>
            <SuperAdminDashboard />
          </SuperAdminRoute>
        } />

        {/* Cancellation Route */}
        <Route path="/cancelar" element={<CancelBooking />} />

        {/* Password Recovery Route */}
        <Route path="/admin/update-password" element={<UpdatePassword />} />

      </Routes>
    </div>
  );
}

export default App;