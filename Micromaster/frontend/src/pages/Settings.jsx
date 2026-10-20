import React from 'react';
import { useLocation } from 'react-router-dom';
import { hasModuleAccess } from '../constants/roles';
import UsersManager from '../components/UsersManager';
import CompanyProfile from '../components/CompanyProfile';

export default function Settings({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'administration');
  const location = useLocation();

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4"><i className="bi bi-lock-fill" aria-hidden="true" /></div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Configuración</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const isConfig = location.pathname === '/settings/config';
  return isConfig ? <CompanyProfile /> : <UsersManager currentUser={user} />;
}