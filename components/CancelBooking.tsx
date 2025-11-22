import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { cancelBookingByUUID } from '../services/api';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';

const CancelBooking = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const cancelBooking = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Token de cancelación no válido o faltante.');
                return;
            }

            try {
                const result = await cancelBookingByUUID(token);
                if (result.success) {
                    setStatus('success');
                } else {
                    setStatus('error');
                    setMessage('No se pudo cancelar la reserva. Es posible que ya esté cancelada o el enlace haya expirado.');
                }
            } catch (error) {
                setStatus('error');
                setMessage('Ocurrió un error inesperado al procesar la solicitud.');
            }
        };

        cancelBooking();
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-tav-gold animate-spin mb-4" />
                        <h2 className="text-xl font-serif font-bold text-tav-black">Procesando Cancelación...</h2>
                        <p className="text-gray-500 mt-2">Por favor espere un momento.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-serif font-bold text-tav-black mb-2">Reserva Cancelada</h2>
                        <p className="text-gray-600 mb-6">
                            Tu reserva ha sido cancelada correctamente. Lamentamos que no puedas venir y esperamos verte pronto.
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-tav-gold font-bold uppercase tracking-wider hover:text-tav-black transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <XCircle className="w-16 h-16 text-red-500 mb-4" />
                        <h2 className="text-2xl font-serif font-bold text-tav-black mb-2">Error</h2>
                        <p className="text-gray-600 mb-6">
                            {message}
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-tav-gold font-bold uppercase tracking-wider hover:text-tav-black transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CancelBooking;
