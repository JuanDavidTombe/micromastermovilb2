import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import DriverAvatar from './DriverAvatar';

const DEFAULT_ORIGIN = { label: 'Planta Principal - Medellín', lat: '6.24420000', lng: '-75.58120000' };

export default function RouteFormModal({ isOpen, onClose, orders = [], drivers = [], onSubmit, creating }) {
  const [driverId, setDriverId] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [selected, setSelected] = useState([]);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [showOrigin, setShowOrigin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDriverId('');
      setSelected([]);
      setOrigin(DEFAULT_ORIGIN);
      setShowOrigin(false);
      setError('');
      setDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    }
  }, [isOpen]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const chosen = useMemo(() => orders.filter((o) => selected.includes(o.id)), [orders, selected]);
  const chosenDrivers = drivers.find((d) => String(d.id) === String(driverId));

  const destination = useMemo(() => {
    const uniq = [...new Set(chosen.map((o) => o.destination))];
    if (!uniq.length) return '—';
    if (uniq.length <= 2) return uniq.join(' · ');
    return `${uniq[0]} · +${uniq.length - 1} paradas`;
  }, [chosen]);

  const canSubmit = driverId && date && selected.length > 0 && !creating;

  const submit = async () => {
    setError('');
    try {
      await onSubmit({
        driver_id: Number(driverId),
        scheduled_date: date,
        order_ids: selected,
        origin_label: origin.label || undefined,
        origin_lat: origin.lat ? Number(origin.lat) : undefined,
        origin_lng: origin.lng ? Number(origin.lng) : undefined,
      });
      onClose();
    } catch (e) {
      const data = e?.response?.data;
      if (data?.message) {
        setError(data.message);
      } else if (data?.errors) {
        setError(Object.values(data.errors).flat().join(' · '));
      } else {
        setError('No fue posible crear la ruta');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva ruta de entrega"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-sm bg-slate-900 text-lime-400 font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Creando…' : 'Crear y asignar ruta'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
              Conductor (rol Transportista)
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
            >
              <option value="">Seleccione un conductor…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.vehicle || 'sin vehículo'}
                </option>
              ))}
            </select>
            {chosenDrivers && (
              <div className="flex items-center gap-3 mt-2 p-2 rounded-xl bg-cream border border-slate-200">
                <DriverAvatar driver={chosenDrivers} size="sm" showSignal={false} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{chosenDrivers.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{chosenDrivers.phone}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Fecha programada</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Código autogenerado: <span className="font-mono text-slate-600">RTE-00N</span>
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs uppercase tracking-wider text-slate-500">
              Pedidos sin ruta ({selected.length} seleccionados)
            </label>
            <button
              onClick={() => setSelected(selected.length === orders.length ? [] : orders.map((o) => o.id))}
              className="text-[11px] font-bold text-[#4F6B00] hover:underline"
            >
              {selected.length === orders.length ? 'Limpiar' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {orders.length === 0 && (
              <p className="p-4 text-xs text-slate-400">No hay pedidos pendientes disponibles.</p>
            )}
            {orders.map((o) => {
              const on = selected.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                    on ? 'bg-lime-400/15' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(o.id)}
                    className="mt-1 accent-[#0F2133]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate">{o.client_name}</span>
                      <span className="text-[11px] font-mono text-slate-400">#{o.id}</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 truncate">{o.destination}</span>
                    <span className="block text-[11px] text-slate-400">${o.amount}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-cream border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-1">Vista previa</p>
          <p className="text-sm font-bold text-slate-900">{destination}</p>
          <p className="text-[11px] text-slate-500">
            {selected.length} parada{selected.length === 1 ? '' : 's'} · {chosenDrivers ? chosenDrivers.name : 'sin conductor'} · {date}
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowOrigin((v) => !v)}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
          >
            {showOrigin ? '− Ocultar origen' : '+ Cambiar origen (depósito)'}
          </button>
          {showOrigin && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <input
                value={origin.label}
                onChange={(e) => setOrigin({ ...origin, label: e.target.value })}
                placeholder="Etiqueta"
                className="sm:col-span-3 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none"
              />
              <input
                value={origin.lat}
                onChange={(e) => setOrigin({ ...origin, lat: e.target.value })}
                placeholder="Latitud"
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-lime-400 outline-none"
              />
              <input
                value={origin.lng}
                onChange={(e) => setOrigin({ ...origin, lng: e.target.value })}
                placeholder="Longitud"
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-lime-400 outline-none"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
