import React, { useCallback, useEffect, useState } from 'react';
import { admin } from '../services/api';
import TechBadge from './TechBadge';

const EMPTY = {
  company_name: '',
  tax_id: '',
  warehouse_address: '',
  phone: '',
  email: '',
  latitude: '',
  longitude: '',
};

const FIELDS = [
  {
    key: 'company_name',
    label: 'Nombre Comercial',
    type: 'text',
    placeholder: 'MICROMASTER B2B',
    required: true,
    hint: 'Razón social con la que opera la plataforma',
  },
  {
    key: 'tax_id',
    label: 'NIT / ID Tributario',
    type: 'text',
    placeholder: '901.456.789-1',
    hint: 'Identificación tributaria de la empresa',
  },
  {
    key: 'phone',
    label: 'Teléfono',
    type: 'text',
    placeholder: '+57 604 123 4567',
  },
  {
    key: 'email',
    label: 'Correo de Contacto',
    type: 'email',
    placeholder: 'contacto@micromaster.com',
  },
];

export default function CompanyProfile() {
  const [form, setForm] = useState(EMPTY);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await admin.getCompany();
      const c = res.data.company || {};
      setForm({
        company_name: c.company_name || '',
        tax_id: c.tax_id || '',
        warehouse_address: c.warehouse_address || '',
        phone: c.phone || '',
        email: c.email || '',
        latitude: c.latitude ?? '',
        longitude: c.longitude ?? '',
      });
      setSystem(res.data.system || null);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar el perfil de la empresa');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await admin.updateCompany({
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      });
      setToast(res.data.message);
      setTimeout(() => setToast(null), 3200);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración del Sistema</h1>
          <p className="text-sm text-slate-500">Perfil B2B de la empresa y parámetros de operación</p>
        </div>
        <TechBadge label="MICROMASTER B2B" color="lime" />
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 bg-white/80 rounded-3xl border border-slate-200 p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-5">
            <i className="bi bi-building" aria-hidden="true" /> Perfil B2B de la Empresa
          </h2>

          {loading ? (
            <p className="text-xs text-slate-400 py-8 text-center">Cargando perfil…</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    />
                    {f.hint && <p className="text-[10px] text-slate-400 mt-1">{f.hint}</p>}
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                  Dirección de Bodega Central <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.warehouse_address}
                  onChange={(e) => setForm({ ...form, warehouse_address: e.target.value })}
                  placeholder="Cra. 45 # 12-40, Bodega Central, Medellín"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  <i className="bi bi-geo-alt-fill" aria-hidden="true" /> Punto de origen del GPS: todas las rutas se trazan desde aquí.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Latitud Bodega</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="6.2442"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Longitud Bodega</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="-75.5812"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 rounded-xl bg-slate-900 text-lime-400 text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Guardando…' : <><i className="bi bi-floppy-fill" aria-hidden="true" /> Guardar Cambios</>}
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Descartar Cambios
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-3xl p-5">
            <h3 className="text-xs uppercase tracking-[0.2em] text-lime-400 mb-4">Ficha de la Empresa</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <span className="text-[11px] text-white/50">Nombre</span>
                <span className="text-sm font-bold text-right truncate">{form.company_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <span className="text-[11px] text-white/50">NIT</span>
                <span className="text-sm font-mono text-right truncate">{form.tax_id || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <span className="text-[11px] text-white/50">Teléfono</span>
                <span className="text-sm text-right truncate">{form.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <span className="text-[11px] text-white/50">Correo</span>
                <span className="text-sm text-right truncate">{form.email || '—'}</span>
              </div>
              <div>
                <span className="text-[11px] text-white/50">Bodega Central</span>
                <p className="text-sm mt-1 leading-snug">{form.warehouse_address || '—'}</p>
              </div>
            </div>
          </div>

          {system && (
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Parámetros del Sistema</h3>
              <div className="space-y-2">
                {Object.entries(system).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-cream">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{k.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-bold text-slate-900 text-right truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}