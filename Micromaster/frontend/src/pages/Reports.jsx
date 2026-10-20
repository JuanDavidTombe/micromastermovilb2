import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import DynamicTable from '../components/DynamicTable';
import { hasModuleAccess, can } from '../constants/roles';
import { reports } from '../services/api';

const VIEW_META = {
  resumen: {
    title: 'Inicio · Resumen Financiero',
    desc: 'Ingresos, costos y estado general de reportes',
    badge: 'RESUMEN FINANCIERO',
    color: 'lime',
  },
  ventas: {
    title: 'Reportes de Ventas B2B',
    desc: 'Ingresos y cobros confirmados',
    badge: 'VENTAS B2B',
    color: 'lime',
  },
  pedidos: {
    title: 'Conciliación de Caja & OTP',
    desc: 'Verificación de dinero recaudado por pedidos',
    badge: 'CONCILIACIÓN DE CAJA',
    color: 'lime',
  },
  inventario: {
    title: 'Valoración de Inventario',
    desc: 'Costo total del stock en bodega',
    badge: 'VALORACIÓN DE INVENTARIO',
    color: 'lime',
  },
  exportar: {
    title: 'Descarga de Informes',
    desc: 'Exportador masivo en CSV',
    badge: 'EXPORTACIÓN CSV',
    color: 'terracotta',
  },
};

export default function Reports({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const location = useLocation();
  const view = location.pathname === '/reports' ? 'resumen' : location.pathname.split('/')[2] || 'resumen';

  const canAccess = hasModuleAccess(role, 'reports_simulations');
  const canDownload = can(role, 'download');

  const [costs, setCosts] = useState([]);
  const [stock, setStock] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    if (!canAccess) return;
    reports.costs().then((res) => setCosts(res.data.costs)).catch((e) => setError(e.response?.data?.message || ''));
    reports.stock().then((res) => setStock(res.data.stock)).catch(() => {});
    reports.orders().then((res) => setOrders(res.data.orders)).catch(() => {});
  }, [canAccess]);

  const handleDownload = async (type) => {
    if (!canDownload) return;
    setDownloading(type);
    setError('');
    try {
      const res = await reports.download(type);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `micromaster_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('No se pudo generar la descarga');
    } finally {
      setDownloading('');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4"><i className="bi bi-lock-fill" aria-hidden="true" /></div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Reportes & Simulaciones</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[view];
  const totalCost = costs.reduce((s, c) => s + Number(c.total_cost || 0), 0);
  const insufficient = costs.filter((c) => c.stock_status === 'insufficient').length;
  const totalStock = stock.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const pending = orders.filter((o) => o.payment_status === 'pending');
  const completed = orders.filter((o) => o.payment_status === 'completed');
  const revenue = completed.reduce((s, o) => s + Number(o.amount || 0), 0);

  const costColumns = [
    { key: 'name', label: 'Receta' },
    { key: 'waste_percentage', label: '% Merma' },
    { key: 'total_cost', label: 'Costo Total' },
    { key: 'ingredients_count', label: 'Insumos' },
    { key: 'stock_status', label: 'Estado Insumos' },
  ];

  const stockColumns = [
    { key: 'batch_code', label: 'Lote' },
    { key: 'ingredient', label: 'Insumo' },
    { key: 'supplier_name', label: 'Proveedor' },
    { key: 'quantity', label: 'Actual' },
    { key: 'initial_quantity', label: 'Inicial' },
    { key: 'expiration_date', label: 'Vencimiento' },
    { key: 'status', label: 'Estado' },
  ];

  const orderCols = [
    { key: 'id', label: '#' },
    { key: 'client_name', label: 'Cliente' },
    { key: 'amount', label: 'Monto' },
    { key: 'payment_status', label: 'Pago' },
    { key: 'status', label: 'Estado' },
    { key: 'created_at', label: 'Creado' },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-sm text-slate-500">{meta.desc}</p>
        </div>
        <TechBadge label={meta.badge} color={meta.color} />
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

      {(view === 'resumen' || view === 'ventas') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FreshCard title="Recetas" value={costs.length} subtitle={`${insufficient} con insumos insuficientes`} icon="clipboard" color="lime" />
          <FreshCard title="Costo Total Recetas" value={`$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} subtitle="Catálogo" icon="cash-coin" color="lime" />
          <FreshCard title="Stock Total" value={`${totalStock.toLocaleString()}`} subtitle={`${stock.length} lotes`} icon="box-seam" color="terracotta" />
          <FreshCard title="Ventas" value={`$${revenue.toLocaleString()}`} subtitle={`${pending.length} pendientes`} icon="bar-chart-fill" color="lime" />
        </div>
      )}

      {view === 'resumen' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Vista rápida de reportes</h2>
          <p className="text-sm text-slate-400">Usa las vistas específicas desde el menú para ver ventas, conciliación, valoración o exportación.</p>
        </div>
      )}

      {view === 'ventas' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Pedidos con datos de venta</h2>
          <DynamicTable columns={orderCols} data={completed} renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-mono text-slate-500">#{row.id}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.client_name}</td>
              <td className="px-4 py-3 text-sm text-slate-900">${Number(row.amount).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.payment_status}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.status}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{String(row.created_at).slice(0, 10)}</td>
            </>
          )} />
        </div>
      )}

      {view === 'pedidos' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Conciliación de Caja & OTP</h2>
          <DynamicTable columns={orderCols} data={orders} renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-mono text-slate-500">#{row.id}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.client_name}</td>
              <td className="px-4 py-3 text-sm text-slate-900">${Number(row.amount).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.payment_status}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.status}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{String(row.created_at).slice(0, 10)}</td>
            </>
          )} />
        </div>
      )}

      {view === 'inventario' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Valoración de Inventario</h2>
          <DynamicTable columns={stockColumns} data={stock} renderRow={(row) => (
            <>
              <td className="px-4 py-3 text-sm font-mono text-slate-900">{row.batch_code}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.ingredient}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.supplier_name || '—'}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-900">{Number(row.quantity).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{Number(row.initial_quantity).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.expiration_date}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  row.status === 'optimal' ? 'bg-lime-50 border-lime-300 text-[#3F5600]'
                    : row.status === 'warning' ? 'bg-orange-50 border-orange-300 text-[#A44B1F]'
                    : 'bg-red-50 border-red-300 text-[#A44B1F]'
                }`}>{row.status}</span>
              </td>
            </>
          )} />
        </div>
      )}

      {view === 'exportar' && (
        <div className="max-w-xl bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Descarga de Informes</h2>
          <div className="space-y-3">
            {[
              { type: 'stock', label: 'Inventario (CSV)' },
              { type: 'costs', label: 'Costos por receta (CSV)' },
              { type: 'orders', label: 'Pedidos (CSV)' },
            ].map((item) => (
              <button key={item.type} onClick={() => handleDownload(item.type)} disabled={!canDownload} className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all">
                {downloading === item.type ? 'Generando…' : <><i className="bi bi-download" aria-hidden="true" /> {item.label}</>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}