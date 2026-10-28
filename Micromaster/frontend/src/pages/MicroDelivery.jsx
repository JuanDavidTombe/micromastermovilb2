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

  // Arqueo de caja físico y colapso de OTP
  const [showOtpSection, setShowOtpSection] = useState(false);
  const [bills50k, setBills50k] = useState('');
  const [bills20k, setBills20k] = useState('');
  const [coinsVal, setCoinsVal] = useState('');

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

  const subtotal50k = (parseInt(bills50k, 10) || 0) * 50000;
  const subtotal20k = (parseInt(bills20k, 10) || 0) * 20000;
  const subtotalCoins = parseFloat(coinsVal) || 0;
  const totalPhysicalCash = subtotal50k + subtotal20k + subtotalCoins;
  const collectedToday = Number(cajaSummary.collected || 0);
  const cashDifference = totalPhysicalCash - collectedToday;
  const hasCashInputs = bills50k !== '' || bills20k !== '' || coinsVal !== '';

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{meta.title}</h1>
            <p className="text-xs sm:text-sm text-slate-500">{meta.desc}</p>
          </div>
          <div className="self-start sm:self-auto shrink-0">
            <TechBadge label={meta.badge} color={meta.color} />
          </div>
        </div>

        {toast && (
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-xs sm:text-sm text-slate-500">{meta.desc}</p>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          <TechBadge label={meta.badge} color={meta.color} />
        </div>
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-lime-400 text-xs font-bold shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
        <FreshCard title="Cobrado Hoy" value={`$${cajaSummary.collected.toLocaleString()}`} subtitle="Completados" icon="cash-coin" color="lime" />
        <FreshCard title="Pendiente" value={`$${cajaSummary.pending.toLocaleString()}`} subtitle="Sin cobrar" icon="hourglass-split" color="terracotta" />
        <FreshCard title="Confirmado" value={`$${cajaSummary.confirmed.toLocaleString()}`} subtitle="Por completar" icon="check-circle-fill" color="cream" />
        <FreshCard title="Total Pedidos" value={cajaSummary.total} subtitle="En caja" icon="box-seam" color="lime" />
      </div>

      {/* MÓDULO PRINCIPAL: ARQUEO DE CAJA FÍSICO Y BYPASS / PAGO MANUAL */}
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-white/5">
            <div className="px-4 md:px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping" />
                <span className="text-sm uppercase tracking-[0.2em] text-lime-400 font-bold flex items-center gap-2">
                  <i className="bi bi-cash-stack" aria-hidden="true" /> Arqueo de Caja Físico & Pago Manual (Bypass)
                </span>
              </div>
              {canBypass && (
                <button
                  onClick={() => openPayment(null, 'contingency')}
                  className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
                >
                  <i className="bi bi-shield-check text-sm" aria-hidden="true" /> Registrar Pago Manual (Bypass)
                </button>
              )}
            </div>

            <div className="p-4 md:p-6 text-white space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Tabla de Arqueo Físico de Billetes */}
                <div className="lg:col-span-7 bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-lime-400 font-bold flex items-center gap-1.5">
                      <i className="bi bi-table" aria-hidden="true" /> Mesa de Conteo de Efectivo
                    </h3>
                    <span className="text-[11px] text-white/50">Digita lo recibido por el conductor</span>
                  </div>

                  <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <table className="w-full text-left text-xs min-w-[320px] sm:min-w-full">
                      <thead>
                        <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                          <th className="pb-2 font-semibold">Denominación</th>
                          <th className="pb-2 font-semibold text-center">Billetes</th>
                          <th className="pb-2 font-semibold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <tr>
                          <td className="py-2.5 font-medium flex items-center gap-1.5 sm:gap-2">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] sm:text-[11px] font-bold">$50.000</span>
                            <span className="text-[11px] sm:text-xs"><span className="hidden sm:inline">Billetes </span>$50.000</span>
                          </td>
                          <td className="py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={bills50k}
                              onChange={(e) => setBills50k(e.target.value)}
                              className="w-16 sm:w-24 px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-center font-mono text-white text-xs outline-none focus:ring-2 focus:ring-lime-400"
                            />
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-white/90">
                            ${subtotal50k.toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-medium flex items-center gap-1.5 sm:gap-2">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-[10px] sm:text-[11px] font-bold">$20.000</span>
                            <span className="text-[11px] sm:text-xs"><span className="hidden sm:inline">Billetes </span>$20.000</span>
                          </td>
                          <td className="py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={bills20k}
                              onChange={(e) => setBills20k(e.target.value)}
                              className="w-16 sm:w-24 px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-center font-mono text-white text-xs outline-none focus:ring-2 focus:ring-lime-400"
                            />
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-white/90">
                            ${subtotal20k.toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-medium flex items-center gap-1.5 sm:gap-2">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] sm:text-[11px] font-bold">Moneda</span>
                            <span className="text-[11px] sm:text-xs">Sencillo</span>
                          </td>
                          <td className="py-2.5 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Valor $"
                              value={coinsVal}
                              onChange={(e) => setCoinsVal(e.target.value)}
                              className="w-16 sm:w-24 px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-center font-mono text-white text-xs outline-none focus:ring-2 focus:ring-lime-400"
                            />
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-white/90">
                            ${subtotalCoins.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/20 font-bold">
                          <td colSpan={2} className="pt-3 text-white/70 uppercase tracking-wider text-[11px]">
                            Total Físico en Mesa:
                          </td>
                          <td className="pt-3 text-right font-mono text-sm text-lime-400">
                            ${totalPhysicalCash.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Cruce contra Cobrado Hoy y Descuadre en Tiempo Real */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider text-white/70 font-bold">
                      Cruce de Arqueo en Tiempo Real
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-white/70">
                        <span>Cobrado Hoy (Registrado):</span>
                        <span className="font-mono font-bold text-white">${collectedToday.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-white/70">
                        <span>Total Físico en Mesa:</span>
                        <span className="font-mono font-bold text-lime-400">${totalPhysicalCash.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Semáforo de Descuadre */}
                    <div className="pt-2">
                      {!hasCashInputs ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-[11px]">
                          Digita las denominaciones recibidas para calcular el arqueo.
                        </div>
                      ) : cashDifference === 0 ? (
                        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center gap-2">
                          <i className="bi bi-check-circle-fill text-emerald-400 text-base" aria-hidden="true" />
                          <div>
                            <p>¡Cuadre de Caja Exacto!</p>
                            <p className="text-[10px] text-emerald-400/80 font-normal">Diferencia $0.00 · Todo coincide</p>
                          </div>
                        </div>
                      ) : cashDifference < 0 ? (
                        <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-2">
                          <i className="bi bi-exclamation-octagon-fill text-red-400 text-base" aria-hidden="true" />
                          <div>
                            <p>Faltante en Caja: -${Math.abs(cashDifference).toLocaleString()}</p>
                            <p className="text-[10px] text-red-300/80 font-normal">El físico entregado es menor a lo cobrado.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center gap-2">
                          <i className="bi bi-info-circle-fill text-amber-400 text-base" aria-hidden="true" />
                          <div>
                            <p>Sobrante en Caja: +${cashDifference.toLocaleString()}</p>
                            <p className="text-[10px] text-amber-200/80 font-normal">El físico entregado supera lo registrado.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Registro si hay pedido seleccionado */}
                  {selectedOrder && (
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/70">Pedido #{selectedOrder.id}</span>
                        <span className="font-bold text-lime-400">${selectedOrder.amount}</span>
                      </div>
                      <p className="text-[11px] text-white/50 truncate">{selectedOrder.destination}</p>
                      <div className="flex gap-2 pt-1">
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
                  )}
                </div>
              </div>

              {/* SECCIÓN SECUNDARIA COLAPSADA: INGRESO DE OTP */}
              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowOtpSection((prev) => !prev)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold uppercase tracking-wider text-white transition-all"
                >
                  <span className="flex items-center gap-2 text-white/80">
                    <i className="bi bi-shield-lock text-sm text-lime-400" aria-hidden="true" />
                    Seguridad Avanzada: Verificación de Código OTP (Excepciones)
                  </span>
                  <span className="text-lime-400 text-[11px] font-bold">
                    {showOtpSection ? 'Colapsar ▲' : 'Desplegar ▼'}
                  </span>
                </button>

                {showOtpSection && (
                  <div className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 animate-fade-in space-y-3">
                    <p className="text-xs text-white/60">
                      Usa esta opción solo para pedidos que requieran validación criptográfica OTP por excepción de protocolo.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => { setOtpCode(e.target.value.toUpperCase()); setOtpResult(null); }}
                        placeholder="Código OTP (4 dígitos)"
                        maxLength={4}
                        className="w-48 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-center text-sm font-mono focus:ring-2 focus:ring-lime-400 outline-none tracking-widest"
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={!canCreate}
                        className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40"
                      >
                        Verificar OTP
                      </button>
                    </div>
                    {otpResult && (
                      <div className={`mt-2 p-3 rounded-xl text-xs ${otpResult.valid ? 'bg-lime-400/20 border border-lime-400/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                        <p className={`font-bold ${otpResult.valid ? 'text-lime-400' : 'text-red-400'}`}>
                          {otpResult.valid ? (
                            <><i className="bi bi-check-circle-fill" aria-hidden="true" /> Pedido #{otpResult.order?.id} — ${otpResult.order?.amount}</>
                          ) : (
                            <><i className="bi bi-x-lg" aria-hidden="true" /> Código OTP no válido</>
                          )}
                        </p>
                        {otpResult.valid && <p className="text-[11px] text-white/70 mt-1">Destino: {otpResult.order?.destination}</p>}
                      </div>
                    )}
                  </div>
                )}
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
