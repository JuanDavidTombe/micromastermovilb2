<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Ingredient;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MicroStockController extends Controller
{
    protected const WAREHOUSE_CAPACITY = 2400;

    /**
     * LISTADO DE LOTES (FEFO) con trazabilidad completa.
     * Acceso: ADMINISTRADOR y OPERARIO_LOGISTICO (escritura+lectura),
     *         SUPERVISOR_PRODUCCION (solo lectura vía read_modules).
     */
    public function index(Request $request)
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        $query = Batch::with('ingredient')
            ->orderBy('expiration_date', 'asc');

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('ingredient_id') && $request->ingredient_id) {
            $query->where('ingredient_id', $request->ingredient_id);
        }

        if ($request->filled('supplier_name')) {
            $query->where('supplier_name', 'like', '%' . $request->supplier_name . '%');
        }

        if ($request->filled('storage_zone')) {
            $query->where('storage_zone', $request->storage_zone);
        }

        if ($request->has('quarantined') && $request->quarantined !== '' && $request->quarantined !== null) {
            $query->where('is_quarantined', filter_var($request->quarantined, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($qq) => $qq
                ->where('batch_code', 'like', "%{$s}%")
                ->orWhere('qr_code_hash', 'like', "%{$s}%")
                ->orWhere('supplier_name', 'like', "%{$s}%"));
        }

        $batches = $query->paginate(20);

        $batches->getCollection()->transform(function ($batch) {
            $batch->status = Batch::fefoStatusFor($batch->expiration_date);
            return $batch;
        });

        return response()->json([
            'batches' => $batches->items(),
            'meta' => [
                'total' => $batches->total(),
                'current_page' => $batches->currentPage(),
                'pages' => $batches->lastPage(),
            ],
            'summary' => $this->stockSummary(),
        ]);
    }

    /**
     * POST /api/stock/qr-scan
     * Sincroniza el escaneo QR de la app móvil con la base de datos web.
     * Acceso: OPERARIO_LOGISTICO y ADMINISTRADOR.
     */
    public function qrScan(Request $request)
    {
        if (! $this->hasStockWriteAccess()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'qr_code_hash' => 'required|string|max:255',
            'batch_code' => 'required|string|max:255',
            'ingredient_id' => 'required|integer|exists:ingredients,id',
            'supplier_name' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
        ]);

        // Anti-duplicación: un mismo QR no puede registrarse dos veces
        $duplicated = Batch::where('qr_code_hash', $data['qr_code_hash'])->first();

        if ($duplicated) {
            return response()->json([
                'error' => 'QR_DUPLICADO',
                'message' => "El código QR ya está registrado en el lote {$duplicated->batch_code}.",
                'batch' => $duplicated->load('ingredient'),
            ], 409);
        }

        $batch = DB::transaction(function () use ($data) {
            return Batch::create([
                'ingredient_id' => $data['ingredient_id'],
                'batch_code' => $data['batch_code'],
                'supplier_name' => $data['supplier_name'],
                'qr_code_hash' => $data['qr_code_hash'],
                'quantity' => $data['quantity'],
                'initial_quantity' => $data['quantity'],
                'expiration_date' => $data['expiration_date'],
                'status' => Batch::fefoStatusFor($data['expiration_date']),
                'received_at' => now(),
            ]);
        });

        $batch->load('ingredient');

        return response()->json([
            'message' => 'Lote registrado exitosamente desde QR',
            'batch' => $batch,
            // Resumen para refrescar la vista web de inventario y alertas en el mismo 201
            'summary' => $this->stockSummary(),
            'alerts' => $this->alertsPayload(),
        ], 201);
    }

    public function store(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'batch_code' => 'required|string|max:255',
            'supplier_name' => 'nullable|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
            'received_at' => 'nullable|date',
        ]);

        if (Batch::where('batch_code', $request->batch_code)->exists()) {
            return response()->json(['message' => 'El código de lote ya existe'], 422);
        }

        $batch = Batch::create([
            'ingredient_id' => $request->ingredient_id,
            'batch_code' => $request->batch_code,
            'supplier_name' => $request->supplier_name,
            'quantity' => $request->quantity,
            'initial_quantity' => $request->quantity,
            'expiration_date' => $request->expiration_date,
            'status' => Batch::fefoStatusFor($request->expiration_date),
            'received_at' => $request->received_at ?: now(),
        ]);

        $batch->load('ingredient');

        return response()->json(['batch' => $batch, 'summary' => $this->stockSummary()], 201);
    }

    public function alerts()
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        return response()->json($this->alertsPayload());
    }

    public function ingredientStock()
    {
        if (! $this->hasStockReadAccess()) {
            return $this->forbidden();
        }

        $ingredients = Ingredient::with(['batches' => function ($query) {
            $query->orderBy('expiration_date', 'asc');
        }])->get();

        return response()->json(['ingredients' => $ingredients]);
    }

    public function purchaseOrder(string $code)
    {
        if (! $this->hasStockReadAccess()) {
            return $this->forbidden();
        }

        $order = PurchaseOrder::with('items.ingredient')
            ->where('code', $code)
            ->first();

        if (! $order) {
            return response()->json([
                'found' => false,
                'message' => "No se encontró la orden de compra {$code}.",
            ], 404);
        }

        $received = Batch::with('ingredient')
            ->where('purchase_order_code', $code)
            ->get();

        return response()->json([
            'found' => true,
            'purchase_order' => $order,
            'received' => $received,
        ]);
    }

    public function block(Request $request, string $id)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'is_quarantined' => 'required|boolean',
            'quarantine_reason' => 'nullable|string|max:500',
        ]);

        if ($data['is_quarantined'] && empty($data['quarantine_reason'])) {
            return response()->json([
                'message' => 'Debes indicar el motivo de la cuarentena.',
            ], 422);
        }

        $batch = Batch::findOrFail($id);
        $batch->is_quarantined = $data['is_quarantined'];
        $batch->quarantine_reason = $data['is_quarantined'] ? $data['quarantine_reason'] : null;
        $batch->save();

        return response()->json([
            'batch' => $batch->load('ingredient'),
            'summary' => $this->stockSummary(),
            'message' => $data['is_quarantined'] ? 'Lote bloqueado en cuarentena' : 'Lote liberado',
        ]);
    }

    /**
     * Entrada de stock manual (recepción de compra de proveedor).
     */
    public function entry(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'ingredient_id' => 'required|exists:ingredients,id',
            'batch_code' => 'required|string|max:255',
            'supplier_name' => 'nullable|string|max:255',
            'quantity' => 'required|numeric|min:0.0001',
            'expiration_date' => 'required|date',
            'storage_zone' => 'required|string|max:255',
            'purchase_order_code' => 'nullable|string|max:255',
            'quality_checklist' => 'required|array',
            'quality_checklist.temperature' => 'required|boolean',
            'quality_checklist.packaging' => 'required|boolean',
            'quality_checklist.labeling' => 'required|boolean',
            'quality_checklist.sanitary_registry' => 'required|boolean',
        ]);

        $failed = array_keys(array_filter($data['quality_checklist'], fn ($ok) => ! $ok));

        if (! empty($failed)) {
            return response()->json([
                'error' => 'QUALITY_REJECTED',
                'message' => 'La recepción fue rechazada: no pasó el control de calidad sanitaria.',
                'failed_checks' => $failed,
            ], 422);
        }

        if (Batch::where('batch_code', $data['batch_code'])->exists()) {
            return response()->json(['message' => 'El código de lote ya existe'], 422);
        }

        $batch = Batch::create([
            'ingredient_id' => $data['ingredient_id'],
            'batch_code' => $data['batch_code'],
            'supplier_name' => $data['supplier_name'] ?? null,
            'storage_zone' => $data['storage_zone'],
            'quantity' => $data['quantity'],
            'initial_quantity' => $data['quantity'],
            'expiration_date' => $data['expiration_date'],
            'status' => Batch::fefoStatusFor($data['expiration_date']),
            'quality_status' => 'approved',
            'purchase_order_code' => $data['purchase_order_code'] ?? null,
            'received_at' => now(),
        ]);

        if (! empty($data['purchase_order_code'])) {
            PurchaseOrder::where('code', $data['purchase_order_code'])
                ->update(['status' => 'partial']);
        }

        return response()->json([
            'batch' => $batch->load('ingredient'),
            'message' => 'Stock entry recorded',
            'summary' => $this->stockSummary(),
        ], 201);
    }

    /**
     * Salida de stock: descuenta del lote conservando initial_quantity.
     */
    public function exit(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $request->validate([
            'batch_id' => 'required|exists:batches,id',
            'quantity' => 'required|numeric|min:0.0001',
        ]);

        $batch = Batch::findOrFail($request->batch_id);

        if ($batch->quantity < $request->quantity) {
            return response()->json(['error' => 'Insufficient quantity'], 400);
        }

        $batch->quantity = round((float) $batch->quantity - (float) $request->quantity, 4);
        if ($batch->quantity <= 0) {
            $batch->status = 'critical';
        }
        $batch->save();

        return response()->json([
            'batch' => $batch,
            'message' => 'Stock exit recorded',
            'summary' => $this->stockSummary(),
        ]);
    }

    // ------------------------------------------------------------------
    //  Control de acceso
    // ------------------------------------------------------------------

    protected function hasStockReadAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasReadModuleAccess('inventory_stock');
    }

    protected function hasStockWriteAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess('inventory_stock');
    }

    /**
     * El CONTADOR consulta inventario a través de Reportes & Simulaciones.
     */
    protected function hasReportsAccess(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess('reports_simulations');
    }

    protected function canCreate(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && in_array('create', $user->role_permissions['can'] ?? []);
    }

    // ------------------------------------------------------------------
    //  Utilidades de respuesta
    // ------------------------------------------------------------------

    protected function stockSummary(): array
    {
        $now = now();

        $available = Batch::where('is_quarantined', false);

        $totalQuantity = (float) (clone $available)->sum('quantity');
        $totalInitial = (float) (clone $available)->sum('initial_quantity');
        $availableCount = (clone $available)->count();

        $optimal = Batch::where('expiration_date', '>', $now->copy()->addDays(7))->count();
        $warning = Batch::where('expiration_date', '>=', $now)
            ->where('expiration_date', '<=', $now->copy()->addDays(7))->count();
        $critical = Batch::where('expiration_date', '<', $now)->count();
        $totalBatches = Batch::count();

        $freshnessIndex = $totalBatches > 0 ? round(($optimal / $totalBatches) * 100, 1) : 0.0;
        $consumed = max($totalInitial - $totalQuantity, 0);

        $ingredientStatus = Ingredient::with(['batches' => fn ($q) => $q->where('is_quarantined', false)])
            ->get()
            ->map(function (Ingredient $ingredient) {
                $stock = (float) $ingredient->batches->sum('quantity');
                $min = (float) $ingredient->min_stock;

                return [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'available' => round($stock, 2),
                    'min_stock' => round($min, 2),
                    'coverage' => $min > 0 ? (int) round(min(($stock / $min) * 100, 999)) : null,
                    'status' => $stock <= 0 ? 'rupture' : ($min > 0 && $stock <= $min ? 'low' : 'ok'),
                ];
            });

        $topIngredients = DB::table('recipe_ingredient')
            ->join('ingredients', 'ingredients.id', '=', 'recipe_ingredient.ingredient_id')
            ->groupBy('ingredients.id', 'ingredients.name', 'ingredients.unit')
            ->select('ingredients.name', 'ingredients.unit', DB::raw('SUM(recipe_ingredient.quantity) as demand'), DB::raw('COUNT(*) as usage_count'))
            ->orderByDesc('demand')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'unit' => $row->unit,
                'usage_count' => (int) $row->usage_count,
                'demand' => round((float) $row->demand, 2),
            ])
            ->all();

        $availableBatches = (clone $available)->get();
        $avgAge = $availableBatches->count() > 0
            ? (int) round($availableBatches->avg(fn ($b) => $now->diffInDays($b->received_at)))
            : 0;

        return [
            'total' => $totalBatches,
            'available_batches' => $availableCount,
            'optimal' => $optimal,
            'warning' => $warning,
            'critical' => $critical,
            'quarantined' => Batch::where('is_quarantined', true)->count(),
            'total_quantity' => round($totalQuantity, 2),
            'capacity' => self::WAREHOUSE_CAPACITY,
            'occupancy' => self::WAREHOUSE_CAPACITY > 0 ? round(($totalQuantity / self::WAREHOUSE_CAPACITY) * 100, 1) : 0.0,
            'suppliers' => Batch::whereNotNull('supplier_name')->distinct()->count('supplier_name'),
            'zones' => $this->zoneOccupancy(),
            'low_stock' => $ingredientStatus->where('status', 'low')->values(),
            'rupture' => $ingredientStatus->where('status', 'rupture')->values(),
            'top_ingredients' => $topIngredients,
            'freshness_index' => $freshnessIndex,
            'avg_age_days' => $avgAge,
            'rotation_index' => $totalInitial > 0 ? round(($consumed / $totalInitial) * 100, 1) : 0.0,
        ];
    }

    protected function zoneOccupancy(): array
    {
        return Batch::where('is_quarantined', false)
            ->whereNotNull('storage_zone')
            ->groupBy('storage_zone')
            ->select('storage_zone', DB::raw('COUNT(*) as batches'), DB::raw('SUM(quantity) as quantity'))
            ->orderBy('storage_zone')
            ->get()
            ->map(fn ($row) => [
                'zone' => $row->storage_zone,
                'batches' => (int) $row->batches,
                'quantity' => round((float) $row->quantity, 2),
            ])
            ->all();
    }

    protected function alertsPayload(): array
    {
        $now = now();

        $critical = Batch::with('ingredient')->where('expiration_date', '<', $now)
            ->orderBy('expiration_date', 'asc')->get();

        $warning = Batch::with('ingredient')->where('expiration_date', '>=', $now)
            ->where('expiration_date', '<=', $now->copy()->addDays(7))
            ->orderBy('expiration_date', 'asc')->get();

        return [
            'critical_count' => $critical->count(),
            'warning_count' => $warning->count(),
            'critical_batches' => $critical,
            'warning_batches' => $warning,
        ];
    }
}
