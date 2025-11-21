import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2 } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 shadow-2xl max-w-sm w-full border-t-4 border-tav-gold">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif text-tav-black font-bold">La Tavernetta</h2>
          <p className="text-xs text-tav-gold uppercase tracking-widest mt-2">Admin Access</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-b-2 border-gray-200 p-3 focus:border-tav-gold outline-none transition-colors bg-gray-50 focus:bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-b-2 border-gray-200 p-3 focus:border-tav-gold outline-none transition-colors bg-gray-50 focus:bg-white"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs p-3 bg-red-50 border-l-2 border-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-tav-black text-tav-gold py-4 hover:bg-gray-900 transition-colors font-bold text-xs uppercase tracking-widest flex justify-center"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;