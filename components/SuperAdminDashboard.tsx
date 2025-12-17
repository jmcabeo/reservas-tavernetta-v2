
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, ExternalLink, RefreshCw, Key, X, Users, UserPlus } from 'lucide-react';

interface Restaurant {
    id: string;
    name: string;
    slug: string;
    created_at: string;
}

interface RestaurantUser {
    id: string;
    email: string;
    role: string;
}

const SuperAdminDashboard: React.FC = () => {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(false);
    const [newRest, setNewRest] = useState({ name: '', slug: '', custom_domain: '' });

    const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
    const [manageUsersRest, setManageUsersRest] = useState<Restaurant | null>(null);
    const [usersList, setUsersList] = useState<RestaurantUser[]>([]);
    const [newUserEmail, setNewUserEmail] = useState('');

    const fetchRestaurants = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
        if (data) setRestaurants(data);
        setLoading(false);
    };

    const fetchUsers = async (restaurantId: string) => {
        const { data } = await supabase.from('restaurant_users').select('*').eq('restaurant_id', restaurantId);
        if (data) setUsersList(data);
    };

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manageUsersRest || !newUserEmail) return;

        const { error } = await supabase.from('restaurant_users').insert([
            { restaurant_id: manageUsersRest.id, email: newUserEmail.toLowerCase().trim() }
        ]);

        if (error) alert('Error añadiendo usuario: ' + error.message);
        else {
            setNewUserEmail('');
            fetchUsers(manageUsersRest.id);
        }
    };

    const removeUser = async (userId: string) => {
        if (!confirm('¿Quitar acceso a este usuario?')) return;
        const { error } = await supabase.from('restaurant_users').delete().eq('id', userId);
        if (manageUsersRest) fetchUsers(manageUsersRest.id);
    };

    useEffect(() => {
        if (manageUsersRest) fetchUsers(manageUsersRest.id);
    }, [manageUsersRest]);

    useEffect(() => {
        fetchRestaurants();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRest.name || !newRest.slug) {
            alert('Por favor completa Nombre y Slug.');
            return;
        }

        setLoading(true);
        const payload: any = { name: newRest.name, slug: newRest.slug };
        if (newRest.custom_domain) payload.custom_domain = newRest.custom_domain;

        try {
            const { data, error } = await supabase.from('restaurants').insert([payload]).select().single();

            if (error) {
                console.error('Supabase create error:', error);
                throw error;
            }

            // Auto-init settings handled by migration or manual call? Migration handled existing. 
            // For NEW ones, we should init settings in code or trigger. Let's do in code for simplicity.
            if (data) {
                await supabase.from('settings').insert([
                    { restaurant_id: data.id, key: 'require_manual_approval', value: 'false' },
                    { restaurant_id: data.id, key: 'flexible_capacity', value: 'false' },
                    { restaurant_id: data.id, key: 'manual_validation_message', value: 'Tu reserva está pendiente de confirmación.' }
                ]);
            }

            setNewRest({ name: '', slug: '', custom_domain: '' });
            fetchRestaurants();
            alert('Restaurante creado correctamente');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'PGRST204') {
                alert('FALTA MIGRACIÓN: La columna "custom_domain" no existe. Ejecuta el SQL "add_custom_domains.sql" en Supabase.');
            } else {
                alert('Error creando restaurante: ' + (err.message || JSON.stringify(err)));
            }
        } finally {
            setLoading(false);
        }
    };

    const deleteRestaurant = async (id: string) => {
        if (!confirm('¿Seguro que quieres borrar este restaurante? Se borrarán todos sus datos.')) return;

        console.log('Deleting restaurant:', id);

        // Manual Cascade Delete (to avoid FK errors if not set in DB)
        try {
            await supabase.from('settings').delete().eq('restaurant_id', id);
            await supabase.from('bookings').delete().eq('restaurant_id', id);
            // Delete tables first then zones
            await supabase.from('tables').delete().eq('restaurant_id', id);
            await supabase.from('zones').delete().eq('restaurant_id', id);
        } catch (e) {
            console.error('Cascade delete warning:', e);
        }

        const { error } = await supabase.from('restaurants').delete().eq('id', id);

        if (error) {
            console.error('Delete error:', error);
            alert('Error: ' + error.message);
        } else {
            console.log('Deleted successfully');
            fetchRestaurants();
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            {/* Credentials Modal */}
            {selectedRest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-500" /> Credenciales de Acceso
                            </h3>
                            <button onClick={() => setSelectedRest(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                                <p><strong>Restaurante:</strong> {selectedRest.name}</p>
                                <p className="mt-1">Usa estos datos para configurar el entorno o acceder como admin.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Restaurant ID (UUID)</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-3 bg-gray-100 border border-gray-300 rounded font-mono text-sm break-all">
                                        {selectedRest.id}
                                    </code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(selectedRest.id)}
                                        className="bg-gray-200 hover:bg-gray-300 px-3 rounded font-bold text-xs uppercase"
                                    >
                                        Copiar
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Slug URL</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-3 bg-gray-100 border border-gray-300 rounded font-mono text-sm">
                                        {selectedRest.slug}
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedRest(null)}
                                className="px-4 py-2 bg-gray-900 text-white rounded font-bold text-sm hover:bg-black"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Users Modal */}
            {manageUsersRest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-500" /> Gestionar Usuarios: {manageUsersRest.name}
                            </h3>
                            <button onClick={() => setManageUsersRest(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Add User Form */}
                            <form onSubmit={addUser} className="flex gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                                <input
                                    type="email"
                                    required
                                    placeholder="usuario@email.com"
                                    className="flex-1 p-2 border rounded text-sm"
                                    value={newUserEmail}
                                    onChange={e => setNewUserEmail(e.target.value)}
                                />
                                <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1 text-sm font-bold">
                                    <UserPlus className="w-4 h-4" /> Añadir
                                </button>
                            </form>

                            {/* Users List */}
                            <div>
                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Usuarios con Acceso</h4>
                                <div className="border rounded divide-y">
                                    {usersList.length === 0 ? (
                                        <p className="p-4 text-center text-sm text-gray-400">Sin usuarios asignados.</p>
                                    ) : (
                                        usersList.map(u => (
                                            <div key={u.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                                <span className="text-sm font-medium">{u.email}</span>
                                                <button onClick={() => removeUser(u.id)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setManageUsersRest(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-bold text-sm hover:bg-gray-200">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-gray-900">Panel SuperAdmin</h1>
                        <p className="text-gray-500">Gestión Multi-Tenant de Restaurantes</p>
                    </div>
                    <button onClick={fetchRestaurants} className="p-2 bg-white rounded shadow text-gray-600 hover:text-blue-600">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </header>

                {/* Create Form */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border border-gray-200">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-green-600" /> Crear Nuevo Restaurante
                    </h2>
                    <form onSubmit={handleCreate} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nombre</label>
                            <input
                                value={newRest.name}
                                onChange={e => setNewRest({ ...newRest, name: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="Ej: Pizzeria Luigi"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Slug (URL)</label>
                            <input
                                value={newRest.slug}
                                onChange={e => setNewRest({ ...newRest, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                className="w-full p-2 border rounded"
                                placeholder="ej: pizzeria-luigi"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Dominio Personal (Opcional)</label>
                            <input
                                value={newRest.custom_domain}
                                onChange={e => setNewRest({ ...newRest, custom_domain: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="ej: reservas.pizzerialuigi.com"
                            />
                        </div>
                        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700">
                            Crear
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="p-4">Nombre</th>
                                <th className="p-4">Slug</th>
                                <th className="p-4">ID (UUID)</th>
                                <th className="p-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {restaurants.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-bold">{r.name}</td>
                                    <td className="p-4 text-blue-600 font-mono text-sm">{r.slug}</td>
                                    <td className="p-4 text-gray-400 font-mono text-xs">{r.id}</td>
                                    <td className="p-4 flex gap-3">
                                        <button
                                            onClick={() => window.open(`/?restaurant_id=${r.id}`, '_blank')}
                                            className="text-gray-600 hover:text-blue-600"
                                            title="Ver Web Pública"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => window.open(`/login?restaurant_id=${r.id}`, '_blank')}
                                            className="text-gray-600 hover:text-green-600"
                                            title="Ir al Admin"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedRest(r)}
                                            className="text-gray-600 hover:text-amber-600"
                                            title="Ver Credenciales"
                                        >
                                            <Key className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setManageUsersRest(r)}
                                            className="text-gray-600 hover:text-blue-600"
                                            title="Gestionar Usuarios"
                                        >
                                            <Users className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteRestaurant(r.id)}
                                            className="text-red-400 hover:text-red-600"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {restaurants.length === 0 && <div className="p-8 text-center text-gray-500">No hay restaurantes creados.</div>}
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
