import React, { useState, useMemo } from 'react';
import { formatCOP, formatUnitCOP } from '../utils/currencyFormatter';

/**
 * DataGrid Maestro-Detalle para Inventario Web
 * 
 * Nivel 1 (Fila Maestra - Siempre visible):
 *   Columnas: Insumo | Unidad | Costo Unitario | Stock Total | Valor Total | Estado Global | [ ℹ️ Más Info ▾ ]
 * 
 * Nivel 2 (Sub-tabla de Lotes - Oculta por defecto):
 *   Fila expandida con fondo ligeramente más oscuro.
 *   Columnas: ID Lote | Zona de Bodega | Stock del Lote | Valor | Fecha de Vencimiento | Estado del Lote (Etiquetas rojas/naranjas solo si hay alerta).
 *   Lotes estrictamente ordenados por FEFO (el backend envía primero los que vencen antes).
 */
export default function InventoryMasterDetailGrid({
  items = [],
  loading = false,
  onPrintLabel,
  onQuarantineToggle,
  canWrite = false,
  defaultExpandAll = false,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'alerts', 'optimal'
  const [expandedIds, setExpandedIds] = useState(() => {
    if (defaultExpandAll && items.length > 0) {
      return new Set(items.map((i) => i.id));
    }
    return new Set();
  });

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedIds.size === filteredItems.length && filteredItems.length > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro de búsqueda
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchUnit = item.unit?.toLowerCase().includes(q);
        const matchStatus = item.global_status_label?.toLowerCase().includes(q);
        const matchBatch = item.batches?.some(
          (b) =>
            b.batch_code?.toLowerCase().includes(q) ||
            b.storage_zone?.toLowerCase().includes(q) ||
            b.alert_label?.toLowerCase().includes(q)
        );
        if (!matchName && !matchUnit && !matchStatus && !matchBatch) {
          return false;
        }
      }

      // Filtro de estado
      if (statusFilter === 'alerts') {
        const hasAlert = item.global_status === 'critical' || item.global_status === 'warning' || item.global_status === 'rupture' || item.global_status === 'low';
        if (!hasAlert) return false;
      } else if (statusFilter === 'optimal') {
        if (item.global_status !== 'ok') return false;
      }

      return true;
    });
  }, [items, search, statusFilter]);

  const totalValue = useMemo(() => {
    return filteredItems.reduce((acc, it) => acc + (Number(it.total_value) || 0), 0);
  }, [filteredItems]);

  const allExpanded = filteredItems.length > 0 && expandedIds.size === filteredItems.length;

  return (
    <div className="bg-white/90 rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Barra de Controles y Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="bi bi-table text-slate-700" aria-hidden="true" />
              Inventario Físico & Lotes FEFO (Maestro-Detalle)
            </h2>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Acordeón FEFO
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Información macro por insumo con desglose expansible de lotes físicos ordenados por vencimiento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de filtros rápidos */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('alerts')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                statusFilter === 'alerts'
                  ? 'bg-amber-100 text-amber-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Con Alertas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('optimal')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                statusFilter === 'optimal'
                  ? 'bg-emerald-100 text-emerald-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Óptimos
            </button>
          </div>

          {/* Botón sobrio para expandir/colapsar todo */}
          <button
            type="button"
            onClick={toggleAll}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
            title={allExpanded ? 'Colapsar todos los insumos' : 'Expandir todos los insumos'}
          >
            <i className={`bi bi-${allExpanded ? 'arrows-collapse' : 'arrows-expand'} text-slate-500`} aria-hidden="true" />
            <span>{allExpanded ? 'Colapsar Todo' : 'Expandir Todo'}</span>
          </button>

          {/* Buscador */}
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar insumo, lote o zona..."
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white w-48 sm:w-60 focus:ring-2 focus:ring-slate-900 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Tabla Maestro-Detalle */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
              <th className="py-3 px-4">Insumo</th>
              <th className="py-3 px-3">Unidad</th>
              <th className="py-3 px-3">Costo Unitario</th>
              <th className="py-3 px-3">Stock Total</th>
              <th className="py-3 px-3">Valor Total</th>
              <th className="py-3 px-3">Estado Global</th>
              <th className="py-3 px-4 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2 text-xs font-medium">
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                    Cargando inventario maestro y lotes FEFO...
                  </div>
                </td>
              </tr>
            )}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                  <i className="bi bi-inbox text-2xl block mb-2 text-slate-300" aria-hidden="true" />
                  No se encontraron insumos que coincidan con los filtros aplicados.
                </td>
              </tr>
            )}

            {!loading &&
              filteredItems.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                const batchesCount = item.batches ? item.batches.length : 0;

                return (
                  <React.Fragment key={item.id}>
                    {/* ========================================================= */}
                    {/* NIVEL 1: FILA MAESTRA (Siempre visible)                    */}
                    {/* ========================================================= */}
                    <tr
                      onClick={() => toggleExpand(item.id)}
                      className={`cursor-pointer transition-colors select-none ${
                        isExpanded
                          ? 'bg-slate-100/90 font-medium'
                          : 'hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      {/* 1. Insumo */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                          <span className="text-[10px] font-mono font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            {batchesCount} {batchesCount === 1 ? 'lote' : 'lotes'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Unidad */}
                      <td className="py-3.5 px-3 text-xs uppercase font-semibold text-slate-500 font-mono">
                        {item.unit}
                      </td>

                      {/* 3. Costo Unitario */}
                      <td className="py-3.5 px-3 font-mono text-sm text-slate-700">
                        {formatUnitCOP(item.cost_per_unit, item.unit)}
                      </td>

                      {/* 4. Stock Total */}
                      <td className="py-3.5 px-3 font-mono font-bold text-sm text-slate-900">
                        {Number(item.stock_total).toLocaleString('es-CO')}{' '}
                        <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </td>

                      {/* 5. Valor Total */}
                      <td className="py-3.5 px-3 font-mono font-bold text-sm text-slate-900">
                        <span className="bg-lime-400/20 text-[#2D3F00] px-2.5 py-1 rounded-lg border border-lime-300/80 inline-block shadow-xs">
                          {formatCOP(item.total_value)}
                        </span>
                      </td>

                      {/* 6. Estado Global */}
                      <td className="py-3.5 px-3">
                        {item.global_status_badge === 'red' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            {item.global_status_label}
                          </span>
                        ) : item.global_status_badge === 'amber' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {item.global_status_label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {item.global_status_label}
                          </span>
                        )}
                      </td>

                      {/* 7. Botón Sobrio [ ℹ️ Más Info ] o [ ▾ ] */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.id);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            isExpanded
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title={isExpanded ? 'Ocultar desglose de lotes' : 'Ver desglose de lotes físicos FEFO'}
                        >
                          <span>ℹ️ Más Info</span>
                          <i
                            className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-[10px] transition-transform`}
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>

                    {/* ========================================================= */}
                    {/* NIVEL 2: SUB-TABLA DE LOTES (Oculta por defecto)          */}
                    {/* ========================================================= */}
                    {isExpanded && (
                      <tr className="bg-slate-200/50 border-y border-slate-300">
                        <td colSpan={7} className="p-3 sm:p-5">
                          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <i className="bi bi-layers-half text-slate-700 text-sm" aria-hidden="true" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                  Lotes Físicos de {item.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  ({batchesCount} {batchesCount === 1 ? 'lote registrado' : 'lotes registrados'})
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                                Orden FEFO estricto: Primero en vencer arriba
                              </span>
                            </div>

                            {batchesCount > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      <th className="py-2 px-3">ID Lote</th>
                                      <th className="py-2 px-3">Zona de Bodega</th>
                                      <th className="py-2 px-3">Stock del Lote</th>
                                      <th className="py-2 px-3">Valor</th>
                                      <th className="py-2 px-3">Fecha de Vencimiento</th>
                                      <th className="py-2 px-3">Estado del Lote</th>
                                      <th className="py-2 px-3 text-right">Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.batches.map((batch) => (
                                      <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                                        {/* ID Lote */}
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                          {batch.batch_code}
                                        </td>

                                        {/* Zona de Bodega */}
                                        <td className="py-2.5 px-3">
                                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                            {batch.storage_zone}
                                          </span>
                                        </td>

                                        {/* Stock del Lote */}
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                          {Number(batch.quantity).toLocaleString('es-CO')}{' '}
                                          <span className="font-normal text-slate-500">{batch.unit}</span>
                                        </td>

                                        {/* Valor */}
                                        <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">
                                          {formatCOP(batch.value)}
                                        </td>

                                        {/* Fecha de Vencimiento */}
                                        <td className="py-2.5 px-3 font-mono text-slate-700">
                                          {batch.expiration_date_human}
                                        </td>

                                        {/* Estado del Lote (Etiquetas rojas/naranjas solo si hay alerta) */}
                                        <td className="py-2.5 px-3">
                                          {batch.has_alert ? (
                                            batch.alert_color === 'red' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 shadow-xs whitespace-nowrap">
                                                <i className="bi bi-shield-slash-fill text-[9px]" aria-hidden="true" />
                                                {batch.alert_label}
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs whitespace-nowrap">
                                                <i className="bi bi-hourglass-split text-[9px]" aria-hidden="true" />
                                                {batch.alert_label}
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-[11px] text-slate-400 font-medium">
                                              Óptimo
                                            </span>
                                          )}
                                        </td>

                                        {/* Acción: Imprimir QR */}
                                        <td className="py-2.5 px-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {onPrintLabel && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onPrintLabel(batch);
                                                }}
                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                                title="Imprimir etiqueta QR"
                                              >
                                                <i className="bi bi-qr-code text-xs" aria-hidden="true" />
                                              </button>
                                            )}
                                            {canWrite && onQuarantineToggle && (
                                              batch.days_to_expire < 0 ? (
                                                <span
                                                  title="Lote vencido bloqueado por sistema sanitario"
                                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-0.5"
                                                >
                                                  <i className="bi bi-lock-fill text-[9px]" />
                                                  Bloqueado
                                                </span>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onQuarantineToggle(batch);
                                                  }}
                                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                                    batch.is_quarantined
                                                      ? 'bg-lime-400 text-slate-900 hover:bg-lime-500'
                                                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                                  }`}
                                                  title={batch.is_quarantined ? 'Liberar lote de cuarentena' : 'Poner lote en cuarentena por merma'}
                                                >
                                                  {batch.is_quarantined ? 'Liberar' : 'Aislar'}
                                                </button>
                                              )
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <i className="bi bi-inbox text-slate-300 text-lg block mb-1" aria-hidden="true" />
                                Sin lotes físicos activos registrados para este insumo.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer con Resumen Consolidado */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div>
          Mostrando <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> insumos en inventario
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">
            Total Valorizado:{' '}
            <strong className="font-mono text-slate-900">{formatCOP(totalValue, true)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
