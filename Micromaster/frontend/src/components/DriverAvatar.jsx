import React, { useState } from 'react';

const SIZES = {
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
};

const SIGNAL = {
  live: { dot: 'bg-[#CCFF00]', ring: 'ring-lime-400', label: 'En vivo' },
  weak: { dot: 'bg-terracotta-400', ring: 'ring-terracotta-400', label: 'Señal débil' },
  stale: { dot: 'bg-slate-400', ring: 'ring-slate-300', label: 'Sin señal' },
};

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function signalFromAge(age) {
  if (age == null) return 'stale';
  if (age <= 30) return 'live';
  return age <= 120 ? 'weak' : 'stale';
}

export default function DriverAvatar({ driver, size = 'md', signal, showSignal = true }) {
  const [broken, setBroken] = useState(false);

  if (!driver) return null;

  const sig = signal || driver.tracking?.signal || signalFromAge(driver.last_location?.age_seconds);
  const s = SIGNAL[sig] || SIGNAL.stale;
  const photo = driver.photo_url;
  const age = driver.tracking?.source === 'simulated'
    ? 0
    : (driver.tracking?.age_seconds ?? driver.last_location?.age_seconds);
  const trackLabel = driver.tracking?.source === 'simulated' ? ' · GPS simulado' : '';

  return (
    <div className="relative inline-flex shrink-0">
      <div className={`${SIZES[size]} rounded-full overflow-hidden bg-slate-900 text-lime-400 flex items-center justify-center font-extrabold ring-1 ring-slate-900/20`}>
        {photo && !broken ? (
          <img
            src={photo}
            alt={driver.name}
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials(driver.name)}</span>
        )}
      </div>
      {showSignal && (
        <span
          title={`${s.label}${age != null ? ` · hace ${Math.round(age)}s` : ''}${trackLabel}`}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${s.dot} ring-2 ring-white`}
        />
      )}
    </div>
  );
}
