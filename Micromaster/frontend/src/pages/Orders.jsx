import React, { useState, useEffect, useCallback } from 'react';
import { orders, delivery } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DynamicTable from '../components/DynamicTable';
import { hasModuleAccess, can } from '../constants/roles';

const EMPTY_FORM = {
  client_name: '',
  destination: '',
  amount: '',
  payment_method: 'cash',
  route_id: '',
};

export default function Orders({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const [orderList, setOrderList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const canAccess = hasModuleAccess(role, 'orders_delivery');
  const isManager = role === 'ADMINISTRADOR' || role === 'OPERARIO_LOGISTICO';
  const canCreate = can(role, 'create') && isManager;
  const canUpdate = can(role, 'update') && isManager;
  const canDelete = can(role, 'delete') && isManager;

  const fetchOrders = useCallback(() => {
    orders.list({
      status: filterStatus === 'all' ? undefined : filterStatus,
      search: search.trim() || undefined,
    }).then((res) => {
      setOrderList(res.data.orders);
      setSummary(res.data.summary);
    }).catch(() => {});
  }, [filterStatus, search]);

  useEffect(() => {
    if (!canAccess) return;
    fetchOrders();
    delivery.getRoutes().then((res) => setRoutes(res.data.routes)).catch(() => {});
  }, [canAccess, fetchOrders]);

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (order) => {
    setEditing(order);
    setFormData({
      client_name: order.client_name || '',
      destination: order.destination || '',
      amount: order.amount || '',
      payment_method: order.payment_method || 'cash',
      route_id: order.route_id || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!formData.client_name.trim()) { setFormError('Ingresa el nombre del cliente'); return; }
    if (!formData.destination.trim()) { setFormError('Ingresa el destino de entrega'); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { setFormError('Ingresa un monto válido mayor a 0'); return; }

    const payload = {
      client_name: formData.client_name.trim(),
      destination: formData.destination.trim(),
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method,
      route_id: formData.route_id ? parseInt(formData.route_id, 10) : null,
    };

    try {
      if (editing) {
        await orders.update(editing.id, payload);
      } else {
        await orders.create(payload);
      }
      setShowModal(false);
      setEditing(null);
      fetchOrders();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Error al guardar el pedido');
    }
  };

  const handleChangeStatus = async (order, status) => {
    try {
      await orders.update(order.id, { status });
      fetchOrders();
      setShowDetail(null);
    } catch (e) {
      alert(e.response?.data?.message || 'No se pudo cambiar el estado');
    }
  };

  const handleAssignRoute = async (order, routeId) => {
    try {
      await orders.update(order.id, { route_id: routeId ? parseInt(routeId, 10) : null });
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.message || 'No se pudo asignar la ruta');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await orders.remove(confirmDelete.id);
      setConfirmDelete(null);
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.message || 'No se pudo eliminar el pedido');
      setConfirmDelete(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4"><i className="bi bi-lock-fill" aria-hidden="true" /></div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Pedidos</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const columns = [
    { key: 'id', label: '#' },
    { key: 'client_name', label: 'Cliente' },
    { key: 'destination', label: 'Destino' },
    { key: 'amount', label: 'Monto' },
    { key: 'status', label: 'Estado' },
    { key: 'payment_status', label: 'Pago' },
    { key: 'route', label: 'Ruta' },
    { key: 'actions', label: 'Acciones' },
  ];

  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'assigned', label: 'Asignados' },
    { value: 'in_transit', label: 'En Tránsito' },
    { value: 'delivered', label: 'Entregados' },
    { value: 'cancelled', label: 'Cancelados' },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos & Entregas</h1>
          <p className="text-sm text-slate-500">Gestión de órdenes de clientes, rutas y cobro</p>
        </div>
          <div className="flex gap-3 items-center">
            <TechBadge label="GESTIÓN DE ÓRDENES" color="lime" />
            {canCreate && (
              <button onClick={openCreate} className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                + Nuevo Pedido
              </button>
            )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Total Pedidos" value={summary?.total || 0} subtitle="En sistema" icon="clipboard" color="lime" />
        <FreshCard title="Pendientes" value={summary?.pending || 0} subtitle="Sin ruta asignada" icon="clock" color="slate" />
        <FreshCard title="En Tránsito" value={summary?.in_transit || 0} subtitle="En camino" icon="truck" color="terracotta" />
        <FreshCard title="Monto Total" value={`$${(summary?.total_amount || 0).toLocaleString()}`} subtitle="Valor órdenes" icon="cash-coin" color="lime" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilterStatus(f.value)} className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            filterStatus === f.value ? 'bg-lime-400 text-slate-900' : 'bg-white/60 text-slate-600 hover:bg-white/80'
          }`}>
            {f.label}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o destino..."
          className="ml-auto px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm w-64 focus:ring-2 focus:ring-lime-400 outline-none"
        />
      </div>

      <DynamicTable columns={columns} data={orderList} renderRow={(order) => (
        <>
          <td className="px-4 py-3 text-sm font-mono text-slate-500">#{order.id}</td>
          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{order.client_name || '—'}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{order.destination}</td>
          <td className="px-4 py-3 text-sm font-bold text-slate-900">${Number(order.amount).toLocaleString()}</td>
          <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
          <td className="px-4 py-3"><StatusBadge status={order.payment_status} /></td>
          <td className="px-4 py-3 text-xs text-slate-600">
            {order.route ? (
              <span className="font-mono">{order.route.route_code}</span>
            ) : (
              <span className="text-slate-400">Sin ruta</span>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <button onClick={() => setShowDetail(order)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 transition-all">
                Ver
              </button>
              {canUpdate && (
                <button onClick={() => openEdit(order)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-lime-400/20 hover:bg-lime-400/30 text-[#3F5600] transition-all">
                  Editar
                </button>
              )}
              {canDelete && (
                <button onClick={() => setConfirmDelete(order)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-all">
                  Eliminar
                </button>
              )}
            </div>
          </td>
        </>
      )} />

      {orderList.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-4">No hay pedidos que coincidan con el filtro.</p>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Editar Pedido #${editing.id}` : 'Nuevo Pedido'}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm bg-lime-400 text-slate-900 font-bold hover:bg-lime-500">
              {editing ? 'Guardar Cambios' : 'Crear Pedido'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cliente</label>
            <input type="text" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="Ej: Almacenes Éxito S.A." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Destino de Entrega</label>
            <input type="text" value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} placeholder="Ej: Bodega Central - Barranquilla" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Monto ($)</label>
              <input type="number" min="0.01" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="Ej: 1250.00" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Método de Pago</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
                <option value="cash">Efectivo</option>
                <option value="qr">QR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Ruta (opcional)</label>
            <select value={formData.route_id} onChange={(e) => setFormData({ ...formData, route_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
              <option value="">Sin asignar (queda Pendiente)</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.route_code} — {r.destination}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Al asignar ruta el pedido pasa a estado Asignado.</p>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Pedido #${showDetail.id}` : ''}
        footer={
          <>
            <button onClick={() => setShowDetail(null)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cerrar</button>
          </>
        }
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-semibold text-slate-900">{showDetail.client_name || '—'}</p>
              </div>
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-slate-500">Monto</p>
                <p className="font-semibold text-slate-900">${Number(showDetail.amount).toLocaleString()}</p>
              </div>
              <div className="bg-cream rounded-xl p-3 col-span-2">
                <p className="text-xs text-slate-500">Destino</p>
                <p className="font-semibold text-slate-900">{showDetail.destination}</p>
              </div>
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-slate-500">Estado</p>
                <StatusBadge status={showDetail.status} />
              </div>
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-slate-500">Pago</p>
                <StatusBadge status={showDetail.payment_status} />
              </div>
              <div className="bg-cream rounded-xl p-3 col-span-2">
                <p className="text-xs text-slate-500">OTP de Cobro</p>
                <p className="font-mono text-lg tracking-[0.3em] text-slate-900">{showDetail.otp_code || '—'}</p>
              </div>
            </div>

            {canUpdate && (
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cambiar Estado</label>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'assigned', 'in_transit', 'delivered', 'cancelled'].map((s) => (
                    <button key={s} onClick={() => handleChangeStatus(showDetail, s)} disabled={showDetail.status === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        showDetail.status === s
                          ? 'bg-lime-400 text-slate-900'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {s === 'pending' ? 'Pendiente' : s === 'assigned' ? 'Asignado' : s === 'in_transit' ? 'En Tránsito' : s === 'delivered' ? 'Entregado' : 'Cancelado'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {canUpdate && (
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Asignar a Ruta</label>
                <select value={showDetail.route_id || ''} onChange={(e) => handleAssignRoute(showDetail, e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none">
                  <option value="">Sin ruta</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.route_code} — {r.destination}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar Pedido"
        footer={
          <>
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-bold hover:bg-red-700">Eliminar</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          ¿Seguro que deseas eliminar el pedido <strong>#{confirmDelete?.id}</strong> de <strong>{confirmDelete?.client_name}</strong>?
          Solo se pueden eliminar pedidos pendientes o cancelados.
        </p>
      </Modal>
    </div>
  );
}
