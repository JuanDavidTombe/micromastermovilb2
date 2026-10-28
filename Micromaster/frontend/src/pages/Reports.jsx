import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import DynamicTable from '../components/DynamicTable';
import ErrorBoundary from '../components/ErrorBoundary';
import { hasModuleAccess, can } from '../constants/roles';
import { reports } from '../services/api';
import { formatCOP, formatUnitCOP } from '../utils/currencyFormatter';

const VIEW_META = {
  resumen: {
    title: 'Inicio · Resumen Financiero Real',
    desc: 'Panel de control contable: cartera, inventario, COGS y mermas valorizadas',
    badge: 'BALANCE FINANCIERO',
    color: 'lime',
  },
  inventario: {
    title: 'Valoración de Inventario (Cierre Contable)',
    desc: 'Costeo general de insumos en bodega y congelación de saldos fiscales',
    badge: 'CIERRE FISCAL',
    color: 'lime',
  },
  pedidos: {
    title: 'Conciliación Bancaria y de Caja',
    desc: 'Cruce con extractos bancarios (Bancolombia, Davivienda) y comisiones de pasarela',
    badge: 'EXTRACTOS BANCARIOS',
    color: 'lime',
  },
  exportar: {
    title: 'Descarga de Informes (Excel Contable)',
    desc: 'Libro Mayor de Inventarios (Kardex), Ventas/Recaudos y Mermas DIAN filtrados',
    badge: 'REPORTES AUDITADOS',
    color: 'terracotta',
  },
  ventas: {
    title: 'Reportes de Ventas y Recaudos B2B',
    desc: 'Facturación bruta, cobranza efectiva y cartera comercial',
    badge: 'VENTAS B2B',
    color: 'lime',
  },
};

