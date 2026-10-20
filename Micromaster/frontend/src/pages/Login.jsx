import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/api';
import { getDefaultRoute } from '../constants/roles';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await auth.login(email, password);
      localStorage.setItem('micromaster_token', res.data.token);
      localStorage.setItem('micromaster_user', JSON.stringify(res.data.user));
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      const data = err.response?.data;
      const status = data?.status;

      if (status === 'PENDING' || status === 'REJECTED') {
        setNotice(data?.error || 'Tu cuenta aún no está habilitada');
      } else {
        setError(data?.error || data?.message || 'Credenciales inválidas');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream technical-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-lime-400 rounded-3xl mb-4">
            <span className="text-3xl font-bold text-slate-900">MM</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">MICRO<span className="text-[#4F6B00]">MASTER</span></h1>
          <p className="text-sm text-slate-500 mt-2">Plataforma B2B de Control Operativo</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 rounded-3xl border border-slate-200 p-8 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Iniciar Sesión</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {notice}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="admin@micromaster.com"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all mt-6"
            >
              {loading ? 'INICIANDO...' : 'INICIAR SESIÓN'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link
              to="/register"
              className="font-bold text-[#4F6B00] hover:underline"
            >
              Regístrate aquí
            </Link>
          </p>

          <div className="mt-6 p-4 bg-cream rounded-xl">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Credenciales de Prueba</p>
            <p className="text-xs text-slate-900">Admin: admin@micromaster.com / admin123</p>
            <p className="text-xs text-slate-900">Logístico: logistica@micromaster.com / logistica123</p>
            <p className="text-xs text-slate-900">Producción: produccion@micromaster.com / produccion123</p>
            <p className="text-xs text-slate-900">Contador: contabilidad@micromaster.com / contabilidad123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
