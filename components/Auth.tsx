import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2 } from 'lucide-react';
import { Tenant } from '../services/TenantResolver';
import { SUPERADMIN_EMAIL, SITE_URL } from '../constants';

import { User } from '@supabase/supabase-js';

interface Props {
  onLogin: (user: User) => void;
  tenant: Tenant | null;
}

const Auth: React.FC<Props> = ({ onLogin, tenant }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const resetUrl = `${window.location.origin}/admin/update-password`;
    console.log('[Auth] Password reset redirect URL:', resetUrl);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    });

    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    // Access Control Logic
    if (tenant) {
      // SuperAdmin Bypass
      if (email.toLowerCase().trim() === SUPERADMIN_EMAIL.toLowerCase().trim()) {
        setLoading(false);
        if (authData.user) onLogin(authData.user);
        return;
      }

      // Check whitelist
      const { data: accessData } = await supabase
        .from('restaurant_users')
        .select('*')
        .eq('restaurant_id', tenant.id)
        .eq('email', email.toLowerCase().trim())
        .single();

      if (!accessData) {
        setLoading(false);
        setError('Acceso Denegado: Tu usuario no tiene permiso para administrar este restaurante.');
        await supabase.auth.signOut();
        return;
      }
    }

    setLoading(false);
    if (authData.user) {
      onLogin(authData.user);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 shadow-xl max-w-sm w-full border-t-4 border-primary rounded-lg">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">{tenant?.name || 'Admin Panel'}</h2>
          <p className="text-xs text-secondary uppercase tracking-widest mt-2">{tenant?.slug ? `Access for ${tenant.slug}` : 'System Access'}</p>
        </div>

        {resetMode ? (
          resetSent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-green-700 p-4 rounded text-sm">
                Hemos enviado un enlace de recuperación a <strong>{email}</strong>.
                <br />Revisa tu correo (y SPAM).
              </div>
              <button onClick={() => { setResetMode(false); setResetSent(false); }} className="text-primary text-xs font-bold uppercase underline">Volver al Login</button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <h3 className="text-center font-bold text-gray-700">Recuperar Contraseña</h3>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  required
                />
              </div>
              {error && <div className="text-red-500 text-xs p-3 bg-red-50 border-l-2 border-red-500 rounded">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded hover:opacity-90 transition-opacity font-bold text-xs uppercase tracking-widest flex justify-center"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Enviar Enlace'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => setResetMode(false)} className="text-gray-400 hover:text-gray-600 text-xs uppercase font-bold">Cancelar</button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase text-gray-500">Password</label>
                <button type="button" onClick={() => setResetMode(true)} className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-xs p-3 bg-red-50 border-l-2 border-red-500 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded hover:opacity-90 transition-opacity font-bold text-xs uppercase tracking-widest flex justify-center"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Login'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;