export default function Reports({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const location = useLocation();
  const rawView = location.pathname === '/reports' ? 'resumen' : location.pathname.split('/')[2] || 'resumen';
  const view = VIEW_META[rawView] ? rawView : 'resumen';

  const canAccess = hasModuleAccess(role, 'reports_simulations');
  const canDownload = can(role, 'download');

  // Estado general
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 1. KPIs Financieros
  const [financialKpis, setFinancialKpis] = useState(null);

  // 2. Valoración de Inventario & Cierres
  const [valuationData, setValuationData] = useState({ summary: {}, items: [], snapshots: [] });
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezePeriod, setFreezePeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [freezeNotes, setFreezeNotes] = useState('Cierre contable mensual y congelación de saldos para balance.');
  const [freezing, setFreezing] = useState(false);

  // 3. Conciliación Bancaria
  const [bankData, setBankData] = useState({ summary: {}, orders: [] });
  const [reconcilingId, setReconcilingId] = useState(null);
  const [reconcileEdits, setReconcileEdits] = useState({});

  // 4. Descarga de Informes Filtrados
  const [exportFilterMode, setExportFilterMode] = useState('month'); // 'month' | 'range'
  const [exportPeriod, setExportPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [exportFrom, setExportFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10));
  const [downloadingType, setDownloadingType] = useState('');

  // Carga inicial según la vista
  const loadData = async () => {
    if (!canAccess) return;
    setLoading(true);
    setError('');

    try {
      if (view === 'resumen') {
        const res = await reports.getFinancialKpis();
        setFinancialKpis(res.data.kpis);
      } else if (view === 'inventario') {
        const res = await reports.getInventoryValuation();
        setValuationData(res.data);
      } else if (view === 'pedidos') {
        const res = await reports.getBankReconciliation();
        setBankData(res.data);
        // Inicializar formulario editable de filas
        const initialEdits = {};
        (res.data.orders || []).forEach((o) => {
          initialEdits[o.id] = {
            bank_name: o.bank_name || 'Bancolombia',
            bank_reference: o.bank_reference || '',
            bank_fee: o.bank_fee || 0,
            is_bank_reconciled: Boolean(o.is_bank_reconciled),
          };
        });
        setReconcileEdits(initialEdits);
      } else if (view === 'ventas') {
        const res = await reports.orders();
        setBankData((prev) => ({ ...prev, legacyOrders: res.data.orders }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al conectar con el servidor contable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [view, canAccess]);

  // Acción: Congelar Inventario
  const handleFreezeInventory = async (e) => {
    e.preventDefault();
    setFreezing(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await reports.closeInventorySnapshot({
        period: freezePeriod,
        notes: freezeNotes,
      });
      setSuccessMessage(res.data.message || 'Inventario cerrado y congelado.');
      setFreezeModalOpen(false);
      // Recargar datos
      const refreshed = await reports.getInventoryValuation();
      setValuationData(refreshed.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al congelar el inventario contable.');
    } finally {
      setFreezing(false);
    }
  };

  // Acción: Conciliar Pedido / Asentar extracto
  const handleSaveReconciliation = async (orderId, newCheckedState = null) => {
    setReconcilingId(orderId);
    setError('');
    setSuccessMessage('');

    const currentEdit = reconcileEdits[orderId] || {};
    const payload = {
      ...currentEdit,
      is_bank_reconciled: newCheckedState !== null ? newCheckedState : currentEdit.is_bank_reconciled,
    };

    try {
      const res = await reports.reconcileOrder(orderId, payload);
      setSuccessMessage(res.data.message || 'Conciliación registrada.');
      // Actualizar estado local
      setBankData((prev) => {
        const updatedOrders = prev.orders.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              is_bank_reconciled: payload.is_bank_reconciled,
              bank_name: payload.bank_name,
              bank_reference: payload.bank_reference,
              bank_fee: Number(payload.bank_fee),
              net_amount: Math.max(0, o.amount - Number(payload.bank_fee)),
              reconciled_at: payload.is_bank_reconciled ? new Date().toISOString() : null,
              reconciled_by_name: payload.is_bank_reconciled ? (user?.name || 'Deiby Vitonco') : null,
            };
          }
          return o;
        });

        const reconciled = updatedOrders.filter((o) => o.is_bank_reconciled);
        const pending = updatedOrders.filter((o) => !o.is_bank_reconciled);

        return {
          ...prev,
          orders: updatedOrders,
          summary: {
            ...prev.summary,
            reconciled_count: reconciled.length,
            pending_count: pending.length,
            reconciled_amount: reconciled.reduce((acc, o) => acc + o.amount, 0),
            pending_amount: pending.reduce((acc, o) => acc + o.amount, 0),
            total_bank_fees: updatedOrders.reduce((acc, o) => acc + (o.bank_fee || 0), 0),
            total_net_received: reconciled.reduce((acc, o) => acc + o.net_amount, 0),
          },
        };
      });

      setReconcileEdits((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          is_bank_reconciled: payload.is_bank_reconciled,
        },
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar la conciliación bancaria.');
    } finally {
      setReconcilingId(null);
    }
  };

  // Acción: Descargar Informes Filtrados
  const handleFilteredDownload = async (reportType, customFilename) => {
    if (!canDownload) return;
    setDownloadingType(reportType);
    setError('');

    try {
      const params = { report_type: reportType };
      if (exportFilterMode === 'month') {
        params.period = exportPeriod;
      } else {
        params.from = exportFrom;
        params.to = exportTo;
      }

      const res = await reports.exportFiltered(params);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = customFilename || `micromaster_${reportType}_${exportFilterMode === 'month' ? exportPeriod : exportFrom + '_' + exportTo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('No fue posible generar el informe en Excel/CSV. Verifica las fechas.');
    } finally {
      setDownloadingType('');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-200">
          <div className="text-5xl text-red-500 mb-4"><i className="bi bi-shield-lock" aria-hidden="true" /></div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Exclusivo para Contabilidad</h2>
          <p className="text-sm text-slate-500 mt-2">Este módulo requiere credenciales del departamento contable o administración.</p>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[view];

  return (
    <ErrorBoundary onReload={loadData}>
      <div className="space-y-4 md:space-y-6 animate-fade-in pb-12">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">Departamento Contable · Deiby Vitonco</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{meta.title}</h1>
            <p className="text-xs sm:text-sm text-slate-500">{meta.desc}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              title="Refrescar datos contables"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
            <TechBadge label={meta.badge} color={meta.color} />
          </div>
        </div>

        {/* Notificaciones de éxito o error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="bi bi-exclamation-triangle-fill text-red-500 text-base" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-xs font-bold">Cerrar</button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-lime-50 border border-lime-300 rounded-2xl text-sm text-emerald-800 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <i className="bi bi-check-circle-fill text-lime-600 text-base" aria-hidden="true" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">Cerrar</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. TABLERO DE MANDO (RESUMEN FINANCIERO REAL)                             */}
        {/* ========================================================================= */}
        {view === 'resumen' && (
          <div className="space-y-6">
            {/* Las 4 Tarjetas KPI Financieras solicitadas por el usuario */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
              {/* KPI 1: Cuentas por Cobrar (Cartera) */}
              <div className="bg-white/90 rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-4 md:p-5 shadow-sm hover:border-lime-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Cartera Comercial</span>
                    <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm sm:text-lg">
                      <i className="bi bi-wallet2" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-900 font-mono tracking-tight truncate">
                    {formatCOP(financialKpis?.receivables?.total_amount || 0)}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-semibold text-blue-700 mt-1 truncate">
                    {financialKpis?.receivables?.invoices_count || 0} facturas (30 días)
                  </p>
                </div>
                <p className="text-[9px] sm:text-[11px] text-slate-400 mt-3 sm:mt-4 border-t border-slate-100 pt-1.5 sm:pt-2 truncate">
                  Pendiente de cobro B2B
                </p>
              </div>

              {/* KPI 2: Valor Total de Inventario */}
              <div className="bg-white/90 rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-4 md:p-5 shadow-sm hover:border-lime-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventario</span>
                    <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-lime-50 text-[#3F5600] flex items-center justify-center text-sm sm:text-lg">
                      <i className="bi bi-boxes" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-900 font-mono tracking-tight truncate">
                    {formatCOP(financialKpis?.inventory_valuation?.total_amount || 0)}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-semibold text-[#3F5600] mt-1 truncate">
                    Materias Primas + PT
                  </p>
                </div>
                <p className="text-[9px] sm:text-[11px] text-slate-400 mt-3 sm:mt-4 border-t border-slate-100 pt-1.5 sm:pt-2 truncate">
                  Activo congelado en bodega
                </p>
              </div>

              {/* KPI 3: Costo de Ventas (COGS) vs Ventas Brutas */}
              <div className="bg-white/90 rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-4 md:p-5 shadow-sm hover:border-lime-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Rentabilidad</span>
                    <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm sm:text-lg">
                      <i className="bi bi-graph-up-arrow" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-emerald-700 font-mono tracking-tight">
                      {financialKpis?.profitability?.margin_percentage || 0}%
                    </h3>
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Margen</span>
                  </div>
                  <p className="text-[10px] sm:text-xs font-medium text-slate-600 mt-1 truncate">
                    Ventas: <span className="font-semibold text-slate-900">{formatCOP(financialKpis?.profitability?.gross_sales || 0)}</span>
                  </p>
                </div>
                <p className="text-[9px] sm:text-[11px] text-slate-400 mt-3 sm:mt-4 border-t border-slate-100 pt-1.5 sm:pt-2 truncate">
                  COGS: {formatCOP(financialKpis?.profitability?.cogs || 0)}
                </p>
              </div>

              {/* KPI 4: Mermas Valorizadas del Mes */}
              <div className="bg-white/90 rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-4 md:p-5 shadow-sm hover:border-red-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Mermas Mes</span>
                    <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-sm sm:text-lg">
                      <i className="bi bi-trash3" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-red-600 font-mono tracking-tight truncate">
                    {formatCOP(financialKpis?.wastes_valuation?.total_amount || 0)}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-semibold text-red-700 mt-1 truncate">
                    {financialKpis?.wastes_valuation?.total_quantity || 0} kg/unid baja
                  </p>
                </div>
                <p className="text-[9px] sm:text-[11px] text-slate-400 mt-3 sm:mt-4 border-t border-slate-100 pt-1.5 sm:pt-2 truncate">
                  Deducible de renta (DIAN)
                </p>
              </div>
            </div>

            {/* Accesos rápidos de trabajo diario para Deiby */}
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
                Operaciones Contables & Auditoría del Mes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  to="/reports/inventario"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-lime-50/50 border border-slate-200 hover:border-lime-400 transition-all block"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-lime-400 text-slate-900 flex items-center justify-center font-bold text-sm">
                      <i className="bi bi-snow" aria-hidden="true" />
                    </span>
                    <h3 className="font-bold text-slate-900 group-hover:text-[#3F5600]">Cierre y Congelación</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Calcula el Costo Promedio Unitario (CPU) y congela la foto del inventario a fin de mes.
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#3F5600] mt-3">
                    Ir a Valoración <i className="bi bi-arrow-right" aria-hidden="true" />
                  </span>
                </Link>

                <Link
                  to="/reports/pedidos"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-400 transition-all block"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                      <i className="bi bi-bank" aria-hidden="true" />
                    </span>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-700">Conciliación Bancaria</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cruza transferencias de Bancolombia/Davivienda con pedidos completados y registra comisiones.
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 mt-3">
                    Ir a Conciliación <i className="bi bi-arrow-right" aria-hidden="true" />
                  </span>
                </Link>

                <Link
                  to="/reports/exportar"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-orange-400 transition-all block"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                      <i className="bi bi-file-earmark-excel" aria-hidden="true" />
                    </span>
                    <h3 className="font-bold text-slate-900 group-hover:text-orange-700">Descarga Filtrada (Excel)</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Descarga Libro Mayor (Kardex), Ventas y Mermas por mes contable con formato UTF-8 para Excel.
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 mt-3">
                    Ir a Informes <i className="bi bi-arrow-right" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. REDISEÑO DE "VALORACIÓN DE INVENTARIO" (EL CIERRE CONTABLE)             */}
        {/* ========================================================================= */}
        {view === 'inventario' && (
          <div className="space-y-6">
            {/* Barra de Acciones y Resumen Superior */}
            <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Activo Bodega</span>
                <div className="flex items-baseline gap-3 mt-1">
                  <h2 className="text-3xl font-extrabold text-slate-900 font-mono">
                    {formatCOP(valuationData.summary?.total_valuation || 0)}
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    ({valuationData.items?.length || 0} insumos costeados)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Valuación basada en Costo Promedio Unitario (CPU) según últimas recepciones de compras.
                </p>
              </div>

              {/* Gran Botón Solicitado: [ Cerrar Mes y Congelar Inventario ] */}
              <button
                type="button"
                onClick={() => setFreezeModalOpen(true)}
                className="w-full md:w-auto px-6 py-3.5 bg-lime-400 hover:bg-lime-500 text-slate-900 rounded-2xl font-extrabold text-sm shadow-lg shadow-lime-400/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <i className="bi bi-snow text-lg" aria-hidden="true" />
                <span>Cerrar Mes y Congelar Inventario</span>
              </button>
            </div>

            {/* Cuadrícula Financiera Obligatoria */}
            <div className="bg-white/90 rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Cuadrícula Financiera de Costeo de Insumos
                </h3>
                <span className="text-xs text-slate-400">Valores expresados en COP</span>
              </div>

              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-left border-collapse min-w-[560px] sm:min-w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-3.5">Insumo</th>
                      <th className="px-6 py-3.5 text-right">Stock Físico Actual</th>
                      <th className="px-6 py-3.5 text-right">Costo Promedio Unitario (CPU)</th>
                      <th className="px-6 py-3.5 text-right">Costo Total (Valorización)</th>
                      <th className="px-6 py-3.5 text-right">% Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {(valuationData.items || []).map((item) => (
                      <tr key={item.id} className="hover:bg-lime-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <span className="block text-[11px] text-slate-400">Unidad: {item.unit}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-slate-800">
                          {Number(item.stock).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unit}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-700">
                          {formatCOP(item.unit_cost)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {formatCOP(item.total_cost)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-700">{item.share_percentage}%</span>
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-lime-500 rounded-full"
                                style={{ width: `${Math.min(100, item.share_percentage * 2)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {(!valuationData.items || valuationData.items.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                          No hay insumos registrados en inventario.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                      <td className="px-6 py-4 uppercase text-xs tracking-wider">Total General de Bodega:</td>
                      <td className="px-6 py-4 text-right font-mono">
                        {Number(valuationData.summary?.total_stock || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} unid/kg
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400">—</td>
                      <td className="px-6 py-4 text-right font-mono text-base text-emerald-800">
                        {formatCOP(valuationData.summary?.total_valuation || 0)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Historial de Cierres Contables Congelados (Inmutables) */}
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <i className="bi bi-lock-fill text-slate-500" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Historial de Cierres Contables Congelados (Inmutables)
                </h3>
              </div>

              {(valuationData.snapshots || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Aún no se han ejecutado cierres contables mensuales congelados. Pulsa [ Cerrar Mes y Congelar Inventario ] para asentar el primer cierre.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {valuationData.snapshots.map((snap) => (
                    <div key={snap.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">Periodo {snap.period}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                            Congelado
                          </span>
                        </div>
                        <p className="text-lg font-extrabold text-slate-900 font-mono">{formatCOP(snap.total_valuation)}</p>
                        <p className="text-xs text-slate-500 mt-1">Stock total: {Number(snap.total_stock).toLocaleString()} unidades</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400">
                        <span>Cerrado por: <strong className="text-slate-600">{snap.closed_by}</strong></span>
                        <span className="block mt-0.5">{snap.created_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal para Cerrar Mes y Congelar Inventario */}
            {freezeModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-2xl bg-lime-400 text-slate-900 flex items-center justify-center text-xl font-bold">
                      <i className="bi bi-snow" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">Cierre Contable Mensual</h3>
                      <p className="text-xs text-slate-500">Congelación inmutable para balance fiscal</p>
                    </div>
                  </div>

                  <form onSubmit={handleFreezeInventory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Periodo Contable (Mes / Año)</label>
                      <input
                        type="month"
                        value={freezePeriod}
                        onChange={(e) => setFreezePeriod(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-lime-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notas Contables / Dictamen</label>
                      <textarea
                        value={freezeNotes}
                        onChange={(e) => setFreezeNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                        placeholder="Ej: Cierre de mes verificado contra conteo físico y compras de proveedores."
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <i className="bi bi-info-circle-fill mr-1" aria-hidden="true" />
                      Esta acción tomará una fotografía inamovible de los saldos valorizados de bodega ({formatCOP(valuationData.summary?.total_valuation || 0)}) para la DIAN y auditorías.
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setFreezeModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={freezing}
                        className="px-5 py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-900 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-2"
                      >
                        {freezing ? <><i className="bi bi-arrow-clockwise animate-spin" /> Congelando...</> : 'Confirmar Cierre y Congelar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CONCILIACIÓN BANCARIA Y DE CAJA                                        */}
        {/* ========================================================================= */}
        {view === 'pedidos' && (
          <div className="space-y-6">
            {/* Banner de Estado de Conciliación Bancaria */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
              <div className="bg-white/90 rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 tracking-wider">A Conciliar</span>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 font-mono mt-0.5 sm:mt-1 truncate">
                  {formatCOP(bankData.summary?.total_amount || 0)}
                </p>
                <span className="text-[10px] sm:text-[11px] text-slate-500 truncate block">{bankData.summary?.total_orders || 0} pedidos</span>
              </div>

              <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-3 sm:p-4 shadow-sm">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Confirmado</span>
                <p className="text-base sm:text-xl font-extrabold text-emerald-800 font-mono mt-0.5 sm:mt-1 truncate">
                  {formatCOP(bankData.summary?.reconciled_amount || 0)}
                </p>
                <span className="text-[10px] sm:text-[11px] text-emerald-700 font-medium truncate block">{bankData.summary?.reconciled_count || 0} cruzados</span>
              </div>

              <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-3 sm:p-4 shadow-sm">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-700 tracking-wider">Pendiente</span>
                <p className="text-base sm:text-xl font-extrabold text-amber-800 font-mono mt-0.5 sm:mt-1 truncate">
                  {formatCOP(bankData.summary?.pending_amount || 0)}
                </p>
                <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium truncate block">{bankData.summary?.pending_count || 0} por verificar</span>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">Comisiones</span>
                <p className="text-base sm:text-xl font-extrabold text-slate-700 font-mono mt-0.5 sm:mt-1 truncate">
                  {formatCOP(bankData.summary?.total_bank_fees || 0)}
                </p>
                <span className="text-[10px] sm:text-[11px] text-slate-500 truncate block">Deducidos</span>
              </div>
            </div>

            {/* Tabla de Conciliación con Extracto Bancario */}
            <div className="bg-white/90 rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Cruce de Transferencias vs Extractos Bancarios
                  </h3>
                  <p className="text-xs text-slate-400">
                    Marca [ Confirmado en Banco ] al cotejar con Bancolombia o Davivienda. El dinero conciliado queda inmovilizado.
                  </p>
                </div>
                <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-200">
                  {bankData.summary?.reconciled_count || 0} / {bankData.orders?.length || 0} Conciliados
                </span>
              </div>

              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-left border-collapse sm:min-w-full">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-2.5 sm:px-3 py-2.5">Pedido / Cliente</th>
                      <th className="px-2.5 sm:px-3 py-2.5 text-right">Monto Bruto</th>
                      <th className="px-2.5 sm:px-3 py-2.5">Entidad Bancaria</th>
                      <th className="px-2.5 sm:px-3 py-2.5">Ref. Transferencia</th>
                      <th className="px-2.5 sm:px-3 py-2.5 text-right">Descuento</th>
                      <th className="px-2.5 sm:px-3 py-2.5 text-right">Neto</th>
                      <th className="px-2.5 sm:px-3 py-2.5 text-center">Confirmado</th>
                      <th className="px-2.5 sm:px-3 py-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {(bankData.orders || []).map((o) => {
                      const edit = reconcileEdits[o.id] || {
                        bank_name: o.bank_name || 'Bancolombia',
                        bank_reference: o.bank_reference || '',
                        bank_fee: o.bank_fee || 0,
                        is_bank_reconciled: Boolean(o.is_bank_reconciled),
                      };

                      const isReconciled = edit.is_bank_reconciled;
                      const calculatedNet = Math.max(0, o.amount - Number(edit.bank_fee || 0));

                      return (
                        <tr
                          key={o.id}
                          className={`transition-colors ${
                            isReconciled ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Pedido / Cliente */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-500">#{o.id}</span>
                              <span className="font-semibold text-slate-900">{o.client_name}</span>
                            </div>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {o.created_at} · <span className="uppercase">{o.payment_method}</span>
                            </span>
                          </td>

                          {/* Monto Bruto */}
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                            {formatCOP(o.amount)}
                          </td>

                          {/* Banco / Pasarela */}
                          <td className="px-4 py-3.5">
                            <select
                              value={edit.bank_name}
                              disabled={isReconciled && !user?.is_admin}
                              onChange={(e) =>
                                setReconcileEdits((prev) => ({
                                  ...prev,
                                  [o.id]: { ...prev[o.id], bank_name: e.target.value },
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 disabled:bg-slate-100 disabled:text-slate-600"
                            >
                              <option value="Bancolombia">Bancolombia</option>
                              <option value="Davivienda">Davivienda</option>
                              <option value="Nequi">Nequi</option>
                              <option value="Daviplata">Daviplata</option>
                              <option value="BBVA">BBVA</option>
                              <option value="Caja Efectivo">Caja Efectivo</option>
                            </select>
                          </td>

                          {/* Referencia Comprobante */}
                          <td className="px-4 py-3.5">
                            <input
                              type="text"
                              placeholder="Ej: TR-89234"
                              value={edit.bank_reference}
                              disabled={isReconciled && !user?.is_admin}
                              onChange={(e) =>
                                setReconcileEdits((prev) => ({
                                  ...prev,
                                  [o.id]: { ...prev[o.id], bank_reference: e.target.value },
                                }))
                              }
                              className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </td>

                          {/* Descuento Bancario */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs text-slate-400">$</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={edit.bank_fee}
                                disabled={isReconciled && !user?.is_admin}
                                onChange={(e) =>
                                  setReconcileEdits((prev) => ({
                                    ...prev,
                                    [o.id]: { ...prev[o.id], bank_fee: e.target.value },
                                  }))
                                }
                                className="w-24 px-2 py-1.5 text-right rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-lime-400 disabled:bg-slate-100 disabled:text-slate-600"
                              />
                            </div>
                          </td>

                          {/* Neto Recaudado */}
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-800">
                            {formatCOP(calculatedNet)}
                          </td>

                          {/* Casilla [ Confirmado en Banco ] solicitada */}
                          <td className="px-4 py-3.5 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isReconciled}
                                onChange={(e) => handleSaveReconciliation(o.id, e.target.checked)}
                                disabled={reconcilingId === o.id}
                                className="w-5 h-5 rounded-md border-slate-300 text-emerald-600 focus:ring-lime-400 accent-emerald-600 transition-all cursor-pointer"
                              />
                              <span className={`text-xs font-bold ${isReconciled ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {isReconciled ? 'Confirmado' : 'Pendiente'}
                              </span>
                            </label>
                            {isReconciled && o.reconciled_by_name && (
                              <span className="block text-[10px] text-slate-400">
                                Por {o.reconciled_by_name}
                              </span>
                            )}
                          </td>

                          {/* Guardar / Estado */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleSaveReconciliation(o.id)}
                              disabled={reconcilingId === o.id}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                isReconciled
                                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  : 'bg-lime-400 hover:bg-lime-500 text-slate-900 shadow-sm'
                              }`}
                              title={isReconciled ? 'Dinero inmutable' : 'Guardar y asentar'}
                            >
                              {reconcilingId === o.id ? (
                                <i className="bi bi-arrow-clockwise animate-spin" />
                              ) : isReconciled ? (
                                <><i className="bi bi-lock-fill mr-1" /> Cruzado</>
                              ) : (
                                'Asentar'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {(!bankData.orders || bankData.orders.length === 0) && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-sm">
                          No hay pedidos para conciliar en este momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. DESCARGA DE INFORMES (EL EXCEL ES REY CON FILTRO OBLIGATORIO)           */}
        {/* ========================================================================= */}
        {view === 'exportar' && (
          <div className="max-w-4xl space-y-6">
            {/* Filtro Obligatorio de Fechas / Mes Contable */}
            <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <i className="bi bi-funnel-fill text-slate-500" aria-hidden="true" />
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Filtro Contable Obligatorio (Auditoría & Balances)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Para no saturar la base de datos ni generar inconsistencias contables, selecciona el mes o rango específico antes de exportar.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="radio"
                    name="filterMode"
                    value="month"
                    checked={exportFilterMode === 'month'}
                    onChange={() => setExportFilterMode('month')}
                    className="accent-lime-500"
                  />
                  Por Mes Contable
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="radio"
                    name="filterMode"
                    value="range"
                    checked={exportFilterMode === 'range'}
                    onChange={() => setExportFilterMode('range')}
                    className="accent-lime-500"
                  />
                  Por Rango de Fechas (Desde - Hasta)
                </label>
              </div>

              {exportFilterMode === 'month' ? (
                <div className="max-w-xs">
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Mes Contable:
                  </label>
                  <input
                    type="month"
                    value={exportPeriod}
                    onChange={(e) => setExportPeriod(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Desde:
                    </label>
                    <input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-lime-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Hasta:
                    </label>
                    <input
                      type="date"
                      value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-lime-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Las 3 Opciones de Descarga Esenciales en Excel/CSV */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
              {/* Reporte 1: Libro Mayor de Inventarios (Kardex) */}
              <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-lime-400 transition-all">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-lime-100 text-[#3F5600] flex items-center justify-center text-2xl mb-4 font-bold">
                    <i className="bi bi-journal-bookmark" aria-hidden="true" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Libro Mayor de Inventarios (Kardex)</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Entradas, salidas, mermas y saldos costeados en COP para control de existencias y balances.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFilteredDownload('kardex', `micromaster_kardex_${exportPeriod}.csv`)}
                    disabled={downloadingType === 'kardex' || !canDownload}
                    className="w-full py-3 px-4 bg-lime-400 hover:bg-lime-500 disabled:opacity-50 text-slate-900 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {downloadingType === 'kardex' ? (
                      <><i className="bi bi-arrow-clockwise animate-spin" /> Descargando...</>
                    ) : (
                      <><i className="bi bi-file-earmark-spreadsheet-fill text-sm" /> Descargar Excel / CSV</>
                    )}
                  </button>
                </div>
              </div>

              {/* Reporte 2: Reporte de Ventas y Recaudos */}
              <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-all">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl mb-4 font-bold">
                    <i className="bi bi-receipt" aria-hidden="true" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Ventas y Recaudos Bancarios</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Qué se facturó, qué se cobró en efectivo, transferencias y comisiones de pasarela bancaria.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFilteredDownload('sales_collections', `micromaster_ventas_recaudos_${exportPeriod}.csv`)}
                    disabled={downloadingType === 'sales_collections' || !canDownload}
                    className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {downloadingType === 'sales_collections' ? (
                      <><i className="bi bi-arrow-clockwise animate-spin" /> Descargando...</>
                    ) : (
                      <><i className="bi bi-file-earmark-spreadsheet-fill text-sm" /> Descargar Excel / CSV</>
                    )}
                  </button>
                </div>
              </div>

              {/* Reporte 3: Reporte de Mermas y Gastos */}
              <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-red-400 transition-all">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center text-2xl mb-4 font-bold">
                    <i className="bi bi-cash-stack" aria-hidden="true" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Mermas y Gastos (DIAN)</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Lista de desperdicios y bajas en planta valorizadas en COP para deducción fiscal de impuestos.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFilteredDownload('wastes', `micromaster_mermas_fiscal_${exportPeriod}.csv`)}
                    disabled={downloadingType === 'wastes' || !canDownload}
                    className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {downloadingType === 'wastes' ? (
                      <><i className="bi bi-arrow-clockwise animate-spin" /> Descargando...</>
                    ) : (
                      <><i className="bi bi-file-earmark-spreadsheet-fill text-sm" /> Descargar Excel / CSV</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Retrocompatibilidad / Ventas B2B view */}
        {view === 'ventas' && (
          <div className="bg-white/90 rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4">
              Historial de Facturación y Pedidos
            </h3>
            <DynamicTable
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'client_name', label: 'Cliente' },
                { key: 'amount', label: 'Monto' },
                { key: 'payment_status', label: 'Pago' },
                { key: 'status', label: 'Estado' },
                { key: 'created_at', label: 'Fecha' },
              ]}
              data={bankData.legacyOrders || []}
              renderRow={(row) => (
                <>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{row.id}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.client_name}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{formatCOP(row.amount)}</td>
                  <td className="px-4 py-3 text-xs">{row.payment_status}</td>
                  <td className="px-4 py-3 text-xs">{row.status}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{String(row.created_at).slice(0, 10)}</td>
                </>
              )}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
