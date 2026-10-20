<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Recipe;
use App\Models\Ingredient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
            'ingredients.*.unit_cost' => 'required|numeric|min:0',
        ]);

        $recipe = Recipe::create([
            'name' => $request->name,
            'waste_percentage' => $request->waste_percentage,
        ]);

        foreach ($request->ingredients as $ing) {
            $recipe->ingredients()->attach($ing['ingredient_id'], [
                'quantity' => $ing['quantity'],
                'unit_cost' => $ing['unit_cost'],
            ]);
        }

        $recipe->load('ingredients');
        $recipe->append(['stock_check']);

        return response()->json(['recipe' => $recipe], 201);
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
        ]);

        $recipe = Recipe::with('ingredients')->findOrFail($id);
        $recipe->fill($request->only(['name', 'waste_percentage']));
        $recipe->save();

        if ($request->has('ingredients')) {
            $recipe->ingredients()->detach();
            foreach ($request->ingredients as $ing) {
                $recipe->ingredients()->attach($ing['ingredient_id'], [
                    'quantity' => $ing['quantity'],
                    'unit_cost' => $ing['unit_cost'],
                ]);
            }
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
