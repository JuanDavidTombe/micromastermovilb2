import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { stock } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DynamicTable from '../components/DynamicTable';
import InventoryMasterDetailGrid from '../components/InventoryMasterDetailGrid';
import { formatHumanDate } from '../utils/dateFormatter';
import { formatCOP, formatUnitCOP } from '../utils/currencyFormatter';
import { hasReadAccess, hasModuleAccess, can } from '../constants/roles';
import { ModuleError } from '../components/ErrorBoundary';

const VARIABLE_WEIGHT_HINTS = ['pollo', 'carne', 'cerdo', 'pescado', 'filete', 'granel', 'carne de res', 'lomo', 'pechuga', 'costilla'];

function isVariableWeightIngredient(ing) {
  if (!ing) return false;
  if (ing.is_variable_weight === true || ing.is_variable_weight === 1) return true;
  const n = String(ing.name || '').toLowerCase();
  if (/\bres\b/.test(n)) return true;
  return VARIABLE_WEIGHT_HINTS.some((k) => n.includes(k));
}

function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function movementTypeLabel(type) {
  if (type === 'entrada') return 'Entrada';
  if (type === 'merma') return 'Merma';
  if (type === 'salida') return 'Salida';
  return type || '-';
}

function exportMovementsExcel(rows) {
  const headers = ['Fecha', 'Tipo', 'Lote', 'Insumo', 'Cantidad', 'Unidad', 'Zona', 'Proveedor', 'Referencia', 'Notas'];
  const lines = [
    headers,
    ...rows.map((row) => [
      String(row.occurred_at || '').slice(0, 19).replace('T', ' '),
      movementTypeLabel(row.type),
      row.batch_code || '',
      row.ingredient || '',
      row.quantity ?? '',
      row.unit || '',
      row.storage_zone || '',
      row.supplier_name || '',
      row.reference || '',
      row.notes || '',
    ]),
  ];
  const csv = `\uFEFF${lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')}`;
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reportes_bodega_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const ZONES = ['A-01', 'A-02', 'B-01', 'C-01', 'Refrigerado', 'Congelado'];

function defaultExpirationFor(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('pollo') || n.includes('carne') || n.includes('pescado') || n.includes('cerdo')) {
    return isoDateOffset(7);
  }
  if (n.includes('leche') || n.includes('queso') || n.includes('lact')) {
    return isoDateOffset(15);
  }
  if (n.includes('verdura') || n.includes('tomate') || n.includes('cebolla') || n.includes('piment')) {
    return isoDateOffset(12);
  }
  return isoDateOffset(90);
}

const QUALITY_CHECKS = [
  { key: 'temperature', label: 'Temperatura de transporte dentro del rango reglamentario' },
  { key: 'packaging', label: 'Empaque íntegro, limpio y sin roturas ni derrames' },
  { key: 'labeling', label: 'Etiquetado con código de lote y fecha de vencimiento legible' },
  { key: 'sanitary_registry', label: 'Registro sanitario INVIMA vigente y documentación legal' },
];

function qrPattern(value, n = 21) {
  let seed = 7;
  for (let i = 0; i < value.length; i += 1) {
    seed = (seed * 33 + value.charCodeAt(i)) % 2147483647;
  }
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const grid = Array.from({ length: n }, () => Array(n).fill(false));
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const inFinder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      if (!inFinder && next() > 0.5) grid[y][x] = true;
    }
  }
  const drawFinder = (ox, oy) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = edge || core;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(n - 7, 0);
  drawFinder(0, n - 7);
  return grid;
}

function qrSvg(value, size = 150) {
  const n = 21;
  const grid = qrPattern(value || 'sin-codigo', n);
  const c = size / n;
  let cells = '';
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (grid[y][x]) cells += `<rect x="${(x * c).toFixed(2)}" y="${(y * c).toFixed(2)}" width="${c.toFixed(2)}" height="${c.toFixed(2)}" />`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#ffffff"/><g fill="#0f172a">${cells}</g></svg>`;
}

