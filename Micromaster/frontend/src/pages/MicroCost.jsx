import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cost } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import { hasModuleAccess, can } from '../constants/roles';

const VIEW_META = {
  tablero: {
    title: 'Inicio · Tablero de Cocina',
    desc: 'Resumen operativo de recetas, insumos y simulaciones',
    badge: 'TABLERO PRODUCCIÓN',
    color: 'lime',
  },
  recetas: {
    title: 'Catálogo de Recetas',
    desc: 'Fórmulas, mermas, ingredientes y verificación de stock',
    badge: 'CATÁLOGO DE RECETAS',
    color: 'lime',
  },
  simulador: {
    title: 'Simulador de Escala',
    desc: 'Calcular costo por kg para producción escalada',
    badge: 'SIMULADOR DE ESCALA',
    color: 'lime',
  },
  insumos: {
    title: 'Disponibilidad de Insumos',
    desc: 'Check automático de disponibilidad por receta',
    badge: 'DISPONIBILIDAD DE INSUMOS',
    color: 'terracotta',
  },
};

export default function MicroCost({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const location = useLocation();
  const view = location.pathname === '/cost' ? 'tablero' : location.pathname.split('/')[2] || 'tablero';

  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [formData, setFormData] = useState({ name: '', waste_percentage: 0 });
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [simQuantity, setSimQuantity] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [formError, setFormError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const canAccess = hasModuleAccess(role, 'recipes_production');
  const canCreate = can(role, 'create');

  useEffect(() => {
    if (!canAccess) return;
    cost.getRecipes().then((res) => setRecipes(res.data.recipes)).catch(() => {});
    cost.getIngredients().then((res) => setIngredients(res.data.ingredients)).catch(() => {});
  }, [canAccess]);

  const handleCreateRecipe = async () => {
    if (!canCreate) return;
    setFormError('');
    if (!formData.name.trim()) { setFormError('Ingresa el nombre de la receta'); return; }
    if (selectedIngredients.length === 0) { setFormError('Selecciona al menos un insumo'); return; }
    if (selectedIngredients.some((i) => !i.quantity || i.quantity <= 0)) { setFormError('Define la cantidad de cada insumo'); return; }
    try {
      const res = await cost.createRecipe({
        name: formData.name,
        waste_percentage: parseFloat(formData.waste_percentage) || 0,
        ingredients: selectedIngredients.map((ing) => ({
          ingredient_id: ing.id,
          cantidad: ing.quantity,
          quantity: ing.quantity,
          unit_cost: ing.cost_per_unit,
          unidad: ing.unit,
          unit: ing.unit,
        })),
      });
      setRecipes([...recipes, res.data.recipe]);
      setFormData({ name: '', waste_percentage: 0 });
      setSelectedIngredients([]);
      setSavedMsg('Receta creada correctamente.');
      setTimeout(() => setSavedMsg(''), 3500);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Error al crear la receta');
    }
  };

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
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Producción</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[view];
  const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-lime-400 outline-none';
  const labelClass = 'text-xs uppercase tracking-wider text-slate-500 mb-1 block';

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{meta.title}</h1>
          <p className="text-sm text-slate-500">{meta.desc}</p>
        </div>
        <TechBadge label={meta.badge} color={meta.color} />
      </div>

      {view === 'tablero' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FreshCard title="Recetas Activas" value={recipes.length} subtitle="Definidas" icon="clipboard" color="lime" />
            <FreshCard title="Insumos Disponibles" value={ingredients.length} subtitle="Catalogados" icon="box-seam" color="terracotta" />
            <FreshCard
              title="Insumos Insuficientes"
              value={recipes.filter((r) => r.stock_check && !r.stock_check.sufficient).length}
              subtitle={`de ${recipes.length} recetas`}
              icon="x-circle-fill"
              color="terracotta"
            />
            <FreshCard title="Última Simulación" value={simulation ? `$${simulation.cost_per_kg}` : '—'} subtitle="Costo/kg" icon="calculator" color="lime" />
          </div>

          <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Recetas destacadas</h2>
            <div className="space-y-3">
              {recipes.slice(0, 4).map((recipe) => {
                const check = recipe.stock_check;
                const enough = check?.sufficient;
                return (
                  <div key={recipe.id} className="p-4 rounded-2xl border border-slate-200 bg-white/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{recipe.name}</p>
                        <p className="text-xs text-slate-500">Merma: {recipe.waste_percentage}% · {recipe.ingredients?.length || 0} ingredientes</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${enough ? 'bg-lime-50 border-lime-300 text-[#3F5600]' : 'bg-red-50 border-red-300 text-[#A44B1F]'}`}>
                        {enough ? 'Con stock' : 'Requiere insumos'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {recipes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No hay recetas registradas.</p>}
            </div>
          </div>
        </>
      )}

      {view === 'recetas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Catálogo de Recetas</h2>
            <div className="space-y-3">
              {recipes.map((recipe) => {
                const check = recipe.stock_check;
                const enough = check?.sufficient;
                return (
                  <div key={recipe.id} className="p-4 rounded-2xl border border-slate-200 bg-white/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{recipe.name}</p>
                        <p className="text-xs text-slate-500">Merma: {recipe.waste_percentage}% · {recipe.ingredients?.length || 0} ingredientes</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${enough ? 'bg-lime-50 border-lime-300 text-[#3F5600]' : 'bg-red-50 border-red-300 text-[#A44B1F]'}`}>
                        {enough ? 'Con stock suficiente' : 'Insumos insuficientes'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {recipes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No hay recetas registradas.</p>}
            </div>
          </div>

          <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Nueva Receta</h2>
            {!canCreate && (
              <p className="text-xs text-slate-500 mb-4">Tu rol tiene acceso de solo lectura. No puedes crear recetas.</p>
            )}
            <div className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>
              )}
              <div>
                <label className={labelClass}>Nombre de Receta</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Base Arroz con Fríjoles" className={inputClass} disabled={!canCreate} />
              </div>
              <div>
                <label className={labelClass}>Porcentaje de Merma (%)</label>
                <input type="number" value={formData.waste_percentage} onChange={(e) => setFormData({ ...formData, waste_percentage: e.target.value })} className={inputClass} disabled={!canCreate} />
              </div>
               <div>
                 <label className={labelClass}>Insumos Asociados</label>
                 <div className="space-y-2 max-h-60 overflow-y-auto">
                   {ingredients.map((ing) => {
                     const existing = selectedIngredients.find((x) => x.id === ing.id);
                     return (
                       <div key={ing.id} className="p-2 rounded-xl bg-white/60 border border-slate-200">
                         <div className="flex items-center gap-2">
                           <input type="checkbox" checked={!!existing} onChange={(e) => {
                             if (e.target.checked) setSelectedIngredients([...selectedIngredients, { ...ing, quantity: 0 }]);
                             else setSelectedIngredients(selectedIngredients.filter((x) => x.id !== ing.id));
                           }} className="rounded" disabled={!canCreate} />
                           <span className="text-sm flex-1 text-slate-900">{ing.name}</span>
                           <span className="text-xs text-slate-500">${ing.cost_per_unit}/{ing.unit}</span>
                         </div>
                         {existing && (
                           <div className="grid grid-cols-2 gap-2 mt-2 pl-6">
                             <div>
                               <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Cantidad Requerida</label>
                               <input type="number" step="0.01" min="0" value={existing.quantity} onChange={(e) => {
                                 const q = parseFloat(e.target.value);
                                 setSelectedIngredients(selectedIngredients.map((x) => x.id === ing.id ? { ...x, quantity: isNaN(q) ? 0 : q } : x));
                               }} placeholder="0.00" className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs" disabled={!canCreate} />
                             </div>
                             <div>
                               <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Unidad de Medida</label>
                               <div className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-slate-50 text-slate-700 flex items-center h-7">{ing.unit}</div>
                             </div>
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
              {savedMsg && (
                <div className="px-4 py-3 rounded-xl bg-lime-50 border border-lime-300 text-sm text-lime-900">{savedMsg}</div>
              )}
              {canCreate && (
                <button onClick={handleCreateRecipe} className="w-full bg-lime-400 hover:bg-lime-500 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all">
                  <i className="bi bi-plus-circle" aria-hidden="true" /> Crear Receta
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'simulador' && (
        <div className="max-w-2xl bg-white/80 rounded-3xl border border-slate-200 p-6">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Simulador de Escala</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Receta Base</label>
              <select value={selectedRecipe?.id || ''} onChange={(e) => {
                const r = recipes.find((x) => x.id === parseInt(e.target.value));
                setSelectedRecipe(r);
                setSimulation(null);
              }} className={inputClass}>
                <option value="">Seleccionar receta...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cantidad Objetivo (kg)</label>
              <input type="number" value={simQuantity} onChange={(e) => { setSimQuantity(e.target.value); setSimulation(null); }} placeholder="Ej: 500" className={inputClass} />
            </div>
            <button onClick={handleSimulate} disabled={!selectedRecipe || !simQuantity} className="w-full bg-lime-400 hover:bg-lime-500 disabled:opacity-40 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all">
              <i className="bi bi-calculator-fill" aria-hidden="true" /> SIMULAR ESCALA
            </button>

            {simulation && (
              <div className="bg-slate-900 rounded-2xl p-5 text-white animate-slide-up">
                <h3 className="text-xs uppercase tracking-wider text-lime-400 mb-3">Resultado de Simulación</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/70">Costo Total:</span><p className="font-bold text-lime-400">${simulation.total_cost?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Costo/kg:</span><p className="font-bold text-lime-400">${simulation.cost_per_kg?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Merma:</span><p className="font-bold text-terracotta-400">${simulation.total_waste_cost?.toLocaleString()}</p></div>
                  <div><span className="text-white/70">Precio Venta:</span><p className="font-bold text-green-400">${simulation.selling_price?.toLocaleString()}</p></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">Margen Estimado (30%):</span>
                    <span className="font-bold text-lime-400">${simulation.margin?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'insumos' && (
        <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Disponibilidad de Insumos por Receta</h2>
          <div className="space-y-3">
            {recipes.map((recipe) => {
              const check = recipe.stock_check;
              const enough = check?.sufficient;
              return (
                <div key={recipe.id} className="p-4 rounded-2xl border border-slate-200 bg-white/60">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">{recipe.name}</p>
                      <p className="text-xs text-slate-500">Merma: {recipe.waste_percentage}%</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${enough ? 'bg-lime-50 border-lime-300 text-[#3F5600]' : 'bg-red-50 border-red-300 text-[#A44B1F]'}`}>
                      {check?.label || (enough ? 'Suficiente' : 'Insuficiente')}
                    </span>
                  </div>
                  {!enough && check?.missing?.length > 0 && (
                    <ul className="text-[11px] text-red-700 space-y-0.5">
                      {check.missing.map((m) => (
                        <li key={m.ingredient_id}>• {m.name}: falta <b>{m.missing_quantity} {m.unit}</b> (hay {m.available})</li>
                      ))}
                    </ul>
                  )}
                  {enough && check?.items?.length > 0 && (
                    <p className="text-[11px] text-[#4F6B00]">Todos los insumos cuentan con stock suficiente.</p>
                  )}
                </div>
              );
            })}
            {recipes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No hay recetas para verificar.</p>}
          </div>
        </div>
      )}
    </div>
  );
}