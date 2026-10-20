import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { stock } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DynamicTable from '../components/DynamicTable';
import { formatHumanDate } from '../utils/dateFormatter';
import { hasReadAccess, hasModuleAccess, can } from '../constants/roles';

const ZONES = ['A-01', 'A-02', 'B-01', 'C-01', 'Refrigerado', 'Congelado'];

const EMPTY_ENTRY = {
  purchase_order_code: '',
  ingredient_id: '',
  batch_code: '',
  supplier_name: '',
  quantity: '',
  expiration_date: '',
  storage_zone: '',
};

const EMPTY_CHECKLIST = {
  temperature: false,
  packaging: false,
  labeling: false,
  sanitary_registry: false,
};

const QUALITY_CHECKS = [
  { key: 'temperature', label: 'Temperatura de transporte dentro del rango' },
  { key: 'packaging', label: 'Empaque íntegro y sin roturas' },
  { key: 'labeling', label: 'Etiquetado y código de lote legibles' },
  { key: 'sanitary_registry', label: 'Registro sanitario (INVIMA) vigente' },
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
      : 'resumen';

  const role = user?.role || 'ADMINISTRADOR';
  const canView = hasReadAccess(role, 'inventory_stock');
  const canWrite = hasModuleAccess(role, 'inventory_stock') && can(role, 'create');

  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterQuarantine, setFilterQuarantine] = useState(false);
  const [search, setSearch] = useState('');

  const [blockTarget, setBlockTarget] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [labelTarget, setLabelTarget] = useState(null);

  const [step, setStep] = useState(1);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [checklist, setChecklist] = useState(EMPTY_CHECKLIST);
  const [poInfo, setPoInfo] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchBatches = () => {
    stock.getBatches({
      status: filterStatus === 'all' ? undefined : filterStatus,
      quarantined: filterQuarantine ? 'true' : undefined,
      search: search || undefined,
    })
      .then((res) => {
        setBatches(res.data.batches);
        setSummary(res.data.summary);
      })
      .catch(() => {});
  };

  const refreshSummary = () => {
    stock.getBatches()
      .then((res) => setSummary(res.data.summary))
      .catch(() => {});
  };

  useEffect(() => {
    if (!canView) return;
    stock.getIngredientStock().then((res) => setIngredients(res.data.ingredients)).catch(() => {});
    refreshSummary();
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    fetchBatches();
  }, [canView, filterStatus, filterQuarantine, search]);

  const setEntryField = (patch) => setEntry((prev) => ({ ...prev, ...patch }));

  const verifyOrder = async () => {
    const code = entry.purchase_order_code.trim();
    if (!code) {
      setFeedback({ type: 'error', message: 'Ingresa un número de orden de compra.' });
      return;
    }
    setFeedback(null);
    try {
      const res = await stock.getPurchaseOrder(code);
      setPoInfo(res.data.purchase_order);
      const items = res.data.purchase_order.items || [];
      if (items.length > 0) {
        setEntry((prev) => ({
          ...prev,
          supplier_name: prev.supplier_name || res.data.purchase_order.supplier_name,
          ingredient_id: prev.ingredient_id || String(items[0].ingredient_id),
          quantity: prev.quantity || String(items[0].expected_quantity),
        }));
      }
    } catch (e) {
      setPoInfo(null);
      setFeedback({ type: 'error', message: e.response?.data?.message || 'No se pudo verificar la orden de compra.' });
    }
  };

  const applyExpectedItem = (item) => {
    setEntry((prev) => ({
      ...prev,
      ingredient_id: String(item.ingredient_id),
      quantity: String(item.expected_quantity),
    }));
  };

  const goToQuality = () => {
    if (!entry.ingredient_id || !entry.batch_code || !entry.quantity || !entry.expiration_date) {
      setFeedback({ type: 'error', message: 'Completa insumo, código de lote, cantidad y vencimiento.' });
      return;
    }
    setFeedback(null);
    setStep(2);
  };

  const submitEntry = async () => {
    const allChecked = QUALITY_CHECKS.every((c) => checklist[c.key]);
    if (!allChecked) {
      setFeedback({ type: 'error', message: 'Todos los controles de calidad son obligatorios.' });
      return;
    }
    if (!entry.storage_zone) {
      setFeedback({ type: 'error', message: 'Selecciona la zona de bodega de destino.' });
      return;
    }
    try {
      await stock.createEntry({ ...entry, quality_checklist: checklist });
      setFeedback({ type: 'success', message: 'Entrada registrada correctamente. Lote habilitado en bodega.' });
      setStep(1);
      setEntry(EMPTY_ENTRY);
      setChecklist(EMPTY_CHECKLIST);
      setPoInfo(null);
      refreshSummary();
      fetchBatches();
    } catch (e) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'No se pudo registrar la entrada.' });
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

  const batchColumns = [
    { key: 'batch_code', label: 'Lote' },
    { key: 'ingredient', label: 'Insumo' },
    { key: 'supplier_name', label: 'Proveedor' },
    { key: 'storage_zone', label: 'Zona' },
    { key: 'quantity', label: 'Stock' },
    { key: 'expiration_date', label: 'Vencimiento' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: 'Acciones' },
  ];

  const totalAlerts = (summary?.warning ?? 0) + (summary?.critical ?? 0);

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventario & Stock</h1>
          <p className="text-sm text-slate-500">Ocupación de bodega, trazabilidad FEFO y control sanitario de entradas</p>
        </div>
        <TechBadge label={canWrite ? 'CONTROL DE STOCK BODEGA' : 'SOLO LECTURA'} color={canWrite ? 'lime' : 'slate'} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FreshCard title="Ocupación de Bodega" value={`${summary?.occupancy ?? 0}%`} subtitle={`${summary?.total_quantity ?? 0} de ${summary?.capacity ?? 0} kg·L`} icon="box-seam" color="slate" />
            <FreshCard title="Lotes en Riesgo" value={totalAlerts} subtitle={`${summary?.critical ?? 0} vencidos · ${summary?.warning ?? 0} por vencer`} icon="exclamation-triangle" color="terracotta" />
            <FreshCard title="Quiebre de Stock" value={summary?.rupture?.length ?? 0} subtitle="Insumos sin existencias" icon="slash-circle" color="slate" />
            <FreshCard title="Bajo Mínimo" value={summary?.low_stock?.length ?? 0} subtitle="Requieren reposición" icon="arrow-down-circle" color="lime" />
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FreshCard title="Índice de Rotación" value={`${summary?.rotation_index ?? 0}%`} subtitle="Consumo sobre stock recibido" icon="arrow-repeat" color="cream" />
            <FreshCard title="Índice de Frescura" value={`${summary?.freshness_index ?? 0}%`} subtitle="Lotes óptimos sobre total" icon="shield-check" color="lime" />
            <FreshCard title="Lotes en Cuarentena" value={summary?.quarantined ?? 0} subtitle="Bloqueados por calidad" icon="shield-exclamation" color="terracotta" />
          </div>
        </div>
      )}

      {view === 'lotes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {['all', 'optimal', 'warning', 'critical'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  filterStatus === s ? 'bg-lime-400 text-slate-900' : 'bg-white/60 text-slate-600 hover:bg-white/80'
                }`}
              >
                {s === 'all' ? 'Todos' : s === 'optimal' ? 'Óptimo' : s === 'warning' ? 'Por vencer' : 'Crítico'}
              </button>
            ))}
            <button
              onClick={() => setFilterQuarantine((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                filterQuarantine ? 'bg-red-500 text-white' : 'bg-white/60 text-slate-600 hover:bg-white/80'
              }`}
            >
              <i className="bi bi-shield-slash" aria-hidden="true" />
              En cuarentena
            </button>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lote, QR o proveedor..."
              className="ml-auto px-4 py-2 rounded-xl text-sm border border-slate-200 bg-white w-64 focus:ring-2 focus:ring-lime-400 outline-none"
            />
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-2">
            <i className="bi bi-arrow-down-up" aria-hidden="true" />
            Orden estricto FEFO: el lote que primero vence es el primero en salir
          </p>

          <DynamicTable
            columns={batchColumns}
            data={batches}
            rowClassName={(batch) => (batch.is_quarantined ? 'bg-red-50/70' : '')}
            renderRow={(batch) => (
              <>
                <td className="px-4 py-3">
                  <p className="text-sm font-mono font-semibold text-slate-900">{batch.batch_code}</p>
                  {batch.is_quarantined && <StatusBadge status="quarantined" />}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{batch.ingredient?.name || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{batch.supplier_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{batch.storage_zone || '-'}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{batch.quantity} {batch.ingredient?.unit}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-lime-400" style={{ width: `${Math.min(batch.remaining_percentage ?? 0, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{batch.remaining_percentage ?? 0}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-700">{formatHumanDate(batch.expiration_date)}</p>
                  <p className={`text-[11px] ${batch.days_to_expire < 0 ? 'text-red-600' : batch.days_to_expire <= 7 ? 'text-[#C4622F]' : 'text-slate-400'}`}>
                    {batch.days_to_expire < 0 ? `Venció hace ${Math.abs(batch.days_to_expire)} días` : `Vence en ${batch.days_to_expire} días`}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={batch.is_quarantined ? 'quarantined' : batch.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLabelTarget(batch)}
                      title="Imprimir etiqueta QR"
                      className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all"
                    >
                      <i className="bi bi-qr-code" aria-hidden="true" />
                    </button>
                    {canWrite && (
                      <button
                        onClick={() => { setBlockTarget(batch); setBlockReason(''); }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          batch.is_quarantined ? 'bg-lime-400 hover:bg-lime-500 text-slate-900' : 'bg-red-500/10 hover:bg-red-500/20 text-red-700'
                        }`}
                      >
                        {batch.is_quarantined ? 'Liberar' : 'Bloquear Lote'}
                      </button>
                    )}
                  </div>
                </td>
              </>
            )}
          />

          {batches.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No hay lotes que coincidan con el filtro.</p>
          )}
        </div>
      )}

      {view === 'entradas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-5">
            <div className="flex items-center gap-3">
              {[1, 2].map((n) => (
                <React.Fragment key={n}>
                  <div className={`flex items-center gap-2 ${step >= n ? 'text-slate-900' : 'text-slate-400'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= n ? 'bg-lime-400 text-slate-900' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
                    <span className="text-sm font-semibold">{n === 1 ? 'Datos del Lote' : 'Calidad & Zona'}</span>
                  </div>
                  {n === 1 && <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-lime-400' : 'bg-slate-100'}`} />}
                </React.Fragment>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-cream rounded-2xl border border-slate-200 p-4">
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Cruce con Orden de Compra</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={entry.purchase_order_code}
                      onChange={(e) => setEntryField({ purchase_order_code: e.target.value })}
                      placeholder="Ej: OC-2026-001"
                      className="flex-1 min-w-[200px] px-4 py-2 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none font-mono"
                    />
                    <button onClick={verifyOrder} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                      Verificar OC
                    </button>
                  </div>
                  {poInfo && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-500">Proveedor esperado: <span className="font-semibold text-slate-700">{poInfo.supplier_name}</span></p>
                      {(poInfo.items || []).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => applyExpectedItem(item)}
                          className="w-full flex items-center justify-between bg-white rounded-xl border border-slate-200 px-3 py-2 hover:border-lime-400 transition-all text-left"
                        >
                          <span className="text-sm text-slate-700">{item.ingredient?.name}</span>
                          <span className="text-xs font-semibold text-slate-500">{item.expected_quantity} {item.ingredient?.unit} · prellenar</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Insumo</label>
                    <select
                      value={entry.ingredient_id}
                      onChange={(e) => setEntryField({ ingredient_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Proveedor / Origen</label>
                    <input
                      type="text"
                      value={entry.supplier_name}
                      onChange={(e) => setEntryField({ supplier_name: e.target.value })}
                      placeholder="Ej: Arroz del Valle S.A."
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Código de Lote</label>
                    <input
                      type="text"
                      value={entry.batch_code}
                      onChange={(e) => setEntryField({ batch_code: e.target.value })}
                      placeholder="Ej: BCH-ARR-20250201"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Cantidad Recibida</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.quantity}
                      onChange={(e) => setEntryField({ quantity: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={entry.expiration_date}
                      onChange={(e) => setEntryField({ expiration_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={goToQuality} className="bg-lime-400 hover:bg-lime-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
                    Siguiente: Control de Calidad
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-cream rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900 mb-1">Checklist de Calidad Sanitaria</p>
                  <p className="text-xs text-slate-500 mb-3">Todos los controles son obligatorios. Si alguno falla, la recepción se rechaza.</p>
                  <div className="space-y-2">
                    {QUALITY_CHECKS.map((check) => (
                      <label key={check.key} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist[c.key] }
                          onChange={(e) => setChecklist((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                          className="w-4 h-4 accent-lime-500"
                        />
                        <span className="text-sm text-slate-700">{check.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Zona de Bodega de Destino</label>
                  <select
                    value={entry.storage_zone}
                    onChange={(e) => setEntryField({ storage_zone: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-lime-400 outline-none"
                  >
                    <option value="">Seleccionar zona...</option>
                    {ZONES.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                    Atrás
                  </button>
                  <button
                    onClick={submitEntry}
                    disabled={!QUALITY_CHECKS.every((c) => checklist[c.key]) || !entry.storage_zone}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      QUALITY_CHECKS.every((c) => checklist[c.key]) && entry.storage_zone
                        ? 'bg-lime-400 hover:bg-lime-500 text-slate-900'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Registrar Entrada
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-5 text-white h-fit">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <i className="bi bi-clipboard2-pulse text-lime-400" aria-hidden="true" />
              Resumen de Recepción
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Insumo</p>
                <p>{ingredients.find((i) => String(i.id) === String(entry.ingredient_id))?.name || 'Sin seleccionar'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Lote</p>
                <p className="font-mono">{entry.batch_code || '-'}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Cantidad</p>
                  <p>{entry.quantity || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Zona</p>
                  <p>{entry.storage_zone || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Vence</p>
                <p>{entry.expiration_date ? formatHumanDate(entry.expiration_date) : '-'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Orden de Compra</p>
                <p className="font-mono">{entry.purchase_order_code || 'Sin OC'}</p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 mb-1">Control de Calidad</p>
                <p className={QUALITY_CHECKS.every((c) => checklist[c.key]) ? 'text-lime-400 font-semibold' : 'text-slate-400'}>
                  {QUALITY_CHECKS.filter((c) => checklist[c.key]).length}/{QUALITY_CHECKS.length} controles aprobados
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!blockTarget}
        onClose={() => { setBlockTarget(null); setBlockReason(''); }}
        title={blockTarget?.is_quarantined ? 'Liberar Lote' : 'Bloquear Lote en Cuarentena'}
        footer={
          <>
            <button onClick={() => { setBlockTarget(null); setBlockReason(''); }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button onClick={confirmBlock} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${blockTarget?.is_quarantined ? 'bg-lime-400 hover:bg-lime-500 text-slate-900' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
              {blockTarget?.is_quarantined ? 'Liberar' : 'Bloquear'}
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
              <p className="text-sm text-slate-600">El lote quedará disponible nuevamente para despacho.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">El lote quedará aislado y no se podrá despachar hasta liberarlo.</p>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Motivo de Cuarentena (Obligatorio)</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={3}
                    placeholder="Ej: Empaque roto detectado en inspección visual"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-red-400 outline-none resize-none"
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
