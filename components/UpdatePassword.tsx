import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UpdatePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Verification: Check if we have a session (password reset tokens create a session)
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                setError('La sesión ha expirado o el enlace es inválido. Por favor, solicita uno nuevo.');
            }
        };
        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err: any) {
            console.error('Error updating password:', err);
            setError(err.message || 'Error al actualizar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 shadow-xl max-w-sm w-full text-center rounded-lg border-t-4 border-green-500">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Contraseña Actualizada</h2>
                    <p className="text-gray-500 text-sm mb-6">Tu contraseña ha sido cambiada correctamente. Te redirigimos al login...</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-green-500 text-white py-3 rounded font-bold uppercase text-xs tracking-widest"
                    >
                        Volver al Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-10 shadow-xl max-w-sm w-full border-t-4 border-primary rounded-lg">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Nueva Contraseña</h2>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mt-2">Establece tus nuevas credenciales</p>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            required
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs p-3 bg-red-50 border-l-2 border-red-500 flex items-start gap-2 rounded">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded hover:opacity-90 transition-opacity font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Actualizar Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UpdatePassword;
