<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Ingredient;
use App\Models\PurchaseOrder;
use App\Models\User;
use Carbon\Carbon;
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

        // Hard Lock por sistema: Cualquier lote alcanzando su fecha de vencimiento pasa automáticamente a cuarentena
        Batch::where('is_quarantined', false)
            ->whereDate('expiration_date', '<', now()->toDateString())
            ->update([
                'is_quarantined' => true,
                'quarantine_reason' => 'Bloqueo legal/sanitario automático: Fecha de vencimiento cumplida (Hard Lock)',
            ]);

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

    /**
     * GET /api/inventory/summary
     * DataGrid Maestro-Detalle para inventario web.
     * Devuelve cada insumo con su stock y valor total (Fila Maestra),
     * junto con su arreglo anidado de lotes ordenados estrictamente por FEFO (Sub-tabla).
     * Los cálculos de fechas y estado de alerta se resuelven en backend.
     */
    public function inventorySummary(Request $request)
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        // Hard Lock por sistema: Cualquier lote alcanzando su fecha de vencimiento pasa automáticamente a cuarentena
        Batch::where('is_quarantined', false)
            ->whereDate('expiration_date', '<', now()->toDateString())
            ->update([
                'is_quarantined' => true,
                'quarantine_reason' => 'Bloqueo legal/sanitario automático: Fecha de vencimiento cumplida (Hard Lock)',
            ]);

        $now = now()->startOfDay();

        // Obtenemos los insumos con sus lotes ordenados estrictamente por fecha de vencimiento (FEFO)
        $ingredients = Ingredient::with(['batches' => function ($query) {
            $query->orderBy('expiration_date', 'asc');
        }])
        ->orderBy('name', 'asc')
        ->get();

        $data = $ingredients->map(function (Ingredient $ingredient) use ($now) {
            $costPerUnit = (float) $ingredient->cost_per_unit;
            $allBatches = $ingredient->batches;

            $totalStock = (float) $allBatches->sum('quantity');
            $totalValue = round($totalStock * $costPerUnit, 2);
            $minStock = (float) $ingredient->min_stock;

            // Lotes ordenados estrictamente por FEFO con alertas precalculadas en backend
            $formattedBatches = $allBatches->map(function (Batch $batch) use ($now, $costPerUnit, $ingredient) {
                $batchQty = (float) $batch->quantity;
                $batchValue = round($batchQty * $costPerUnit, 2);

                $expDate = $batch->expiration_date ? Carbon::parse($batch->expiration_date)->startOfDay() : null;
                $daysToExpire = $expDate ? (int) $now->diffInDays($expDate, false) : 9999;
                $isQuarantined = (bool) $batch->is_quarantined;

                // Solo si hay alerta (rojas / naranjas):
                // - Cuarentena / Vencido / Vence hoy -> Rojo
                // - Próximo a vencer (<= 7 días) -> Naranja / Amber
                // - Óptimo (> 7 días) -> Sin alerta
                $hasAlert = false;
                $alertColor = null;
                $alertLabel = null;
                $lotStatus = 'optimal';

                if ($isQuarantined) {
                    $hasAlert = true;
                    $alertColor = 'red';
                    $alertLabel = 'En Cuarentena';
                    $lotStatus = 'quarantined';
                } elseif ($daysToExpire < 0) {
                    $hasAlert = true;
                    $alertColor = 'red';
                    $alertLabel = 'Venció hace ' . abs($daysToExpire) . 'd';
                    $lotStatus = 'critical';
                } elseif ($daysToExpire === 0) {
                    $hasAlert = true;
                    $alertColor = 'red';
                    $alertLabel = 'Vence HOY';
                    $lotStatus = 'critical';
                } elseif ($daysToExpire <= 7) {
                    $hasAlert = true;
                    $alertColor = 'amber';
                    $alertLabel = 'Vence en ' . $daysToExpire . 'd';
                    $lotStatus = 'warning';
                } else {
                    $lotStatus = 'optimal';
                    $hasAlert = false;
                    $alertColor = null;
                    $alertLabel = null;
                }

                return [
                    'id' => $batch->id,
                    'batch_code' => $batch->batch_code,
                    'qr_code_hash' => $batch->qr_code_hash ?: $batch->batch_code,
                    'supplier_name' => $batch->supplier_name ?: 'Proveedor Directo',
                    'ingredient' => [
                        'id' => $ingredient->id,
                        'name' => $ingredient->name,
                        'unit' => $ingredient->unit,
                    ],
                    'storage_zone' => $batch->storage_zone ?: 'Sin zona',
                    'quantity' => $batchQty,
                    'unit' => $ingredient->unit,
                    'cost_per_unit' => $costPerUnit,
                    'value' => $batchValue,
                    'expiration_date' => $batch->expiration_date?->toDateString(),
                    'expiration_date_human' => $batch->expiration_date ? Carbon::parse($batch->expiration_date)->format('d/m/Y') : '-',
                    'days_to_expire' => $daysToExpire,
                    'status' => $lotStatus,
                    'is_quarantined' => $isQuarantined,
                    'quarantine_reason' => $batch->quarantine_reason,
                    'has_alert' => $hasAlert,
                    'alert_color' => $alertColor,
                    'alert_label' => $alertLabel,
                ];
            });

            // Determinar Estado Global del Insumo (para Fila Maestra):
            $hasExpiredOrQuarantine = $formattedBatches->contains(fn ($b) => $b['is_quarantined'] || $b['days_to_expire'] <= 0);
            $hasExpiringSoon = $formattedBatches->contains(fn ($b) => ! $b['is_quarantined'] && $b['days_to_expire'] > 0 && $b['days_to_expire'] <= 7);

            if ($totalStock <= 0) {
                $globalStatus = 'rupture';
                $globalStatusLabel = 'Agotado';
                $globalStatusBadge = 'red';
            } elseif ($hasExpiredOrQuarantine) {
                $globalStatus = 'critical';
                $globalStatusLabel = 'Crítico / En Riesgo';
                $globalStatusBadge = 'red';
            } elseif ($hasExpiringSoon) {
                $globalStatus = 'warning';
                $globalStatusLabel = 'Por Vencer';
                $globalStatusBadge = 'amber';
            } elseif ($minStock > 0 && $totalStock <= $minStock) {
                $globalStatus = 'low';
                $globalStatusLabel = 'Bajo Stock';
                $globalStatusBadge = 'amber';
            } else {
                $globalStatus = 'ok';
                $globalStatusLabel = 'Óptimo';
                $globalStatusBadge = 'emerald';
            }

            return [
                'id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'cost_per_unit' => $costPerUnit,
                'stock_total' => $totalStock,
                'total_value' => $totalValue,
                'min_stock' => $minStock,
                'batches_count' => $formattedBatches->count(),
                'global_status' => $globalStatus,
                'global_status_label' => $globalStatusLabel,
                'global_status_badge' => $globalStatusBadge,
                'batches' => $formattedBatches->values()->all(),
            ];
        });

        return response()->json([
            'ingredients' => $data,
            'summary' => $this->stockSummary(),
        ]);
    }

    /**
     * GET /api/stock/purchase-orders
     * Listado de órdenes de compra para recepción por excepción.
     */
    public function purchaseOrdersList()
    {
        if (! $this->hasStockReadAccess()) {
            return $this->forbidden();
        }

        $orders = PurchaseOrder::with('items.ingredient')
            ->orderBy('expected_date', 'asc')
            ->get()
            ->map(function ($po) {
                $totalExpectedValue = $po->items->sum(function ($it) {
                    return (float) $it->expected_quantity * (float) ($it->ingredient?->cost_per_unit ?? 0);
                });

                return [
                    'id' => $po->id,
                    'code' => $po->code,
                    'supplier_name' => $po->supplier_name,
                    'expected_date' => $po->expected_date?->toDateString(),
                    'expected_date_human' => $po->expected_date ? Carbon::parse($po->expected_date)->format('d/m/Y') : '-',
                    'status' => $po->status,
                    'items_count' => $po->items->count(),
                    'total_expected_value' => round($totalExpectedValue, 2),
                    'items' => $po->items->map(function ($it) {
                        return [
                            'id' => $it->id,
                            'ingredient_id' => $it->ingredient_id,
                            'ingredient_name' => $it->ingredient?->name ?? 'Insumo',
                            'unit' => $it->ingredient?->unit ?? 'kg',
                            'cost_per_unit' => (float) ($it->ingredient?->cost_per_unit ?? 0),
                            'expected_quantity' => (float) $it->expected_quantity,
                            'is_variable_weight' => (bool) ($it->ingredient?->is_variable_weight ?? false),
                            'expected_value' => round((float) $it->expected_quantity * (float) ($it->ingredient?->cost_per_unit ?? 0), 2),
                        ];
                    }),
                ];
            });

        return response()->json(['purchase_orders' => $orders]);
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

        if (! $data['is_quarantined'] && Carbon::parse($batch->expiration_date)->lt(now()->startOfDay())) {
            return response()->json([
                'message' => 'Acción denegada: Un lote vencido no puede ser liberado de cuarentena por riesgo sanitario legal.',
            ], 422);
        }

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
            'temperature' => 'nullable|numeric',
            'temperature_notes' => 'nullable|string|max:1000',
            'gross_weight' => 'nullable|numeric|min:0',
            'tare_weight' => 'nullable|numeric|min:0',
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

        $ingredient = Ingredient::find($data['ingredient_id']);
        if ($ingredient && $ingredient->is_variable_weight) {
            $gross = isset($data['gross_weight']) ? (float) $data['gross_weight'] : null;
            $tare = isset($data['tare_weight']) ? (float) $data['tare_weight'] : 0;
            if ($gross !== null) {
                $net = round(max(0, $gross - $tare), 4);
                if ($net <= 0) {
                    return response()->json([
                        'message' => 'El peso neto (bruto − tara) debe ser mayor a cero.',
                    ], 422);
                }
                $data['quantity'] = $net;
            }
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
     * POST /api/stock/reception-match
     * Cruce de ASN / Factura de Proveedor por Excepción.
     * El operario solo digita lo que cuenta/pesa en el muelle.
     * El sistema calcula mermas/desvíos, crea los lotes físicos y actualiza el inventario.
     */
    public function receptionMatch(Request $request)
    {
        if (! $this->hasStockWriteAccess() || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'purchase_order_code' => 'required|string|exists:purchase_orders,code',
            'storage_zone' => 'required|string|max:50',
            'temperature' => 'nullable|numeric',
            'temperature_notes' => 'nullable|string|max:500',
            'quality_checklist' => 'required|array',
            'items' => 'required|array|min:1',
            'items.*.ingredient_id' => 'required|integer|exists:ingredients,id',
            'items.*.expected_quantity' => 'required|numeric|min:0',
            'items.*.received_quantity' => 'required|numeric|min:0',
            'items.*.expiration_date' => 'required|date',
            'items.*.gross_weight' => 'nullable|numeric',
            'items.*.tare_weight' => 'nullable|numeric',
            'items.*.batch_code' => 'nullable|string|max:100',
        ]);

        $po = PurchaseOrder::with('items.ingredient')->where('code', $data['purchase_order_code'])->firstOrFail();

        $batchesCreated = [];
        $deviations = [];
        $totalLossValue = 0;

        DB::beginTransaction();
        try {
            foreach ($data['items'] as $itemData) {
                $ingredient = Ingredient::findOrFail($itemData['ingredient_id']);
                $expected = (float) $itemData['expected_quantity'];
                $received = (float) $itemData['received_quantity'];
                $diff = round($received - $expected, 4);

                $dateSlug = Carbon::parse($itemData['expiration_date'])->format('Ymd');
                $codePrefix = 'LOT-' . preg_replace('/[^A-Za-z0-9]/', '', $po->code);
                $batchCode = ! empty($itemData['batch_code'])
                    ? $itemData['batch_code']
                    : $codePrefix . '-' . $ingredient->id . '-' . $dateSlug;

                $counter = 1;
                $originalCode = $batchCode;
                while (Batch::where('batch_code', $batchCode)->exists()) {
                    $batchCode = $originalCode . '-' . $counter;
                    $counter++;
                }

                $batch = null;
                if ($received > 0) {
                    $batch = Batch::create([
                        'ingredient_id' => $ingredient->id,
                        'batch_code' => $batchCode,
                        'supplier_name' => $po->supplier_name,
                        'storage_zone' => $data['storage_zone'],
                        'quantity' => $received,
                        'initial_quantity' => $received,
                        'expiration_date' => $itemData['expiration_date'],
                        'status' => Batch::fefoStatusFor($itemData['expiration_date']),
                        'quality_status' => 'approved',
                        'purchase_order_code' => $po->code,
                        'received_at' => now(),
                    ]);
                    $batchesCreated[] = $batch;
                }

                $costPerUnit = (float) $ingredient->cost_per_unit;
                $diffValue = round($diff * $costPerUnit, 2);

                if ($diff < 0) {
                    $totalLossValue += abs($diffValue);
                }

                $deviations[] = [
                    'ingredient_id' => $ingredient->id,
                    'ingredient' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'expected' => $expected,
                    'received' => $received,
                    'difference' => $diff,
                    'difference_value' => $diffValue,
                    'status' => $diff === 0.0 ? 'exact' : ($diff < 0 ? 'loss' : 'surplus'),
                    'batch_code' => $received > 0 ? $batchCode : null,
                ];
            }

            $hasShortage = collect($deviations)->contains(fn ($d) => $d['difference'] < 0);
            $po->status = $hasShortage ? 'partial' : 'completed';
            $po->save();

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al registrar la recepción: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Recepción de la Orden {$po->code} completada exitosamente.",
            'purchase_order_code' => $po->code,
            'status' => $po->status,
            'batches_created_count' => count($batchesCreated),
            'deviations' => $deviations,
            'total_loss_value' => $totalLossValue,
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

        if ($batch->is_quarantined || Carbon::parse($batch->expiration_date)->lt(now()->startOfDay())) {
            return response()->json([
                'error' => 'BATCH_LOCKED',
                'message' => 'Lote bloqueado: no se puede despachar stock de un lote en cuarentena o vencido.',
            ], 422);
        }

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

    /**
     * Movimientos de bodega para auditoría (Entradas, Mermas, Salidas).
     */
    public function movements(Request $request)
    {
        if (! $this->hasStockReadAccess() && ! $this->hasReportsAccess()) {
            return $this->forbidden();
        }

        Batch::where('is_quarantined', false)
            ->whereDate('expiration_date', '<', now()->toDateString())
            ->update([
                'is_quarantined' => true,
                'quarantine_reason' => 'Bloqueo legal/sanitario automático: Fecha de vencimiento cumplida (Hard Lock)',
            ]);

        $from = $request->filled('from')
            ? Carbon::parse($request->from)->startOfDay()
            : now()->subDays(180)->startOfDay();
        $to = $request->filled('to')
            ? Carbon::parse($request->to)->endOfDay()
            : now()->endOfDay();
        $type = $request->get('type', 'all');

        $rows = [];

        foreach (Batch::with('ingredient')->get() as $batch) {
            $receivedAt = $batch->received_at
                ? Carbon::parse($batch->received_at)
                : ($batch->created_at ? Carbon::parse($batch->created_at) : null);

            if ($receivedAt && $receivedAt->between($from, $to) && in_array($type, ['all', 'entradas'], true)) {
                $rows[] = $this->movementRow(
                    $batch,
                    'entrada',
                    $receivedAt,
                    (float) $batch->initial_quantity,
                    $batch->purchase_order_code ?: $batch->supplier_name,
                    'Recepción de mercancía'
                );
            }

            $consumed = round((float) $batch->initial_quantity - (float) $batch->quantity, 4);
            $movedAt = $batch->updated_at ? Carbon::parse($batch->updated_at) : $receivedAt;
            if ($consumed > 0 && $movedAt && $movedAt->between($from, $to) && in_array($type, ['all', 'salidas'], true)) {
                $rows[] = $this->movementRow($batch, 'salida', $movedAt, $consumed, null, 'Salida de stock');
            }

            if ($batch->is_quarantined && $movedAt && $movedAt->between($from, $to) && in_array($type, ['all', 'mermas'], true)) {
                $rows[] = $this->movementRow(
                    $batch,
                    'merma',
                    $movedAt,
                    (float) $batch->quantity,
                    null,
                    $batch->quarantine_reason ?: 'Merma / cuarentena'
                );
            }
        }

        usort($rows, fn ($a, $b) => strcmp($b['occurred_at'], $a['occurred_at']));

        return response()->json(['movements' => $rows]);
    }

    protected function movementRow(Batch $batch, string $type, Carbon $when, float $quantity, ?string $reference, string $notes): array
    {
        return [
            'id' => $type . '-' . $batch->id,
            'type' => $type,
            'occurred_at' => $when->toIso8601String(),
            'batch_code' => $batch->batch_code,
            'ingredient' => $batch->ingredient->name ?? '-',
            'unit' => $batch->ingredient->unit ?? '',
            'quantity' => round($quantity, 4),
            'reference' => $reference,
            'notes' => $notes,
            'storage_zone' => $batch->storage_zone,
            'supplier_name' => $batch->supplier_name,
        ];
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

        $totalInventoryValue = (float) (clone $available)
            ->join('ingredients', 'batches.ingredient_id', '=', 'ingredients.id')
            ->sum(DB::raw('batches.quantity * ingredients.cost_per_unit'));

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
                $costPerUnit = (float) $ingredient->cost_per_unit;
                $totalVal = round($stock * $costPerUnit, 2);

                return [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'cost_per_unit' => $costPerUnit,
                    'total_value' => $totalVal,
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
            'total_inventory_value' => round($totalInventoryValue, 2),
            'ingredient_valuations' => $ingredientStatus->values(),
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
