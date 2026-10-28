import React, { useEffect, useState } from 'react';
import UserProfileModal from './UserProfileModal';

export default function Topbar({ user, onMenuToggle, onProfileUpdated }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const roleLabel = user?.role_label || 'Usuario';

  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e) => e.key === 'Escape' && setProfileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileOpen]);

  return (
    <>
      <header className="bg-slate-900 text-white px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden shrink-0 w-10 h-10 -ml-1 flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
            title="Menú"
            aria-label="Abrir menú"
          >
            <i className="bi bi-list text-xl leading-none" aria-hidden="true" />
          </button>
          <div className="h-4 w-px bg-white/20 hidden lg:block"></div>
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">MICROMASTER B2B</span>
            <span className="text-xs bg-lime-400 text-slate-900 px-2 py-0.5 rounded font-bold">LIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              title="Rol asignado por el administrador del sistema"
              className="text-[10px] md:text-xs bg-lime-400/20 text-lime-400 px-2 py-1 rounded-lg font-mono truncate max-w-[7.5rem] md:max-w-none select-none cursor-default"
            >
              {roleLabel}
            </span>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title="Mi perfil"
              aria-label="Abrir mi perfil de usuario"
              className="group flex items-center gap-2 rounded-full pl-1 pr-1 md:pr-3 py-1 hover:bg-white/10 active:bg-white/15 transition-colors"
            >
              <span className="w-8 h-8 shrink-0 bg-lime-400/30 group-hover:bg-lime-400/50 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
              <span className="hidden md:block text-left min-w-0 max-w-[9rem]">
                <span className="block text-[11px] font-semibold truncate leading-tight">
                  {user?.name ? user.name.replace(/Palehor/gi, 'Palechor') : ''}
                </span>
                <span className="block text-[9px] text-lime-400 uppercase tracking-wider truncate leading-tight">
                  Mi perfil
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        onProfileUpdated={(p) => onProfileUpdated && onProfileUpdated(p)}
      />
    </>
  );
}