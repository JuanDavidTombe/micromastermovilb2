import React from 'react';

export default function StatusBadge({ status }) {
  const config = {
    optimal: { label: 'Óptimo', bg: 'bg-lime-400/30', text: 'text-[#3F5600]', dot: 'bg-[#5a7d00]' },
    warning: { label: 'Próximo a vencer', bg: 'bg-terracotta-400/25', text: 'text-[#A44B1F]', dot: 'bg-terracotta-500' },
    critical: { label: 'Crítico', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    quarantined: { label: 'En Cuarentena', bg: 'bg-slate-300/60', text: 'text-red-700', dot: 'bg-red-600' },
    rejected: { label: 'Rechazado', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    approved: { label: 'Aprobado', bg: 'bg-green-500/15', text: 'text-green-700', dot: 'bg-green-600' },
    rupture: { label: 'Quiebre', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    low: { label: 'Bajo mínimo', bg: 'bg-terracotta-400/25', text: 'text-[#A44B1F]', dot: 'bg-terracotta-500' },
    ok: { label: 'Disponible', bg: 'bg-lime-400/30', text: 'text-[#3F5600]', dot: 'bg-[#5a7d00]' },
    pending: { label: 'Pendiente', bg: 'bg-slate-900/10', text: 'text-slate-700', dot: 'bg-slate-700' },
    confirmed: { label: 'Confirmado', bg: 'bg-lime-400/30', text: 'text-[#3F5600]', dot: 'bg-[#5a7d00]' },
    completed: { label: 'Completado', bg: 'bg-green-500/15', text: 'text-green-700', dot: 'bg-green-600' },
    in_progress: { label: 'En Proceso', bg: 'bg-terracotta-400/25', text: 'text-[#A44B1F]', dot: 'bg-terracotta-500' },
    assigned: { label: 'Asignado', bg: 'bg-sky-500/15', text: 'text-sky-700', dot: 'bg-sky-600' },
    in_transit: { label: 'En Tránsito', bg: 'bg-terracotta-400/25', text: 'text-[#A44B1F]', dot: 'bg-terracotta-500' },
    delivered: { label: 'Entregado', bg: 'bg-green-500/15', text: 'text-green-700', dot: 'bg-green-600' },
    cancelled: { label: 'Cancelado', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    refunded: { label: 'Reembolsado', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    draft: { label: 'Borrador', bg: 'bg-slate-900/10', text: 'text-slate-600', dot: 'bg-slate-500' },

    Open: { label: 'Abierta', bg: 'bg-red-500/15', text: 'text-red-600', dot: 'bg-red-500' },
    Resolved: { label: 'Resuelta', bg: 'bg-green-500/15', text: 'text-green-700', dot: 'bg-green-600' },

    live: { label: 'En vivo', bg: 'bg-lime-400/30', text: 'text-[#3F5600]', dot: 'bg-[#5a7d00]' },
    weak: { label: 'Señal débil', bg: 'bg-terracotta-400/25', text: 'text-[#A44B1F]', dot: 'bg-terracotta-500' },
    stale: { label: 'Sin señal', bg: 'bg-slate-900/10', text: 'text-slate-600', dot: 'bg-slate-500' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 ${c.bg} ${c.text} px-2.5 py-1 rounded-full text-xs font-semibold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}
