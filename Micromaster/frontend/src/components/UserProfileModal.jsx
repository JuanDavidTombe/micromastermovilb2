import React, { useCallback, useEffect, useRef, useState } from 'react';
import { profile as profileApi, auth } from '../services/api';

const TABS = [
  { id: 'personal', label: 'Personal y Contacto', icon: 'pin-angle' },
  { id: 'laboral', label: 'Laboral y Operación', icon: 'buildings' },
  { id: 'seguridad', label: 'Seguridad y Accesos', icon: 'shield-lock' },
  { id: 'preferencias', label: 'Preferencias', icon: 'gear' },
];

const ROLE_BADGE = {
  ADMINISTRADOR: 'bg-slate-900 text-lime-400',
  OPERARIO_LOGISTICO: 'bg-lime-400/25 text-[#3F5600]',
  SUPERVISOR_PRODUCCION: 'bg-terracotta-400/20 text-[#C4622F]',
  CONTADOR: 'bg-blue-500/10 text-blue-700',
  TRANSPORTISTA: 'bg-slate-200 text-slate-700',
};

function errText(err, fallback) {
  const d = err?.response?.data;
  if (d?.errors) return Object.values(d.errors).flat().join(' ');
  return d?.message || fallback;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Switch({ checked, onChange, label, desc, icon }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-cream hover:bg-cream/70 transition-colors text-left"
    >
      <span className="min-w-0 flex items-start gap-3">
        <i className={`bi bi-${icon} text-base leading-none mt-0.5`} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-900">{label}</span>
          {desc && <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">{desc}</span>}
        </span>
      </span>
      <span className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-slate-900' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, hint, disabled }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
            : 'bg-white border-slate-200 text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-lime-400/40'
        }`}
      />
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function UserProfileModal({ isOpen, onClose, user, onProfileUpdated }) {
  const [tab, setTab] = useState('personal');
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  const [personal, setPersonal] = useState({ name: '', identity_document: '', employee_code: '', email: '', phone: '' });
  const [passwords, setPasswords] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [prefs, setPrefs] = useState({
    locale: 'es', theme: 'light',
    notify_email: true, notify_push: true, notify_sound: true,
    two_factor_enabled: false, two_factor_method: 'AUTHENTICATOR',
  });

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await profileApi.get();
      const p = res.data.profile;
      setData(p);
      setSessions(res.data.sessions || []);
      setPersonal({
        name: p.name || '', identity_document: p.identity_document || '',
        employee_code: p.employee_code || '', email: p.email || '', phone: p.phone || '',
      });
      setPrefs({
        locale: p.locale || 'es', theme: p.theme || 'light',
        notify_email: !!p.notify_email, notify_push: !!p.notify_push, notify_sound: !!p.notify_sound,
        two_factor_enabled: !!p.two_factor_enabled, two_factor_method: p.two_factor_method || 'AUTHENTICATOR',
      });
      return p;
    } catch (e) {
      setError(errText(e, 'No se pudo cargar el perfil'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPhoto = useCallback(async () => {
    try {
      const res = await profileApi.getPhoto();
      if (res.data instanceof Blob && res.data.size > 0) {
        setPhotoPreview(URL.createObjectURL(res.data));
      }
    } catch {
      setPhotoPreview(null);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setTab('personal');
    setPasswords({ current_password: '', password: '', password_confirmation: '' });

    load().then((p) => {
      if (p?.photo_url) loadPhoto();
    });
  }, [isOpen, load, loadPhoto]);

  const applyTheme = useCallback((theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  useEffect(() => {
    if (prefs.theme) applyTheme(prefs.theme);
  }, [prefs.theme, applyTheme]);

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const savePersonal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await profileApi.update(personal);
      setData(res.data.profile);
      flash(res.data.message);
      onProfileUpdated?.(res.data.profile);
    } catch (err) {
      setError(errText(err, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      setError('');
      const res = await profileApi.uploadPhoto(file);
      setData(res.data.profile);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(res.data.preview);
      flash(res.data.message);
      onProfileUpdated?.(res.data.profile);
    } catch (err) {
      setError(errText(err, 'No se pudo subir la fotografía'));
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    try {
      setSaving(true);
      const res = await profileApi.deletePhoto();
      setData(res.data.profile);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      flash(res.data.message);
      onProfileUpdated?.(res.data.profile);
    } catch (err) {
      setError(errText(err, 'No se pudo eliminar la fotografía'));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passwords.password !== passwords.password_confirmation) {
      setError('La nueva contraseña y su confirmación no coinciden');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await profileApi.changePassword(passwords);
      setSessions(res.data.sessions || []);
      setPasswords({ current_password: '', password: '', password_confirmation: '' });
      flash(res.data.message);
    } catch (err) {
      setError(errText(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setSaving(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await profileApi.updatePreferences(prefs);
      setData(res.data.profile);
      applyTheme(res.data.profile.theme);
      flash(res.data.message);
      onProfileUpdated?.(res.data.profile);
    } catch (err) {
      setError(errText(err, 'No se pudieron guardar las preferencias'));
    } finally {
      setSaving(false);
    }
  };

  const closeAllSessions = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await profileApi.revokeSessions();
      setSessions(res.data.sessions || []);
      flash(res.data.message);
    } catch (err) {
      setError(errText(err, 'No se pudieron cerrar las sesiones'));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setSaving(true);
    try {
      await auth.logout().catch(() => {});
    } finally {
      localStorage.removeItem('micromaster_token');
      localStorage.removeItem('micromaster_user');
      onClose?.();
      window.location.href = '/login';
    }
  };

  if (!isOpen) return null;

  const p = data || {};
  const externalSessions = sessions.filter((s) => !s.is_current);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-3">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        <div className="flex items-start justify-between gap-4 p-4 md:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-lime-400/30 flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-extrabold text-slate-900">
                  {p.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">Mi Perfil</h2>
              <p className="text-[11px] text-slate-500 truncate">
                {p.name} {p.employee_code ? `· ${p.employee_code}` : ''}
              </p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-bold ${ROLE_BADGE[p.role] || 'bg-slate-100 text-slate-700'}`}>
                {p.role_label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="px-3 md:px-5 pt-3 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(''); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-all ${
                  tab === t.id ? 'bg-slate-900 text-lime-400 shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <i className={`bi bi-${t.icon} text-xs leading-none`} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {(toast || error) && (
          <div className="px-4 md:px-5 pt-3 shrink-0">
            {toast && <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-[11px] font-bold animate-fade-in">{toast}</div>}
            {error && <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">{error}</div>}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-10">Cargando perfil…</p>
          ) : tab === 'personal' ? (
            <div className="space-y-5">
              <section className="bg-cream rounded-2xl p-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Fotografía de Perfil</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Vista previa" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-extrabold text-lime-400">{p.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-lime-400 text-[11px] font-bold hover:bg-slate-800 disabled:opacity-40"
                    >
                      <i className="bi bi-camera" aria-hidden="true" /> {photoPreview ? 'Actualizar foto' : 'Cargar foto'}
                    </button>
                    {photoPreview && (
                      <button
                        onClick={removePhoto}
                        disabled={saving}
                        className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3">JPG, PNG o WEBP · máximo 2 MB.</p>
              </section>

              <form onSubmit={savePersonal} className="space-y-4">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Campos de Identificación</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre Completo" value={personal.name} onChange={(v) => setPersonal({ ...personal, name: v })} />
                    <Field
                      label="Documento de Identidad (Cédula / DNI)"
                      value={personal.identity_document}
                      onChange={(v) => setPersonal({ ...personal, identity_document: v })}
                      placeholder="CC 10.000.000"
                    />
                    <Field
                      label="ID / Código Interno de Empleado"
                      value={personal.employee_code}
                      onChange={(v) => setPersonal({ ...personal, employee_code: v })}
                      placeholder="EMP-2026-042"
                      hint={personal.employee_code ? undefined : 'Se genera automáticamente si lo dejas vacío'}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Contacto Directo</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Correo Electrónico Corporativo" type="email" value={personal.email} onChange={(v) => setPersonal({ ...personal, email: v })} />
                    <Field
                      label="Teléfono Celular / WhatsApp"
                      value={personal.phone}
                      onChange={(v) => setPersonal({ ...personal, phone: v })}
                      placeholder="+57 300 000 0000"
                      hint="Se usa para alertas de ruta"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || !personal.name || !personal.email}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-xs font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Guardando…' : <><i className="bi bi-floppy" aria-hidden="true" /> Guardar Información</>}
                </button>
              </form>
            </div>
          ) : tab === 'laboral' ? (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-2xl p-5">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-lime-400 mb-4">Rol Asignado</h3>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold truncate">{p.role_label}</p>
                    <p className="text-[10px] text-white/50 font-mono mt-0.5">{p.role}</p>
                  </div>
                  <span className="shrink-0 text-[9px] bg-lime-400 text-slate-900 px-2 py-1 rounded-lg font-bold uppercase">
                    Solo lectura
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {(p.role_permissions?.modules || []).map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-lg bg-white/10 text-white/70 text-[9px] font-mono">{m}</span>
                  ))}
                </div>
                <p className="text-[10px] text-white/40 mt-3 leading-snug">
                  <i className="bi bi-lock-fill" aria-hidden="true" /> El rol lo asigna el administrador en Gestión de Usuarios & Roles. No puede modificarse desde el perfil.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: 'buildings', label: 'Sede / Bodega', value: p.warehouse_site },
                  { icon: 'clock', label: 'Horario / Turno', value: p.shift_schedule },
                  { icon: 'person', label: 'Jefe Directo', value: p.supervisor_name },
                  { icon: 'upc-scan', label: 'Código de Empleado', value: p.employee_code },
                  { icon: 'envelope', label: 'Correo', value: p.email },
                  { icon: 'phone', label: 'Teléfono', value: p.phone },
                ].map((f) => (
                  <div key={f.label} className="bg-cream rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <i className={`bi bi-${f.icon} text-sm leading-none`} aria-hidden="true" />
                      <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-bold">{f.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 break-words">{f.value || '—'}</p>
                  </div>
                ))}
              </div>

              <div className="bg-cream rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Último acceso</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDateTime(p.last_login_at)}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold ${p.is_active ? 'bg-green-500/15 text-green-700' : 'bg-red-500/15 text-red-600'}`}>
                  <i className={`bi bi-${p.is_active ? 'check-circle-fill' : 'slash-circle-fill'}`} aria-hidden="true" />{' '}
                  {p.is_active ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
            </div>
          ) : tab === 'seguridad' ? (
            <div className="space-y-5">
              <form onSubmit={savePassword} className="bg-cream rounded-2xl p-4 space-y-3.5">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Cambio de Contraseña</h3>
                <Field label="Contraseña Actual" type="password" value={passwords.current_password} onChange={(v) => setPasswords({ ...passwords, current_password: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nueva Contraseña" type="password" value={passwords.password} onChange={(v) => setPasswords({ ...passwords, password: v })} />
                  <Field label="Confirmar Contraseña" type="password" value={passwords.password_confirmation} onChange={(v) => setPasswords({ ...passwords, password_confirmation: v })} />
                </div>
                <p className="text-[10px] text-slate-500">Mínimo 6 caracteres. Al cambiarla se cerrarán las demás sesiones.</p>
                <button
                  type="submit"
                  disabled={saving || !passwords.current_password || passwords.password.length < 6 || !passwords.password_confirmation}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-[11px] font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <i className="bi bi-key" aria-hidden="true" /> Actualizar Contraseña
                </button>
              </form>

              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Autenticación en Dos Pasos (2FA)</h3>
                <Switch
                  icon="shield-check"
                  checked={prefs.two_factor_enabled}
                  onChange={(v) => setPrefs({ ...prefs, two_factor_enabled: v })}
                  label="Verificación en dos pasos"
                  desc="Exige un código OTP de Google Authenticator al ingresar. Recomendado para rutas y cobros."
                />
                {prefs.two_factor_enabled && (
                  <div className="pl-1">
                    <select
                      value={prefs.two_factor_method}
                      onChange={(e) => setPrefs({ ...prefs, two_factor_method: e.target.value })}
                      className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-slate-900"
                    >
                      <option value="AUTHENTICATOR">Google Authenticator</option>
                      <option value="OTP">Código OTP por SMS</option>
                    </select>
                  </div>
                )}
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Los cambios de esta sección se aplican al pulsar «Guardar Preferencias».
                </p>
              </div>

              <div className="bg-cream rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Sesiones Activas</h3>
                  <span className="text-[10px] text-slate-500 font-bold">{sessions.length} abierta(s)</span>
                </div>

                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{s.device}</p>
                        <p className="text-[10px] text-slate-500">
                          {s.is_current ? (
                            <>
                              <i className="bi bi-check-circle-fill text-lime-600" aria-hidden="true" /> Esta sesión
                            </>
                          ) : (
                            `Último uso: ${formatDateTime(s.last_used_at)}`
                          )}
                        </p>
                      </div>
                      {s.is_current ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-lg bg-lime-400/30 text-[9px] font-bold text-[#3F5600] uppercase">Actual</span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-100 text-[9px] font-bold text-slate-500 uppercase">Activa</span>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="text-[11px] text-slate-400 text-center py-3">Sin sesiones registradas</p>}
                </div>

                <button
                  onClick={closeAllSessions}
                  disabled={saving || externalSessions.length === 0}
                  className="mt-3 w-full px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {externalSessions.length === 0
                    ? 'No hay sesiones externas'
                    : `Cerrar todas las sesiones externas (${externalSessions.length})`}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 block">Idioma del Sistema</label>
                  <select
                    value={prefs.locale}
                    onChange={(e) => setPrefs({ ...prefs, locale: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-slate-900"
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 block">Tema Visual</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: 'light', label: 'Modo Claro', icon: 'sun' },
                      { v: 'dark', label: 'Modo Oscuro', icon: 'moon-stars' },
                    ].map((t) => (
                      <button
                        key={t.v}
                        onClick={() => setPrefs({ ...prefs, theme: t.v })}
                        className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                          prefs.theme === t.v
                            ? 'bg-slate-900 text-lime-400 border-slate-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <i className={`bi bi-${t.icon} mr-1.5`} aria-hidden="true" />{t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Configuración de Notificaciones</h3>
                <div className="space-y-2">
                  <Switch icon="envelope" checked={prefs.notify_email} onChange={(v) => setPrefs({ ...prefs, notify_email: v })}
                    label="Alertas por Correo Electrónico" desc="Resumen diario de pedidos e incidencias." />
                  <Switch icon="bell" checked={prefs.notify_push} onChange={(v) => setPrefs({ ...prefs, notify_push: v })}
                    label="Notificaciones Push en Celular" desc="Avisos instantáneos en el dispositivo móvil." />
                  <Switch icon="volume-up" checked={prefs.notify_sound} onChange={(v) => setPrefs({ ...prefs, notify_sound: v })}
                    label="Alertas de Sonido" desc="Nuevo pedido o incidencia en ruta." />
                </div>
              </div>

              <button
                onClick={savePrefs}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-lime-400 text-xs font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Guardando…' : <><i className="bi bi-floppy" aria-hidden="true" /> Guardar Preferencias</>}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 md:p-5 border-t border-slate-100 shrink-0">
          <span className="text-[10px] text-slate-400 hidden sm:block">
            Sesión autenticada por Laravel Sanctum
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={logout}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              <i className="bi bi-power" aria-hidden="true" /> CERRAR SESIÓN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}