import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { admin } from '../services/api';
import FreshCard from './FreshCard';
import Modal from './Modal';
import TechBadge from './TechBadge';
import PendingUsersPanel from './PendingUsersPanel';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'OPERARIO_LOGISTICO',
  phone: '',
  vehicle: '',
};

const ROLE_BADGE = {
  ADMINISTRADOR: 'bg-slate-900 text-lime-400 border-slate-900',
  OPERARIO_LOGISTICO: 'bg-lime-400/20 text-[#4F6B00] border-lime-400/40',
  SUPERVISOR_PRODUCCION: 'bg-terracotta-400/15 text-[#C4622F] border-terracotta-400/40',
  CONTADOR: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  TRANSPORTISTA: 'bg-slate-100 text-slate-700 border-slate-300',
};

function formatDate(iso) {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UsersManager({ currentUser }) {
  const [data, setData] = useState({ users: [], roles: [], total: 0, active: 0, inactive: 0, pending: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('staff');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await admin.getUsers();
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar el personal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  };

  const visible = useMemo(() => {
    const settled = data.users.filter((u) => u.status !== 'PENDING');
    if (filter === 'all') return settled;
    return settled.filter((u) => (filter === 'active' ? u.is_active : !u.is_active));
  }, [data.users, filter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone || '',
      vehicle: u.vehicle || '',
    });
    setError('');
    setShowModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        const res = await admin.updateUser(editing.id, payload);
        flash(res.data.message);
      } else {
        const res = await admin.createUser(form);
        flash(res.data.message);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    try {
      const res = await admin.toggleUserStatus(u.id);
      flash(res.data.message);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cambiar el estado');
    }
  };

  const selectedRole = data.roles.find((r) => r.value === form.role);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios & Roles</h1>
          <p className="text-sm text-slate-500">Personal registrado y matriz de permisos RBAC</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-sm font-bold hover:bg-slate-800 transition-all"
        >
          + Registrar Nuevo Usuario
        </button>
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="flex gap-2 p-1 bg-slate-900/5 rounded-2xl w-full md:w-auto md:self-start">
        <button
          onClick={() => setTab('staff')}
          className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tab === 'staff'
              ? 'bg-slate-900 text-lime-400 shadow-sm'
              : 'text-slate-600 hover:bg-white/70'
          }`}
        >
          Personal Registrado
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
            tab === 'pending'
              ? 'bg-slate-900 text-lime-400 shadow-sm'
              : 'text-slate-600 hover:bg-white/70'
          }`}
        >
          Solicitudes Pendientes
          {data.pending > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                tab === 'pending' ? 'bg-lime-400 text-slate-900' : 'bg-amber-400 text-slate-900'
              }`}
            >
              {data.pending}
            </span>
          )}
        </button>
      </div>

      {tab === 'pending' ? (
        <PendingUsersPanel onChanged={load} />
      ) : (
        <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FreshCard title="Total Personal" value={data.total} subtitle="Usuarios registrados" icon="people" color="slate" />
        <FreshCard title="Activos" value={data.active} subtitle="Con acceso" icon="check-circle-fill" color="lime" />
        <FreshCard title="Inactivos" value={data.inactive} subtitle="Acceso bloqueado" icon="slash-circle" color="terracotta" />
        <FreshCard title="Roles" value={data.roles.length} subtitle="En la matriz RBAC" icon="shield-check" color="cream" />
      </div>

      <div className="bg-white/80 rounded-3xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 p-5 border-b border-slate-100">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Tabla de Personal</h2>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Activos' },
              { key: 'inactive', label: 'Inactivos' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  filter === f.key
                    ? 'bg-slate-900 text-lime-400'
                    : 'bg-white/60 text-slate-600 border border-slate-200 hover:bg-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:hidden divide-y divide-slate-100">
          {loading && <p className="p-6 text-center text-xs text-slate-400">Cargando personal…</p>}
          {!loading && visible.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-400">Sin usuarios para este filtro</p>
          )}
          {visible.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              isSelf={u.id === currentUser?.id}
              onEdit={() => openEdit(u)}
              onToggle={() => toggleStatus(u)}
            />
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-cream">
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Nombre</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Correo</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Rol Asignado</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Estado</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Cargando personal…</td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Sin usuarios para este filtro</td>
                </tr>
              )}
              {visible.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-cream/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-lime-400/30 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <p className="text-[10px] text-lime-600 font-bold uppercase tracking-wider">Tú</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 truncate">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold border ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                      {u.role_label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                      u.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : u.is_active
                          ? 'bg-green-500/10 text-green-700'
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        u.status === 'REJECTED' ? 'bg-red-500' : u.is_active ? 'bg-green-500' : 'bg-slate-400'
                      }`} />
                      {u.status === 'REJECTED' ? 'RECHAZADO' : u.is_active ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-900 transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(u)}
                        disabled={u.id === currentUser?.id}
                        title={u.id === currentUser?.id ? 'No puedes desactivar tu propia cuenta' : ''}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.is_active
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        }`}
                      >
                        {u.is_active ? 'Inactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Editar Usuario #${editing.id}` : 'Registrar Nuevo Usuario'}
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name || !form.email || (!editing && !form.password)}
              className="px-4 py-2 rounded-xl text-sm bg-slate-900 text-lime-400 font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando…' : editing ? 'Guardar Cambios' : 'Registrar Usuario'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Nombre Completo</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="Ej: Juan Perez"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="usuario@micromaster.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
              {editing ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
              placeholder={editing ? 'Dejar vacío para mantener' : 'Mínimo 6 caracteres'}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Rol Asignado</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
            >
              {data.roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {selectedRole && (
              <div className="mt-2 flex items-start gap-2 text-[11px] text-slate-500">
                <TechBadge label={`${selectedRole.modules.length} módulos`} color="slate" />
                <span className="pt-0.5">
                  Acceso: {selectedRole.modules.length ? selectedRole.modules.join(', ') : 'sin módulos completos'}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Teléfono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="+57 300 000 0000"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Vehículo (conductores)</label>
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                placeholder="ABC-123"
              />
            </div>
          </div>
        </form>
      </Modal>
        </>
      )}
    </div>
  );
}

function UserCard({ u, isSelf, onEdit, onToggle }) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-lime-400/30 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
          {u.name?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {u.name} {isSelf && <span className="text-[10px] text-lime-600 uppercase">· Tú</span>}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
              {u.role_label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              u.status === 'REJECTED'
                ? 'bg-red-50 text-red-700'
                : u.is_active
                  ? 'bg-green-500/10 text-green-700'
                  : 'bg-slate-200 text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                u.status === 'REJECTED' ? 'bg-red-500' : u.is_active ? 'bg-green-500' : 'bg-slate-400'
              }`} />
              {u.status === 'REJECTED' ? 'RECHAZADO' : u.is_active ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Último acceso: {formatDate(u.last_login_at)}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-2 rounded-xl text-[11px] font-bold border border-slate-200 text-slate-700 hover:border-slate-900"
            >
              Editar
            </button>
            <button
              onClick={onToggle}
              disabled={isSelf}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
                u.is_active
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {u.is_active ? 'Inactivar' : 'Reactivar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}