import React from 'react';
import { Link } from 'react-router-dom';

export default function PendingApproval() {
  return (
    <div className="min-h-screen bg-cream technical-grid flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <div className="bg-white/85 rounded-3xl border border-slate-200 p-6 md:p-8 backdrop-blur-sm shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-lime-400 rounded-3xl mb-4">
            <span className="text-2xl font-bold text-slate-900">MM</span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            <i className="bi bi-hourglass-split" aria-hidden="true" /> Solicitud de Registro Enviada
          </h1>

          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            Tu cuenta ha sido creada con éxito, pero requiere la{' '}
            <strong className="text-slate-900">aprobación del Administrador</strong> de
            MicroMaster.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Estado actual:{' '}
              <i className="bi bi-hourglass-split" aria-hidden="true" /> Esperando Confirmación de
              Registro
            </span>
          </div>

          <p className="mt-5 text-sm text-slate-500 leading-relaxed">
            Te notificaremos por correo electrónico una vez que tu acceso haya
            sido activado.
          </p>

          <Link
            to="/login"
            className="mt-7 inline-block w-full bg-slate-900 hover:bg-slate-800 text-lime-400 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all"
          >
            Volver al Inicio de Sesión
          </Link>

          <p className="mt-4 text-[11px] text-slate-400">
            ¿Tu solicitud fue rechazada por error? Contacta al Administrador de
            MicroMaster.
          </p>
        </div>
      </div>
    </div>
  );
}