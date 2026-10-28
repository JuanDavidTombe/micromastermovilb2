import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cost } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import { hasModuleAccess, can } from '../constants/roles';
import { formatCOP, formatUnitCOP } from '../utils/currencyFormatter';

const VIEW_META = {
  tablero: {
    title: 'Inicio · Tablero de Cocina',
    desc: 'Supervisión operativa de tandas de producción, recetas y mermas',
    badge: 'SUPERVISIÓN PLANTA',
    color: 'lime',
  },
  recetas: {
    title: 'Fase 1: Catálogo de Recetas (BOM)',
    desc: 'Formulación y estructura de costos: insumos, cantidades netas y merma técnica',
    badge: 'BOM & COSTEO',
    color: 'lime',
  },
  tandas: {
    title: 'Fase 2: Nueva Tanda · Emisión de Orden',
    desc: 'Del software al papel: explosión de insumos y hoja física de alistamiento (Picking)',
    badge: 'ORDEN DE ALISTAMIENTO',
    color: 'lime',
  },
  cierre: {
    title: 'Fase 3: Cierre de Producción',
    desc: 'La ejecución de inventario: consumo real de materias primas y alta de producto terminado',
    badge: 'CIERRE & RENDIMIENTO',
    color: 'terracotta',
  },
  mermas: {
    title: 'Fase 4: Ajuste de Mermas de Planta',
    desc: 'Bajas rápidas de desperdicio diario con teclado fluido (estilo Excel)',
    badge: 'DESPERDICIO DE PLANTA',
    color: 'terracotta',
  },
  simulador: {
    title: 'Simulador de Escala',
    desc: 'Cálculo de costo y rendimiento para tandas masivas',
    badge: 'SIMULADOR DE ESCALA',
    color: 'lime',
  },
  insumos: {
    title: 'Disponibilidad de Insumos',
    desc: 'Check automático de existencias en bodega contra recetas',
    badge: 'DISPONIBILIDAD',
    color: 'slate',
  },
};

const COMMON_WASTE_REASONS = [
  'Contaminación cruzada',
  'Derrame en piso / transporte',
  'Pérdida de frío / temperatura fuera de rango',
  'Recortes / huesos / desposte',
  'Rotura de empaque original',
  'Quemado / sobrecocción',
  'Error de pesaje en marmita',
];

