import React, { useState } from 'react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import DriverAvatar from './DriverAvatar';

const SEVERITY = {
  critical: { stripe: 'bg-red-500', chip: 'bg-red-500/15 text-red-600', icon: 'exclamation-octagon-fill' },
  warning: { stripe: 'bg-terracotta-500', chip: 'bg-terracotta-400/20 text-[#A44B1F]', icon: 'exclamation-triangle-fill' },
  attention: { stripe: 'bg-amber-400', chip: 'bg-amber-400/20 text-amber-700', icon: 'geo-alt-fill' },
  info: { stripe: 'bg-sky-500', chip: 'bg-sky-500/15 text-sky-700', icon: 'info-circle-fill' },
};

const TYPES = [
  { value: 'CLIENT_NOT_FOUND', label: 'Cliente ausente' },
  { value: 'VEHICLE_BREAKDOWN', label: 'Vehículo varado' },
  { value: 'WRONG_ADDRESS', label: 'Dirección incorrecta' },
  { value: 'OTHER', label: 'Otra novedad' },
];

function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export default function IncidentsPanel({
  incidents = [],
  summary,
  canManage = false,
  drivers = [],
  routes = [],
  reportableOrders = [],
  onReport,
  onUpdate,
  reporting,
}) {
  const [showReport, setShowReport] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [type, setType] = useState('CLIENT_NOT_FOUND');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState({});
  const [error, setError] = useState('');

  const submitReport = async () => {
    setError('');
    try {
      await onReport({ order_id: Number(orderId), type, description: description || undefined });
      setShowReport(false);
      setOrderId('');
      setDescription('');
    } catch (e) {
      const data = e?.response?.data;
      setError(data?.message || Object.values(data?.errors || {}).flat().join(' · ') || 'No se pudo reportar');
    }
  };

  return (
    <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Novedades de campo</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary ? `${summary.open} abiertas · ${summary.resolved} resueltas` : `${incidents.length} registros`}
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-terracotta-400 hover:bg-terracotta-500 text-white transition-all"
        >
          + Reportar
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1 -mr-1" style={{ maxHeight: 560 }}>
        {incidents.length === 0 && (
          <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200">
            <div className="text-3xl mb-2"><i className="bi bi-check-circle-fill" aria-hidden="true" /></div>
            <p className="text-xs font-bold text-slate-600">Sin novedades</p>
            <p className="text-[11px] text-slate-400 mt-1">Ruta despejada en todo el día de operación.</p>
          </div>
        )}

        {incidents.map((inc) => {
          const sev = SEVERITY[inc.severity] || SEVERITY.info;
          const isOpen = inc.status === 'OPEN';
          const expanded = open[inc.id];

          return (
            <div
              key={inc.id}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isOpen ? 'border-red-500/30 bg-white' : 'border-slate-200 bg-white/60 opacity-80'
              }`}
            >
              <div className="flex">
                <span className={`w-1.5 shrink-0 ${sev.stripe}`} />
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.chip}`}>
                        <i className={"bi bi-" + sev.icon} aria-hidden="true" /> {inc.type_label}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 mt-1.5 truncate">
                        {inc.route?.route_code} · Pedido #{inc.order_id}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{inc.order?.client_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={inc.status === 'OPEN' ? 'Open' : 'Resolved'} />
                      <span className="text-[10px] text-slate-400">{ago(inc.reported_at)}</span>
                    </div>
                  </div>

                  {inc.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{inc.description}</p>
                  )}

                  {inc.driver && (
                    <div className="flex items-center gap-2 mt-2">
                      <DriverAvatar driver={inc.driver} size="sm" showSignal={false} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{inc.driver.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{inc.driver.vehicle}</p>
                      </div>
                    </div>
                  )}

                  {inc.status === 'RESOLVED' && inc.resolution && (
                    <p className="text-[10px] text-green-700 bg-green-500/10 rounded-lg px-2 py-1 mt-2">
                      <i className="bi bi-check-lg" aria-hidden="true" /> {inc.resolution}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => setOpen((p) => ({ ...p, [inc.id]: !p[inc.id] }))}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700"
                    >
                      {expanded ? '− Menos' : '+ Acciones'}
                    </button>
                  </div>

                  {expanded && canManage && (
                    <div className="mt-2 p-2 rounded-xl bg-cream border border-slate-200 space-y-2">
                      {isOpen ? (
                        <button
                          onClick={() => onUpdate(inc.id, { status: 'RESOLVED', resolution: 'Resuelta desde el panel de Logística' })}
                          className="w-full py-2 rounded-lg bg-[#0F2133] text-lime-400 text-[11px] font-bold hover:bg-slate-800"
                        >
                          <i className="bi bi-check-lg" aria-hidden="true" /> Marcar como resuelta
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdate(inc.id, { status: 'OPEN' })}
                          className="w-full py-2 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-bold hover:bg-white"
                        >
                          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reabrir novedad
                        </button>
                      )}

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-400">Reasignar conductor</label>
                        <select
                          value=""
                          onChange={(e) => e.target.value && onUpdate(inc.id, { driver_id: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-white"
                        >
                          <option value="">Seleccionar…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-400">Cambiar de ruta</label>
                        <select
                          value=""
                          onChange={(e) => e.target.value && onUpdate(inc.id, { route_id: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-white"
                        >
                          <option value="">Seleccionar…</option>
                          {routes.map((r) => (
                            <option key={r.id} value={r.id}>{r.route_code} — {r.destination}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showReport}
        onClose={() => { setShowReport(false); setError(''); }}
        title="Reportar novedad de campo"
        footer={
          <>
            <button onClick={() => setShowReport(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={submitReport}
              disabled={!orderId || reporting}
              className="px-4 py-2 rounded-xl text-sm bg-terracotta-400 text-white font-bold hover:bg-terracotta-500 disabled:opacity-40"
            >
              {reporting ? 'Enviando…' : 'Reportar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Pedido afectado</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
            >
              <option value="">Seleccione un pedido con ruta…</option>
              {reportableOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} — {o.client_name} ({o.destination})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Tipo de novedad</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    type === t.value
                      ? 'bg-slate-900 text-lime-400 border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Detalle lo ocurrido en el punto de entrega…"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none resize-none"
            />
          </div>

          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}
