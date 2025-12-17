import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Palette, Lock, Image as ImageIcon, Upload, X, Layout, Plus, Trash2, Table as TableIcon, Clock } from 'lucide-react';
import { getSettings, updateSetting, getApiRestaurantId } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { Zone, Table } from '../types';

interface AdminSettingsProps {
    onSettingsChange?: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ onSettingsChange }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Settings State
    const [requireManualApproval, setRequireManualApproval] = useState(false);
    const [flexibleCapacity, setFlexibleCapacity] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [themePrimaryColor, setThemePrimaryColor] = useState('#111827'); // Default Gray-900
    const [themeSecondaryColor, setThemeSecondaryColor] = useState('#d97706'); // Default Amber-600
    const [manualValidationMessage, setManualValidationMessage] = useState('');
    const [minNoticeMinutes, setMinNoticeMinutes] = useState(1440); // Default 24h

    // Zones & Tables State
    const [zones, setZones] = useState<Zone[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [newZoneName, setNewZoneName] = useState({ es: '', en: '' });
    const [newTable, setNewTable] = useState({ zoneId: 0, min: 2, max: 4, number: '' });

    // Upload State
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadSettings();
        fetchZonesAndTables();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const settings = await getSettings();
            setRequireManualApproval(settings['require_manual_approval'] === 'true');
            setFlexibleCapacity(settings['flexible_capacity'] === 'true');
            setLogoUrl(settings['logo_url'] || '');
            setThemePrimaryColor(settings['theme_primary_color'] || '#111827');
            setThemeSecondaryColor(settings['theme_secondary_color'] || '#d97706');
            setManualValidationMessage(settings['manual_validation_message'] || 'Tu reserva está pendiente de confirmación por el restaurante.');
            setMinNoticeMinutes(parseInt(settings['min_notice_minutes'] || '1440'));
        } catch (error) {
            console.error('Error loading settings:', error);
            showToast('Error cargando configuración', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchZonesAndTables = async () => {
        const R_ID = getApiRestaurantId();
        const { data: zData } = await supabase.from('zones').select('*').eq('restaurant_id', R_ID).order('id');
        const { data: tData } = await supabase.from('tables').select('*').eq('restaurant_id', R_ID).order('table_number');

        if (zData) setZones(zData);
        if (tData) setTables(tData);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const promises = [
                updateSetting('require_manual_approval', String(requireManualApproval)),
                updateSetting('flexible_capacity', String(flexibleCapacity)),
                updateSetting('logo_url', logoUrl),
                updateSetting('theme_primary_color', themePrimaryColor),
                updateSetting('theme_secondary_color', themeSecondaryColor),
                updateSetting('manual_validation_message', manualValidationMessage),
                updateSetting('min_notice_minutes', String(minNoticeMinutes))
            ];

            await Promise.all(promises);

            showToast('Configuración guardada correctamente', 'success');
            if (onSettingsChange) onSettingsChange();

        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Error guardando configuración', 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Zone Management ---
    const handleAddZone = async () => {
        if (!newZoneName.es) return;

        const { error } = await supabase.from('zones').insert([{
            restaurant_id: getApiRestaurantId(),
            name: newZoneName.es, // Legacy field
            name_es: newZoneName.es,
            name_en: newZoneName.en || newZoneName.es
        }]);

        if (error) {
            showToast('Error creando zona: ' + error.message, 'error');
        } else {
            showToast('Zona creada', 'success');
            setNewZoneName({ es: '', en: '' });
            fetchZonesAndTables();
        }
    };

    const handleDeleteZone = async (id: number) => {
        if (!confirm('¿Eliminar zona? Se eliminarán también sus mesas asociadas.')) return;

        // Delete tables first (if no cascade)
        await supabase.from('tables').delete().eq('zone_id', id);
        const { error } = await supabase.from('zones').delete().eq('id', id);

        if (error) showToast('Error eliminando zona', 'error');
        else fetchZonesAndTables();
    };

    // --- Table Management ---
    const handleAddTable = async () => {
        if (!newTable.zoneId || !newTable.number) {
            showToast('Selecciona zona y número de mesa', 'error');
            return;
        }

        const { error } = await supabase.from('tables').insert([{
            restaurant_id: getApiRestaurantId(),
            zone_id: newTable.zoneId,
            table_number: newTable.number,
            min_pax: newTable.min,
            max_pax: newTable.max
        }]);

        if (error) {
            showToast('Error creando mesa: ' + error.message, 'error');
        } else {
            showToast('Mesa añadida', 'success');
            setNewTable(prev => ({ ...prev, number: String(Number(prev.number) + 1) })); // Auto-increment number suggestion
            fetchZonesAndTables();
        }
    };

    const handleDeleteTable = async (id: number) => {
        const { error } = await supabase.from('tables').delete().eq('id', id);
        if (error) showToast('Error eliminando mesa', 'error');
        else fetchZonesAndTables();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];
        const fileExt = file.name.split('.').pop();
        const R_ID = getApiRestaurantId();
        const fileName = `${R_ID}/logo_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        setUploading(true);
        try {
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
            if (data) {
                setLogoUrl(data.publicUrl);
                showToast('Logo subido. Recuerda guardar.', 'success');
            }
        } catch (error: any) {
            showToast('Error subiendo imagen: ' + error.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando configuración...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {notification && (
                <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded shadow-xl text-white font-bold text-sm animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {notification.message}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-tav-black">Configuración General</h2>
                    <p className="text-gray-500 text-sm">Gestiona los aspectos principales de tu restaurante.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-tav-black text-tav-gold px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                    <Save className="w-4 h-4" />
                </button>
            </div>

            {/* Logic Configuration */}
            <section className="bg-white p-6 rounded-sm shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <Lock className="text-tav-gold w-5 h-5" />
                    <h3 className="font-bold text-lg text-tav-black">Reglas de Negocio</h3>
                </div>

                <div className="space-y-8">
                    {/* Manual Approval Toggle */}
                    <div className="flex items-start gap-4">
                        <div className="pt-1">
                            <button
                                onClick={() => setRequireManualApproval(!requireManualApproval)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${requireManualApproval ? 'bg-tav-gold' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${requireManualApproval ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                            <h4 className="font-bold text-tav-black text-sm uppercase mb-1">Validación Manual Requerida</h4>
                            <p className="text-sm text-gray-500 mb-2">
                                Todas las reservas quedarán en estado <strong>Pendiente</strong> hasta que tú las valides.
                            </p>
                            {requireManualApproval && (
                                <div className="mt-2 space-y-2">
                                    <label className="text-xs font-bold uppercase text-gray-500">Mensaje al cliente</label>
                                    <input
                                        type="text"
                                        value={manualValidationMessage}
                                        onChange={(e) => setManualValidationMessage(e.target.value)}
                                        className="w-full border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Min Notice Input */}
                    <div className="flex items-start gap-4 border-t border-gray-100 pt-6">
                        <div className="pt-1">
                            <Clock className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-tav-black text-sm uppercase mb-1">Antelación Mínima (Tiempo Lead)</h4>
                            <p className="text-sm text-gray-500 mb-2">
                                ¿Con cuánta antelación mínima deben reservar los clientes?
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    value={minNoticeMinutes / 60}
                                    onChange={(e) => setMinNoticeMinutes(Math.round(parseFloat(e.target.value) * 60))}
                                    className="w-20 border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-center font-bold"
                                />
                                <span className="text-sm font-bold text-gray-700">Horas</span>
                                <span className="text-xs text-gray-400 ml-2">({minNoticeMinutes} minutos)</span>
                            </div>
                        </div>
                    </div>

                    {/* Flexible Capacity Toggle */}
                    <div className="flex items-start gap-4 border-t border-gray-100 pt-6">
                        <div className="pt-1">
                            <button
                                onClick={() => setFlexibleCapacity(!flexibleCapacity)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flexibleCapacity ? 'bg-tav-gold' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flexibleCapacity ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                            <h4 className="font-bold text-tav-black text-sm uppercase mb-1">Aforo Flexible (Sin Límite de Mesas)</h4>
                            <p className="text-sm text-gray-500">
                                Si activas esto, el sistema <strong>NO restará mesas</strong> ni mostrará disponibilidad numérica.
                                Ideal si prefieres aceptar todas las solicitudes y validarlas tú mismo manualmente.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Zones & Tables Management */}
            <section className="bg-white p-6 rounded-sm shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <Layout className="text-tav-gold w-5 h-5" />
                    <h3 className="font-bold text-lg text-tav-black">Gestión de Espacios (Salas y Mesas)</h3>
                </div>

                {/* Create Zone */}
                <div className="flex gap-4 items-end mb-8 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                    <div className="flex-1">
                        <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Nombre Sala (Español)</label>
                        <input
                            value={newZoneName.es}
                            onChange={e => setNewZoneName({ ...newZoneName, es: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-sm"
                            placeholder="Ej: Terraza Principal"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Nombre (Inglés) - Opcional</label>
                        <input
                            value={newZoneName.en}
                            onChange={e => setNewZoneName({ ...newZoneName, en: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-sm"
                            placeholder="Ej: Main Terrace"
                        />
                    </div>
                    <button
                        onClick={handleAddZone}
                        className="bg-tav-black text-tav-gold px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-gray-800"
                    >
                        Crear Sala
                    </button>
                </div>

                <div className="grid gap-6">
                    {zones.map(zone => (
                        <div key={zone.id} className="border border-gray-200 rounded-sm overflow-hidden">
                            <div className="bg-gray-100 p-4 flex justify-between items-center border-b border-gray-200">
                                <h4 className="font-bold text-tav-black flex items-center gap-2">
                                    <Layout className="w-4 h-4 text-gray-500" />
                                    {zone.name_es}
                                    {zone.name_en && <span className="text-xs text-gray-500 font-normal">({zone.name_en})</span>}
                                </h4>
                                <button onClick={() => handleDeleteZone(zone.id)} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4">
                                {/* Tables List */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {tables.filter(t => t.zone_id === zone.id).map(t => (
                                        <div key={t.id} className="group relative bg-white border border-gray-200 px-3 py-2 rounded-sm flex flex-col items-center min-w-[60px]">
                                            <span className="text-xs font-bold text-gray-400">Mesa</span>
                                            <span className="text-lg font-serif font-bold text-tav-black">{t.table_number}</span>
                                            <span className="text-[10px] text-gray-400">{t.min_pax}-{t.max_pax} pax</span>
                                            <button
                                                onClick={() => handleDeleteTable(t.id)}
                                                className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {tables.filter(t => t.zone_id === zone.id).length === 0 && (
                                        <span className="text-xs text-gray-400 italic py-2">Sin mesas asignadas</span>
                                    )}
                                </div>

                                {/* Add Table Form Inline */}
                                <div className="flex items-center gap-2 text-sm border-t border-dashed border-gray-200 pt-3">
                                    <Plus className="w-4 h-4 text-tav-gold" />
                                    <span className="text-xs font-bold uppercase text-gray-500 mr-2">Añadir Mesa:</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Nº Mesa</span>
                                        <input
                                            className="w-20 p-1 border border-gray-300 text-center uppercase text-sm"
                                            placeholder="Ej: A1"
                                            value={newTable.zoneId === zone.id ? newTable.number : ''}
                                            onChange={e => setNewTable({ ...newTable, zoneId: zone.id, number: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Min Pax</span>
                                        <input
                                            type="number"
                                            className="w-16 p-1 border border-gray-300 text-center text-sm"
                                            placeholder="2"
                                            value={newTable.zoneId === zone.id ? newTable.min : 2}
                                            onChange={e => setNewTable({ ...newTable, zoneId: zone.id, min: Number(e.target.value) })}
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Max Pax</span>
                                        <input
                                            type="number"
                                            className="w-16 p-1 border border-gray-300 text-center text-sm"
                                            placeholder="4"
                                            value={newTable.zoneId === zone.id ? newTable.max : 4}
                                            onChange={e => setNewTable({ ...newTable, zoneId: zone.id, max: Number(e.target.value) })}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (newTable.zoneId !== zone.id) {
                                                setNewTable({ ...newTable, zoneId: zone.id });
                                                // Need to wait for stated update? actually directly calling add with current inputs if they were valid
                                                // But here inputs are bound to state. If user typed in input, state matches.
                                                // Just ensure we call addTable with correct logic
                                                // Wait, if I type in input, state updates.
                                                // So handleAddTable uses 'newTable' state.
                                            }
                                            // Trigger add
                                            handleAddTable();
                                        }}
                                        className="text-xs font-bold uppercase text-tav-gold hover:text-black ml-2"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Branding Configuration */}
            <section className="bg-white p-6 rounded-sm shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <Palette className="text-tav-gold w-5 h-5" />
                    <h3 className="font-bold text-lg text-tav-black">Branding y Apariencia</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Logo URL */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Logo del Restaurante
                        </label>

                        <div className="border border-gray-200 bg-gray-50 h-40 flex flex-col items-center justify-center rounded-sm relative overflow-hidden group">
                            {logoUrl ? (
                                <>
                                    <img src={logoUrl} alt="Preview Logo" className="h-full object-contain p-2" onError={(e) => (e.currentTarget.src = '')} />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => setLogoUrl('')}
                                            className="text-white hover:text-red-400 font-bold uppercase text-xs flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full"
                                        >
                                            <X className="w-4 h-4" /> Quitar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-4">
                                    <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <span className="text-gray-400 text-xs text-center block mb-2">Sube tu logo (PNG, JPG)</span>
                                </div>
                            )}

                            {uploading && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tav-gold"></div>
                                </div>
                            )}
                        </div>

                        <div className="mt-3">
                            <label className="cursor-pointer flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors w-full">
                                <Upload className="w-4 h-4" />
                                {uploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                            </label>
                            <p className="text-[10px] text-gray-400 mt-1 text-center">Se guardará en Supabase Storage (bucket: logos)</p>
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-4">Colores Corporativos</h4>

                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Color Principal (Botones, Títulos)</label>
                            <div className="flex items-center gap-4 mb-2">
                                <input
                                    type="color"
                                    value={themePrimaryColor}
                                    onChange={(e) => setThemePrimaryColor(e.target.value)}
                                    className="h-10 w-20 cursor-pointer border-none p-0 bg-transparent"
                                />
                                <span className="text-sm font-mono bg-gray-100 px-3 py-2 rounded-sm border border-gray-200">{themePrimaryColor}</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Color Secundario (Acentos, Bordes)</label>
                            <div className="flex items-center gap-4 mb-2">
                                <input
                                    type="color"
                                    value={themeSecondaryColor}
                                    onChange={(e) => setThemeSecondaryColor(e.target.value)}
                                    className="h-10 w-20 cursor-pointer border-none p-0 bg-transparent"
                                />
                                <span className="text-sm font-mono bg-gray-100 px-3 py-2 rounded-sm border border-gray-200">{themeSecondaryColor}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-sm border border-gray-200 mt-4">
                            <p className="text-sm font-bold mb-2">Vista Previa</p>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 text-xs font-bold uppercase text-white rounded-sm shadow-sm"
                                    style={{ backgroundColor: themePrimaryColor }}
                                >
                                    Botón Principal
                                </button>
                                <button
                                    className="px-4 py-2 text-xs font-bold uppercase bg-white border rounded-sm shadow-sm"
                                    style={{ borderColor: themeSecondaryColor, color: themeSecondaryColor }}
                                >
                                    Botón Secundario
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-tav-black text-tav-gold px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                        <Save className="w-4 h-4" />
                    </button>
                </div>
            </section>
        </div>
    );
};

export default AdminSettings;
