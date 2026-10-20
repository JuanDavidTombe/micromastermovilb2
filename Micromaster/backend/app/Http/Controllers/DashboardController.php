<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Ingredient;
use App\Models\Order;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function index()
    {
        $now = now();
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            return $this->forbidden();
        }

        $totalInventory = Batch::sum('quantity');
        $totalInventoryValue = Batch::join('ingredients', 'batches.ingredient_id', '=', 'ingredients.id')
            ->sum(DB::raw('batches.quantity * ingredients.cost_per_unit'));

        $criticalBatches = Batch::where('expiration_date', '<', $now)->count();
        $warningBatches = Batch::where('expiration_date', '>=', $now)
            ->where('expiration_date', '<=', $now->copy()->addDays(7))
            ->count();
        $optimalBatches = Batch::where('expiration_date', '>', $now->copy()->addDays(7))->count();

        $totalWaste = Batch::where('status', 'critical')->sum('quantity');
        $totalBatches = Batch::count();
        $totalIngredients = Ingredient::count();
        $totalRecipes = Recipe::count();

        $pendingOrders = Order::where('payment_status', 'pending')->count();
        $completedOrders = Order::where('payment_status', 'completed')->count();
        $totalRevenue = Order::where('payment_status', 'completed')->sum('amount');
        $totalCollected = Order::where('payment_status', 'completed')->sum('received_amount');

        $expiringThisWeek = Batch::where('expiration_date', '>=', $now)
            ->where('expiration_date', '<=', $now->copy()->addDays(7))
            ->orderBy('expiration_date', 'asc')
            ->take(5)
            ->get();

        $modules = $user->role_permissions['modules'] ?? [];

        return response()->json([
            'user' => [
                'role' => $user->role,
                'role_label' => $user->role_label,
                'modules' => $modules,
            ],
            'kpis' => [
                'total_inventory_kg' => round($totalInventory, 2),
                'total_inventory_value' => round($totalInventoryValue, 2),
                'total_batches' => $totalBatches,
                'total_ingredients' => $totalIngredients,
                'total_recipes' => $totalRecipes,
                'critical_batches' => $criticalBatches,
                'warning_batches' => $warningBatches,
                'optimal_batches' => $optimalBatches,
                'total_waste_kg' => round($totalWaste, 2),
                'pending_orders' => $pendingOrders,
                'completed_orders' => $completedOrders,
                'total_revenue' => round($totalRevenue, 2),
                'total_collected' => round($totalCollected, 2),
            ],
            'alerts' => [
                'expiring_this_week' => $expiringThisWeek,
            ],
            'fefo_matrix' => [
                ['type' => 'Optimal', 'count' => $optimalBatches, 'color' => '#CCFF00'],
                ['type' => 'Próximo a vencer', 'count' => $warningBatches, 'color' => '#F09163'],
                ['type' => 'Crítico', 'count' => $criticalBatches, 'color' => '#FF0000'],
            ],
        ]);
    }
}
