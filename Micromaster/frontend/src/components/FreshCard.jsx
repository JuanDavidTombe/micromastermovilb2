import React from 'react';

export default function FreshCard({ title, value, subtitle, icon, color = 'lime', className = '' }) {
  const colorMap = {
    lime: { bg: 'bg-lime-400/20', border: 'border-lime-400/40', text: 'text-[#4F6B00]', icon: 'text-[#4F6B00]' },
    terracotta: { bg: 'bg-terracotta-400/15', border: 'border-terracotta-400/35', text: 'text-[#C4622F]', icon: 'text-[#C4622F]' },
    slate: { bg: 'bg-slate-900', border: 'border-slate-900', text: 'text-white', icon: 'text-lime-400' },
    cream: { bg: 'bg-white/80', border: 'border-slate-200', text: 'text-slate-900', icon: 'text-slate-900' },
  };

  const c = colorMap[color];

  return (
    <div className={`${c.bg} border ${c.border} rounded-3xl p-4 md:p-5 backdrop-blur-sm hover:shadow-lg transition-all duration-300 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">{title}</p>
          <p className={`text-[20px] leading-tight md:text-2xl font-bold truncate ${c.text}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`shrink-0 text-xl md:text-2xl ${c.icon}`}>
          <i className={`bi bi-${icon}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
