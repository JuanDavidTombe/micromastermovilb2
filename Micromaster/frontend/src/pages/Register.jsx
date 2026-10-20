import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import { REGISTRABLE_ROLES } from '../constants/roles';

const EMPTY = {
  name: '',
  identity_document: '',
  email: '',
  phone: '',
  role: 'OPERARIO_LOGISTICO',
  password: '',
  password_confirmation: '',
};

const FIELD =
  'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 outline-none';
const LABEL = 'text-xs uppercase tracking-wider text-slate-500 mb-1 block';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (form.password !== form.password_confirmation) {
      setError('La contraseña y su confirmación no coinciden');
      setLoading(false);
      return;
    }

    try {
      await auth.register(form);
      navigate('/pending-approval', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.errors
          ? Object.values(data.errors).flat().join(' · ')
          : data?.message || 'No se pudo enviar la solicitud de registro'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream technical-grid flex items-start md:items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-lime-400 rounded-3xl mb-3">
            <span className="text-2xl font-bold text-slate-900">MM</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            MICRO<span className="text-[#4F6B00]">MASTER</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Registro de Nuevo Usuario</p>
        </div>

        <div className="bg-white/85 rounded-3xl border border-slate-200 p-5 md:p-8 backdrop-blur-sm">
          <div className="flex items-start gap-3 mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <i className="bi bi-hourglass-split text-xl leading-none" aria-hidden="true" />
            <p className="text-xs text-amber-900 leading-relaxed">
              Tu cuenta quedará <strong>en espera</strong> hasta que el{' '}
              <strong>Administrador de MicroMaster</strong> revise y apruebe esta
              solicitud. Recibirás un correo electrónico cuando tu acceso sea activado.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Nombre Completo</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="Ej: Juan Pérez"
                  value={form.name}
                  onChange={set('name')}
                  required
                  maxLength={120}
                />
              </div>
              <div>
                <label className={LABEL}>Documento de Identidad (Cédula/DNI)</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="Ej: CC 12.345.678"
                  value={form.identity_document}
                  onChange={set('identity_document')}
                  required
                  maxLength={40}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Correo Electrónico Corporativo</label>
                <input
                  type="email"
                  className={FIELD}
                  placeholder="usuario@micromaster.com"
                  value={form.email}
                  onChange={set('email')}
                  required
                  maxLength={150}
                />
              </div>
              <div>
                <label className={LABEL}>Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  className={FIELD}
                  placeholder="+57 300 000 0000"
                  value={form.phone}
                  onChange={set('phone')}
                  required
                  maxLength={40}
                />
              </div>
            </div>

            <div>
              <label className={LABEL}>Rol Solicitado</label>
              <select
                className={FIELD}
                value={form.role}
                onChange={set('role')}
                required
              >
                {REGISTRABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {REGISTRABLE_ROLES.find((r) => r.value === form.role)?.description}
                {' · '}
                <span className="text-slate-400">
                  El Administrador asigna el rol oficial al aprobar la solicitud.
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Contraseña</label>
                <input
                  type="password"
                  className={FIELD}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className={LABEL}>Confirmar Contraseña</label>
                <input
                  type="password"
                  className={FIELD}
                  placeholder="Repite la contraseña"
                  value={form.password_confirmation}
                  onChange={set('password_confirmation')}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all mt-2"
            >
              {loading ? 'ENVIANDO SOLICITUD...' : '[ SOLICITAR REGISTRO ]'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes una cuenta aprobada?{' '}
            <Link to="/login" className="font-bold text-[#4F6B00] hover:underline">
              Inicia Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}