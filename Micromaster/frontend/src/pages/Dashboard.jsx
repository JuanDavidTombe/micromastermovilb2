import React, { useState, useEffect } from 'react';
import { dashboard } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import { hasModuleAccess } from '../constants/roles';
import { formatHumanDate } from '../utils/dateFormatter';

const TABS = [
  { id: 'resumen', label: 'Resumen General' },
  { id: 'inventario', label: 'Inventario & FEFO' },
  { id: 'logistica', label: 'Pedidos & Entregas' },
  { id: 'finanzas', label: 'Finanzas' },
];

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const role = user?.role || 'ADMINISTRADOR';

  useEffect(() => {
    dashboard.getKpis().then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-lime-400/30 border-t-lime-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const fefoMatrix = data?.fefo_matrix || [];
  const alerts = data?.alerts || {};
  const expiring = alerts.expiring_this_week || [];

  const criticalCount = kpis.critical_batches || 0;
  const warningCount = kpis.warning_batches || expiring.filter((b) => b.status === 'warning').length || 0;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inicio · Torre de Control</h1>
          <p className="text-sm text-slate-500">Bienvenido, {user?.name}</p>
        </div>
        <TechBadge label="SISTEMA OPERATIVO" color="lime" />
      </div>

      {(criticalCount > 0 || warningCount > 0 || expiring.length > 0) && (
        <div className="bg-slate-900 rounded-3xl border border-slate-900 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-[0.2em] text-lime-400">Alertas urgentes</h2>
            <span className="text-[11px] text-white/60">{criticalCount + warningCount} lotes requieren acción</span>
          </div>
          <div className="flex flex-col gap-3 md:gap-2">
            {expiring.slice(0, 5).map((batch) => (
              <div key={batch.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="min-w-0 md:flex-1">
                  <p className="text-sm font-mono font-semibold truncate">{batch.batch_code}</p>
                  <p className="text-[11px] text-white/60 truncate">
                    {batch.ingredient?.name || 'Insumo'} · Expira {formatHumanDate(batch.expiration_date)}
                  </p>
                </div>
                <span className={`w-full md:w-auto text-center whitespace-nowrap text-[11px] font-bold px-3 py-2 rounded-full border transition-colors ${batch.status === 'critical' ? 'bg-red-500/30 border-red-500/40 text-red-100' : 'bg-terracotta-400/20 border-terracotta-400/40 text-terracotta-100'}`}>
                  {batch.status === 'critical' ? 'CRÍTICO' : 'PRÓXIMO A VENCER'}
                </span>
              </div>
            ))}
            {expiring.length === 0 && (
              <p className="text-sm text-white/60">No hay alertas de expiración registradas.</p>
            )}
          </div>
        </div>
      )}

      <div className="no-scrollbar -mx-3 px-3 md:mx-0 md:px-0 flex flex-nowrap gap-2 items-center overflow-x-auto whitespace-nowrap">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === tab.id ? 'bg-lime-400 text-slate-900' : 'bg-white/60 text-slate-600 hover:bg-white/80'
          }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {hasModuleAccess(role, 'inventory_stock') && (activeTab === 'resumen' || activeTab === 'inventario') && (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <FreshCard title="Inventario Total" value={`${kpis.total_inventory_kg || 0} kg`} subtitle={`Valor: $${(kpis.total_inventory_value || 0).toLocaleString()}`} icon="box-seam" color="lime" />
          <FreshCard title="Lotes Óptimos" value={kpis.optimal_batches || 0} subtitle="Disponibles" icon="check-circle-fill" color="lime" />
          <FreshCard title="Alertas Críticas" value={kpis.critical_batches || 0} subtitle="Requieren atención" icon="exclamation-triangle" color="terracotta" />
          <FreshCard title="Órdenes Completadas" value={kpis.completed_orders || 0} subtitle={`Pendientes: ${kpis.pending_orders || 0}`} icon="truck" color="lime" />
        </div>
      )}

      {activeTab === 'inventario' && hasModuleAccess(role, 'inventory_stock') && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Matriz FEFO - Estado de Lotes</h2>
          <div className="space-y-3">
            {fefoMatrix.map((item) => (
              <div key={item.type} className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
                  <span className="text-sm font-medium text-slate-900">{item.type}</span>
                </div>
                <span className="text-2xl font-bold text-slate-900">{item.count}</span>
              </div>
            ))}
            {fefoMatrix.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos de matriz FEFO.</p>}
          </div>
        </div>
      )}

      {activeTab === 'logistica' && hasModuleAccess(role, 'orders_delivery') && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Resumen de Entregas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Entregas Completadas</span>
              <p className="text-2xl font-bold text-slate-900">{kpis.completed_orders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Pendientes de Pago</span>
              <p className="text-2xl font-bold text-slate-900">{kpis.pending_orders || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Órdenes en Tránsito</span>
              <p className="text-2xl font-bold text-slate-900">{kpis.in_transit_orders || 0}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'finanzas' && hasModuleAccess(role, 'reports_simulations') && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">KPIs Financieros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Ingresos Totales</span>
              <p className="text-2xl font-bold text-slate-900">${(kpis.total_revenue || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Cobrado</span>
              <p className="text-2xl font-bold text-[#4F6B00]">${(kpis.total_collected || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-cream">
              <span className="text-xs text-slate-500">Mermas</span>
              <p className="text-2xl font-bold text-[#C4622F]">{kpis.total_waste_kg || 0} kg</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}