function QrPreview({ value, size = 136 }) {
  const src = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg(value, size))}`, [value, size]);
  return <img src={src} alt="Código QR del lote" width={size} height={size} className="bg-white rounded-xl border border-slate-200 p-1" />;
}

export default function MicroStock({ user }) {
  const location = useLocation();
  const view = location.pathname === '/stock/lotes'
    ? 'lotes'
    : location.pathname === '/stock/entradas'
      ? 'entradas'
      : location.pathname === '/stock/alertas'
        ? 'reportes'
        : 'resumen';

  const role = user?.role || 'ADMINISTRADOR';
  const canView = hasReadAccess(role, 'inventory_stock');
  const canWrite = hasModuleAccess(role, 'inventory_stock') && can(role, 'create');

  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterQuarantine, setFilterQuarantine] = useState(false);
  const [search, setSearch] = useState('');

  const [blockTarget, setBlockTarget] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [labelTarget, setLabelTarget] = useState(null);

  // Recepción por Excepción (Cruce ASN / Órdenes de Compra)
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [poFilterStatus, setPoFilterStatus] = useState('all');
  const [selectedPo, setSelectedPo] = useState(null);
  const [receptionZone, setReceptionZone] = useState('A-01');
  const [receptionTemp, setReceptionTemp] = useState('3.2');
  const [receptionTempNotes, setReceptionTempNotes] = useState('');
  const [receptionChecklist, setReceptionChecklist] = useState({
    temperature: true,
    packaging: true,
    labeling: true,
    sanitary_registry: true,
  });
  const [receptionItems, setReceptionItems] = useState([]);
  const [receptionSubmitting, setReceptionSubmitting] = useState(false);
  const [receptionResult, setReceptionResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [movements, setMovements] = useState([]);
  const [reportFrom, setReportFrom] = useState(() => isoDateOffset(-120));
  const [reportTo, setReportTo] = useState(() => isoDateOffset(0));
  const [reportType, setReportType] = useState('all');

  const fetchInventorySummary = () => {
    setInventoryLoading(true);
    stock.getInventorySummary()
      .then((res) => {
        setInventoryItems(Array.isArray(res.data?.ingredients) ? res.data.ingredients : []);
        if (res.data?.summary) setSummary(res.data.summary);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setInventoryLoading(false));
  };

  const fetchBatches = () => {
    stock.getBatches({
      status: filterStatus === 'all' ? undefined : filterStatus,
      quarantined: filterQuarantine ? 'true' : undefined,
      search: search || undefined,
    })
      .then((res) => {
        setBatches(Array.isArray(res.data?.batches) ? res.data.batches : []);
        setSummary(res.data?.summary || null);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  };

  const refreshSummary = () => {
    stock.getBatches()
      .then((res) => {
        setSummary(res.data?.summary || null);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  };

  const fetchMovements = () => {
    stock.getMovements({
      from: reportFrom || undefined,
      to: reportTo || undefined,
      type: reportType === 'all' ? 'all' : reportType,
    })
      .then((res) => {
        setMovements(Array.isArray(res.data?.movements) ? res.data.movements : []);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  };

  const fetchPurchaseOrders = () => {
    setPoLoading(true);
    stock.getPurchaseOrders()
      .then((res) => {
        setPurchaseOrders(Array.isArray(res.data?.purchase_orders) ? res.data.purchase_orders : []);
      })
      .catch((err) => {
        console.error('Error al cargar órdenes de compra:', err);
      })
      .finally(() => setPoLoading(false));
  };

  useEffect(() => {
    if (!canView) return;
    fetchInventorySummary();
    stock.getIngredientStock()
      .then((res) => setIngredients(Array.isArray(res.data?.ingredients) ? res.data.ingredients : []))
      .catch(() => setLoadError(true));
    refreshSummary();
    fetchPurchaseOrders();
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    fetchBatches();
  }, [canView, filterStatus, filterQuarantine, search]);

  useEffect(() => {
    if (!canView || view !== 'reportes') return;
    fetchMovements();
  }, [canView, view, reportFrom, reportTo, reportType]);

  useEffect(() => {
    if (!canView || view !== 'entradas') return;
    fetchPurchaseOrders();
  }, [canView, view]);

  const handleSelectPo = (po) => {
    setSelectedPo(po);
    const hasRefrigerated = (po.items || []).some((it) => {
      const n = (it.ingredient_name || '').toLowerCase();
      return n.includes('pollo') || n.includes('carne') || n.includes('pescado');
    });
    setReceptionZone(hasRefrigerated ? 'Refrigerado' : 'A-01');
    setReceptionTemp(hasRefrigerated ? '2.5' : '18.0');
    setReceptionTempNotes('');
    setReceptionChecklist({
      temperature: true,
      packaging: true,
      labeling: true,
      sanitary_registry: true,
    });
    setReceptionItems(
      (po.items || []).map((it) => {
        const isVarWeight = it.is_variable_weight || isVariableWeightIngredient({ name: it.ingredient_name });
        return {
          id: it.id,
          ingredient_id: it.ingredient_id,
          ingredient_name: it.ingredient_name,
          unit: it.unit,
          cost_per_unit: it.cost_per_unit,
          expected_quantity: it.expected_quantity,
          received_quantity: String(it.expected_quantity),
          is_variable_weight: isVarWeight,
          gross_weight: isVarWeight ? String((it.expected_quantity + 2.5).toFixed(2)) : '',
          tare_weight: isVarWeight ? '2.50' : '',
          expiration_date: defaultExpirationFor(it.ingredient_name),
          batch_code: '',
        };
      })
    );
    setReceptionResult(null);
    setFeedback(null);
  };

  const updateReceptionItem = (idx, field, val) => {
    setReceptionItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: val };

      if (field === 'gross_weight' || field === 'tare_weight') {
        const g = parseFloat(field === 'gross_weight' ? val : item.gross_weight) || 0;
        const t = parseFloat(field === 'tare_weight' ? val : item.tare_weight) || 0;
        const net = Math.max(0, g - t);
        item.received_quantity = net > 0 ? String(net.toFixed(2)) : '0';
      }

      next[idx] = item;
      return next;
    });
  };

  const setItemExact = (idx) => {
    setReceptionItems((prev) => {
      const next = [...prev];
      const it = next[idx];
      next[idx] = {
        ...it,
        received_quantity: String(it.expected_quantity),
        gross_weight: it.is_variable_weight ? String((it.expected_quantity + 2.5).toFixed(2)) : '',
        tare_weight: it.is_variable_weight ? '2.50' : '',
      };
      return next;
    });
  };

  const setAllItemsExact = () => {
    setReceptionItems((prev) =>
      prev.map((it) => ({
        ...it,
        received_quantity: String(it.expected_quantity),
        gross_weight: it.is_variable_weight ? String((it.expected_quantity + 2.5).toFixed(2)) : '',
        tare_weight: it.is_variable_weight ? '2.50' : '',
      }))
    );
  };

  const receptionCalculations = useMemo(() => {
    let totalExpectedValue = 0;
    let totalReceivedValue = 0;
    let totalLossValue = 0;
    let totalShortageCount = 0;
    let totalSurplusCount = 0;

    const itemsSummary = receptionItems.map((it) => {
      const expected = parseFloat(it.expected_quantity) || 0;
      const received = parseFloat(it.received_quantity) || 0;
      const cost = parseFloat(it.cost_per_unit) || 0;
      const diff = Math.round((received - expected) * 10000) / 10000;
      const expectedVal = Math.round(expected * cost);
      const receivedVal = Math.round(received * cost);
      const diffVal = Math.round(diff * cost);

      totalExpectedValue += expectedVal;
      totalReceivedValue += receivedVal;

      if (diff < 0) {
        totalLossValue += Math.abs(diffVal);
        totalShortageCount++;
      } else if (diff > 0) {
        totalSurplusCount++;
      }

      return {
        ...it,
        expected,
        received,
        diff,
        expectedVal,
        receivedVal,
        diffVal,
      };
    });

    return {
      itemsSummary,
      totalExpectedValue,
      totalReceivedValue,
      totalLossValue,
      totalShortageCount,
      totalSurplusCount,
      isPerfectMatch: totalShortageCount === 0 && totalSurplusCount === 0,
    };
  }, [receptionItems]);

  const receptionTempVal = parseFloat(receptionTemp);
  const isReceptionTempOutOfRange = !isNaN(receptionTempVal) && receptionTempVal > 4 && receptionZone === 'Refrigerado';

  const handleSubmitReception = async () => {
    if (!selectedPo) return;

    const allChecked = QUALITY_CHECKS.every((c) => receptionChecklist[c.key]);
    if (!allChecked) {
      setFeedback({ type: 'error', message: 'Todos los controles del checklist sanitario deben ser verificados.' });
      return;
    }

    if (!receptionZone) {
      setFeedback({ type: 'error', message: 'Selecciona la zona de bodega de destino.' });
      return;
    }

    if (isReceptionTempOutOfRange && !receptionTempNotes.trim()) {
      setFeedback({ type: 'error', message: 'La temperatura supera los 4°C en producto refrigerado. Ingrese la justificación técnica obligatoria.' });
      return;
    }

    for (const it of receptionItems) {
      const r = parseFloat(it.received_quantity);
      if (isNaN(r) || r < 0) {
        setFeedback({ type: 'error', message: `Cantidad física inválida para el insumo ${it.ingredient_name}.` });
        return;
      }
      if (!it.expiration_date) {
        setFeedback({ type: 'error', message: `Fecha de vencimiento requerida para ${it.ingredient_name}.` });
        return;
      }
    }

    setReceptionSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        purchase_order_code: selectedPo.code,
        storage_zone: receptionZone,
        temperature: parseFloat(receptionTemp) || null,
        temperature_notes: receptionTempNotes?.trim() || null,
        quality_checklist: receptionChecklist,
        items: receptionItems.map((it) => ({
          ingredient_id: it.ingredient_id,
          expected_quantity: it.expected_quantity,
          received_quantity: parseFloat(it.received_quantity) || 0,
          expiration_date: it.expiration_date,
          gross_weight: it.gross_weight ? parseFloat(it.gross_weight) : null,
          tare_weight: it.tare_weight ? parseFloat(it.tare_weight) : null,
          batch_code: it.batch_code?.trim() || null,
        })),
      };

      const res = await stock.receptionMatch(payload);
      setReceptionResult(res.data);
      setFeedback({
        type: 'success',
        message: `¡Recepción completada! Se registraron ${res.data.batches_created_count} lotes en bodega para la orden ${selectedPo.code}.`,
      });
      fetchBatches();
      fetchInventorySummary();
      fetchPurchaseOrders();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error al procesar la recepción por excepción.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setReceptionSubmitting(false);
    }
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    const blocking = !blockTarget.is_quarantined;
    if (blocking && !blockReason.trim()) {
      setFeedback({ type: 'error', message: 'Indica el motivo de la cuarentena.' });
      return;
    }
    try {
      await stock.blockBatch(blockTarget.id, { is_quarantined: blocking, quarantine_reason: blockReason });
      setBlockTarget(null);
      setBlockReason('');
      setFeedback(null);
      fetchBatches();
      fetchInventorySummary();
    } catch (e) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'No se pudo actualizar el lote.' });
    }
  };

  const runPrint = () => {
    if (!labelTarget) return;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Etiqueta ${labelTarget.batch_code}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#0f172a}.card{border:2px solid #0f172a;border-radius:16px;padding:16px}.row{display:flex;align-items:center;gap:16px}.code{font-family:monospace;font-weight:700}.muted{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.12em}hr{border:none;border-top:1px solid #cbd5e1;margin:12px 0}</style></head><body><div class="card"><div class="row">${qrSvg(labelTarget.qr_code_hash || labelTarget.batch_code, 120)}<div><p class="muted">Lote</p><p class="code">${labelTarget.batch_code}</p><p class="muted">Insumo</p><p>${labelTarget.ingredient?.name || '-'}</p></div></div><hr /><p class="muted">Vence</p><p>${formatHumanDate(labelTarget.expiration_date)}</p><p class="muted">Proveedor</p><p>${labelTarget.supplier_name || '-'}</p><p class="muted">Zona</p><p>${labelTarget.storage_zone || '-'}</p></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  if (loadError) {
    return (
      <ModuleError
        onReload={() => {
          setLoadError(false);
          fetchBatches();
          refreshSummary();
          if (view === 'reportes') fetchMovements();
          stock.getIngredientStock()
            .then((res) => setIngredients(Array.isArray(res.data?.ingredients) ? res.data.ingredients : []))
            .catch(() => setLoadError(true));
        }}
      />
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Inventario & Stock</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const filteredPurchaseOrders = useMemo(() => {
    return (purchaseOrders || []).filter((po) => {
      const matchSearch =
        !poSearch.trim() ||
        po.code?.toLowerCase().includes(poSearch.toLowerCase()) ||
        po.supplier_name?.toLowerCase().includes(poSearch.toLowerCase());
      const matchStatus =
        poFilterStatus === 'all'
          ? true
          : poFilterStatus === 'pending'
            ? po.status === 'pending' || po.status === 'partial'
            : po.status === poFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [purchaseOrders, poSearch, poFilterStatus]);

  const totalAlerts = (summary?.warning ?? 0) + (summary?.critical ?? 0);

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {view === 'reportes'
              ? 'Reportes de Bodega'
              : view === 'entradas'
                ? 'Entradas de Proveedores'
                : 'Inventario & Stock'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {view === 'reportes'
              ? 'Auditoría plana de movimientos de bodega: entradas, mermas y salidas'
              : view === 'entradas'
                ? 'Recepción por Excepción: cruce automático contra ASN / Órdenes de Compra y liquidación de mermas en muelle'
                : 'Control consolidado de insumos y desglose de lotes físicos FEFO en bodega'}
          </p>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          <TechBadge label={canWrite ? 'CONTROL DE STOCK BODEGA' : 'SOLO LECTURA'} color={canWrite ? 'lime' : 'slate'} />
        </div>
      </div>

      {feedback?.type === 'error' && (
        <div className="rounded-2xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <i className="bi bi-exclamation-octagon" aria-hidden="true" />
          {feedback.message}
        </div>
      )}
      {feedback?.type === 'success' && (
        <div className="rounded-2xl px-4 py-3 text-sm bg-lime-50 border border-lime-300 text-lime-900 flex items-center gap-2">
          <i className="bi bi-check2-circle" aria-hidden="true" />
          {feedback.message}
        </div>
      )}

      {view === 'resumen' && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
            <FreshCard title="Ocupación de Bodega" value={`${summary?.occupancy ?? 0}%`} subtitle={`${summary?.total_quantity ?? 0} de ${summary?.capacity ?? 0} kg·L`} icon="box-seam" color="slate" />
            <FreshCard title="Valor Total Inventario" value={formatCOP(summary?.total_inventory_value || 0)} subtitle="Capital activo en bodega (COP)" icon="cash-coin" color="lime" />
            <FreshCard title="Lotes en Riesgo" value={totalAlerts} subtitle={`${summary?.critical ?? 0} vencidos · ${summary?.warning ?? 0} por vencer`} icon="exclamation-triangle" color="terracotta" />
            <FreshCard title="Quiebre & Reposición" value={(summary?.rupture?.length ?? 0) + (summary?.low_stock?.length ?? 0)} subtitle={`${summary?.rupture?.length ?? 0} quiebres · ${summary?.low_stock?.length ?? 0} bajos`} icon="slash-circle" color="slate" />
          </div>

          {/* DataGrid Maestro-Detalle para Inventario Web */}
          <InventoryMasterDetailGrid
            items={inventoryItems}
            loading={inventoryLoading}
            onPrintLabel={(batch) => setLabelTarget(batch)}
            onQuarantineToggle={(batch) => {
              setBlockTarget(batch);
              setBlockReason('');
            }}
            canWrite={canWrite}
            defaultExpandAll={false}
          />

          <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-slate-900">Capacidad de Almacenamiento</h3>
              <span className="text-xs font-semibold text-slate-500">
                Antigüedad media {summary?.avg_age_days ?? 0} días · Frescura {summary?.freshness_index ?? 0}%
              </span>
            </div>
            <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${(summary?.occupancy ?? 0) >= 90 ? 'bg-red-500' : (summary?.occupancy ?? 0) >= 75 ? 'bg-terracotta-500' : 'bg-lime-400'}`}
                style={{ width: `${Math.min(summary?.occupancy ?? 0, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
              {(summary?.zones || []).map((z) => (
                <div key={z.zone} className="bg-cream rounded-2xl border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Zona {z.zone}</p>
                  <p className="text-lg font-bold text-slate-900">{z.quantity}</p>
                  <p className="text-[11px] text-slate-400">{z.batches} lotes</p>
                </div>
              ))}
              {(!summary?.zones || summary.zones.length === 0) && (
                <p className="text-sm text-slate-400 col-span-full">Sin zonas con stock registrado.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-3">Insumos Más Usados</h3>
              <div className="space-y-2">
                {(summary?.top_ingredients || []).map((ing) => (
                  <div key={ing.name} className="flex items-center justify-between bg-cream rounded-2xl px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{ing.name}</p>
                      <p className="text-[11px] text-slate-400">{ing.usage_count} recetas</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{ing.demand} {ing.unit}</span>
                  </div>
                ))}
                {(!summary?.top_ingredients || summary.top_ingredients.length === 0) && (
                  <p className="text-sm text-slate-400">Sin recetas asociadas.</p>
                )}
              </div>
            </div>

            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-3">Alertas de Quiebre & Reposición</h3>
              <div className="space-y-2">
                {[...(summary?.rupture || []), ...(summary?.low_stock || [])].map((ing) => (
                  <div key={ing.id} className="flex items-center justify-between bg-cream rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ing.status} />
                      <span className="text-sm font-semibold text-slate-800">{ing.name}</span>
                    </div>
                    <span className="text-sm text-slate-600">{ing.available} / mín {ing.min_stock} {ing.unit}</span>
                  </div>
                ))}
                {(summary?.rupture?.length ?? 0) + (summary?.low_stock?.length ?? 0) === 0 && (
                  <p className="text-sm text-slate-400">Sin alertas de reposición.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
            <FreshCard title="Índice de Rotación" value={`${summary?.rotation_index ?? 0}%`} subtitle="Consumo sobre stock recibido" icon="arrow-repeat" color="cream" />
            <FreshCard title="Índice de Frescura" value={`${summary?.freshness_index ?? 0}%`} subtitle="Lotes óptimos sobre total" icon="shield-check" color="lime" />
            <FreshCard title="Lotes en Cuarentena" value={summary?.quarantined ?? 0} subtitle="Bloqueados por calidad" icon="shield-exclamation" color="terracotta" />
          </div>
        </div>
      )}

      {view === 'entradas' && !selectedPo && (
        <div className="space-y-4 md:space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-5 md:p-6 text-white border border-slate-700 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-lime-400/20 text-lime-400 text-xs font-semibold">
                  <i className="bi bi-box-arrow-in-down" /> Recepción por Excepción (ASN / OC)
                </div>
                <h2 className="text-xl md:text-2xl font-bold">Muelle de Recepción de Mercancía</h2>
                <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
                  Cruce automático contra la Orden de Compra precargada. Selecciona la orden que ingresa al muelle; el sistema despliega el manifiesto esperado y el operario únicamente registra el conteo físico real y controla mermas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPurchaseOrders}
                  disabled={poLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center gap-1.5 transition-colors"
                >
                  <i className={`bi bi-arrow-repeat ${poLoading ? 'animate-spin' : ''}`} />
                  Actualizar Manifiestos
                </button>
              </div>
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div className="bg-white/90 rounded-2xl border border-slate-200 p-3 md:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Buscar por código (OC-...) o nombre de proveedor..."
                className="w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'pending', label: 'Pendientes / Muelle' },
                { id: 'completed', label: 'Completadas' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPoFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    poFilterStatus === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Listado de Órdenes de Compra (ASN) */}
          {poLoading && purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <i className="bi bi-arrow-repeat animate-spin text-3xl mb-2 block" />
              Cargando manifiestos de órdenes de compra...
            </div>
          ) : filteredPurchaseOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500">
              <i className="bi bi-inbox text-4xl text-slate-300 mb-2 block" />
              <p className="font-semibold text-slate-700">No se encontraron órdenes de compra esperadas.</p>
              <p className="text-xs text-slate-400 mt-1">Verifica los filtros aplicados o sincroniza los manifiestos de proveedores.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPurchaseOrders.map((po) => {
                const isCompleted = po.status === 'completed';
                const isPartial = po.status === 'partial';
                return (
                  <div
                    key={po.id}
                    className={`bg-white rounded-3xl border transition-all p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                      isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-lime-400'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                          {po.code}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isPartial
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-lime-100 text-lime-900 border border-lime-300'
                          }`}
                        >
                          {isCompleted ? '✓ Recibido' : isPartial ? '⚠️ Parcial' : '⏳ Esperado'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{po.supplier_name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <i className="bi bi-calendar3" />
                          Fecha esperada: <strong className="text-slate-600">{po.expected_date_human || po.expected_date}</strong>
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Manifiesto ASN ({po.items?.length || 0} insumos)
                        </p>
                        <div className="space-y-1">
                          {(po.items || []).slice(0, 3).map((it) => (
                            <div key={it.id} className="flex justify-between text-xs text-slate-600">
                              <span className="truncate pr-2">{it.ingredient_name}</span>
                              <span className="font-semibold text-slate-800 whitespace-nowrap">
                                {it.expected_quantity} {it.unit}
                              </span>
                            </div>
                          ))}
                          {(po.items?.length || 0) > 3 && (
                            <p className="text-[10px] text-slate-400 italic text-right">+ {(po.items.length - 3)} más...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Valor Esperado</p>
                        <p className="text-sm font-bold text-slate-900">{formatCOP(po.total_expected_value || 0)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectPo(po)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isCompleted
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-lime-400 hover:bg-lime-500 text-slate-900 shadow-xs'
                        }`}
                      >
                        <i className="bi bi-truck text-xs" />
                        {isCompleted ? 'Reabrir / Revisar' : 'Descargar en Muelle'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'entradas' && selectedPo && (
        <div className="space-y-4 md:space-y-6">
          {/* Header / Barra de Navegación de la Orden */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setSelectedPo(null); setFeedback(null); }}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shrink-0"
                  title="Volver a lista de órdenes"
                >
                  <i className="bi bi-arrow-left text-sm" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {selectedPo.code}
                    </span>
                    <h2 className="text-lg md:text-xl font-bold text-slate-900">
                      {selectedPo.supplier_name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cruce por Excepción ASN · Arribo programado: <strong>{selectedPo.expected_date_human || selectedPo.expected_date}</strong> · {receptionItems.length} insumos esperados
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  type="button"
                  onClick={setAllItemsExact}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <i className="bi bi-check2-all text-sm text-lime-600" />
                  Marcar Todos 100% Conformes
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Conteo Físico en Muelle */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                  <i className="bi bi-clipboard2-check text-lime-600" />
                  Conteo Físico Real en Muelle vs Manifiesto ASN
                </h3>
                <p className="text-xs text-slate-400">
                  Digita la cantidad real recibida o el pesaje neto (Bruto − Tara). Las diferencias y mermas se calculan en vivo.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50/80 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Esperado (ASN)</th>
                    <th className="py-3 px-4">Costo Unitario</th>
                    <th className="py-3 px-4 min-w-[240px]">Conteo Físico Real</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4 min-w-[150px]">Lote Sugerido</th>
                    <th className="py-3 px-4">Desvío / Merma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receptionCalculations.itemsSummary.map((item, idx) => {
                    const isVarWeight = item.is_variable_weight;
                    const hasDiff = item.diff !== 0;
                    const isLoss = item.diff < 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{item.ingredient_name}</p>
                          <span className="text-[10px] text-slate-400">Unidad: {item.unit}</span>
                          {isVarWeight && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              <i className="bi bi-speedometer2" /> Cárnico / Balanza
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          {item.expected} {item.unit}
                          <span className="block text-[11px] text-slate-400 font-sans">
                            {formatCOP(item.expectedVal)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {formatCOP(item.cost_per_unit)}
                        </td>
                        <td className="py-3 px-4">
                          {isVarWeight ? (
                            <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Peso Bruto</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.gross_weight || ''}
                                    onChange={(e) => updateReceptionItem(idx, 'gross_weight', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white font-mono focus:ring-1 focus:ring-lime-400 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Tara (Carreta/Caja)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.tare_weight || ''}
                                    onChange={(e) => updateReceptionItem(idx, 'tare_weight', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white font-mono focus:ring-1 focus:ring-lime-400 outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                                <span className="text-[10px] text-slate-500 font-medium">Peso Neto Ingresado:</span>
                                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                  {item.received} {item.unit}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.received_quantity}
                                onChange={(e) => updateReceptionItem(idx, 'received_quantity', e.target.value)}
                                className="w-28 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-lime-400 outline-none"
                              />
                              <span className="text-xs text-slate-500">{item.unit}</span>
                              <button
                                type="button"
                                onClick={() => setItemExact(idx)}
                                title="Restablecer al 100% esperado"
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              >
                                = 100%
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="date"
                            value={item.expiration_date}
                            onChange={(e) => updateReceptionItem(idx, 'expiration_date', e.target.value)}
                            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.batch_code}
                            onChange={(e) => updateReceptionItem(idx, 'batch_code', e.target.value)}
                            placeholder={`LOT-${selectedPo.code}-${item.ingredient_id}`}
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          {!hasDiff ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xl">
                              <i className="bi bi-check-circle-fill text-emerald-600" /> Conforme ($0)
                            </span>
                          ) : isLoss ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                                <i className="bi bi-exclamation-triangle-fill text-rose-500" />
                                Merma: {item.diff} {item.unit}
                              </span>
                              <span className="block text-[10px] font-mono font-bold text-rose-600">
                                - {formatCOP(Math.abs(item.diffVal))}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                                <i className="bi bi-arrow-up-circle-fill text-sky-500" />
                                Sobrante: +{item.diff} {item.unit}
                              </span>
                              <span className="block text-[10px] font-mono font-bold text-sky-700">
                                + {formatCOP(item.diffVal)}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controles Sanitarios, Temperatura y Zona de Almacén */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Temperatura y Justificación */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold tracking-wider text-slate-600 flex items-center gap-1.5">
                  <i className="bi bi-thermometer-half text-rose-500 text-sm" />
                  Temperatura en Muelle (°C)
                </label>
                {isReceptionTempOutOfRange && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full animate-pulse">
                    &gt; 4°C Desvío Crítico
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={receptionTemp}
                  onChange={(e) => setReceptionTemp(e.target.value)}
                  className={`w-full px-4 py-2 text-sm rounded-xl border outline-none font-mono ${
                    isReceptionTempOutOfRange
                      ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-400'
                      : 'border-slate-200 bg-white focus:ring-2 focus:ring-lime-400'
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">°C</span>
              </div>
              {isReceptionTempOutOfRange && (
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-rose-700 block">Justificación Técnica Obligatoria:</label>
                  <textarea
                    rows={2}
                    value={receptionTempNotes}
                    onChange={(e) => setReceptionTempNotes(e.target.value)}
                    placeholder="Explicación del desvío térmico y medidas adoptadas..."
                    className="w-full p-2.5 rounded-xl border border-rose-300 text-xs bg-rose-50/30 focus:ring-2 focus:ring-rose-400 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Zona de Bodega */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <label className="text-xs uppercase font-bold tracking-wider text-slate-600 flex items-center gap-1.5">
                <i className="bi bi-geo-alt-fill text-lime-600 text-sm" />
                Zona de Almacenamiento
              </label>
              <select
                value={receptionZone}
                onChange={(e) => setReceptionZone(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none font-semibold text-slate-800"
              >
                {ZONES.map((zone) => (
                  <option key={zone} value={zone}>Zona {zone}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                Ubicación física designada para el ingreso de los lotes generados.
              </p>
            </div>

            {/* Checklist Sanitario */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold tracking-wider text-slate-600 flex items-center gap-1.5">
                  <i className="bi bi-shield-check text-emerald-600 text-sm" />
                  Control Sanitario (BPM)
                </label>
                <button
                  type="button"
                  onClick={() => setReceptionChecklist({ temperature: true, packaging: true, labeling: true, sanitary_registry: true })}
                  className="text-[10px] font-bold text-lime-700 hover:text-lime-800"
                >
                  Aprobar Todo
                </button>
              </div>
              <div className="space-y-1.5">
                {QUALITY_CHECKS.map((check) => (
                  <label key={check.key} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!receptionChecklist[check.key]}
                      onChange={(e) => setReceptionChecklist((prev) => ({ ...prev, [check.key]: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 accent-lime-500 rounded shrink-0"
                    />
                    <span>{check.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen de Liquidación & Botón de Confirmación */}
          <div className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white border border-slate-800 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Valor Esperado ASN</p>
                  <p className="text-lg md:text-xl font-bold font-mono">{formatCOP(receptionCalculations.totalExpectedValue)}</p>
                  <p className="text-[11px] text-white/40">{receptionCalculations.itemsSummary.length} insumos contratados</p>
                </div>
                <div className="pt-2 sm:pt-0 sm:pl-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Valor Físico en Muelle</p>
                  <p className="text-lg md:text-xl font-bold font-mono text-lime-400">{formatCOP(receptionCalculations.totalReceivedValue)}</p>
                  <p className="text-[11px] text-white/40">Liquidación real pesada</p>
                </div>
                <div className="pt-2 sm:pt-0 sm:pl-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Desvío / Merma Neta</p>
                  <p className={`text-lg md:text-xl font-bold font-mono ${receptionCalculations.totalLossValue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {receptionCalculations.totalLossValue > 0 ? `- ${formatCOP(receptionCalculations.totalLossValue)}` : '$0 COP'}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {receptionCalculations.totalLossValue > 0 ? 'Pérdida registrada por merma' : 'Entrega 100% conforme'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-stretch lg:self-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPo(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReception}
                  disabled={receptionSubmitting}
                  className="px-6 py-3 rounded-2xl text-xs md:text-sm font-bold bg-lime-400 hover:bg-lime-500 text-slate-900 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {receptionSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat animate-spin" />
                      Registrando Lotes en Bodega...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-down" />
                      Confirmar Recepción por Excepción
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Modal de Liquidación Final / Auditoría */}
          <Modal
            isOpen={!!receptionResult}
            onClose={() => { setReceptionResult(null); setSelectedPo(null); }}
            title="Liquidación de Muelle - Recepción Completada"
            footer={
              <button
                type="button"
                onClick={() => { setReceptionResult(null); setSelectedPo(null); }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-lime-400 hover:bg-lime-500 text-slate-900 transition-all"
              >
                ✓ Finalizar y Volver a Órdenes
              </button>
            }
          >
            {receptionResult && (
              <div className="space-y-4">
                <div className="bg-lime-50 border border-lime-300 rounded-2xl p-4 text-slate-900">
                  <div className="flex items-center gap-2 font-bold text-lime-900">
                    <i className="bi bi-check-circle-fill text-lime-600 text-lg" />
                    <span>{receptionResult.message}</span>
                  </div>
                  <p className="text-xs text-lime-800 mt-1">
                    Estado de la Orden: <strong>{receptionResult.status === 'completed' ? 'Completada / Cerrada' : 'Parcial (con mermas)'}</strong> · Lotes creados: <strong>{receptionResult.batches_created_count}</strong>
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Desglose de Desvíos & Mermas</h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(receptionResult.deviations || []).map((dev, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{dev.ingredient}</p>
                          <p className="text-slate-500 font-mono text-[11px]">
                            Lote: {dev.batch_code || 'N/A'} · Esperado: {dev.expected} {dev.unit} · Recibido: {dev.received} {dev.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          {dev.difference === 0 ? (
                            <span className="text-emerald-700 font-bold">100% Conforme</span>
                          ) : dev.difference < 0 ? (
                            <span className="text-rose-600 font-bold">
                              Merma: {dev.difference} {dev.unit} ({formatCOP(Math.abs(dev.difference_value))})
                            </span>
                          ) : (
                            <span className="text-sky-700 font-bold">
                              +{dev.difference} {dev.unit} (+{formatCOP(dev.difference_value)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {receptionResult.total_loss_value > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
                    <span className="font-bold">Total Pérdida por Mermas Físicas:</span>
                    <span className="font-mono font-bold text-sm text-rose-700">
                      {formatCOP(receptionResult.total_loss_value)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}

      {view === 'reportes' && (
        <div className="space-y-4">
          <div className="bg-white/80 rounded-3xl border border-slate-200 p-4 md:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Desde</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Hasta</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Tipo de movimiento</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none min-w-[180px]"
                >
                  <option value="all">Todos</option>
                  <option value="entradas">Entradas</option>
                  <option value="mermas">Mermas</option>
                  <option value="salidas">Salidas</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => exportMovementsExcel(movements)}
                className="ml-auto inline-flex items-center gap-2 bg-lime-400 hover:bg-lime-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                <i className="bi bi-file-earmark-excel" aria-hidden="true" />
                Exportar a Excel
              </button>
            </div>
          </div>

          <DynamicTable
            columns={[
              { key: 'occurred_at', label: 'Fecha' },
              { key: 'type', label: 'Tipo' },
              { key: 'batch_code', label: 'Lote' },
              { key: 'ingredient', label: 'Insumo' },
              { key: 'quantity', label: 'Cantidad' },
              { key: 'reference', label: 'Referencia' },
              { key: 'notes', label: 'Notas' },
            ]}
            data={movements}
            renderRow={(row) => (
              <>
                <td className="px-4 py-3 text-sm text-slate-700">{formatHumanDate(row.occurred_at) || String(row.occurred_at || '').slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                    row.type === 'entrada' ? 'bg-lime-50 border-lime-300 text-[#3F5600]'
                      : row.type === 'merma' ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}>
                    {movementTypeLabel(row.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900">{row.batch_code}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.ingredient}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.quantity} {row.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.reference || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{row.notes || '—'}</td>
              </>
            )}
          />

          {movements.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No hay movimientos en el rango seleccionado.</p>
          )}
        </div>
      )}

      <Modal
        isOpen={!!blockTarget}
        onClose={() => { setBlockTarget(null); setBlockReason(''); }}
        title={blockTarget?.is_quarantined ? 'Liberar Lote Aislado' : 'Dar de Baja Lote (Registro de Merma)'}
        footer={
          <>
            <button onClick={() => { setBlockTarget(null); setBlockReason(''); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button onClick={confirmBlock} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${blockTarget?.is_quarantined ? 'bg-lime-400 hover:bg-lime-500 text-slate-900' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}>
              {blockTarget?.is_quarantined ? 'Liberar Lote' : 'Confirmar Baja (Merma)'}
            </button>
          </>
        }
      >
        {blockTarget && (
          <div className="space-y-3">
            <div className="bg-cream rounded-2xl border border-slate-200 p-3 text-sm">
              <p className="font-mono font-semibold text-slate-900">{blockTarget.batch_code}</p>
              <p className="text-slate-500">{blockTarget.ingredient?.name} · {blockTarget.quantity} {blockTarget.ingredient?.unit}</p>
            </div>
            {blockTarget.is_quarantined ? (
              <p className="text-sm text-slate-600">El lote quedará disponible nuevamente para despacho y procesos.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Aislar este producto con vida útil vigente por daños físicos (ruptura de empaque, rotura de cadena de frío o contaminación).
                </p>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Motivo de Baja / Merma (Obligatorio)</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={3}
                    placeholder="Ej: Empaque roto en estiba, pérdida de frío durante almacenamiento, etc."
                    className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-rose-400 outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        title="Etiqueta de Trazabilidad QR"
        footer={
          <>
            <button onClick={() => setLabelTarget(null)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 transition-all">
              Cerrar
            </button>
            <button onClick={runPrint} className="px-4 py-2 rounded-xl text-sm bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all flex items-center gap-2">
              <i className="bi bi-printer" aria-hidden="true" />
              Imprimir
            </button>
          </>
        }
      >
        {labelTarget && (
          <div className="border-2 border-slate-900 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <QrPreview value={labelTarget.qr_code_hash || labelTarget.batch_code} />
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Lote</p>
                  <p className="font-mono font-bold text-slate-900">{labelTarget.batch_code}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Insumo</p>
                  <p className="text-sm text-slate-700">{labelTarget.ingredient?.name}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Vence</p>
                <p className="text-slate-700">{formatHumanDate(labelTarget.expiration_date)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Zona</p>
                <p className="text-slate-700">{labelTarget.storage_zone || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Proveedor</p>
                <p className="text-slate-700">{labelTarget.supplier_name || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
