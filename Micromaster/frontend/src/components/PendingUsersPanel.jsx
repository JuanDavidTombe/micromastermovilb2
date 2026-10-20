import React, { useCallback, useEffect, useState } from 'react';
import { admin } from '../services/api';
import Modal from './Modal';
import { REGISTRABLE_ROLES } from '../constants/roles';

const ROLE_BADGE = {
  ADMINISTRADOR: 'bg-slate-900 text-lime-400 border-slate-900',
  OPERARIO_LOGISTICO: 'bg-lime-400/20 text-[#4F6B00] border-lime-400/40',
  SUPERVISOR_PRODUCCION: 'bg-terracotta-400/15 text-[#C4622F] border-terracotta-400/40',
  CONTADOR: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  TRANSPORTISTA: 'bg-slate-100 text-slate-700 border-slate-300',
};

const FIELD =
  'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-lime-400 outline-none';
const LABEL = 'text-xs uppercase tracking-wider text-slate-500 mb-1 block';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PendingUsersPanel({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [target, setTarget] = useState(null);
  const [role, setRole] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await admin.getPendingUsers();
      setRows(res.data.users || []);
      setTotal(res.data.pending ?? (res.data.users || []).length);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudieron cargar las solicitudes');
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

  const openApprove = (u) => {
    setTarget({ user: u, mode: 'approve' });
    setRole(u.requested_role || u.role);
    setReason('');
    setError('');
  };

  const openReject = (u) => {
    setTarget({ user: u, mode: 'reject' });
    setRole('');
    setReason('');
    setError('');
  };

  const confirm = async () => {
    if (!target) return;
    setSaving(true);
    setError('');
    try {
      const res =
        target.mode === 'approve'
          ? await admin.approveUser(target.user.id, { role })
          : await admin.rejectUser(target.user.id, { reason: reason.trim() });

      flash(res.data.message);
      setTarget(null);
      await load();
      onChanged?.();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'No se pudo completar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Solicitudes Pendientes
            {total > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-bold align-middle">
                {total}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            Altas públicas desde /register en espera de tu aprobación
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-sm font-bold hover:bg-slate-800 transition-all"
        >
          <><i className="bi bi-arrow-clockwise" aria-hidden="true" /> Actualizar</>
        </button>
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {error && !target && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white/80 rounded-3xl border border-slate-200">
          Cargando solicitudes…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center bg-white/80 rounded-3xl border border-slate-200">
          <i className="bi bi-check-circle-fill text-3xl mb-2" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">No hay solicitudes pendientes</p>
          <p className="text-xs text-slate-500 mt-1">
            Las solicitudes de /register aparecerán aquí para su aprobación.
          </p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((u) => (
              <div key={u.id} className="p-4 bg-white/85 rounded-2xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-400/30 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
                    {u.name?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-slate-400 uppercase tracking-wider text-[9px]">Documento</dt>
                    <dd className="text-slate-700 font-semibold">{u.identity_document || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 uppercase tracking-wider text-[9px]">Teléfono</dt>
                    <dd className="text-slate-700 font-semibold">{u.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 uppercase tracking-wider text-[9px]">Rol solicitado</dt>
                    <dd>{u.requested_role_label || u.role_label}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 uppercase tracking-wider text-[9px]">Solicitado</dt>
                    <dd className="text-slate-700 font-semibold">{formatDate(u.created_at)}</dd>
                  </div>
                </dl>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openApprove(u)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold bg-lime-400 text-slate-900 hover:bg-lime-500"
                  >
                    <><i className="bi bi-check-lg" aria-hidden="true" /> Aprobar</>
                  </button>
                  <button
                    onClick={() => openReject(u)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold bg-red-50 text-red-600 border border-red-200"
                  >
                    <><i className="bi bi-x-lg" aria-hidden="true" /> Rechazar</>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white/80 rounded-3xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream">
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Nombre</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Correo</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Documento</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Rol Solicitado</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500">Fecha Solicitud</th>
                    <th className="px-4 py-3 text-right text-[10px] uppercase tracking-[0.15em] text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-cream/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-400/30 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
                            {u.name?.charAt(0)}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 truncate">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{u.identity_document || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold border ${ROLE_BADGE[u.requested_role || u.role] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                          {u.requested_role_label || u.role_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openApprove(u)}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-lime-400 text-slate-900 hover:bg-lime-500 transition-all"
                          >
                            <><i className="bi bi-check-lg" aria-hidden="true" /> Aprobar</>
                          </button>
                          <button
                            onClick={() => openReject(u)}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
                          >
                            <><i className="bi bi-x-lg" aria-hidden="true" /> Rechazar</>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={
          target?.mode === 'approve'
            ? `Aprobar a ${target?.user?.name || ''}`
            : `Rechazar a ${target?.user?.name || ''}`
        }
        footer={
          <>
            <button
              onClick={() => setTarget(null)}
              className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirm}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
                target?.mode === 'approve'
                  ? 'bg-lime-400 text-slate-900 hover:bg-lime-500'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {saving
                ? 'Procesando…'
                : target?.mode === 'approve'
                  ? 'Confirmar Aprobación'
                  : 'Confirmar Rechazo'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          {target && (
            <div className="p-3 rounded-xl bg-cream text-xs text-slate-600 space-y-1">
              <p><span className="text-slate-400">Correo:</span> {target.user.email}</p>
              <p><span className="text-slate-400">Documento:</span> {target.user.identity_document || '—'}</p>
              <p><span className="text-slate-400">Teléfono:</span> {target.user.phone || '—'}</p>
              <p><span className="text-slate-400">Rol solicitado:</span> {target.user.requested_role_label || target.user.role_label}</p>
            </div>
          )}

          {target?.mode === 'approve' && (
            <>
              <div>
                <label className={LABEL}>Rol Oficial Asignado</label>
                <select className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
                  {REGISTRABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Puedes asignar un rol distinto al solicitado; queda registrado como rol oficial.
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Al aprobar, la cuenta queda <strong>ACTIVA</strong> y el usuario podrá iniciar sesión de inmediato.
              </p>
            </>
          )}

          {target?.mode === 'reject' && (
            <>
              <div>
                <label className={LABEL}>Motivo del Rechazo (opcional)</label>
                <textarea
                  rows={3}
                  className={FIELD}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Los documentos no coinciden con los datos de la empresa"
                  maxLength={255}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                La solicitud queda como <strong>RECHAZADA</strong> y el usuario no podrá iniciar sesión.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}