function printProductionOrder(order) {
  const w = window.open('', '_blank', 'width=850,height=900');
  if (!w) {
    alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir la orden de alistamiento.');
    return;
  }
  const dateStr = new Date(order.created_at || Date.now()).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const items = order.bom_snapshot || [];

  w.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Orden de Producción ${order.order_code}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 28px; color: #0f172a; line-height: 1.4; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.1em; }
    .badge { background: #0f172a; color: #fff; padding: 5px 12px; border-radius: 6px; font-family: monospace; font-size: 14px; font-weight: 700; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; }
    .meta-item b { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .meta-item span { font-weight: 700; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 9px 10px; border-bottom: 1px solid #cbd5e1; }
    .box { width: 90px; height: 24px; border: 1.5px dashed #64748b; border-radius: 4px; display: inline-block; background: #fff; }
    .chk { width: 20px; height: 20px; border: 1.5px solid #0f172a; border-radius: 4px; display: inline-block; }
    .notice { font-size: 11px; color: #334155; background: #f1f5f9; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #0f172a; margin-bottom: 24px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 45px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    @media print { body { padding: 15px; } .badge, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">MicroMaster · Planta de Transformación</h1>
      <p class="subtitle">Orden de Producción y Hoja de Alistamiento Físico (Picking de Cocina)</p>
    </div>
    <div class="badge">${order.order_code}</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><b>Receta / Fórmula:</b><span>${order.recipe?.name || 'Receta'}</span></div>
    <div class="meta-item"><b>Meta a Producir:</b><span>${order.target_quantity} ${order.target_unit || 'kg'}</span></div>
    <div class="meta-item"><b>Supervisor Emisor:</b><span>${order.supervisor?.name || 'Supervisor'}</span></div>
    <div class="meta-item"><b>Fecha de Emisión:</b><span>${dateStr}</span></div>
  </div>

  <div class="notice">
    <strong>INSTRUCCIÓN OPERATIVA DE PLANTA:</strong> Entregue esta hoja física al operario de cocina. El operario debe acudir a la bodega con la balanza física, pesar las cantidades requeridas, anotar el valor real pesado y el lote utilizado en las casillas vacías, y devolver esta hoja firmada al supervisor para el cierre de turno.
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th>Insumo Requerido</th>
        <th style="text-align: right; width: 110px;">Cant. Teórica</th>
        <th style="width: 60px;">Unidad</th>
        <th style="text-align: center; width: 120px;">[  ] Peso Real Pesado</th>
        <th style="text-align: center; width: 120px;">[  ] Lote Utilizado</th>
        <th style="text-align: center; width: 50px;">Alistado</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${it.name}</strong></td>
          <td style="text-align: right; font-family: monospace; font-weight: 700;">${it.theoretical_quantity}</td>
          <td>${it.unit}</td>
          <td style="text-align: center;"><div class="box"></div></td>
          <td style="text-align: center;"><div class="box"></div></td>
          <td style="text-align: center;"><div class="chk"></div></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="meta-grid" style="grid-template-columns: 2fr 1fr; margin-top: 15px;">
    <div><b>Observaciones del Proceso de Cocción:</b><div style="height: 40px; border-bottom: 1px dotted #94a3b8;"></div></div>
    <div><b>Rendimiento Final Obtenido:</b><div style="height: 40px; border-bottom: 1px solid #0f172a; text-align: center; font-size: 16px; font-weight: bold; padding-top: 10px;">_______ kg</div></div>
  </div>

  <div class="signatures">
    <div class="sig-line">Firma Operario de Cocina / Pesaje</div>
    <div class="sig-line">Firma Supervisor de Producción</div>
  </div>
</body>
</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

export default function MicroCost({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname === '/cost' ? 'tablero' : location.pathname.split('/')[2] || 'tablero';

  // Catálogos y datos base
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [floorWastes, setFloorWastes] = useState([]);
  const [floorWasteSummary, setFloorWasteSummary] = useState(null);

  // Estados Fase 1: Creación de Receta (BOM)
  const [recipeName, setRecipeName] = useState('');
  const [wastePercentage, setWastePercentage] = useState(10);
  const [bomItems, setBomItems] = useState([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState(null);

  // Estados Fase 2: Nueva Tanda / Emisión de Orden
  const [tandaRecipeId, setTandaRecipeId] = useState('');
  const [tandaTargetKg, setTandaTargetKg] = useState('');
  const [tandaNotes, setTandaNotes] = useState('');
  const [isEmitting, setIsEmitting] = useState(false);

  // Estados Fase 3: Cierre de Producción
  const [selectedOrderForClose, setSelectedOrderForClose] = useState(null);
  const [closeActualKg, setCloseActualKg] = useState('');
  const [closeConsumedItems, setCloseConsumedItems] = useState([]);
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Estados Fase 4: Registro de Mermas de Planta
  const [wasteRows, setWasteRows] = useState([
    { id: 1, ingredient_id: '', quantity: '', unit: 'kg', reason: 'Contaminación cruzada', notes: '' },
    { id: 2, ingredient_id: '', quantity: '', unit: 'litro', reason: 'Derrame en piso / transporte', notes: '' },
    { id: 3, ingredient_id: '', quantity: '', unit: 'kg', reason: 'Recortes / huesos / desposte', notes: '' },
  ]);
  const [isSubmittingWaste, setIsSubmittingWaste] = useState(false);

  // Estados de simulación libre
  const [simulation, setSimulation] = useState(null);
  const [simQuantity, setSimQuantity] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Notificaciones y feedback
  const [formError, setFormError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const canAccess = hasModuleAccess(role, 'recipes_production');
  const canCreate = can(role, 'create');

  const searchInputRef = useRef(null);

  const fetchBaseData = () => {
    if (!canAccess) return;
    cost.getRecipes().then((res) => setRecipes(res.data.recipes || [])).catch(() => {});
    cost.getIngredients().then((res) => setIngredients(res.data.ingredients || [])).catch(() => {});
    cost.getProductionOrders().then((res) => setProductionOrders(res.data.orders || [])).catch(() => {});
    cost.getFloorWastes().then((res) => {
      setFloorWastes(res.data.wastes || []);
      setFloorWasteSummary(res.data.summary || null);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchBaseData();
  }, [canAccess]);

  // Limpiar mensajes tras 4s
  useEffect(() => {
    if (savedMsg) {
      const t = setTimeout(() => setSavedMsg(''), 4500);
      return () => clearTimeout(t);
    }
  }, [savedMsg]);

  // ------------------------------------------------------------------
  //  CÁLCULOS REACTIVOS EN FASE 1 (BOM FORMULACIÓN)
  // ------------------------------------------------------------------
  const filteredSearchIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return [];
    const term = ingredientSearch.toLowerCase();
    return ingredients.filter(
      (ing) => ing.name.toLowerCase().includes(term) && !bomItems.some((b) => b.ingredient_id === ing.id)
    ).slice(0, 8);
  }, [ingredientSearch, ingredients, bomItems]);

  const addIngredientToBom = (ing) => {
    setBomItems([
      ...bomItems,
      {
        ingredient_id: ing.id,
        name: ing.name,
        unit: ing.unit || 'kg',
        unit_cost: Number(ing.cost_per_unit || 0),
        quantity: 1, // cantidad neta inicial sugerida
      },
    ]);
    setIngredientSearch('');
    setIsSearchOpen(false);
  };

  const updateBomItem = (index, field, value) => {
    const updated = [...bomItems];
    updated[index] = { ...updated[index], [field]: value };
    setBomItems(updated);
  };

  const removeBomItem = (index) => {
    setBomItems(bomItems.filter((_, idx) => idx !== index));
  };

  // Costeo teórico en tiempo real (en milisegundos)
  const theoreticalBomSummary = useMemo(() => {
    let totalWeight = 0;
    let baseCost = 0;

    bomItems.forEach((item) => {
      const q = parseFloat(item.quantity) || 0;
      const c = parseFloat(item.unit_cost) || 0;
      totalWeight += q;
      baseCost += q * c;
    });

    const wastePct = parseFloat(wastePercentage) || 0;
    const wasteImpact = baseCost * (wastePct / 100);
    const totalCost = baseCost + wasteImpact;
    const costPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;

    return {
      totalWeight: round2(totalWeight),
      baseCost: round2(baseCost),
      wasteImpact: round2(wasteImpact),
      totalCost: round2(totalCost),
      costPerKg: round2(costPerKg),
    };
  }, [bomItems, wastePercentage]);

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  // Guardar receta Fase 1
  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setFormError('');

    if (!recipeName.trim()) {
      setFormError('Ingresa el nombre oficial de la receta.');
      return;
    }
    if (bomItems.length === 0) {
      setFormError('La fórmula debe contener al menos un insumo en el BOM.');
      return;
    }
    if (bomItems.some((i) => !i.quantity || parseFloat(i.quantity) <= 0)) {
      setFormError('Digita una cantidad neta válida para cada insumo de la receta.');
      return;
    }

    try {
      const payload = {
        name: recipeName.trim(),
        waste_percentage: parseFloat(wastePercentage) || 0,
        ingredients: bomItems.map((item) => ({
          ingredient_id: item.ingredient_id,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_cost: item.unit_cost,
        })),
      };

      const res = await cost.createRecipe(payload);
      setRecipes([res.data.recipe, ...recipes]);
      setRecipeName('');
      setWastePercentage(10);
      setBomItems([]);
      setSavedMsg(`Receta «${res.data.recipe.name}» formulada y guardada con éxito en la base de datos.`);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar la receta en el servidor.');
    }
  };

  // ------------------------------------------------------------------
  //  FASE 2: NUEVA TANDA & EMISIÓN DE ORDEN FÍSICA
  // ------------------------------------------------------------------
  const selectedTandaRecipe = useMemo(() => {
    return recipes.find((r) => r.id === parseInt(tandaRecipeId));
  }, [tandaRecipeId, recipes]);

  const explodedTandaBom = useMemo(() => {
    if (!selectedTandaRecipe || !tandaTargetKg || parseFloat(tandaTargetKg) <= 0) return null;
    const target = parseFloat(tandaTargetKg);
    const baseQuantity = Math.max(
      selectedTandaRecipe.ingredients?.reduce((acc, i) => acc + (parseFloat(i.pivot?.quantity) || 0), 0) || 1,
      0.001
    );
    const scaleFactor = target / baseQuantity;

    const items = (selectedTandaRecipe.ingredients || []).map((ing) => {
      const baseQty = parseFloat(ing.pivot?.quantity) || 0;
      const scaledQty = round2(baseQty * scaleFactor);
      const unitCost = parseFloat(ing.pivot?.unit_cost || ing.cost_per_unit || 0);
      const subtotal = round2(scaledQty * unitCost);

      return {
        ingredient_id: ing.id,
        name: ing.name,
        unit: ing.pivot?.unit || ing.unit,
        theoretical_quantity: scaledQty,
        unit_cost: unitCost,
        subtotal,
      };
    });

    const baseCost = items.reduce((acc, i) => acc + i.subtotal, 0);
    const wasteVal = baseCost * ((parseFloat(selectedTandaRecipe.waste_percentage) || 0) / 100);
    const totalCost = baseCost + wasteVal;

    return {
      items,
      scaleFactor: round2(scaleFactor),
      baseCost: round2(baseCost),
      wasteVal: round2(wasteVal),
      totalCost: round2(totalCost),
      costPerKg: round2(totalCost / target),
    };
  }, [selectedTandaRecipe, tandaTargetKg]);

  const handleEmitProductionOrder = async () => {
    if (!selectedTandaRecipe || !tandaTargetKg) return;
    setIsEmitting(true);
    setFormError('');
    try {
      const res = await cost.createProductionOrder({
        recipe_id: selectedTandaRecipe.id,
        target_quantity: parseFloat(tandaTargetKg),
        notes: tandaNotes.trim() || undefined,
      });

      const newOrder = res.data.order;
      setProductionOrders([newOrder, ...productionOrders]);
      setTandaRecipeId('');
      setTandaTargetKg('');
      setTandaNotes('');
      setSavedMsg(`Orden ${newOrder.order_code} emitida correctamente. El software queda en pausa esperando el cierre de turno.`);

      // Imprimir automáticamente la orden física de alistamiento
      printProductionOrder(newOrder);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al emitir la orden de producción.');
    } finally {
      setIsEmitting(false);
    }
  };

  // ------------------------------------------------------------------
  //  FASE 3: CIERRE DE PRODUCCIÓN (EJECUCIÓN DE INVENTARIO)
  // ------------------------------------------------------------------
  const activeOrdersForClose = useMemo(() => {
    return productionOrders.filter((o) => o.status === 'in_progress');
  }, [productionOrders]);

  const handleSelectOrderToClose = (order) => {
    setSelectedOrderForClose(order);
    setCloseActualKg(order.target_quantity); // sugerir meta inicial
    // Precargar insumos teóricos como base editable
    const initialConsumed = (order.bom_snapshot || []).map((it) => ({
      ingredient_id: it.ingredient_id,
      name: it.name,
      unit: it.unit,
      theoretical_quantity: it.theoretical_quantity,
      actual_quantity: it.theoretical_quantity, // precargado pero editable
      unit_cost: it.unit_cost,
    }));
    setCloseConsumedItems(initialConsumed);
    setCloseNotes('');
  };

  const updateCloseConsumedQty = (index, value) => {
    const updated = [...closeConsumedItems];
    updated[index].actual_quantity = value;
    setCloseConsumedItems(updated);
  };

  const closeFinancials = useMemo(() => {
    let totalRealCost = 0;
    closeConsumedItems.forEach((it) => {
      const q = parseFloat(it.actual_quantity) || 0;
      const c = parseFloat(it.unit_cost) || 0;
      totalRealCost += q * c;
    });

    const actualYield = parseFloat(closeActualKg) || 0;
    const realUnitCost = actualYield > 0 ? totalRealCost / actualYield : 0;

    return {
      totalRealCost: round2(totalRealCost),
      realUnitCost: round2(realUnitCost),
    };
  }, [closeConsumedItems, closeActualKg]);

  const handleExecuteCloseProduction = async () => {
    if (!selectedOrderForClose || !closeActualKg) return;
    if (parseFloat(closeActualKg) <= 0) {
      setFormError('Digita una cantidad válida de producto terminado obtenido.');
      return;
    }

    setIsClosing(true);
    setFormError('');
    try {
      const payload = {
        actual_quantity: parseFloat(closeActualKg),
        consumed_items: closeConsumedItems.map((it) => ({
          ingredient_id: it.ingredient_id,
          actual_quantity: parseFloat(it.actual_quantity) || 0,
          theoretical_quantity: parseFloat(it.theoretical_quantity) || 0,
          unit: it.unit,
        })),
        notes: closeNotes.trim() || undefined,
      };

      const res = await cost.closeProductionOrder(selectedOrderForClose.id, payload);
      const updatedOrder = res.data.order;

      setProductionOrders(productionOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
      setSelectedOrderForClose(null);
      setCloseConsumedItems([]);
      setCloseActualKg('');
      setSavedMsg(res.data.message);

      // Recargar existencias de ingredientes
      cost.getIngredients().then((r) => setIngredients(r.data.ingredients || [])).catch(() => {});
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al ejecutar el cierre de producción.');
    } finally {
      setIsClosing(false);
    }
  };

  // ------------------------------------------------------------------
  //  FASE 4: REGISTRO DE MERMAS DE PLANTA (TIPO EXCEL)
  // ------------------------------------------------------------------
  const addWasteRow = () => {
    setWasteRows([
      ...wasteRows,
      { id: Date.now(), ingredient_id: '', quantity: '', unit: 'kg', reason: 'Derrame en piso / transporte', notes: '' },
    ]);
  };

  const removeWasteRow = (index) => {
    if (wasteRows.length <= 1) return;
    setWasteRows(wasteRows.filter((_, idx) => idx !== index));
  };

  const updateWasteRow = (index, field, value) => {
    const updated = [...wasteRows];
    updated[index] = { ...updated[index], [field]: value };

    // Si cambia el insumo, precargar unidad
    if (field === 'ingredient_id') {
      const found = ingredients.find((i) => i.id === parseInt(value));
      if (found) {
        updated[index].unit = found.unit || 'kg';
      }
    }

    setWasteRows(updated);
  };

  const totalWasteLoss = useMemo(() => {
    return wasteRows.reduce((acc, row) => {
      const ing = ingredients.find((i) => i.id === parseInt(row.ingredient_id));
      const qty = parseFloat(row.quantity) || 0;
      const costPerUnit = parseFloat(ing?.cost_per_unit || 0);
      return acc + (qty * costPerUnit);
    }, 0);
  }, [wasteRows, ingredients]);

  const handleApplyFloorWaste = async () => {
    const validRows = wasteRows.filter((r) => r.ingredient_id && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      setFormError('Digita al menos un insumo con cantidad válida para aplicar la baja de merma.');
      return;
    }

    setIsSubmittingWaste(true);
    setFormError('');
    try {
      const res = await cost.storeFloorWaste({
        wastes: validRows.map((r) => ({
          ingredient_id: parseInt(r.ingredient_id),
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          reason: r.reason,
          notes: r.notes || undefined,
        })),
      });

      setSavedMsg(res.data.message);
      setWasteRows([
        { id: Date.now(), ingredient_id: '', quantity: '', unit: 'kg', reason: 'Contaminación cruzada', notes: '' },
        { id: Date.now() + 1, ingredient_id: '', quantity: '', unit: 'litro', reason: 'Derrame en piso / transporte', notes: '' },
      ]);

      // Refrescar lista de mermas e ingredientes
      cost.getFloorWastes().then((r) => {
        setFloorWastes(r.data.wastes || []);
        setFloorWasteSummary(r.data.summary || null);
      }).catch(() => {});
      cost.getIngredients().then((r) => setIngredients(r.data.ingredients || [])).catch(() => {});
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al aplicar las bajas de merma en el inventario.');
    } finally {
      setIsSubmittingWaste(false);
    }
  };

  // Simulación libre
  const handleSimulate = async () => {
    if (!selectedRecipe || !simQuantity) return;
    try {
      const res = await cost.simulateScale({
        recipe_id: selectedRecipe.id,
        quantity_kg: parseFloat(simQuantity),
      });
      setSimulation(res.data);
    } catch (e) {}
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4"><i className="bi bi-lock-fill" aria-hidden="true" /></div>
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder al módulo de Producción.</p>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[view] || VIEW_META.tablero;
  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none bg-white transition-all';
  const labelClass = 'text-xs uppercase tracking-wider text-slate-500 mb-1 block font-semibold';

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-10">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-xs sm:text-sm text-slate-500">{meta.desc}</p>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          <TechBadge label={meta.badge} color={meta.color} />
        </div>
      </div>

      {/* Alertas y Feedback */}
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm flex items-center gap-2 animate-slide-up">
          <i className="bi bi-exclamation-octagon-fill text-lg shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}
      {savedMsg && (
        <div className="p-4 bg-lime-50 border border-lime-300 text-lime-900 rounded-2xl text-sm flex items-center gap-2 animate-slide-up">
          <i className="bi bi-check-circle-fill text-lg text-[#3F5600] shrink-0" aria-hidden="true" />
          <span className="font-semibold">{savedMsg}</span>
        </div>
      )}

      {/* ================================================================== */}
      {/* VISTA 0: TABLERO DE COCINA (RESUMEN OPERATIVO)                     */}
      {/* ================================================================== */}
      {view === 'tablero' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
            <FreshCard title="Recetas Formuladas" value={recipes.length} subtitle="Fórmulas con BOM" icon="clipboard-data" color="lime" />
            <FreshCard title="Tandas Activas" value={activeOrdersForClose.length} subtitle="En proceso en cocina" icon="fire" color="terracotta" />
            <FreshCard title="Tandas Cerradas" value={productionOrders.filter((o) => o.status === 'completed').length} subtitle="Terminadas hoy" icon="check2-all" color="lime" />
            <FreshCard title="Mermas de Planta" value={formatCOP(floorWasteSummary?.today_total_cost || 0)} subtitle="Bajas registradas hoy" icon="trash3" color="slate" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tandas en Curso */}
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2">
                  <i className="bi bi-clock-history text-amber-500" /> Tandas Activas en Cocina ({activeOrdersForClose.length})
                </h2>
                <button
                  onClick={() => navigate('/cost/tandas')}
                  className="text-xs font-bold text-lime-600 hover:text-lime-700 flex items-center gap-1"
                >
                  <i className="bi bi-plus-circle" /> Nueva Tanda
                </button>
              </div>

              <div className="space-y-3">
                {activeOrdersForClose.map((order) => (
                  <div key={order.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border">
                          {order.order_code}
                        </span>
                        <p className="font-bold text-slate-900 text-sm mt-1">{order.recipe?.name}</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Meta: {order.target_quantity} {order.target_unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs">
                      <span className="text-slate-500">Costo Teórico: {formatCOP(order.theoretical_cost)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => printProductionOrder(order)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 flex items-center gap-1"
                        >
                          <i className="bi bi-printer" /> Re-imprimir
                        </button>
                        <button
                          onClick={() => {
                            handleSelectOrderToClose(order);
                            navigate('/cost/cierre');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 flex items-center gap-1"
                        >
                          <i className="bi bi-check2" /> Cerrar Tanda
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {activeOrdersForClose.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No hay tandas en proceso en este momento.</p>
                )}
              </div>
            </div>

            {/* Recetas Destacadas con BOM */}
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2">
                  <i className="bi bi-egg-fried text-lime-600" /> Catálogo Rápido de Recetas
                </h2>
                <button
                  onClick={() => navigate('/cost/recetas')}
                  className="text-xs font-bold text-lime-600 hover:text-lime-700 flex items-center gap-1"
                >
                  <i className="bi bi-sliders" /> Ver Todas / Formular
                </button>
              </div>

              <div className="space-y-3">
                {recipes.slice(0, 4).map((recipe) => (
                  <div key={recipe.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white/60 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{recipe.name}</p>
                      <p className="text-xs text-slate-500">
                        Merma: {recipe.waste_percentage}% · {recipe.ingredients?.length || 0} insumos
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-lime-400/20 text-[#2D3F00] px-2.5 py-1 rounded-lg border border-lime-300 whitespace-nowrap">
                      {formatCOP(recipe.total_cost || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FASE 1: FORMULACIÓN DE LA RECETA (BOM SIN CHECKBOXES)              */}
      {/* ================================================================== */}
      {view === 'recetas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Derecha / Formulario de Creación (BOM) */}
          <div className="lg:col-span-7 bg-white/90 rounded-3xl border border-slate-200 p-5 md:p-6 space-y-5 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="bi bi-pencil-square text-lime-600" /> Formulación de la Receta (BOM)
              </h2>
              <p className="text-xs text-slate-500">
                Estructura de costos matemáticos. Digita las cantidades netas requeridas y la merma esperada.
              </p>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div>
                <label className={labelClass}>Nombre de la Receta / Producto</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Ej: Pollo con Soya Especial"
                  className={inputClass}
                  disabled={!canCreate}
                />
              </div>

              {/* Buscador Predictivo (Sin checkboxes) */}
              <div className="relative">
                <label className={labelClass}>Buscador Predictivo de Insumos</label>
                <div className="relative">
                  <i className="bi bi-search absolute left-3.5 top-3 text-slate-400 text-sm" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={ingredientSearch}
                    onChange={(e) => {
                      setIngredientSearch(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Escribe el nombre del insumo (ej: Cebolla, Pollo, Arroz)..."
                    className={`${inputClass} pl-10`}
                    disabled={!canCreate}
                  />
                </div>

                {/* Dropdown Predictivo */}
                {isSearchOpen && filteredSearchIngredients.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-slide-up">
                    {filteredSearchIngredients.map((ing) => (
                      <button
                        type="button"
                        key={ing.id}
                        onClick={() => addIngredientToBom(ing)}
                        className="w-full text-left px-4 py-2.5 hover:bg-lime-50/80 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{ing.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Unidad: {ing.unit}</p>
                        </div>
                        <span className="font-mono font-bold text-lime-700 bg-lime-100 px-2 py-0.5 rounded">
                          {formatUnitCOP(ing.cost_per_unit, ing.unit)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla Dinámica del BOM */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Insumos en la Fórmula ({bomItems.length})</label>
                  <span className="text-[11px] text-slate-400">Cantidad Neta y Unidad Exacta</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {bomItems.map((item, index) => {
                    const lineSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
                    return (
                      <div key={item.ingredient_id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500">
                              {formatUnitCOP(item.unit_cost, item.unit)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeBomItem(index)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Remover insumo"
                            >
                              <i className="bi bi-trash3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Cantidad Neta</label>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={item.quantity}
                              onChange={(e) => updateBomItem(index, 'quantity', e.target.value)}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-lime-400"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Unidad</label>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => updateBomItem(index, 'unit', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none"
                            />
                          </div>
                          <div className="col-span-4 text-right">
                            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Subtotal</label>
                            <span className="text-xs font-mono font-bold text-slate-900">
                              {formatCOP(lineSubtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {bomItems.length === 0 && (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                      Usa el buscador predictivo arriba para agregar los insumos de esta receta.
                    </div>
                  )}
                </div>
              </div>

              {/* Merma Técnica y Resumen de Costeo Instantáneo */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className={labelClass}>% Merma Cocción / Limpieza</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={wastePercentage}
                        onChange={(e) => setWastePercentage(e.target.value)}
                        className={`${inputClass} font-bold`}
                      />
                      <span className="text-sm font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="bg-lime-50/70 border border-lime-200 p-3 rounded-2xl text-right">
                    <p className="text-[10px] uppercase font-bold text-[#3F5600] tracking-wider">Costo Teórico / kg</p>
                    <p className="text-xl font-black text-[#2D3F00] font-mono">
                      {formatCOP(theoreticalBomSummary.costPerKg)} / kg
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Peso Base: {theoreticalBomSummary.totalWeight} kg · Total: {formatCOP(theoreticalBomSummary.totalCost)}
                    </p>
                  </div>
                </div>

                {canCreate && (
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-slate-900 text-lime-400 font-bold text-sm hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <i className="bi bi-save2" /> Guardar Formulación de Receta (BOM)
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Columna Izquierda / Catálogo de Recetas Existentes */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold">
                  Catálogo de Recetas ({recipes.length})
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">Costeo estándar</span>
              </div>

              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {recipes.map((recipe) => {
                  const check = recipe.stock_check;
                  const enough = check?.sufficient;
                  const isExpanded = expandedRecipeId === recipe.id;

                  return (
                    <div key={recipe.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-base">{recipe.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs font-mono font-bold bg-lime-400/20 text-[#2D3F00] px-2 py-0.5 rounded border border-lime-300">
                              {formatCOP(recipe.total_cost || 0)}
                            </span>
                            <span className="text-xs text-slate-500">
                              Merma: {recipe.waste_percentage}% · {recipe.ingredients?.length || 0} insumos
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${enough ? 'bg-lime-50 border-lime-300 text-[#3F5600]' : 'bg-red-50 border-red-300 text-[#A44B1F]'}`}>
                          {enough ? 'Con stock' : 'Faltan insumos'}
                        </span>
                      </div>

                      {/* Botón para expandir estructura BOM */}
                      <div>
                        <button
                          onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all"
                        >
                          <i className={`bi bi-${isExpanded ? 'chevron-up' : 'chevron-down'}`} />
                          {isExpanded ? 'Ocultar Estructura' : 'Ver Impacto de Insumos (BOM)'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-slide-up space-y-2">
                            <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
                              Estructura de Insumos (BOM)
                            </p>
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase">
                                  <th className="pb-1">Insumo</th>
                                  <th className="pb-1">Cant.</th>
                                  <th className="pb-1">Costo Unit.</th>
                                  <th className="pb-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(recipe.ingredients || []).map((ing) => {
                                  const q = parseFloat(ing.pivot?.quantity) || 0;
                                  const c = parseFloat(ing.pivot?.unit_cost || ing.cost_per_unit || 0);
                                  return (
                                    <tr key={ing.id} className="text-slate-700">
                                      <td className="py-1 font-medium">{ing.name}</td>
                                      <td className="py-1">{q} {ing.pivot?.unit || ing.unit}</td>
                                      <td className="py-1 font-mono text-[11px]">{formatUnitCOP(c, ing.unit)}</td>
                                      <td className="py-1 font-mono font-bold text-right">{formatCOP(q * c)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Merma ({recipe.waste_percentage}%): +{formatCOP((recipe.total_cost || 0) * (recipe.waste_percentage / 100))}</span>
                              <span className="font-bold text-slate-900">Total: {formatCOP(recipe.total_cost || 0, true)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FASE 2: EMISIÓN DE LA ORDEN (DEL SOFTWARE AL PAPEL)                */}
      {/* ================================================================== */}
      {view === 'tandas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white/90 rounded-3xl border border-slate-200 p-5 md:p-6 space-y-5 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="bi bi-printer text-lime-600" /> Emisión de Orden de Producción (Alistamiento Físico)
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona la receta y la meta del día. El sistema verifica el stock e imprime la hoja física para el operario de cocina.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Receta a Producir</label>
                <select
                  value={tandaRecipeId}
                  onChange={(e) => setTandaRecipeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona una receta del catálogo...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Merma: {r.waste_percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Meta de Producción del Día (kg / Litros)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={tandaTargetKg}
                  onChange={(e) => setTandaTargetKg(e.target.value)}
                  placeholder="Ej: 200"
                  className={`${inputClass} text-base font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>Instrucciones Operativas / Notas de Turno (Opcional)</label>
                <textarea
                  rows="2"
                  value={tandaNotes}
                  onChange={(e) => setTandaNotes(e.target.value)}
                  placeholder="Ej: Cocinar en marmita principal #2. Despachar a bodega de enfriamiento antes de las 16:00."
                  className={inputClass}
                />
              </div>

              {/* Explosión y Verificación de Insumos */}
              {explodedTandaBom && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Explosión de Insumos para {tandaTargetKg} kg
                    </h3>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      Costo Teórico: {formatCOP(explodedTandaBom.totalCost)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase">
                          <th className="pb-1.5">Insumo</th>
                          <th className="pb-1.5">Cant. Requerida</th>
                          <th className="pb-1.5">Unidad</th>
                          <th className="pb-1.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {explodedTandaBom.items.map((it) => (
                          <tr key={it.ingredient_id} className="text-slate-800">
                            <td className="py-2 font-semibold">{it.name}</td>
                            <td className="py-2 font-mono font-bold">{it.theoretical_quantity}</td>
                            <td className="py-2 text-slate-500">{it.unit}</td>
                            <td className="py-2 font-mono text-right font-semibold">{formatCOP(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Botón de Emisión e Impresión */}
                  <div className="pt-2">
                    <button
                      onClick={handleEmitProductionOrder}
                      disabled={isEmitting}
                      className="w-full py-3.5 rounded-xl bg-lime-400 hover:bg-lime-500 text-slate-900 font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <i className="bi bi-printer-fill text-lg" />
                      {isEmitting ? 'Emitiendo e Imprimiendo...' : 'Imprimir Orden de Alistamiento'}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                      El software quedará en pausa. El operario recibe la hoja física para pesar y cocinar.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha / Historial de Tandas Emitidas */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2">
                <i className="bi bi-journal-text" /> Órdenes Emitidas ({productionOrders.length})
              </h2>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {productionOrders.map((order) => (
                  <div key={order.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {order.order_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${order.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {order.status === 'in_progress' ? 'En Cocina' : 'Cerrada'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{order.recipe?.name}</p>
                        <p className="text-slate-500">Meta: {order.target_quantity} {order.target_unit}</p>
                      </div>
                      <button
                        onClick={() => printProductionOrder(order)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                        title="Reimprimir hoja física"
                      >
                        <i className="bi bi-printer" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FASE 3: CIERRE DE PRODUCCIÓN (EJECUCIÓN DE INVENTARIO)              */}
      {/* ================================================================== */}
      {view === 'cierre' && (
        <div className="space-y-5">
          {!selectedOrderForClose ? (
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="bi bi-check2-square text-amber-500" /> Selecciona una Tanda para Cierre de Turno
                </h2>
                <p className="text-xs text-slate-500">
                  Selecciona la orden cuando el operario devuelva la hoja física con las anotaciones reales de pesaje y rendimiento.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeOrdersForClose.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrderToClose(order)}
                    className="p-4 rounded-2xl border-2 border-slate-200 hover:border-lime-400 bg-white cursor-pointer transition-all hover:shadow-md space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold bg-slate-900 text-lime-400 px-2.5 py-0.5 rounded-md">
                        {order.order_code}
                      </span>
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <i className="bi bi-hourglass-split" /> En Cocina
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 text-base">{order.recipe?.name}</p>
                      <p className="text-xs text-slate-500">Meta Planificada: {order.target_quantity} {order.target_unit}</p>
                      <p className="text-xs text-slate-500">Costo Teórico: {formatCOP(order.theoretical_cost)}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Emisión: {order.created_at?.slice(0, 10)}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        Transcribir Hoja <i className="bi bi-arrow-right" />
                      </span>
                    </div>
                  </div>
                ))}
                {activeOrdersForClose.length === 0 && (
                  <p className="text-sm text-slate-400 col-span-full text-center py-10">
                    No hay tandas pendientes de cierre en este momento. Puedes emitir una nueva en «Nueva Tanda».
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Pantalla Crítica de Cierre */
            <div className="bg-white/90 rounded-3xl border-2 border-slate-900 p-5 md:p-6 space-y-5 shadow-xl animate-slide-up">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-black bg-slate-900 text-lime-400 px-3 py-1 rounded-lg">
                      {selectedOrderForClose.order_code}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">
                      Cierre de Producción: {selectedOrderForClose.recipe?.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Transcribe exactamente lo que anotó el operario en el papel. El backend ejecutará la transacción de inventario.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedOrderForClose(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <i className="bi bi-x-lg mr-1" /> Cancelar Cierre
                </button>
              </div>

              {/* Insumos Consumidos (Campos 100% Editables) */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
                  <i className="bi bi-pencil" /> 1. Insumos Consumidos Reales (Transcripción del Papel)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50">
                        <th className="py-2.5 px-3">Insumo</th>
                        <th className="py-2.5 px-3">Plan Teórico</th>
                        <th className="py-2.5 px-3 bg-amber-50 text-amber-900">Cantidad Real Consumida (Papel)</th>
                        <th className="py-2.5 px-3">Costo Unitario (COP)</th>
                        <th className="py-2.5 px-3 text-right">Subtotal Real</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {closeConsumedItems.map((item, idx) => {
                        const lineSubtotal = (parseFloat(item.actual_quantity) || 0) * (parseFloat(item.unit_cost) || 0);
                        const isDifferent = parseFloat(item.actual_quantity) !== parseFloat(item.theoretical_quantity);

                        return (
                          <tr key={item.ingredient_id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-semibold text-slate-800">{item.name}</td>
                            <td className="py-3 px-3 text-slate-500 font-mono">
                              {item.theoretical_quantity} {item.unit}
                            </td>
                            <td className="py-2 px-3 bg-amber-50/60">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.actual_quantity}
                                  onChange={(e) => updateCloseConsumedQty(idx, e.target.value)}
                                  className="w-32 px-3 py-1.5 rounded-lg border border-amber-300 font-mono font-bold text-slate-900 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                                {isDifferent && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                    Ajustado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-slate-600">
                              {formatUnitCOP(item.unit_cost, item.unit)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-right text-slate-900">
                              {formatCOP(lineSubtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Producto Terminado Obtenido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-cream border border-slate-200">
                <div>
                  <label className="text-xs uppercase font-bold text-slate-700 block mb-1">
                    2. Producto Terminado Obtenido (Rendimiento Real)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={closeActualKg}
                      onChange={(e) => setCloseActualKg(e.target.value)}
                      placeholder="Ej: 192"
                      className="w-48 px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-black text-xl text-slate-900 bg-white outline-none focus:ring-2 focus:ring-lime-400"
                    />
                    <span className="text-base font-bold text-slate-700">kg de Producto Terminado</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cantidad pesada que salió efectivamente de marmitas / hornos.
                  </p>
                </div>

                <div className="space-y-1 text-right">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Resumen Económico Real</p>
                  <p className="text-sm font-semibold text-slate-800">
                    Costo Total Consumido: <span className="font-mono font-bold">{formatCOP(closeFinancials.totalRealCost)}</span>
                  </p>
                  <p className="text-xl font-black text-[#2D3F00] font-mono">
                    Costo Real: {formatCOP(closeFinancials.realUnitCost)} / kg
                  </p>
                </div>
              </div>

              {/* Notas de Cierre */}
              <div>
                <label className={labelClass}>Observaciones del Cierre de Producción</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Se derramó 1 kg de arroz en preparación; el rendimiento de carne fue óptimo según el papel."
                  className={inputClass}
                />
              </div>

              {/* Botón de Ejecución Crítico */}
              <div className="pt-3 border-t border-slate-200">
                <button
                  onClick={handleExecuteCloseProduction}
                  disabled={isClosing}
                  className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-lime-400 font-black text-base transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <i className="bi bi-shield-check text-xl" />
                  {isClosing ? 'Ejecutando Transacción en Base de Datos...' : 'Cerrar Producción y Actualizar Inventario (DB::transaction)'}
                </button>
                <p className="text-center text-[11px] text-slate-400 mt-2">
                  Descuenta materias primas por FEFO, calcula el costo unitario real e ingresa el producto terminado al inventario.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* FASE 4: AJUSTE DE MERMAS DE PLANTA (TIPO EXCEL CON TECLA TAB)      */}
      {/* ================================================================== */}
      {view === 'mermas' && (
        <div className="space-y-5">
          <div className="bg-white/90 rounded-3xl border border-slate-200 p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="bi bi-trash3 text-rose-600" /> Registro Diario de Mermas de Planta
                </h2>
                <p className="text-xs text-slate-500">
                  Desperdicio físico (huesos, recortes, contaminación, caídas). Navega entre casillas en ráfaga con la tecla Tab.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addWasteRow}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <i className="bi bi-plus-lg" /> Agregar Fila
                </button>
              </div>
            </div>

            {/* Tabla Estilo Hoja de Cálculo Excel */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3 w-72">Insumo a Dar de Baja</th>
                    <th className="py-2.5 px-3 w-32">Cantidad Pesada</th>
                    <th className="py-2.5 px-3 w-28">Unidad</th>
                    <th className="py-2.5 px-3">Motivo de Merma</th>
                    <th className="py-2.5 px-3 text-right w-36">Impacto (COP)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {wasteRows.map((row, idx) => {
                    const ing = ingredients.find((i) => i.id === parseInt(row.ingredient_id));
                    const costPerUnit = parseFloat(ing?.cost_per_unit || 0);
                    const qty = parseFloat(row.quantity) || 0;
                    const rowCost = qty * costPerUnit;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-xs text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <select
                            value={row.ingredient_id}
                            onChange={(e) => updateWasteRow(idx, 'ingredient_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          >
                            <option value="">Selecciona insumo...</option>
                            {ingredients.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({formatUnitCOP(i.cost_per_unit, i.unit)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={row.quantity}
                            onChange={(e) => updateWasteRow(idx, 'quantity', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateWasteRow(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            list={`reasons-${row.id}`}
                            type="text"
                            value={row.reason}
                            onChange={(e) => updateWasteRow(idx, 'reason', e.target.value)}
                            placeholder="Motivo de merma..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                          />
                          <datalist id={`reasons-${row.id}`}>
                            {COMMON_WASTE_REASONS.map((r) => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-right text-xs text-rose-600">
                          {formatCOP(rowCost)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeWasteRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                            title="Eliminar fila"
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase text-xs text-slate-600">
                      Pérdida Económica Total a Dar de Baja:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-base text-rose-700">
                      {formatCOP(totalWasteLoss)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Botón Acción Principal */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Pesa las canecas al final del turno y aplica las bajas de golpe para mantener los balances financieros exactos.
              </span>
              <button
                type="button"
                onClick={handleApplyFloorWaste}
                disabled={isSubmittingWaste}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                <i className="bi bi-lightning-charge-fill" />
                {isSubmittingWaste ? 'Aplicando Bajas...' : 'Aplicar Bajas de Merma de Planta'}
              </button>
            </div>
          </div>

          {/* Historial de Mermas Registradas */}
          <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-2">
              <i className="bi bi-clock-history" /> Auditoría de Mermas de Planta Recientes ({floorWastes.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-3">Fecha / Hora</th>
                    <th className="py-2 px-3">Insumo</th>
                    <th className="py-2 px-3">Cantidad</th>
                    <th className="py-2 px-3">Motivo</th>
                    <th className="py-2 px-3">Registrado Por</th>
                    <th className="py-2 px-3 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {floorWastes.map((fw) => (
                    <tr key={fw.id} className="text-slate-700">
                      <td className="py-2 px-3 font-mono">{fw.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{fw.ingredient?.name || '-'}</td>
                      <td className="py-2 px-3 font-mono">{fw.quantity} {fw.unit}</td>
                      <td className="py-2 px-3">{fw.reason}</td>
                      <td className="py-2 px-3 text-slate-500">{fw.user?.name || 'Supervisor'}</td>
                      <td className="py-2 px-3 font-mono font-bold text-rose-600 text-right">{formatCOP(fw.total_cost)}</td>
                    </tr>
                  ))}
                  {floorWastes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No hay bajas de merma registradas hoy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* VISTA: SIMULADOR DE ESCALA                                         */}
      {/* ================================================================== */}
      {view === 'simulador' && (
        <div className="max-w-4xl bg-white/80 rounded-3xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold">Simulador de Escala de Cocina</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Receta Base</label>
                <select
                  value={selectedRecipe?.id || ''}
                  onChange={(e) => {
                    const r = recipes.find((x) => x.id === parseInt(e.target.value));
                    setSelectedRecipe(r);
                    setSimulation(null);
                  }}
                  className={inputClass}
                >
                  <option value="">Seleccionar receta...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Cantidad Objetivo (kg)</label>
                <input
                  type="number"
                  value={simQuantity}
                  onChange={(e) => { setSimQuantity(e.target.value); setSimulation(null); }}
                  placeholder="Ej: 500"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={!selectedRecipe || !simQuantity}
              className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <i className="bi bi-calculator-fill" /> SIMULAR ESCALA Y COSTOS
            </button>

            {simulation && (
              <div className="bg-slate-900 rounded-2xl p-5 text-white animate-slide-up space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs uppercase tracking-wider text-lime-400 font-bold">
                    Resultado de Simulación de Producción
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-900 bg-lime-400 px-3 py-1 rounded-lg">
                    Lote Objetivo: {simulation.target_quantity_kg} kg
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/60 text-xs block mb-1">Costo Total Lote:</span>
                    <p className="font-black text-lime-400 text-base">{formatCOP(simulation.total_cost)}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/60 text-xs block mb-1">Costo Unitario / kg:</span>
                    <p className="font-black text-lime-400 text-base">{formatUnitCOP(simulation.cost_per_kg, 'kg')}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/60 text-xs block mb-1">Costo de Merma:</span>
                    <p className="font-black text-terracotta-400 text-base">{formatCOP(simulation.total_waste_cost)}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/60 text-xs block mb-1">Precio Venta (+30%):</span>
                    <p className="font-black text-green-400 text-base">{formatCOP(simulation.selling_price)}</p>
                  </div>
                </div>

                {/* Matriz de Impacto de Insumos */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
                  <p className="text-xs uppercase tracking-wider font-bold text-lime-400">
                    Impacto de Insumos en la Tanda Simulada
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-white/50 uppercase tracking-wider">
                          <th className="pb-2">Insumo</th>
                          <th className="pb-2">Requerido a Escala</th>
                          <th className="pb-2">Costo Unitario (COP)</th>
                          <th className="pb-2">Impacto Económico Total</th>
                          <th className="pb-2">% Costo</th>
                          <th className="pb-2">Stock en Bodega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(simulation.ingredients || []).map((ing) => {
                          const total = Number(simulation.total_cost) || 1;
                          const pct = ((Number(ing.scaled_cost) / total) * 100).toFixed(1);
                          return (
                            <tr key={ing.ingredient_id} className="text-white/80">
                              <td className="py-2.5 font-semibold text-white">{ing.name}</td>
                              <td className="py-2.5 font-mono">{ing.scaled_quantity} {ing.unit}</td>
                              <td className="py-2.5 font-mono text-white/70">{formatUnitCOP(ing.unit_cost, ing.unit)}</td>
                              <td className="py-2.5 font-mono font-bold text-lime-400">{formatCOP(ing.scaled_cost)}</td>
                              <td className="py-2.5 font-mono font-bold text-white">{pct}%</td>
                              <td className="py-2.5">
                                {ing.has_stock ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                    <i className="bi bi-check-circle-fill text-xs" /> {ing.available_in_stock} {ing.unit}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                    <i className="bi bi-x-circle-fill text-xs" /> Falta stock ({ing.available_in_stock} {ing.unit})
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* VISTA: DISPONIBILIDAD DE INSUMOS                                   */}
      {/* ================================================================== */}
      {view === 'insumos' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 font-bold">
            Disponibilidad de Insumos por Receta (Check FEFO)
          </h2>
          <div className="space-y-3">
            {recipes.map((recipe) => {
              const check = recipe.stock_check;
              const enough = check?.sufficient;
              return (
                <div key={recipe.id} className="p-4 rounded-2xl border border-slate-200 bg-white/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{recipe.name}</p>
                      <p className="text-xs text-slate-500">Merma: {recipe.waste_percentage}%</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${enough ? 'bg-lime-50 border-lime-300 text-[#3F5600]' : 'bg-red-50 border-red-300 text-[#A44B1F]'}`}>
                      {check?.label || (enough ? 'Suficiente' : 'Insuficiente')}
                    </span>
                  </div>
                  {!enough && check?.missing?.length > 0 && (
                    <ul className="text-[11px] text-red-700 space-y-0.5 pt-1">
                      {check.missing.map((m) => (
                        <li key={m.ingredient_id}>• {m.name}: falta <b>{m.missing_quantity} {m.unit}</b> (hay {m.available} disponibles)</li>
                      ))}
                    </ul>
                  )}
                  {enough && (
                    <p className="text-[11px] text-[#4F6B00]">Todos los insumos cuentan con existencias suficientes en bodega.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
