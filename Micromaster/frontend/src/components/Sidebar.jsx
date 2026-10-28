import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SIDEBAR_MENU } from '../constants/sidebarMenu';

export default function Sidebar({ user, sidebarOpen, onToggle, onLogout }) {
  const role = user?.role || 'ADMINISTRADOR';
  const menu = SIDEBAR_MENU[role] || [];
  const location = useLocation();

  const sectionFor = (pathname) =>
    menu.find((s) => s.items.some((it) => it.to === pathname));

  const activeSection = sectionFor(location.pathname);
  const [openId, setOpenId] = useState(activeSection?.id || (menu.length > 0 ? menu[0].id : null));


  useEffect(() => {
    if (activeSection) setOpenId(activeSection.id);

  }, [location.pathname]);

  if (menu.length === 0) return null;

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  const isActive = (item) => item.to === location.pathname;

  return (
    <aside
      className={`fixed left-0 top-0 h-dvh w-[272px] max-w-[86vw] md:w-64 md:max-w-none bg-slate-900 text-white z-50 flex flex-col border-r border-white/10 transition-transform duration-300 will-change-transform ${
        sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4 md:p-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-lime-400 rounded-xl flex items-center justify-center font-extrabold text-slate-900 text-sm shrink-0">
            MM
          </div>
          <div className="min-w-0">
            <span className="text-base font-extrabold tracking-tight block leading-none">
              MICRO<span className="text-lime-400">MASTER</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">B2B Platform</span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 active:bg-white/15 transition-colors"
          title="Cerrar menú"
          aria-label="Cerrar menú"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-2">
        {menu.map((section) => {
          const open = openId === section.id;
          return (
            <div key={section.id} className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="font-mono text-[10px] text-lime-400/70 shrink-0">{section.num}</span>
                <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  {section.label}
                </span>
                <span
                  className={`text-[10px] text-lime-400/80 transition-transform duration-200 ${
                    open ? 'rotate-90' : ''
                  }`}
                >
                  <i className="bi bi-caret-right-fill" aria-hidden="true" />
                </span>
              </button>

              {open && (
                <div className="px-2 pb-2.5 space-y-0.5 animate-fade-in">
                  {section.items.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => {
                          if (window.innerWidth < 1024) onToggle();
                        }}
                        className={`group flex items-start gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          active
                            ? 'bg-lime-400 text-slate-900 shadow-lg shadow-lime-400/20'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className={`text-base leading-none mt-0.5 shrink-0 ${active ? 'text-slate-900' : 'text-lime-400'}`}>
                          <i className={`bi bi-${item.icon}`} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] leading-tight">
                            {item.label}
                          </span>
                          <span
                            className={`block text-[10px] leading-tight mt-0.5 ${
                              active ? 'text-slate-900/70' : 'text-white/40 group-hover:text-white/60'
                            }`}
                          >
                            {item.desc}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5">
          <div className="w-9 h-9 rounded-full bg-lime-400 flex items-center justify-center text-xs font-extrabold text-slate-900 shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {user?.name ? user.name.replace(/Palehor/gi, 'Palechor') : 'Usuario'}
            </p>
            <p className="text-[9px] text-lime-400 uppercase tracking-wider truncate">{user?.role_label}</p>
          </div>
          <button onClick={onLogout} title="Cerrar sesión" className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-white/50 text-xs transition-colors">
            <i className="bi bi-power" aria-hidden="true" />
          </button>
        </div>
        <p className="text-center text-[9px] text-white/25 mt-2 uppercase tracking-[0.2em]">v2.4.1 · Operación con criterio</p>
      </div>
    </aside>
  );
}
