<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Recipe;
use App\Models\Ingredient;
use App\Models\ProductionOrder;
use App\Models\FloorWaste;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MicroCostController extends Controller
{
    public function recipes(Request $request)
    {
        if (! $this->checkModule('recipes_production') && ! $this->checkModule('reports_simulations')) {
            return $this->forbidden();
        }

        $recipes = Recipe::with('ingredients')->get();

        // Enriquecer cada receta con su verificación de disponibilidad en bodega
        $recipes->each(function ($recipe) {
            $recipe->append(['stock_check']);
        });

        return response()->json(['recipes' => $recipes]);
    }

    /**
     * CHECK DE INSUMOS AUTOMÁTICO
     *
     * GET /api/cost/recipes/{id}/stock-check
     *
     * Compara lo que necesita la receta contra las existencias reales de
     * inventario y devuelve:
     *   - sufficient: true/false
     *   - status: 'sufficient' | 'insufficient'
     *   - missing[]: detalle exacto de los insumos faltantes
     */
    public function stockCheck($recipeId)
    {
        if (! $this->checkModule('recipes_production')) {
            return $this->forbidden();
        }

        $recipe = Recipe::with('ingredients')->findOrFail($recipeId);
        $check = $this->computeStockCheck($recipe);

        return response()->json([
            'recipe_id' => $recipe->id,
            'recipe_name' => $recipe->name,
            ...$check,
        ]);
    }

    public function storeRecipe(Request $request)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'waste_percentage' => 'required|numeric|between:0,100',
            'ingredients' => 'required|array|min:1',
            'ingredients.*.ingredient_id' => 'required|exists:ingredients,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.0001',
            'ingredients.*.unit' => 'nullable|string|max:30',
        ]);

        $recipe = Recipe::create([
            'name' => $request->name,
            'waste_percentage' => (float) $request->waste_percentage,
        ]);

        $syncData = [];
        foreach ($request->ingredients as $ing) {
            $ingredientModel = Ingredient::find($ing['ingredient_id']);
            $unitCost = isset($ing['unit_cost']) && $ing['unit_cost'] > 0
                ? (float) $ing['unit_cost']
                : (float) ($ingredientModel?->cost_per_unit ?? 0);
            $unit = $ing['unit'] ?? $ing['unidad'] ?? $ingredientModel?->unit ?? 'kg';

            $syncData[$ing['ingredient_id']] = [
                'quantity' => (float) ($ing['quantity'] ?? $ing['cantidad']),
                'unit' => $unit,
                'unit_cost' => $unitCost,
            ];
        }

        $recipe->ingredients()->sync($syncData);
        $recipe->load('ingredients');
        $recipe->append(['stock_check']);

        return response()->json([
            'recipe' => $recipe,
            'message' => 'Receta guardada exitosamente con BOM y costeo integrado',
        ], 201);
    }

    public function updateRecipe(Request $request, $id)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canUpdate()) {
            return $this->forbidden();
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'waste_percentage' => 'sometimes|numeric|between:0,100',
            'ingredients' => 'sometimes|array|min:1',
            'ingredients.*.ingredient_id' => 'required_with:ingredients|exists:ingredients,id',
            'ingredients.*.quantity' => 'required_with:ingredients|numeric|min:0.0001',
        ]);

        $recipe = Recipe::with('ingredients')->findOrFail($id);
        $recipe->fill($request->only(['name', 'waste_percentage']));
        $recipe->save();

        if ($request->has('ingredients')) {
            $syncData = [];
            foreach ($request->ingredients as $ing) {
                $ingredientModel = Ingredient::find($ing['ingredient_id']);
                $unitCost = isset($ing['unit_cost']) && $ing['unit_cost'] > 0
                    ? (float) $ing['unit_cost']
                    : (float) ($ingredientModel?->cost_per_unit ?? 0);
                $unit = $ing['unit'] ?? $ing['unidad'] ?? $ingredientModel?->unit ?? 'kg';

                $syncData[$ing['ingredient_id']] = [
                    'quantity' => (float) ($ing['quantity'] ?? $ing['cantidad']),
                    'unit' => $unit,
                    'unit_cost' => $unitCost,
                ];
            }
            $recipe->ingredients()->sync($syncData);
            $recipe->load('ingredients');
        }

        $recipe->append(['stock_check']);

        return response()->json(['recipe' => $recipe, 'message' => 'Receta actualizada']);
    }

    public function destroyRecipe($id)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canDelete()) {
            return $this->forbidden();
        }

        $recipe = Recipe::findOrFail($id);
        $recipe->delete();

        return response()->json(['message' => 'Receta eliminada']);
    }

    public function simulateScale(Request $request)
    {
        if (! $this->checkModule('recipes_production')) {
            return $this->forbidden();
        }

        $request->validate([
            'recipe_id' => 'required|exists:recipes,id',
            'quantity_kg' => 'required|numeric|min:0.001',
        ]);

        $recipe = Recipe::with('ingredients')->findOrFail($request->recipe_id);

        $baseQuantity = max((float) $recipe->ingredients->sum('pivot.quantity'), 0.001);
        $scaleFactor = (float) $request->quantity_kg / $baseQuantity;

        $ingredientDetails = $recipe->ingredients->map(function ($ingredient) use ($scaleFactor) {
            $scaledQuantity = $ingredient->pivot->quantity * $scaleFactor;
            $scaledCost = $ingredient->pivot->unit_cost * $scaledQuantity;
            $available = (float) Batch::where('ingredient_id', $ingredient->id)
                ->where('expiration_date', '>=', now())->sum('quantity');

            return [
                'ingredient_id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'base_quantity' => $ingredient->pivot->quantity,
                'scaled_quantity' => round($scaledQuantity, 4),
                'unit_cost' => $ingredient->pivot->unit_cost,
                'scaled_cost' => round($scaledCost, 2),
                'available_in_stock' => round($available, 4),
                'has_stock' => $available >= $scaledQuantity,
            ];
        });

        $baseTotalCost = $recipe->ingredients->sum(fn($i) => $i->pivot->quantity * $i->pivot->unit_cost);
        $totalCost = $baseTotalCost * $scaleFactor * (1 + ($recipe->waste_percentage / 100));
        $costPerKg = $totalCost / (float) $request->quantity_kg;
        $wasteAmount = $totalCost * ($recipe->waste_percentage / 100);

        $missing = $ingredientDetails->filter(fn($i) => ! $i['has_stock'])->values();

        return response()->json([
            'recipe_id' => $recipe->id,
            'recipe_name' => $recipe->name,
            'target_quantity_kg' => (float) $request->quantity_kg,
            'scale_factor' => round($scaleFactor, 4),
            'ingredients' => $ingredientDetails,
            'base_total_cost' => round($baseTotalCost, 2),
            'total_waste_cost' => round($wasteAmount, 2),
            'total_cost' => round($totalCost, 2),
            'cost_per_kg' => round($costPerKg, 2),
            'margin' => round($totalCost * 0.30, 2),
            'selling_price' => round($totalCost * 1.30, 2),
            // Check de insumos a la escala solicitada
            'stock_status' => $missing->isEmpty() ? 'sufficient' : 'insufficient',
            'has_stock' => $missing->isEmpty(),
            'missing' => $missing,
        ]);
    }

    public function ingredients(Request $request)
    {
        if (! $this->checkModule('recipes_production') && ! $this->checkReadModule('recipes_production')) {
            return $this->forbidden();
        }

        $ingredients = Ingredient::withSum('batches as total_stock', 'quantity')->get();

        return response()->json(['ingredients' => $ingredients]);
    }

    // ------------------------------------------------------------------
    //  Cálculo del Check de Insumos
    // ------------------------------------------------------------------

    protected function computeStockCheck(Recipe $recipe): array
    {
        $items = $recipe->ingredients->map(function ($ingredient) {
            $required = (float) $ingredient->pivot->quantity;

            // Existencia real: suma de lotes NO vencidos (FEFO vigente)
            $available = (float) Batch::where('ingredient_id', $ingredient->id)
                ->where('expiration_date', '>=', now())
                ->sum('quantity');

            $diff = round($available - $required, 4);

            return [
                'ingredient_id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'required' => $required,
                'available' => round($available, 4),
                'difference' => $diff,
                'enough' => $diff >= 0,
                'missing_quantity' => $diff < 0 ? round(abs($diff), 4) : 0,
            ];
        })->values();

        $missing = $items->filter(fn($i) => ! $i['enough'])->values();
        $sufficient = $missing->isEmpty();

        return [
            'sufficient' => $sufficient,
            'status' => $sufficient ? 'sufficient' : 'insufficient',
            'label' => $sufficient ? 'Insumos Suficientes' : 'Insumos Insuficientes',
            'items' => $items,
            'missing' => $missing,
        ];
    }

    // ------------------------------------------------------------------
    //  FASE 2 & FASE 3: ÓRDENES DE PRODUCCIÓN / TANDAS
    // ------------------------------------------------------------------

    public function productionOrders(Request $request)
    {
        if (! $this->checkModule('recipes_production') && ! $this->checkModule('reports_simulations')) {
            return $this->forbidden();
        }

        $query = ProductionOrder::with(['recipe.ingredients', 'supervisor', 'outputBatch.ingredient'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        return response()->json([
            'orders' => $query->get(),
        ]);
    }

    public function createProductionOrder(Request $request)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'recipe_id' => 'required|exists:recipes,id',
            'target_quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:1000',
        ]);

        $recipe = Recipe::with('ingredients')->findOrFail($request->recipe_id);

        $baseQuantity = max((float) $recipe->ingredients->sum('pivot.quantity'), 0.001);
        $scaleFactor = (float) $request->target_quantity / $baseQuantity;

        // Explotación de receta contra inventario real (FEFO)
        $bomSnapshot = $recipe->ingredients->map(function ($ingredient) use ($scaleFactor) {
            $theoreticalQty = round($ingredient->pivot->quantity * $scaleFactor, 4);
            $unitCost = (float) ($ingredient->pivot->unit_cost ?: $ingredient->cost_per_unit);
            $subtotal = round($theoreticalQty * $unitCost, 2);

            $available = (float) Batch::where('ingredient_id', $ingredient->id)
                ->where('is_quarantined', false)
                ->where('expiration_date', '>=', now())
                ->sum('quantity');

            return [
                'ingredient_id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->pivot->unit ?: $ingredient->unit,
                'base_quantity' => (float) $ingredient->pivot->quantity,
                'theoretical_quantity' => $theoreticalQty,
                'unit_cost' => $unitCost,
                'theoretical_subtotal' => $subtotal,
                'available_in_stock' => round($available, 4),
                'has_stock' => $available >= $theoreticalQty,
            ];
        })->values()->all();

        $baseTotalCost = collect($bomSnapshot)->sum('theoretical_subtotal');
        $wasteMultiplier = 1 + ((float) $recipe->waste_percentage / 100);
        $theoreticalTotalCost = round($baseTotalCost * $wasteMultiplier, 2);

        $datePrefix = 'OP-' . date('Ymd');
        $todayCount = ProductionOrder::where('order_code', 'like', "{$datePrefix}%")->count() + 1;
        $orderCode = $datePrefix . '-' . str_pad($todayCount, 3, '0', STR_PAD_LEFT);

        $order = ProductionOrder::create([
            'order_code' => $orderCode,
            'recipe_id' => $recipe->id,
            'supervisor_id' => Auth::id(),
            'target_quantity' => (float) $request->target_quantity,
            'target_unit' => 'kg',
            'theoretical_cost' => $theoreticalTotalCost,
            'status' => 'in_progress',
            'bom_snapshot' => $bomSnapshot,
            'notes' => $request->notes,
        ]);

        $order->load(['recipe.ingredients', 'supervisor']);

        return response()->json([
            'order' => $order,
            'message' => 'Orden de producción emitida correctamente. Lista para impresión.',
        ], 201);
    }

    public function showProductionOrder($id)
    {
        $order = ProductionOrder::with(['recipe.ingredients', 'supervisor', 'outputBatch.ingredient'])
            ->findOrFail($id);

        return response()->json(['order' => $order]);
    }

    public function closeProductionOrder(Request $request, $id)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canUpdate()) {
            return $this->forbidden();
        }

        $request->validate([
            'actual_quantity' => 'required|numeric|min:0.01',
            'consumed_items' => 'required|array|min:1',
            'consumed_items.*.ingredient_id' => 'required|exists:ingredients,id',
            'consumed_items.*.actual_quantity' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        return DB::transaction(function () use ($request, $id) {
            $order = ProductionOrder::with('recipe')
                ->where('id', $id)
                ->where('status', 'in_progress')
                ->lockForUpdate()
                ->firstOrFail();

            $totalRealCost = 0.0;
            $processedConsumedItems = [];

            // 1. Descontar materias primas reales según la hoja física (FEFO)
            foreach ($request->consumed_items as $item) {
                $ingId = $item['ingredient_id'];
                $actualQty = (float) $item['actual_quantity'];
                $ingredient = Ingredient::lockForUpdate()->findOrFail($ingId);
                $unitCost = (float) $ingredient->cost_per_unit;
                $itemSubtotal = round($actualQty * $unitCost, 2);
                $totalRealCost += $itemSubtotal;

                // Descuento FEFO de los lotes activos de este insumo
                $remainingToDeduct = $actualQty;
                $batches = Batch::where('ingredient_id', $ingId)
                    ->where('is_quarantined', false)
                    ->where('quantity', '>', 0)
                    ->orderBy('expiration_date', 'asc')
                    ->lockForUpdate()
                    ->get();

                foreach ($batches as $batch) {
                    if ($remainingToDeduct <= 0) break;
                    $deduct = min((float) $batch->quantity, $remainingToDeduct);
                    $batch->quantity = (float) $batch->quantity - $deduct;
                    $batch->save();
                    $remainingToDeduct -= $deduct;
                }

                $processedConsumedItems[] = [
                    'ingredient_id' => $ingId,
                    'name' => $ingredient->name,
                    'unit' => $item['unit'] ?? $ingredient->unit,
                    'theoretical_quantity' => (float) ($item['theoretical_quantity'] ?? 0),
                    'actual_quantity' => $actualQty,
                    'unit_cost' => $unitCost,
                    'real_subtotal' => $itemSubtotal,
                ];
            }

            // 2. Calcular Costo Unitario Real
            $actualYieldKg = (float) $request->actual_quantity;
            $realUnitCost = $actualYieldKg > 0 ? round($totalRealCost / $actualYieldKg, 2) : 0.0;

            // 3. Ingresar Producto Terminado a Bodega
            $ptName = 'PT - ' . $order->recipe->name;
            $ptItem = Ingredient::firstOrCreate(
                ['name' => $ptName],
                [
                    'unit' => $order->target_unit ?: 'kg',
                    'cost_per_unit' => $realUnitCost,
                    'min_stock' => 50,
                ]
            );
            $ptItem->cost_per_unit = $realUnitCost;
            $ptItem->save();

            $batchPrefix = 'BCH-PT-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $order->recipe->name), 0, 3));
            $outputBatchCode = $batchPrefix . '-' . now()->format('YmdHis');

            $outputBatch = Batch::create([
                'ingredient_id' => $ptItem->id,
                'batch_code' => $outputBatchCode,
                'supplier_name' => 'Planta de Producción Interna (Orden ' . $order->order_code . ')',
                'storage_zone' => 'Refrigerado',
                'quantity' => $actualYieldKg,
                'initial_quantity' => $actualYieldKg,
                'expiration_date' => now()->addDays(15),
                'status' => 'optimal',
                'received_at' => now(),
            ]);

            // 4. Actualizar estado de la orden de producción
            $order->actual_quantity = $actualYieldKg;
            $order->real_cost = round($totalRealCost, 2);
            $order->real_unit_cost = $realUnitCost;
            $order->status = 'completed';
            $order->output_batch_id = $outputBatch->id;
            $order->consumed_items = $processedConsumedItems;
            $order->completed_at = now();
            if ($request->filled('notes')) {
                $order->notes = ($order->notes ? $order->notes . "\n" : '') . 'Cierre: ' . $request->notes;
            }
            $order->save();

            $order->load(['recipe.ingredients', 'supervisor', 'outputBatch.ingredient']);

            return response()->json([
                'order' => $order,
                'message' => "Tanda {$order->order_code} cerrada con éxito. Se ingresaron {$actualYieldKg} kg de {$ptName} al inventario con costo unitario de {$realUnitCost} COP.",
            ]);
        });
    }

    // ------------------------------------------------------------------
    //  FASE 4: AJUSTE DE MERMAS DE PLANTA
    // ------------------------------------------------------------------

    public function getFloorWastes(Request $request)
    {
        if (! $this->checkModule('recipes_production') && ! $this->checkModule('reports_simulations')) {
            return $this->forbidden();
        }

        $wastes = FloorWaste::with(['ingredient', 'user'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        $todayTotalCost = FloorWaste::whereDate('created_at', today())->sum('total_cost');
        $todayQuantity = FloorWaste::whereDate('created_at', today())->sum('quantity');

        return response()->json([
            'wastes' => $wastes,
            'summary' => [
                'today_total_cost' => (float) $todayTotalCost,
                'today_quantity' => (float) $todayQuantity,
            ],
        ]);
    }

    public function storeFloorWaste(Request $request)
    {
        if (! $this->checkModule('recipes_production') || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'wastes' => 'required|array|min:1',
            'wastes.*.ingredient_id' => 'required|exists:ingredients,id',
            'wastes.*.quantity' => 'required|numeric|min:0.001',
            'wastes.*.reason' => 'required|string|max:255',
        ]);

        return DB::transaction(function () use ($request) {
            $createdWastes = [];
            $totalCostWrittenOff = 0.0;

            foreach ($request->wastes as $w) {
                $ingId = $w['ingredient_id'];
                $qty = (float) $w['quantity'];
                $ingredient = Ingredient::lockForUpdate()->findOrFail($ingId);
                $unitCost = (float) $ingredient->cost_per_unit;
                $itemCost = round($qty * $unitCost, 2);
                $totalCostWrittenOff += $itemCost;

                // Descuento FEFO del inventario
                $remaining = $qty;
                $batches = Batch::where('ingredient_id', $ingId)
                    ->where('is_quarantined', false)
                    ->where('quantity', '>', 0)
                    ->orderBy('expiration_date', 'asc')
                    ->lockForUpdate()
                    ->get();

                foreach ($batches as $b) {
                    if ($remaining <= 0) break;
                    $deduct = min((float) $b->quantity, $remaining);
                    $b->quantity = (float) $b->quantity - $deduct;
                    $b->save();
                    $remaining -= $deduct;
                }

                $record = FloorWaste::create([
                    'user_id' => Auth::id(),
                    'ingredient_id' => $ingId,
                    'quantity' => $qty,
                    'unit' => $w['unit'] ?? $ingredient->unit,
                    'unit_cost' => $unitCost,
                    'total_cost' => $itemCost,
                    'reason' => $w['reason'],
                    'notes' => $w['notes'] ?? null,
                ]);

                $createdWastes[] = $record;
            }

            return response()->json([
                'message' => "Se aplicaron " . count($createdWastes) . " bajas de merma correctamente por un total de " . number_format($totalCostWrittenOff, 0, ',', '.') . " COP.",
                'total_cost' => $totalCostWrittenOff,
                'items_count' => count($createdWastes),
            ], 201);
        });
    }

    // ------------------------------------------------------------------
    //  Control de acceso
    // ------------------------------------------------------------------

    protected function checkModule(string $module): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess($module);
    }

    protected function checkReadModule(string $module): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasReadModuleAccess($module);
    }

    protected function canCreate(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && in_array('create', $user->role_permissions['can'] ?? []);
    }

    protected function canUpdate(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && in_array('update', $user->role_permissions['can'] ?? []);
    }

    protected function canDelete(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && in_array('delete', $user->role_permissions['can'] ?? []);
    }
}
