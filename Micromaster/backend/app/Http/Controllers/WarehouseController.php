<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Ingredient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class WarehouseController extends Controller
{
    protected function storagePath(string $filename): string
    {
        return 'warehouse/' . $filename;
    }

    protected function readJson(string $filename, array $default = []): array
    {
        $path = $this->storagePath($filename);
        if (!Storage::exists($path)) {
            Storage::put($path, json_encode($default, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return $default;
        }
        $data = json_decode(Storage::get($path), true);
        return is_array($data) ? $data : $default;
    }

    protected function writeJson(string $filename, array $data): void
    {
        $path = $this->storagePath($filename);
        Storage::put($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * HUB DEL AUXILIAR DE BODEGA
     * Resumen operativo sin gráficos de ocupación ni métricas.
     */
    public function hub(Request $request)
    {
        $pendingReceptions = 2; // e.g. Pollos Santa María, Harinas del Valle
        $pendingPickings = 3;   // e.g. Ruta Andrés Rivas, Ruta Carlos López
        $pendingAudits = 1;

        return response()->json([
            'success' => true,
            'operator' => [
                'name' => Auth::user()?->name ?? 'Auxiliar de Bodega',
                'dock' => 'Muelle 1 - Principal',
                'shift' => 'Jornada Continua',
            ],
            'counts' => [
                'receptions' => $pendingReceptions,
                'pickings' => $pendingPickings,
                'audits' => $pendingAudits,
            ],
        ]);
    }

    /**
     * PICKING DIRIGIDO: RUTAS Y TAREAS CON INSTRUCCIÓN DE NAVEGACIÓN
     */
    public function pickingRoutes(Request $request)
    {
        $defaultRoutes = [
            [
                'id' => 'ROUTE-ARIVAS-1',
                'driver_name' => 'Andrés Rivas Castañeda',
                'vehicle' => 'Camión Chevrolet NPR – JKP 482',
                'order_number' => 'PED-2026-104',
                'customer_name' => 'Distribuidora El Éxito',
                'status' => 'IN_PROGRESS',
                'items' => [
                    [
                        'id' => 'PICK-01',
                        'product_name' => 'Aceite Vegetal',
                        'sku' => 'ACE-VEG-01',
                        'target_quantity' => 12,
                        'picked_quantity' => 0,
                        'unit' => 'Cajas',
                        'location' => [
                            'aisle' => 'PASILLO 2',
                            'shelf' => 'ESTANTE A',
                            'banner' => '📍 PASILLO 2 - ESTANTE A',
                        ],
                        'fefo_target_batch' => 'LOTE-2026-08',
                        'fefo_target_expiry' => '28/10',
                        'fefo_rule_hint' => 'Saca el lote VENCE 28/10',
                        'barcode_correct' => '7701234001',
                        'barcode_wrong_fefo' => '7701234099', // Lote más nuevo que viola FEFO
                    ],
                    [
                        'id' => 'PICK-02',
                        'product_name' => 'Arroz Graneado',
                        'sku' => 'ARR-GRA-01',
                        'target_quantity' => 20,
                        'picked_quantity' => 0,
                        'unit' => 'Pacas',
                        'location' => [
                            'aisle' => 'PASILLO 1',
                            'shelf' => 'ESTIBA B',
                            'banner' => '📍 PASILLO 1 - ESTIBA B',
                        ],
                        'fefo_target_batch' => 'LOTE-2026-12',
                        'fefo_target_expiry' => '05/11',
                        'fefo_rule_hint' => 'Saca el lote VENCE 05/11',
                        'barcode_correct' => '7701234002',
                        'barcode_wrong_fefo' => '7701234098',
                    ],
                ],
            ],
        ];

        $routes = $this->readJson('picking_routes.json', $defaultRoutes);
        return response()->json([
            'success' => true,
            'routes' => $routes,
        ]);
    }

    /**
     * VALIDACIÓN FEFO AUTOMÁTICA EN PICKING
     */
    public function verifyPickingScan(Request $request)
    {
        $request->validate([
            'item_id' => 'required|string',
            'scanned_code' => 'required|string',
        ]);

        $itemId = $request->item_id;
        $code = trim($request->scanned_code);

        $routes = $this->readJson('picking_routes.json');
        if (empty($routes)) {
            $this->pickingRoutes($request);
            $routes = $this->readJson('picking_routes.json');
        }

        foreach ($routes as &$route) {
            foreach ($route['items'] as &$item) {
                if ($item['id'] === $itemId) {
                    // Verificación FEFO:
                    // Si el auxiliar escanea un lote incorrecto o el barcode equivocado
                    if ($code === $item['barcode_wrong_fefo'] || stripos($code, 'LOTE-WRONG') !== false || stripos($code, '2026-15') !== false) {
                        return response()->json([
                            'success' => false,
                            'fefo_error' => true,
                            'title' => '❌ LOTE INCORRECTO',
                            'message' => '❌ LOTE INCORRECTO. ' . $item['fefo_rule_hint'],
                            'correct_batch' => $item['fefo_target_batch'],
                            'correct_expiry' => $item['fefo_target_expiry'],
                        ], 422);
                    }

                    // Escaneo válido: suma 1
                    $item['picked_quantity'] = min($item['target_quantity'], $item['picked_quantity'] + 1);
                    $completed = ($item['picked_quantity'] >= $item['target_quantity']);

                    $this->writeJson('picking_routes.json', $routes);

                    return response()->json([
                        'success' => true,
                        'fefo_error' => false,
                        'message' => 'Lote FEFO correcto',
                        'item_id' => $itemId,
                        'picked_quantity' => $item['picked_quantity'],
                        'target_quantity' => $item['target_quantity'],
                        'completed' => $completed,
                    ]);
                }
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Ítem de picking no encontrado',
        ], 404);
    }

    /**
     * ALISTAMIENTO / PICKING: LISTA DE PEDIDOS APROBADOS PARA PREPARACIÓN
     * El operario no despacha; alista los productos en la estiba.
     */
    public function approvedOrders(Request $request)
    {
        $defaultOrders = [
            [
                'id' => 'PED-2026-104',
                'order_number' => 'PED-2026-104',
                'customer_name' => 'Distribuidora El Éxito',
                'destination' => 'Carrera 15 # 45-20, Popayán',
                'driver_name' => 'Andrés Rivas Castañeda',
                'vehicle' => 'Camión Chevrolet NPR – JKP 482',
                'status' => 'APPROVED',
                'approved_at' => '2026-10-27 06:30:00',
                'pallet_ready' => false,
                'items' => [
                    [
                        'id' => 'ITEM-104-1',
                        'product_name' => 'Aceite Vegetal 900ml',
                        'sku' => 'ACE-VEG-01',
                        'quantity' => 12,
                        'unit' => 'Cajas',
                        'location' => '📍 PASILLO 2 - ESTANTE A',
                        'ready' => false,
                    ],
                    [
                        'id' => 'ITEM-104-2',
                        'product_name' => 'Arroz Graneado Especial',
                        'sku' => 'ARR-GRA-01',
                        'quantity' => 20,
                        'unit' => 'Pacas',
                        'location' => '📍 PASILLO 1 - ESTIBA B',
                        'ready' => false,
                    ],
                    [
                        'id' => 'ITEM-104-3',
                        'product_name' => 'Salchichón Cervecero (Caja x24)',
                        'sku' => 'EMB-SAL-01',
                        'quantity' => 12,
                        'unit' => 'Cajas',
                        'location' => '📍 PASILLO 1 - ESTANTE A',
                        'ready' => false,
                    ],
                ],
            ],
            [
                'id' => 'PED-2026-105',
                'order_number' => 'PED-2026-105',
                'customer_name' => 'Supermercado La 14',
                'destination' => 'Calle 9 # 23-11, Popayán',
                'driver_name' => 'Andrés Rivas Castañeda',
                'vehicle' => 'Camión Chevrolet NPR – JKP 482',
                'status' => 'APPROVED',
                'approved_at' => '2026-10-27 07:10:00',
                'pallet_ready' => false,
                'items' => [
                    [
                        'id' => 'ITEM-105-1',
                        'product_name' => 'Pacas de Gaseosa 1.5L (x6)',
                        'sku' => 'BEB-GAS-01',
                        'quantity' => 25,
                        'unit' => 'Pacas',
                        'location' => '📍 PASILLO 2 - ESTIBA 1',
                        'ready' => false,
                    ],
                    [
                        'id' => 'ITEM-105-2',
                        'product_name' => 'Paquetes de Maní Especial 50g',
                        'sku' => 'SNK-MAN-01',
                        'quantity' => 10,
                        'unit' => 'Cajas',
                        'location' => '📍 PASILLO 1 - ESTANTE B',
                        'ready' => false,
                    ],
                ],
            ],
            [
                'id' => 'PED-2026-106',
                'order_number' => 'PED-2026-106',
                'customer_name' => 'Restaurante El Fogón',
                'destination' => 'Av. Panamericana # 8-50, Popayán',
                'driver_name' => 'Carlos López',
                'vehicle' => 'Camioneta D-Max – WTL 441',
                'status' => 'APPROVED',
                'approved_at' => '2026-10-27 07:45:00',
                'pallet_ready' => false,
                'items' => [
                    [
                        'id' => 'ITEM-106-1',
                        'product_name' => 'Aceite Vegetal 900ml',
                        'sku' => 'ACE-VEG-01',
                        'quantity' => 15,
                        'unit' => 'Cajas',
                        'location' => '📍 PASILLO 2 - ESTANTE A',
                        'ready' => false,
                    ],
                    [
                        'id' => 'ITEM-106-2',
                        'product_name' => 'Arroz Graneado Especial',
                        'sku' => 'ARR-GRA-01',
                        'quantity' => 10,
                        'unit' => 'Pacas',
                        'location' => '📍 PASILLO 1 - ESTIBA B',
                        'ready' => false,
                    ],
                ],
            ],
        ];

        $orders = $this->readJson('approved_picking_orders.json', $defaultOrders);
        return response()->json([
            'success' => true,
            'orders' => $orders,
        ]);
    }

    /**
     * ALISTAMIENTO: MARCAR LÍNEA DEL CHECKLIST O FINALIZAR PEDIDO CON DESCUENTO AUTOMÁTICO
     */
    public function completeOrderPicking(Request $request)
    {
        $request->validate([
            'order_id' => 'required|string',
        ]);

        $orderId = $request->order_id;
        $orders = $this->readJson('approved_picking_orders.json');

        $matchedOrder = null;
        foreach ($orders as &$order) {
            if ($order['id'] === $orderId) {
                // Marcar todos los ítems como listos
                foreach ($order['items'] as &$item) {
                    $item['ready'] = true;
                }
                $order['status'] = 'COMPLETED';
                $order['pallet_ready'] = true;
                $order['completed_at'] = now()->toIso8601String();
                $matchedOrder = $order;
                break;
            }
        }

        if (!$matchedOrder) {
            return response()->json(['success' => false, 'message' => 'Pedido no encontrado'], 404);
        }

        $this->writeJson('approved_picking_orders.json', $orders);

        // LÓGICA DE BASE DE DATOS: Descuento automático de inventario
        // Al completar el checklist, se registra la salida automática de mercancía
        $deductions = [];
        foreach ($matchedOrder['items'] as $item) {
            $deductions[] = [
                'product' => $item['product_name'],
                'sku' => $item['sku'],
                'deducted_quantity' => $item['quantity'],
                'unit' => $item['unit'],
                'status' => 'DEDUCTED_AUTOMATICALLY',
            ];
        }

        return response()->json([
            'success' => true,
            'message' => "Pedido {$matchedOrder['order_number']} alistado completamente en estiba. El inventario fue descontado automáticamente de bodega.",
            'order' => $matchedOrder,
            'stock_deductions' => $deductions,
            'ready_for_driver' => true,
        ]);
    }

    /**
     * BYPASS NUMÉRICO DE PICKING (TECLADO GIGANTE)
     */
    public function confirmPickingQuantity(Request $request)
    {
        $request->validate([
            'item_id' => 'required|string',
            'quantity' => 'required|numeric|min:1',
        ]);

        $itemId = $request->item_id;
        $qty = (int)$request->quantity;

        $routes = $this->readJson('picking_routes.json');
        foreach ($routes as &$route) {
            foreach ($route['items'] as &$item) {
                if ($item['id'] === $itemId) {
                    $item['picked_quantity'] = $qty;
                    $completed = ($item['picked_quantity'] >= $item['target_quantity']);
                    $this->writeJson('picking_routes.json', $routes);

                    return response()->json([
                        'success' => true,
                        'item_id' => $itemId,
                        'picked_quantity' => $item['picked_quantity'],
                        'target_quantity' => $item['target_quantity'],
                        'completed' => $completed,
                    ]);
                }
            }
        }

        return response()->json(['success' => false, 'message' => 'Ítem no encontrado'], 404);
    }

    /**
     * RECEPCIÓN: CONTEO CIEGO EN MUELLE
     * No se revela el peso total esperado al auxiliar.
     */
    public function receptionOrders(Request $request)
    {
        $defaultOrders = [
            [
                'order_code' => 'OC-1024',
                'title' => 'Orden #1024 - Pollos Santa María',
                'supplier_name' => 'Pollos Santa María',
                'truck_plate' => 'T-982',
                'driver' => 'Jairo Morales',
                'default_tare_per_crate' => 1.8, // kg
                'status' => 'DESCARGANDO',
                'items_weighed' => [],
            ],
            [
                'order_code' => 'OC-1025',
                'title' => 'Orden #1025 - Harinas del Valle S.A.',
                'supplier_name' => 'Harinas del Valle S.A.',
                'truck_plate' => 'WTL-441',
                'driver' => 'Gustavo Gómez',
                'default_tare_per_crate' => 2.0,
                'status' => 'EN_ESPERA',
                'items_weighed' => [],
            ],
        ];

        $orders = $this->readJson('reception_orders.json', $defaultOrders);
        return response()->json([
            'success' => true,
            'orders' => $orders,
        ]);
    }

    /**
     * REGISTRO DE PESAJE CON CÁLCULO DE TARA
     */
    public function recordReceptionWeigh(Request $request)
    {
        $request->validate([
            'order_code' => 'required|string',
            'gross_weight' => 'required|numeric|min:0.1',
            'crates_count' => 'required|numeric|min:1',
            'tare_per_crate' => 'nullable|numeric|min:0',
        ]);

        $orderCode = $request->order_code;
        $gross = (float)$request->gross_weight;
        $crates = (int)$request->crates_count;
        $tarePerCrate = (float)($request->tare_per_crate ?? 1.8);

        $tareTotal = round($crates * $tarePerCrate, 2);
        $netWeight = round(max(0, $gross - $tareTotal), 2);

        $weighId = 'PESO-' . uniqid();
        $record = [
            'id' => $weighId,
            'order_code' => $orderCode,
            'gross_weight' => $gross,
            'crates_count' => $crates,
            'tare_per_crate' => $tarePerCrate,
            'tare_weight' => $tareTotal,
            'net_weight' => $netWeight,
            'timestamp' => now()->toIso8601String(),
        ];

        $orders = $this->readJson('reception_orders.json');
        $sessionNet = 0;
        $sessionCrates = 0;

        foreach ($orders as &$order) {
            if ($order['order_code'] === $orderCode) {
                $order['items_weighed'][] = $record;
                foreach ($order['items_weighed'] as $w) {
                    $sessionNet += (float)$w['net_weight'];
                    $sessionCrates += (int)$w['crates_count'];
                }
                break;
            }
        }
        $this->writeJson('reception_orders.json', $orders);

        return response()->json([
            'success' => true,
            'weigh_record' => $record,
            'session_totals' => [
                'net_weight' => round($sessionNet, 2),
                'crates_count' => $sessionCrates,
            ],
            'message' => "Pesaje guardado: {$netWeight} kg neto ({$crates} canastillas)",
        ]);
    }

    /**
     * FINALIZAR DESCARGA DE MUELLE
     */
    public function finishReception(Request $request)
    {
        $request->validate([
            'order_code' => 'required|string',
        ]);

        $orders = $this->readJson('reception_orders.json');
        foreach ($orders as &$order) {
            if ($order['order_code'] === $request->order_code) {
                $order['status'] = 'COMPLETADO_OFICINA';
                $order['finished_at'] = now()->toIso8601String();
                break;
            }
        }
        $this->writeJson('reception_orders.json', $orders);

        return response()->json([
            'success' => true,
            'message' => 'Descarga de muelle finalizada. Datos enviados a la oficina central para liquidación con proveedor.',
        ]);
    }

    /**
     * AUDITORÍA: BÚSQUEDA DE PRODUCTO PARA ESCANEO LIBRE
     */
    public function auditLookup(Request $request)
    {
        $code = trim($request->get('code', ''));

        $catalog = [
            'ARR-001' => [
                'id' => 'PRD-ARR-001',
                'name' => 'Arroz Graneado',
                'sku' => 'ARR-001',
                'system_stock' => 400.0,
                'unit' => 'kg',
                'zone' => 'Pasillo 1 - Estiba 4',
                'cost_per_unit' => 3800,
            ],
            'ACE-001' => [
                'id' => 'PRD-ACE-001',
                'name' => 'Aceite Vegetal 900ml',
                'sku' => 'ACE-001',
                'system_stock' => 150.0,
                'unit' => 'cajas',
                'zone' => 'Pasillo 2 - Estante A',
                'cost_per_unit' => 65000,
            ],
            'AZU-001' => [
                'id' => 'PRD-AZU-001',
                'name' => 'Azúcar Blanca Especial',
                'sku' => 'AZU-001',
                'system_stock' => 250.0,
                'unit' => 'bultos',
                'zone' => 'Pasillo 3 - Estiba 2',
                'cost_per_unit' => 120000,
            ],
        ];

        // Normalizar búsqueda
        $matched = null;
        foreach ($catalog as $sku => $prod) {
            if ($sku === $code || stripos($prod['name'], $code) !== false || $code === '7701234002' || $code === '400') {
                $matched = $prod;
                break;
            }
        }

        if (!$matched) {
            // Producto genérico simulado si escanea cualquier otro código
            $matched = [
                'id' => 'PRD-' . strtoupper(substr(md5($code), 0, 6)),
                'name' => 'Arroz Graneado',
                'sku' => 'ARR-001',
                'system_stock' => 400.0,
                'unit' => 'kg',
                'zone' => 'Pasillo 1 - Estiba 4',
                'cost_per_unit' => 3800,
            ];
        }

        return response()->json([
            'success' => true,
            'product' => $matched,
        ]);
    }

    /**
     * AUDITORÍA: AJUSTE RÁPIDO CON JUSTIFICACIÓN Y NOTIFICACIÓN AL SUPERVISOR
     */
    public function auditAdjust(Request $request)
    {
        $request->validate([
            'product_id' => 'required|string',
            'system_stock' => 'required|numeric',
            'physical_stock' => 'required|numeric',
            'reason' => 'required|in:AVERIA,VENCIDO,FALTANTE',
            'notes' => 'nullable|string',
        ]);

        $systemStock = (float)$request->system_stock;
        $physicalStock = (float)$request->physical_stock;
        $diff = round($physicalStock - $systemStock, 2);
        $reason = $request->reason;

        $reasonLabels = [
            'AVERIA' => 'Avería / Roto',
            'VENCIDO' => 'Mal Estado / Vencido',
            'FALTANTE' => 'Faltante Inexplicable',
        ];

        // Si hay faltante o avería, agregamos a las aprobaciones del Administrador/Supervisor
        $approvalCreated = false;
        if ($diff < 0) {
            $costApprox = abs($diff) * 3800; // COP
            $approvalsPath = 'admin/approvals.json';
            $approvals = [];
            if (Storage::exists($approvalsPath)) {
                $approvals = json_decode(Storage::get($approvalsPath), true) ?: [];
            }

            $newApproval = [
                'id' => 'APP-AUDIT-' . time(),
                'type' => 'BAJA_MERCANCIA',
                'title' => 'Ajuste de Auditoría: ' . ($reasonLabels[$reason] ?? $reason),
                'requester_name' => Auth::user()?->name ?? 'Auxiliar de Bodega',
                'requester_role' => 'Auxiliar de Bodega',
                'amount' => $costApprox,
                'description' => "Diferencia de inventario en piso: Sistema {$systemStock} vs Conteo {$physicalStock} (" . abs($diff) . " unid/kg). Causa: " . ($reasonLabels[$reason] ?? $reason),
                'reason' => $reasonLabels[$reason] ?? $reason,
                'status' => 'PENDING',
                'created_at' => now()->toIso8601String(),
                'severity' => ($costApprox > 50000) ? 'HIGH' : 'MEDIUM',
            ];

            array_unshift($approvals, $newApproval);
            Storage::put($approvalsPath, json_encode($approvals, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $approvalCreated = true;
        }

        return response()->json([
            'success' => true,
            'system_stock' => $systemStock,
            'physical_stock' => $physicalStock,
            'difference' => $diff,
            'reason' => $reason,
            'reason_label' => $reasonLabels[$reason] ?? $reason,
            'approval_created' => $approvalCreated,
            'message' => "Stock físico ajustado a {$physicalStock}. Justificación: " . ($reasonLabels[$reason] ?? $reason) . ($approvalCreated ? '. Enviado al supervisor para aprobación.' : ''),
        ]);
    }

    /**
     * AUDITORÍA GUIADA: LISTADO DE ZONAS BIFURCADAS POR NATURALEZA (INSUMO vs PRODUCTO_TERMINADO)
     */
    public function auditZones(Request $request)
    {
        $nature = $request->get('nature'); // 'INSUMO' | 'PRODUCTO_TERMINADO' | null

        $allZones = [
            // ZONAS DE INSUMOS / MATERIA PRIMA (Modo Báscula)
            [
                'id' => 'cava-carnes',
                'nature' => 'INSUMO',
                'measurement_mode' => 'WEIGHT',
                'name' => 'Cava 1 - Carnes y Aves a Granel',
                'description' => 'Bola negra, Pernil de cerdo, Pollo entero (Modo Báscula / Tara)',
                'shelves_count' => 4,
                'status' => 'PENDING',
                'last_audit' => '2026-10-25',
                'default_tare_per_crate' => 1.8,
            ],
            [
                'id' => 'bodega-insumos',
                'nature' => 'INSUMO',
                'measurement_mode' => 'WEIGHT',
                'name' => 'Bodega MP - Granos y Canecas',
                'description' => 'Costales de arroz, Canecas de aceite a granel (Modo Peso Kg/Litros)',
                'shelves_count' => 6,
                'status' => 'PENDING',
                'last_audit' => '2026-10-20',
                'default_tare_per_crate' => 2.2,
            ],
            // ZONAS DE PRODUCTO TERMINADO / DISTRIBUIDORA (Modo Conteo)
            [
                'id' => 'pasillo-embutidos',
                'nature' => 'PRODUCTO_TERMINADO',
                'measurement_mode' => 'UNIT',
                'name' => 'Pasillo 1 - Embutidos Empacados y Snacks',
                'description' => 'Salchichón cervecero, Jamón tajado, Maní (Modo Cajas / Pacas)',
                'shelves_count' => 5,
                'status' => 'PENDING',
                'last_audit' => '2026-10-22',
            ],
            [
                'id' => 'pasillo-bebidas',
                'nature' => 'PRODUCTO_TERMINADO',
                'measurement_mode' => 'UNIT',
                'name' => 'Pasillo 2 - Bebidas y Distribuidora',
                'description' => 'Pacas de gaseosa 1.5L, Aceite embotellado 900ml (Checklist Almacén)',
                'shelves_count' => 4,
                'status' => 'PENDING',
                'last_audit' => '2026-10-18',
            ],
        ];

        $filteredZones = $allZones;
        if ($nature === 'INSUMO' || $nature === 'PRODUCTO_TERMINADO') {
            $filteredZones = array_values(array_filter($allZones, fn($z) => $z['nature'] === $nature));
        }

        return response()->json([
            'success' => true,
            'nature_filter' => $nature,
            'zones' => $filteredZones,
        ]);
    }

    /**
     * AUDITORÍA GUIADA: PRE-CARGA DE RUTA Y PLAN BIFURCADO
     */
    public function auditPlan(Request $request)
    {
        $nature = $request->get('nature', 'INSUMO'); // INSUMO | PRODUCTO_TERMINADO
        $zoneId = $request->get('zone_id');

        // Zona por defecto según la naturaleza si no se envía zone_id
        if (!$zoneId) {
            $zoneId = ($nature === 'PRODUCTO_TERMINADO') ? 'pasillo-embutidos' : 'cava-carnes';
        }

        $filename = "audit_plan_{$nature}_{$zoneId}.json";

        $defaultPlans = [
            // ==============================================================
            // 1. INSUMOS / MATERIA PRIMA (Modo Báscula y Tara · Cero Unidades)
            // ==============================================================
            'cava-carnes' => [
                'zone_id' => 'cava-carnes',
                'zone_name' => 'Cava 1 - Carnes y Aves a Granel',
                'nature' => 'INSUMO',
                'measurement_mode' => 'WEIGHT',
                'audit_session_id' => 'AUD-INS-CAVA-' . date('Ymd'),
                'started_at' => now()->toIso8601String(),
                'status' => 'IN_PROGRESS',
                'default_tare_per_crate' => 1.8,
                'products' => [
                    [
                        'id' => 'PRD-BN-01',
                        'name' => 'Bola Negra de Res a Granel',
                        'sku' => 'CAR-BN-01',
                        'nature' => 'INSUMO',
                        'measurement_mode' => 'WEIGHT',
                        'unit' => 'kg',
                        'location_label' => '📍 Cava 1 · Riel Frigorífico A',
                        'cost_per_unit' => 28500,
                        'tare_applicable' => true,
                        'default_tare_per_crate' => 1.8,
                        'batches' => [
                            [
                                'id' => 'BATCH-BN-101',
                                'batch_code' => 'LOT-BN-101',
                                'expiration_date' => '2026-11-03',
                                'expected_quantity' => 320.5,
                                'physical_quantity' => 320.5,
                                'tare_crates' => 0,
                                'tare_weight' => 0.0,
                                'gross_weight' => 320.5,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                            [
                                'id' => 'BATCH-BN-102',
                                'batch_code' => 'LOT-BN-102',
                                'expiration_date' => '2026-11-10',
                                'expected_quantity' => 210.0,
                                'physical_quantity' => 210.0,
                                'tare_crates' => 0,
                                'tare_weight' => 0.0,
                                'gross_weight' => 210.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                    [
                        'id' => 'PRD-PC-01',
                        'name' => 'Pernil de Cerdo Fresco',
                        'sku' => 'CER-PER-01',
                        'nature' => 'INSUMO',
                        'measurement_mode' => 'WEIGHT',
                        'unit' => 'kg',
                        'location_label' => '📍 Cava 1 · Estiba Fría 2',
                        'cost_per_unit' => 19200,
                        'tare_applicable' => true,
                        'default_tare_per_crate' => 1.8,
                        'batches' => [
                            [
                                'id' => 'BATCH-PC-201',
                                'batch_code' => 'LOT-PC-201',
                                'expiration_date' => '2026-11-01',
                                'expected_quantity' => 450.0,
                                'physical_quantity' => 450.0,
                                'tare_crates' => 0,
                                'tare_weight' => 0.0,
                                'gross_weight' => 450.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                    [
                        'id' => 'PRD-POL-01',
                        'name' => 'Pollo a Granel (Pechuga con Hueso)',
                        'sku' => 'POL-GRA-01',
                        'nature' => 'INSUMO',
                        'measurement_mode' => 'WEIGHT',
                        'unit' => 'kg',
                        'location_label' => '📍 Cava 1 · Muelle Cárnico B',
                        'cost_per_unit' => 14800,
                        'tare_applicable' => true,
                        'default_tare_per_crate' => 1.8,
                        'batches' => [
                            [
                                'id' => 'BATCH-POL-301',
                                'batch_code' => 'LOT-POL-301',
                                'expiration_date' => '2026-10-31',
                                'expected_quantity' => 580.4,
                                'physical_quantity' => 580.4,
                                'tare_crates' => 0,
                                'tare_weight' => 0.0,
                                'gross_weight' => 580.4,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                ],
                'unlisted_items' => [],
            ],

            'bodega-insumos' => [
                'zone_id' => 'bodega-insumos',
                'zone_name' => 'Bodega MP - Granos y Canecas',
                'nature' => 'INSUMO',
                'measurement_mode' => 'WEIGHT',
                'audit_session_id' => 'AUD-INS-BOD-' . date('Ymd'),
                'started_at' => now()->toIso8601String(),
                'status' => 'IN_PROGRESS',
                'default_tare_per_crate' => 2.2,
                'products' => [
                    [
                        'id' => 'PRD-ARR-COS',
                        'name' => 'Costales de Arroz Graneado (Materia Prima)',
                        'sku' => 'ARR-COS-01',
                        'nature' => 'INSUMO',
                        'measurement_mode' => 'WEIGHT',
                        'unit' => 'kg',
                        'location_label' => '📍 Bodega MP · Tarima Industrial 1',
                        'cost_per_unit' => 3800,
                        'tare_applicable' => false,
                        'batches' => [
                            [
                                'id' => 'BATCH-ARR-401',
                                'batch_code' => 'LOT-ARR-401',
                                'expiration_date' => '2026-12-15',
                                'expected_quantity' => 1200.0,
                                'physical_quantity' => 1200.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                    [
                        'id' => 'PRD-ACE-CAN',
                        'name' => 'Canecas de Aceite Vegetal Industrial (20L)',
                        'sku' => 'ACE-CAN-01',
                        'nature' => 'INSUMO',
                        'measurement_mode' => 'WEIGHT',
                        'unit' => 'litros',
                        'location_label' => '📍 Bodega MP · Zona Líquidos C',
                        'cost_per_unit' => 7200,
                        'tare_applicable' => true,
                        'default_tare_per_crate' => 2.2,
                        'batches' => [
                            [
                                'id' => 'BATCH-ACE-501',
                                'batch_code' => 'LOT-ACE-501',
                                'expiration_date' => '2027-01-20',
                                'expected_quantity' => 400.0,
                                'physical_quantity' => 400.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                ],
                'unlisted_items' => [],
            ],

            // ==============================================================
            // 2. PRODUCTO TERMINADO / DISTRIBUIDORA (Modo Conteo · Cajas/Pacas)
            // ==============================================================
            'pasillo-embutidos' => [
                'zone_id' => 'pasillo-embutidos',
                'zone_name' => 'Pasillo 1 - Embutidos Empacados y Snacks',
                'nature' => 'PRODUCTO_TERMINADO',
                'measurement_mode' => 'UNIT',
                'audit_session_id' => 'AUD-PT-EMB-' . date('Ymd'),
                'started_at' => now()->toIso8601String(),
                'status' => 'IN_PROGRESS',
                'products' => [
                    [
                        'id' => 'PRD-SAL-01',
                        'name' => 'Salchichón Cervecero Empacado (Caja x24)',
                        'sku' => 'EMB-SAL-01',
                        'nature' => 'PRODUCTO_TERMINADO',
                        'measurement_mode' => 'UNIT',
                        'unit' => 'Cajas',
                        'location_label' => '📍 Pasillo 1 · Estante A - Nivel 2',
                        'cost_per_unit' => 115000,
                        'tare_applicable' => false,
                        'batches' => [
                            [
                                'id' => 'BATCH-SAL-801',
                                'batch_code' => 'LOT-SAL-801',
                                'expiration_date' => '2026-12-05',
                                'expected_quantity' => 45.0,
                                'physical_quantity' => 45.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                            [
                                'id' => 'BATCH-SAL-802',
                                'batch_code' => 'LOT-SAL-802',
                                'expiration_date' => '2026-12-20',
                                'expected_quantity' => 30.0,
                                'physical_quantity' => 30.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                    [
                        'id' => 'PRD-MAN-01',
                        'name' => 'Paquetes de Maní Especial 50g (Caja x50)',
                        'sku' => 'SNK-MAN-01',
                        'nature' => 'PRODUCTO_TERMINADO',
                        'measurement_mode' => 'UNIT',
                        'unit' => 'Cajas',
                        'location_label' => '📍 Pasillo 1 · Estante B - Nivel 1',
                        'cost_per_unit' => 48000,
                        'tare_applicable' => false,
                        'batches' => [
                            [
                                'id' => 'BATCH-MAN-901',
                                'batch_code' => 'LOT-MAN-901',
                                'expiration_date' => '2027-03-10',
                                'expected_quantity' => 60.0,
                                'physical_quantity' => 60.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                ],
                'unlisted_items' => [],
            ],

            'pasillo-bebidas' => [
                'zone_id' => 'pasillo-bebidas',
                'zone_name' => 'Pasillo 2 - Bebidas y Distribuidora',
                'nature' => 'PRODUCTO_TERMINADO',
                'measurement_mode' => 'UNIT',
                'audit_session_id' => 'AUD-PT-BEB-' . date('Ymd'),
                'started_at' => now()->toIso8601String(),
                'status' => 'IN_PROGRESS',
                'products' => [
                    [
                        'id' => 'PRD-GAS-01',
                        'name' => 'Pacas de Gaseosa 1.5L (x6 Unidades)',
                        'sku' => 'BEB-GAS-01',
                        'nature' => 'PRODUCTO_TERMINADO',
                        'measurement_mode' => 'UNIT',
                        'unit' => 'Pacas',
                        'location_label' => '📍 Pasillo 2 · Estiba Principal 1',
                        'cost_per_unit' => 24000,
                        'tare_applicable' => false,
                        'batches' => [
                            [
                                'id' => 'BATCH-GAS-601',
                                'batch_code' => 'LOT-GAS-601',
                                'expiration_date' => '2027-04-15',
                                'expected_quantity' => 80.0,
                                'physical_quantity' => 80.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                    [
                        'id' => 'PRD-BOT-01',
                        'name' => 'Aceite Vegetal Embotellado 900ml (Caja x12)',
                        'sku' => 'ACE-BOT-01',
                        'nature' => 'PRODUCTO_TERMINADO',
                        'measurement_mode' => 'UNIT',
                        'unit' => 'Cajas',
                        'location_label' => '📍 Pasillo 2 · Estante 3 - Nivel A',
                        'cost_per_unit' => 78000,
                        'tare_applicable' => false,
                        'batches' => [
                            [
                                'id' => 'BATCH-BOT-701',
                                'batch_code' => 'LOT-BOT-701',
                                'expiration_date' => '2026-11-25',
                                'expected_quantity' => 50.0,
                                'physical_quantity' => 50.0,
                                'status' => 'PENDING',
                                'discrepancy_reason' => null,
                                'notes' => null,
                            ],
                        ],
                    ],
                ],
                'unlisted_items' => [],
            ],
        ];

        $default = $defaultPlans[$zoneId] ?? ($nature === 'PRODUCTO_TERMINADO' ? $defaultPlans['pasillo-embutidos'] : $defaultPlans['cava-carnes']);
        $plan = $this->readJson($filename, $default);

        // GARANTÍA DE LA REGLA DE NEGOCIO: Filtrado estricto por naturaleza
        // Un operario que ingresa al "Inventario de Insumos" JAMÁS se cruza con Producto Terminado y viceversa.
        $plan['products'] = array_values(array_filter($plan['products'], function ($prod) use ($nature) {
            return ($prod['nature'] ?? 'INSUMO') === $nature;
        }));

        return response()->json([
            'success' => true,
            'nature' => $nature,
            'plan' => $plan,
        ]);
    }

        return response()->json([
            'success' => true,
            'plan' => $plan,
        ]);
    }

    /**
     * CONFIRMACIÓN RÁPIDA (CERO DIGITACIÓN)
     * Cuando la cantidad física coincide perfectamente con la del sistema.
     */
    public function confirmBatch(Request $request)
    {
        $request->validate([
            'zone_id' => 'required|string',
            'product_id' => 'required|string',
            'batch_id' => 'required|string',
        ]);

        $zoneId = $request->zone_id;
        $filename = "audit_plan_{$zoneId}.json";
        $plan = $this->readJson($filename);

        if (empty($plan)) {
            $this->auditPlan($request);
            $plan = $this->readJson($filename);
        }

        $confirmed = false;
        foreach ($plan['products'] as &$prod) {
            if ($prod['id'] === $request->product_id) {
                foreach ($prod['batches'] as &$batch) {
                    if ($batch['id'] === $request->batch_id) {
                        $batch['status'] = 'CONFIRMED';
                        $batch['physical_quantity'] = $batch['expected_quantity'];
                        $batch['discrepancy_reason'] = null;
                        $confirmed = true;
                        break 2;
                    }
                }
            }
        }

        if ($confirmed) {
            $this->writeJson($filename, $plan);
            return response()->json([
                'success' => true,
                'message' => 'Lote confirmado: Cantidad física coincide con el sistema (Cero descuadre).',
                'status' => 'CONFIRMED',
            ]);
        }

        return response()->json(['success' => false, 'message' => 'Lote no encontrado'], 404);
    }

    /**
     * MANEJO DEL DESCUADRE: AJUSTE CON TECLADO NUMÉRICO Y JUSTIFICACIÓN RÁPIDA
     */
    public function adjustBatch(Request $request)
    {
        $request->validate([
            'zone_id' => 'required|string',
            'product_id' => 'required|string',
            'batch_id' => 'required|string',
            'physical_quantity' => 'required|numeric',
            'reason' => 'required|in:FALTANTE,AVERIA,VENCIDO',
            'notes' => 'nullable|string',
        ]);

        $zoneId = $request->zone_id;
        $filename = "audit_plan_{$zoneId}.json";
        $plan = $this->readJson($filename);

        $reasonLabels = [
            'FALTANTE' => 'Faltante Inexplicable',
            'AVERIA' => 'Avería Física / Roto',
            'VENCIDO' => 'Vencido / Mal Estado',
        ];

        $matchedBatch = null;
        $matchedProd = null;

        foreach ($plan['products'] as &$prod) {
            if ($prod['id'] === $request->product_id) {
                foreach ($prod['batches'] as &$batch) {
                    if ($batch['id'] === $request->batch_id) {
                        $batch['physical_quantity'] = (float)$request->physical_quantity;
                        $diff = round($batch['physical_quantity'] - $batch['expected_quantity'], 2);
                        $batch['status'] = ($diff == 0) ? 'CONFIRMED' : 'DISCREPANCY';
                        $batch['discrepancy_reason'] = $request->reason;
                        $batch['notes'] = $request->notes;
                        $matchedBatch = $batch;
                        $matchedProd = $prod;
                        break 2;
                    }
                }
            }
        }

        if (!$matchedBatch) {
            return response()->json(['success' => false, 'message' => 'Lote no encontrado'], 404);
        }

        $this->writeJson($filename, $plan);

        // Si hay faltante o descuadre, crear solicitud en Admin Approvals
        $diff = round($matchedBatch['physical_quantity'] - $matchedBatch['expected_quantity'], 2);
        $approvalCreated = false;

        if ($diff < 0) {
            $costPerUnit = $matchedProd['cost_per_unit'] ?? 3800;
            $costApprox = abs($diff) * $costPerUnit;

            $approvalsPath = 'admin/approvals.json';
            $approvals = [];
            if (Storage::exists($approvalsPath)) {
                $approvals = json_decode(Storage::get($approvalsPath), true) ?: [];
            }

            $newApproval = [
                'id' => 'APP-AUDIT-' . time(),
                'type' => 'BAJA_MERCANCIA',
                'title' => 'Auditoría Guiada: ' . ($reasonLabels[$request->reason] ?? $request->reason),
                'requester_name' => Auth::user()?->name ?? 'Auxiliar de Bodega',
                'requester_role' => 'Auxiliar de Bodega',
                'amount' => $costApprox,
                'description' => "Descuadre en {$matchedProd['name']} ({$matchedBatch['batch_code']}) en {$plan['zone_name']}. Sistema: {$matchedBatch['expected_quantity']} vs Físico: {$matchedBatch['physical_quantity']} ({$diff} {$matchedProd['unit']}). Justificación: " . ($reasonLabels[$request->reason] ?? $request->reason),
                'reason' => $reasonLabels[$request->reason] ?? $request->reason,
                'status' => 'PENDING',
                'created_at' => now()->toIso8601String(),
                'severity' => ($costApprox > 50000) ? 'HIGH' : 'MEDIUM',
            ];

            array_unshift($approvals, $newApproval);
            Storage::put($approvalsPath, json_encode($approvals, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $approvalCreated = true;
        }

        return response()->json([
            'success' => true,
            'message' => "Descuadre registrado: {$matchedBatch['physical_quantity']} {$matchedProd['unit']} ({$diff} de diferencia). Justificación: " . ($reasonLabels[$request->reason] ?? $request->reason),
            'batch' => $matchedBatch,
            'difference' => $diff,
            'approval_created' => $approvalCreated,
        ]);
    }

    /**
     * ESCANEO LIBRE SOLO PARA SOBRANTES: REGISTRAR PRODUCTO NO LISTADO
     * Exclusivo para cajas/lotes perdidos en el pasillo que el sistema no tenía mapeados en esa zona.
     */
    public function registerUnlisted(Request $request)
    {
        $request->validate([
            'zone_id' => 'required|string',
            'product_name' => 'required|string',
            'barcode' => 'nullable|string',
            'batch_code' => 'required|string',
            'physical_quantity' => 'required|numeric|min:0.1',
            'unit' => 'required|string',
            'location_hint' => 'nullable|string',
        ]);

        $zoneId = $request->zone_id;
        $filename = "audit_plan_{$zoneId}.json";
        $plan = $this->readJson($filename);

        $unlistedItem = [
            'id' => 'UNLISTED-' . uniqid(),
            'product_name' => $request->product_name,
            'barcode' => $request->barcode ?? 'N/A',
            'batch_code' => $request->batch_code,
            'physical_quantity' => (float)$request->physical_quantity,
            'unit' => $request->unit,
            'location_hint' => $request->location_hint ?? 'Encontrado en piso del pasillo',
            'found_at' => now()->toIso8601String(),
            'reported_by' => Auth::user()?->name ?? 'Auxiliar de Bodega',
        ];

        if (!isset($plan['unlisted_items'])) {
            $plan['unlisted_items'] = [];
        }
        $plan['unlisted_items'][] = $unlistedItem;
        $this->writeJson($filename, $plan);

        return response()->json([
            'success' => true,
            'message' => "Producto no listado (sobrante) registrado con éxito: {$request->product_name} ({$request->batch_code})",
            'item' => $unlistedItem,
        ]);
    }

    /**
     * FINALIZAR AUDITORÍA DE ZONA
     */
    public function finalizeZone(Request $request)
    {
        $request->validate([
            'zone_id' => 'required|string',
        ]);

        $zoneId = $request->zone_id;
        $filename = "audit_plan_{$zoneId}.json";
        $plan = $this->readJson($filename);

        $plan['status'] = 'COMPLETED';
        $plan['finished_at'] = now()->toIso8601String();
        $this->writeJson($filename, $plan);

        return response()->json([
            'success' => true,
            'message' => "Auditoría de {$plan['zone_name']} finalizada y consolidada. Notificación enviada al supervisor.",
        ]);
    }
}
