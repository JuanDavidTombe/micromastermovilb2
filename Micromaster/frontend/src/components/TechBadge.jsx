import React from 'react';

export default function TechBadge({ label, color = 'lime', size = 'md' }) {
  const colorMap = {
    lime: 'bg-lime-400/30 text-[#3F5600] border-lime-400/30',
    terracotta: 'bg-terracotta-400/20 text-terracotta-400 border-terracotta-400/30',
    slate: 'bg-slate-900/10 text-slate-900 border-slate-900/20',
    red: 'bg-red-500/20 text-red-500 border-red-500/30',
    green: 'bg-green-500/20 text-green-600 border-green-500/30',
    cream: 'bg-cream text-slate-900 border-white/30',
  };

  const sizeMap = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${colorMap[color]} ${sizeMap[size]}`}>
      {label}
    </span>
  );
}
