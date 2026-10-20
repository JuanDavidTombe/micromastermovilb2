import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { delivery, orders as ordersApi } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import RouteFormModal from '../components/RouteFormModal';
import IncidentsPanel from '../components/IncidentsPanel';
import { hasModuleAccess, can } from '../constants/roles';

const POLL_MS = 5000;

const VIEW_META = {
  cobro: { title: 'Cobros, Caja & OTP', desc: 'Verificación de cobros, registro de pagos y arqueo diario', badge: 'COBRO OTP · CAJA', color: 'lime' },
  incidencias: { title: 'Novedades e Incidencias', desc: 'Alertas de conductores en ruta', badge: 'INCIDENCIAS DE CAMPO', color: 'terracotta' },
};

export default function MicroDelivery({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'orders_delivery');
  const isManager = role === 'ADMINISTRADOR' || role === 'OPERARIO_LOGISTICO';
  const canCreate = can(role, 'create') && canAccess;
  const canUpdate = can(role, 'update') && canAccess;
  const canBypass = role === 'ADMINISTRADOR' || role === 'OPERARIO_LOGISTICO' || role === 'SUPERVISOR_PRODUCCION';

  const location = useLocation();
  const view = location.pathname.endsWith('/incidencias') ? 'incidencias' : 'cobro';
  const meta = VIEW_META[view];

  const [routes, setRoutes] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incSummary, setIncSummary] = useState(null);
  const [cobroOrders, setCobroOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [toast, setToast] = useState('');

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpResult, setOtpResult] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentMode, setPaymentMode] = useState('normal');
  const [contingencyReason, setContingencyReason] = useState('');

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const refreshRoutes = useCallback(() => {
    return delivery
      .getRoutes()
      .then((res) => {
        setRoutes(res.data.routes || []);
        setRouteSummary(res.data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshIncidents = useCallback(() => {
    return delivery
      .getIncidents()
      .then((res) => {
        setIncidents(res.data.incidents || []);
        setIncSummary(res.data.summary || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAccess) return undefined;
    refreshRoutes();
    refreshIncidents();
    delivery.getOrders().then((res) => setCobroOrders(res.data.orders || [])).catch(() => {});
    if (isManager) {
      delivery.getDrivers().then((res) => setDrivers(res.data.drivers || [])).catch(() => {});
      ordersApi.list({ status: 'pending' }).then((res) => setPendingOrders(res.data.orders || [])).catch(() => {});
    }
    const id = setInterval(() => {
      refreshRoutes();
      refreshIncidents();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [canAccess, isManager, refreshRoutes, refreshIncidents]);

  const handleCreateRoute = async (data) => {
    setCreatingRoute(true);
    try {
      const res = await delivery.createRoute(data);
      flash(res.data?.message || 'Ruta creada');
      await refreshRoutes();
      await Promise.all([
        ordersApi.list({ status: 'pending' }).then((r) => setPendingOrders(r.data.orders || [])).catch(() => {}),
        delivery.getOrders().then((r) => setCobroOrders(r.data.orders || [])).catch(() => {}),
      ]);
    } finally {
      setCreatingRoute(false);
    }
  };

  const handleIncidentReport = async (data) => {
    const res = await delivery.createIncident(data);
    flash(res.data?.message || 'Novedad reportada');
    await refreshIncidents();
    await refreshRoutes();
  };

  const handleIncidentUpdate = async (id, data) => {
    try {
      const res = await delivery.updateIncident(id, data);
      flash(res.data?.message || 'Novedad actualizada');
      await refreshIncidents();
      await refreshRoutes();
      if (isManager) {
        delivery.getDrivers().then((r) => setDrivers(r.data.drivers || [])).catch(() => {});
      }
    } catch (e) {
      flash(e?.response?.data?.message || 'No se pudo actualizar la novedad');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const res = await delivery.verifyOtp(otpCode);
      setOtpResult(res.data);
    } catch (e) {
      setOtpResult({ valid: false });
    }
  };

  const handleCompletePayment = async () => {
    if (!otpResult?.valid) return;
    try {
      await delivery.completePayment({ order_id: otpResult.order.id, otp_code: otpCode });
      setShowOtpModal(false);
      setOtpCode('');
      setOtpResult(null);
      delivery.getOrders().then((res) => setCobroOrders(res.data.orders || [])).catch(() => {});
    } catch (e) {
      setOtpResult({ valid: false });
    }
  };

  const openPayment = (order, mode) => {
    setSelectedOrder(order);
    setPaymentAmount(order?.amount != null ? String(order.amount) : '');
    setPaymentMethod('cash');
    setPaymentMode(mode);
    setContingencyReason('');
    setShowPaymentModal(true);
  };

  const handleUpdatePayment = async (method) => {
    if (!selectedOrder || !canUpdate) return;
    if (paymentMode === 'contingency' && !contingencyReason.trim()) {
      flash('Ingresa el motivo de contingencia');
      return;
    }
    if (method) setPaymentMethod(method);
    try {
      const res = await delivery.updatePayment({
        order_id: selectedOrder.id,
        payment_method: method || paymentMethod,
        received_amount: parseFloat(paymentAmount) || selectedOrder.amount,
        contingency: paymentMode === 'contingency',
        contingency_reason: paymentMode === 'contingency' ? contingencyReason.trim() : null,
      });
      const updated = res.data?.order;
      setCobroOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, ...(updated || {}) } : o)));
      flash(paymentMode === 'contingency' ? 'Pago registrado por contingencia' : 'Pago registrado correctamente');
      setShowPaymentModal(false);
      setSelectedOrder(null);
      setContingencyReason('');
      setPaymentMode('normal');
    } catch (e) {
      flash(e.response?.data?.message || 'Error al registrar pago');
    }
  };

  const incidentOrderIds = useMemo(() => {
    const ids = [];
    incidents.filter((i) => i.status === 'OPEN').forEach((i) => i.order_id && ids.push(i.order_id));
    return ids;
  }, [incidents]);

  const reportableOrders = useMemo(() => {
    const seen = new Set();
    const acc = [];
    routes.forEach((r) => (r.stops || []).forEach((s) => {
      if (s.order_id == null || seen.has(s.order_id)) return;
      seen.add(s.order_id);
      acc.push({ id: s.order_id, client_name: s.client_name, destination: s.destination, amount: s.amount });
    }));
    return acc;
  }, [routes]);

  const cajaSummary = useMemo(() => {
    const collected = cobroOrders
      .filter((o) => o.payment_status === 'completed')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    const pending = cobroOrders
      .filter((o) => o.payment_status === 'pending')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    const confirmed = cobroOrders
      .filter((o) => o.payment_status === 'confirmed')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    return { collected, pending, confirmed, total: cobroOrders.length };
  }, [cobroOrders]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <i className="bi bi-lock-fill text-6xl mb-4" aria-hidden="true" />
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Logística</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const handleIncidentReportWrapped = async (data) => {
    try {
      await handleIncidentReport(data);
    } catch (e) {
      flash(e?.response?.data?.message || 'No se pudo reportar la novedad');
    }
  };

  if (view === 'incidencias') {
    return (
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{meta.title}</h1>
            <p className="text-sm text-slate-500">{meta.desc}</p>
          </div>
          <TechBadge label={meta.badge} color={meta.color} />
        </div>

        {toast && (
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FreshCard title="Novedades abiertas" value={incSummary?.open ?? 0} subtitle="Requieren gestión" icon="exclamation-octagon" color="terracotta" />
          <FreshCard title="Resueltas" value={incSummary?.resolved ?? 0} subtitle="Hoy" icon="check-circle-fill" color="lime" />
          <FreshCard title="Rutas con incidencia" value={routes.filter((r) => (r.open_incidents || 0) > 0).length} subtitle="En operación" icon="signpost-2" color="slate" />
        </div>

        <IncidentsPanel
          incidents={incidents}
          summary={incSummary}
          canManage={isManager}
          drivers={drivers}
          routes={routes}
          reportableOrders={reportableOrders}
          onReport={handleIncidentReportWrapped}
          onUpdate={handleIncidentUpdate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-sm text-slate-500">{meta.desc}</p>
        </div>
        <TechBadge label={meta.badge} color={meta.color} />
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Cobrado Hoy" value={`$${cajaSummary.collected.toLocaleString()}`} subtitle="Completados" icon="cash-coin" color="lime" />
        <FreshCard title="Pendiente" value={`$${cajaSummary.pending.toLocaleString()}`} subtitle="Sin cobrar" icon="hourglass-split" color="terracotta" />
        <FreshCard title="Confirmado" value={`$${cajaSummary.confirmed.toLocaleString()}`} subtitle="Por completar" icon="check-circle-fill" color="cream" />
        <FreshCard title="Total Pedidos" value={cajaSummary.total} subtitle="En caja" icon="box-seam" color="lime" />
      </div>

      <div className="bg-slate-900 rounded-3xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-white/10">
          <span className="text-sm uppercase tracking-[0.2em] text-lime-400 font-semibold">
            <i className="bi bi-phone" aria-hidden="true" /> Cobro OTP y registro de pagos
          </span>
        </div>

        <div className="px-4 md:px-6 py-4 md:py-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-white/70 mb-3">Verificación de Código OTP</h3>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }}
                  placeholder="Ingrese código OTP"
                  maxLength={4}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-lg font-mono focus:ring-2 focus:ring-lime-400 outline-none"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={!canCreate}
                  className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                >
                  Verificar
                </button>
                {canBypass && (
                  <button
                    onClick={() => openPayment(null, 'contingency')}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all"
                  >
                    <i className="bi bi-shield-exclamation" aria-hidden="true" /> Bypass / Pago Manual
                  </button>
                )}
              </div>
              {otpResult && (
                <div className={`mt-3 p-4 rounded-xl ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                  <p className={`font-bold ${otpResult.valid ? 'text-lime-400' : 'text-red-400'}`}>
                    {otpResult.valid ? (
                      <><i className="bi bi-check-circle-fill" aria-hidden="true" /> Pedido #{otpResult.order?.id} — ${otpResult.order?.amount}</>
                    ) : (
                      <><i className="bi bi-x-lg" aria-hidden="true" /> Código OTP no válido</>
                    )}
                  </p>
                  {otpResult.valid && <p className="text-xs text-white/70 mt-1">Destino: {otpResult.order?.destination}</p>}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-white/70 mb-3">Registro de Cobro</h3>
              {selectedOrder ? (
                <div className="space-y-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-xs text-white/70">Pedido #{selectedOrder.id}</p>
                    <p className="text-lg font-bold">${selectedOrder.amount}</p>
                    <p className="text-xs text-white/70">{selectedOrder.destination}</p>
                  </div>
                  <div className="flex gap-2">
                    {canUpdate && (
                      <button onClick={() => handleUpdatePayment('cash')} className="flex-1 bg-lime-400 hover:bg-lime-500 text-slate-900 py-2 rounded-xl text-xs font-bold transition-all">
                        <i className="bi bi-cash-coin" aria-hidden="true" /> Efectivo
                      </button>
                    )}
                    {canUpdate && (
                      <button onClick={() => handleUpdatePayment('qr')} className="flex-1 bg-terracotta-400 hover:bg-terracotta-500 text-white py-2 rounded-xl text-xs font-bold transition-all">
                        <i className="bi bi-phone" aria-hidden="true" /> QR
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/50">Selecciona un pedido pendiente de cobro.</p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cobroOrders.map((order) => (
              <div key={order.id} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] text-white/50">#{order.id}</span>
                  <StatusBadge status={order.payment_status} />
                </div>
                <p className="text-xs font-medium text-white truncate">{order.destination}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-white/50">
                    {order.payment_method === 'cash' ? 'Efectivo' : order.payment_method === 'qr' ? 'QR' : '—'}
                  </span>
                  <span className="text-sm font-bold text-lime-400">${order.amount}</span>
                </div>
                {order.contingency_reason && (
                  <p className="mt-1.5 text-[10px] text-terracotta-300">
                    <i className="bi bi-shield-exclamation" aria-hidden="true" /> {order.contingency_reason}
                  </p>
                )}
                {order.payment_status === 'pending' && canUpdate && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => openPayment(order, 'normal')}
                      className="flex-1 bg-lime-400 hover:bg-lime-500 text-slate-900 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                    >
                      Registrar Pago
                    </button>
                    {canBypass && (
                      <button
                        onClick={() => openPayment(order, 'contingency')}
                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all"
                        title="Bypass / Pago Manual"
                      >
                        <i className="bi bi-shield-exclamation" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
                {order.payment_status === 'confirmed' && canCreate && (
                  <button
                    onClick={() => { setSelectedOrder(order); setShowOtpModal(true); }}
                    className="mt-2 w-full bg-terracotta-400 hover:bg-terracotta-500 text-white py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  >
                    Verificar OTP y Completar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <RouteFormModal
        isOpen={showRouteForm}
        onClose={() => setShowRouteForm(false)}
        orders={pendingOrders}
        drivers={drivers}
        onSubmit={handleCreateRoute}
        creating={creatingRoute}
      />

      <Modal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setSelectedOrder(null); setContingencyReason(''); setPaymentMode('normal'); }}
        title={paymentMode === 'contingency' ? 'Bypass / Pago Manual' : 'Registrar Pago'}
        footer={
          <>
            <button onClick={() => { setShowPaymentModal(false); setSelectedOrder(null); setContingencyReason(''); setPaymentMode('normal'); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleUpdatePayment} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Confirmar Pago</button>
          </>
        }
      >
        <div className="space-y-4">
          {!selectedOrder && (
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Pedido a Cobrar</label>
              <select
                value={selectedOrder?.id || ''}
                onChange={(e) => {
                  const o = cobroOrders.find((x) => x.id === parseInt(e.target.value, 10));
                  setSelectedOrder(o || null);
                  setPaymentAmount(o?.amount != null ? String(o.amount) : '');
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none"
              >
                <option value="">Seleccionar pedido…</option>
                {cobroOrders.map((o) => (
                  <option key={o.id} value={o.id}>#{o.id} · {o.destination} · ${o.amount}</option>
                ))}
              </select>
            </div>
          )}
          {selectedOrder && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Pedido #{selectedOrder.id}</p>
              <p className="text-lg font-bold text-slate-900">${selectedOrder.amount}</p>
              <p className="text-xs text-slate-500">{selectedOrder.destination}</p>
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Método de Pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
              <option value="cash">Efectivo</option>
              <option value="qr">QR</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Monto Recibido</label>
            <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          {selectedOrder && (
            <div className="bg-cream rounded-xl p-3">
              <p className="text-xs text-slate-500">Cambio:</p>
              <p className="text-lg font-bold text-[#4F6B00]">${((parseFloat(paymentAmount) || 0) - selectedOrder?.amount).toFixed(2)}</p>
            </div>
          )}
          {paymentMode === 'contingency' && (
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Motivo de Contingencia (Obligatorio)</label>
              <textarea
                value={contingencyReason}
                onChange={(e) => setContingencyReason(e.target.value)}
                placeholder="Ej: Cliente sin señal celular, pago verificado en físico"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none resize-none"
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showOtpModal}
        onClose={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }}
        title={<><i className="bi bi-shield-lock" aria-hidden="true" /> Verificación OTP</>}
        footer={
          <>
            <button onClick={() => { setShowOtpModal(false); setOtpCode(''); setOtpResult(null); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            {otpResult?.valid ? (
              <button onClick={handleCompletePayment} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Completar Pago</button>
            ) : (
              <button onClick={handleVerifyOtp} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">Verificar</button>
            )}
          </>
        }
      >
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500">Ingrese el código OTP del pedido para verificar el cobro</p>
          <input type="text" value={otpCode} onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }} maxLength={4} placeholder="----" className="w-32 mx-auto px-4 py-4 text-2xl font-mono text-center rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none tracking-[0.5em]" />
          {otpResult && (
            <div className={`p-4 rounded-xl text-left ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <p className={`font-bold text-sm ${otpResult.valid ? 'text-[#3F5600]' : 'text-red-600'}`}>
                {otpResult.valid ? (
                  <><i className="bi bi-check-circle-fill" aria-hidden="true" /> Pedido #{otpResult.order?.id} — ${otpResult.order?.amount}</>
                ) : (
                  <><i className="bi bi-x-lg" aria-hidden="true" /> Código OTP no válido</>
                )}
              </p>
              {otpResult.valid && <p className="text-xs text-slate-500 mt-1">Destino: {otpResult.order?.destination}</p>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
