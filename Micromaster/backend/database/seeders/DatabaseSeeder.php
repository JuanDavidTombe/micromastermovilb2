<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Ingredient;
use App\Models\Recipe;
use App\Models\RecipeIngredient;
use App\Models\Batch;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Route;
use App\Models\Order;
use App\Models\DriverLocation;
use App\Models\DeliveryIncident;
use App\Support\GpsSimulator;

class DatabaseSeeder extends Seeder
{
    /**
     * Depósito desde el que salen todas las rutas (Planta Principal).
     */
    private const DEPOT = ['label' => 'Planta Principal - Medellín', 'lat' => 6.24420000, 'lng' => -75.58120000];

    /**
     * Factor carretero y velocidad media para la estimación inicial de
     * distancia/duración (DirectionService del cliente la sustituye).
     */
    private const ROAD_FACTOR = 1.35;
    private const AVG_SPEED_KMH = 55;

    public function run(): void
    {
        // ADMINISTRADOR
        User::create([
            'name' => 'Juan David Tombe',
            'email' => 'admin@micromaster.com',
            'password' => Hash::make('admin123'),
            'role' => User::ROLE_ADMINISTRADOR,
        ]);

        // OPERARIO_LOGISTICO
        User::create([
            'name' => 'María Camila Palechor',
            'email' => 'logistica@micromaster.com',
            'password' => Hash::make('logistica123'),
            'role' => User::ROLE_OPERARIO_LOGISTICO,
        ]);

        // SUPERVISOR_PRODUCCION
        User::create([
            'name' => 'Kevin Jesus Millan',
            'email' => 'produccion@micromaster.com',
            'password' => Hash::make('produccion123'),
            'role' => User::ROLE_SUPERVISOR_PRODUCCION,
        ]);

        // CONTADOR
        User::create([
            'name' => 'Deiby Anderson Vitonco',
            'email' => 'contabilidad@micromaster.com',
            'password' => Hash::make('contabilidad123'),
            'role' => User::ROLE_CONTADOR,
        ]);

        // 5º rol: TRANSPORTISTA (conductores con app móvil de Logística)
        $driver1 = User::create([
            'name' => 'Andrés Rivas Castañeda',
            'email' => 'conductor1@micromaster.com',
            'password' => Hash::make('conductor123'),
            'role' => User::ROLE_TRANSPORTISTA,
            'phone' => '+57 310 445 8890',
            'vehicle' => 'Camión Chevrolet NPR · JKP 482',
            'photo_url' => 'https://randomuser.me/api/portraits/men/32.jpg',
        ]);

        $driver2 = User::create([
            'name' => 'Laura Sofía Marín',
            'email' => 'conductor2@micromaster.com',
            'password' => Hash::make('conductor123'),
            'role' => User::ROLE_TRANSPORTISTA,
            'phone' => '+57 315 209 7741',
            'vehicle' => 'Camión Isuzu NPR · MTR 917',
            'photo_url' => 'https://randomuser.me/api/portraits/women/44.jpg',
        ]);

        $driver3 = User::create([
            'name' => 'Camilo Andrés Ospino',
            'email' => 'conductor3@micromaster.com',
            'password' => Hash::make('conductor123'),
            'role' => User::ROLE_TRANSPORTISTA,
            'phone' => '+57 301 663 2058',
            'vehicle' => 'Camión Hyundai HD78 · TDS 305',
            'photo_url' => 'https://randomuser.me/api/portraits/men/76.jpg',
        ]);

        // Ingredients (Valores reales de mercado en Pesos Colombianos COP)
        $rice = Ingredient::create(['name' => 'Arroz Graneado', 'unit' => 'kg', 'cost_per_unit' => 4200.00]);
        $beans = Ingredient::create(['name' => 'Fríjoles Rojos', 'unit' => 'kg', 'cost_per_unit' => 8500.00]);
        $oil = Ingredient::create(['name' => 'Aceite Vegetal', 'unit' => 'litro', 'cost_per_unit' => 12000.00]);
        $salt = Ingredient::create(['name' => 'Sal Marina', 'unit' => 'kg', 'cost_per_unit' => 1800.00]);
        $sauce = Ingredient::create(['name' => 'Soya Sauce', 'unit' => 'litro', 'cost_per_unit' => 9500.00]);
        $pepper = Ingredient::create(['name' => 'Pimienta Negra', 'unit' => 'kg', 'cost_per_unit' => 28000.00]);
        $onion = Ingredient::create(['name' => 'Cebolla Junca', 'unit' => 'kg', 'cost_per_unit' => 3500.00]);
        $chicken = Ingredient::create(['name' => 'Pollo Fresco', 'unit' => 'kg', 'cost_per_unit' => 14500.00, 'is_variable_weight' => true]);

        // Recipes (BOM costeadas en COP)
        $recipe1 = Recipe::create(['name' => 'Base Arroz con Fríjoles', 'waste_percentage' => 5.00]);
        RecipeIngredient::create(['recipe_id' => $recipe1->id, 'ingredient_id' => $rice->id, 'quantity' => 1.0000, 'unit_cost' => 4200.00]);
        RecipeIngredient::create(['recipe_id' => $recipe1->id, 'ingredient_id' => $beans->id, 'quantity' => 0.5000, 'unit_cost' => 8500.00]);
        RecipeIngredient::create(['recipe_id' => $recipe1->id, 'ingredient_id' => $salt->id, 'quantity' => 0.0500, 'unit_cost' => 1800.00]);

        $recipe2 = Recipe::create(['name' => 'Pollo con Soya', 'waste_percentage' => 8.00]);
        RecipeIngredient::create(['recipe_id' => $recipe2->id, 'ingredient_id' => $chicken->id, 'quantity' => 1.0000, 'unit_cost' => 14500.00]);
        RecipeIngredient::create(['recipe_id' => $recipe2->id, 'ingredient_id' => $sauce->id, 'quantity' => 0.3000, 'unit_cost' => 9500.00]);
        RecipeIngredient::create(['recipe_id' => $recipe2->id, 'ingredient_id' => $oil->id, 'quantity' => 0.1000, 'unit_cost' => 12000.00]);
        RecipeIngredient::create(['recipe_id' => $recipe2->id, 'ingredient_id' => $pepper->id, 'quantity' => 0.0200, 'unit_cost' => 28000.00]);

        $recipe3 = Recipe::create(['name' => 'Sopa de Cebolla', 'waste_percentage' => 3.00]);
        RecipeIngredient::create(['recipe_id' => $recipe3->id, 'ingredient_id' => $onion->id, 'quantity' => 0.8000, 'unit_cost' => 3500.00]);
        RecipeIngredient::create(['recipe_id' => $recipe3->id, 'ingredient_id' => $oil->id, 'quantity' => 0.0500, 'unit_cost' => 12000.00]);
        RecipeIngredient::create(['recipe_id' => $recipe3->id, 'ingredient_id' => $salt->id, 'quantity' => 0.0300, 'unit_cost' => 1800.00]);

        // Batches with FEFO + trazabilidad (proveedor, QR, cantidad inicial)
        $now = now();
        $batches = [
            [$rice->id,   'BCH-ARR-20250101', 'Arroz del Valle S.A.',   'QR-ARR-0001-A7F3', 500.0000,  45, 'optimal', -10],
            [$rice->id,   'BCH-ARR-20241215', 'Arroz del Valle S.A.',   'QR-ARR-0002-B92C', 200.0000,   5, 'warning', -60],
            [$rice->id,   'BCH-ARR-20241101', 'Granos Unidos Ltda.',    'QR-ARR-0003-C41D',  50.0000,   2, 'critical', -90],
            [$beans->id,  'BCH-FRJ-20250110', 'Distribuidora Legumbres','QR-FRJ-0001-E88A', 300.0000,  60, 'optimal', -5],
            [$beans->id,  'BCH-FRJ-20241220', 'Distribuidora Legumbres','QR-FRJ-0002-F07B', 150.0000,   8, 'warning', -40],
            [$oil->id,    'BCH-ACE-20250105', 'Aceites del Caribe',     'QR-ACE-0001-G55E', 200.0000,  30, 'optimal', -15],
            [$chicken->id,'BCH-POL-20250112', 'Pollos Santa María',     'QR-POL-0001-H13F', 100.0000,   3, 'warning', -2],
            [$chicken->id,'BCH-POL-20241228', 'Pollos Santa María',     'QR-POL-0002-J90G',  30.0000,   1, 'critical', -45],
            [$onion->id,  'BCH-CEB-20250108', 'Cebollas del Norte',     'QR-CEB-0001-K26H', 400.0000,  20, 'optimal', -7],
        ];

        $zones = [
            $rice->id => 'A-01',
            $beans->id => 'A-01',
            $oil->id => 'B-01',
            $chicken->id => 'Refrigerado',
            $onion->id => 'C-01',
            $salt->id => 'A-02',
            $sauce->id => 'B-01',
            $pepper->id => 'A-02',
        ];

        foreach ($batches as [$ingId, $code, $supplier, $qr, $qty, $days, $status, $received]) {
            Batch::create([
                'ingredient_id' => $ingId,
                'batch_code' => $code,
                'supplier_name' => $supplier,
                'storage_zone' => $zones[$ingId] ?? 'A-01',
                'qr_code_hash' => $qr,
                'quantity' => $qty,
                'initial_quantity' => $qty,
                'expiration_date' => $now->copy()->addDays($days),
                'status' => $status,
                'received_at' => $now->copy()->addDays($received),
            ]);
        }

        // Despensas básicas: con esto "Base Arroz con Frijoles" y "Sopa de Cebolla"
        // quedan en VERDE (Insumos Suficientes) mientras que "Pollo con Soya"
        // sigue en ROJO por falta de Pimienta Negra -> se demuestran los dos estados.
        $pantry = [
            [$salt, 'BCH-SAL-20250115', 'Salinas del Magdalena', 'QR-SAL-0001-M37J', 25.0000, 400, 'optimal', -12],
            [$sauce, 'BCH-SOY-20250116', 'Salsas Oriental S.A.',  'QR-SOY-0001-N48K',  5.0000, 180, 'optimal', -8],
            [$pepper, 'BCH-PIM-20241105', 'Especias del Valle',    'QR-PIM-0001-P59L',  0.0000, 30, 'optimal', -20],
        ];

        foreach ($pantry as [$ing, $code, $supplier, $qr, $qty, $days, $status, $received]) {
            if ($qty <= 0) {
                continue; // la pimienta queda sin lote a proposit (receta en ROJO)
            }
            Batch::create([
                'ingredient_id' => $ing->id,
                'batch_code' => $code,
                'supplier_name' => $supplier,
                'storage_zone' => $zones[$ing->id] ?? 'A-02',
                'qr_code_hash' => $qr,
                'quantity' => $qty,
                'initial_quantity' => $qty,
                'expiration_date' => $now->copy()->addDays($days),
                'status' => $status,
                'received_at' => $now->copy()->addDays($received),
            ]);
        }

        // ------------------------------------------------------------------
        // ÓRDENES DE COMPRA (cruce OC en la recepción de proveedores)
        // ------------------------------------------------------------------
        $po1 = PurchaseOrder::create([
            'code' => 'OC-2026-001',
            'supplier_name' => 'Arroz del Valle S.A.',
            'expected_date' => $now->copy()->addDays(2),
            'status' => 'pending',
        ]);
        PurchaseOrderItem::create(['purchase_order_id' => $po1->id, 'ingredient_id' => $rice->id, 'expected_quantity' => 400]);
        PurchaseOrderItem::create(['purchase_order_id' => $po1->id, 'ingredient_id' => $beans->id, 'expected_quantity' => 250]);

        $po2 = PurchaseOrder::create([
            'code' => 'OC-2026-002',
            'supplier_name' => 'Salsas Oriental S.A.',
            'expected_date' => $now->copy()->addDays(4),
            'status' => 'pending',
        ]);
        PurchaseOrderItem::create(['purchase_order_id' => $po2->id, 'ingredient_id' => $sauce->id, 'expected_quantity' => 40]);
        PurchaseOrderItem::create(['purchase_order_id' => $po2->id, 'ingredient_id' => $oil->id, 'expected_quantity' => 120]);

        $po3 = PurchaseOrder::create([
            'code' => 'OC-2026-003',
            'supplier_name' => 'Pollos Santa María',
            'expected_date' => $now->copy()->addDays(1),
            'status' => 'pending',
        ]);
        PurchaseOrderItem::create(['purchase_order_id' => $po3->id, 'ingredient_id' => $chicken->id, 'expected_quantity' => 150]);
        PurchaseOrderItem::create(['purchase_order_id' => $po3->id, 'ingredient_id' => $pepper->id, 'expected_quantity' => 10]);

        // ------------------------------------------------------------------
        // RUTAS (Google Maps): origen, destino, distancia/duración estimada
        // ------------------------------------------------------------------
        $route1 = Route::create([
            'driver_id' => $driver1->id,
            'route_code' => 'RTE-001',
            'destination' => 'Bodega Central - Barranquilla',
            'origin_label' => self::DEPOT['label'],
            'origin_lat' => self::DEPOT['lat'],
            'origin_lng' => self::DEPOT['lng'],
            'status' => Route::STATUS_IN_PROGRESS,
            'scheduled_date' => $now->copy()->addDays(1),
        ]);

        $route2 = Route::create([
            'driver_id' => $driver2->id,
            'route_code' => 'RTE-002',
            'destination' => 'Mercado Norte - Cartagena',
            'origin_label' => self::DEPOT['label'],
            'origin_lat' => self::DEPOT['lat'],
            'origin_lng' => self::DEPOT['lng'],
            'status' => Route::STATUS_PENDING,
            'scheduled_date' => $now->copy()->addDays(2),
        ]);

        $route3 = Route::create([
            'driver_id' => $driver3->id,
            'route_code' => 'RTE-003',
            'destination' => 'Distribuidora Sur - Medellín',
            'origin_label' => self::DEPOT['label'],
            'origin_lat' => self::DEPOT['lat'],
            'origin_lng' => self::DEPOT['lng'],
            'status' => Route::STATUS_COMPLETED,
            'scheduled_date' => $now->copy()->subDays(1),
        ]);

        // ------------------------------------------------------------------
        // PEDIDOS con coordenadas de destino (Montos realistas en Pesos Colombianos COP)
        // ------------------------------------------------------------------
        $orders = [
            // [route, driver, destino, cliente, estado, pago, monto, recibido, cambio, otp, lat, lng]
            [$route1, $driver1, 'Bodega Central - Barranquilla', 'Distribuidora El Éxito', 'in_transit', 'cash',   1250000.00, 1500000.00, 250000.00, '8421', 10.96850000, -74.78130000],
            [$route1, $driver1, 'Bodega Central - Barranquilla', 'Mercados La Gran Vía',  'delivered',  'qr',      890000.00,  890000.00,   0.00, '3679', 11.00800000, -74.83000000],
            [$route2, $driver2, 'Mercado Norte - Cartagena',     'Supermercado Buen Día', 'assigned',   'cash',   2100000.00, null,     null,   '5103', 10.39100000, -75.51440000],
            [null,    null,     'Plaza de Mercado Sur - Bogotá', 'Almacenes Éxito S.A.',  'pending',    'qr',     3450000.00, null,     null,   '7264',  4.71100000, -74.07210000],
            [null,    null,     'Centro de Abastos - Cali',      'Distribuciones Andina', 'cancelled',  'cash',    780000.00, null,     null,   '1902',  3.45160000, -76.53200000],
            [$route3, $driver3, 'Distribuidora Sur - Medellín',  'Tiendas El Vecino',     'delivered',  'cash',   1675000.00, 2000000.00, 325000.00, '4458',  6.20880000, -75.56600000],
        ];

        foreach ($orders as [$route, $driver, $dest, $client, $status, $method, $amount, $received, $change, $otp, $lat, $lng]) {
            Order::create([
                'route_id' => $route?->id,
                'driver_id' => $driver?->id,
                'destination' => $dest,
                'latitude' => $lat,
                'longitude' => $lng,
                'client_name' => $client,
                'status' => $status,
                'payment_method' => $method,
                'payment_status' => match ($status) {
                    'delivered' => 'completed',
                    'in_transit' => 'confirmed',
                    'cancelled' => 'refunded',
                    default => 'pending',
                },
                'otp_code' => $otp,
                'amount' => $amount,
                'received_amount' => $received ?? 0.00,
                'change_due' => $change ?? 0.00,
            ]);
        }

        // Distancia/duración estimadas a partir del origen + paradas reales
        foreach ([$route1, $route2, $route3] as $route) {
            $this->estimateRoute($route->refresh());
        }

        // ------------------------------------------------------------------
        // ÚLTIMA POSICIÓN GPS DE CADA CONDUCTOR
        // ------------------------------------------------------------------
        DriverLocation::create([
            'driver_id' => $driver1->id,
            'latitude' => 8.61050000,
            'longitude' => -75.19000000,   // sobre la traza Medellín -> Barranquilla
            'speed_kmh' => 62.40,
            'heading' => 18.00,
            'recorded_at' => $now->copy()->subMinutes(4),   // sin señal -> la app simula el avance
        ]);

        DriverLocation::create([
            'driver_id' => $driver2->id,
            'latitude' => self::DEPOT['lat'],
            'longitude' => self::DEPOT['lng'],               // en vivo, estacionado en planta
            'speed_kmh' => 0.00,
            'heading' => 0.00,
            'recorded_at' => $now->copy()->subSeconds(12),
        ]);

        DriverLocation::create([
            'driver_id' => $driver3->id,
            'latitude' => 6.20880000,
            'longitude' => -75.56600000,
            'speed_kmh' => 0.00,
            'heading' => 0.00,
            'recorded_at' => $now->copy()->subMinutes(35),
        ]);

        // ------------------------------------------------------------------
        // NOVEDADES DE CAMPO (panel lateral de Logística)
        // ------------------------------------------------------------------
        DeliveryIncident::create([
            'order_id' => Order::where('otp_code', '8421')->first()->id,
            'route_id' => $route1->id,
            'driver_id' => $driver1->id,
            'type' => DeliveryIncident::TYPE_WRONG_ADDRESS,
            'description' => 'El cliente reportó una dirección incorrecta: confirmar acceso por la puerta 3 del depósito.',
            'status' => DeliveryIncident::STATUS_OPEN,
            'reported_at' => $now->copy()->subHours(2),
        ]);

        DeliveryIncident::create([
            'order_id' => Order::where('otp_code', '5103')->first()->id,
            'route_id' => $route2->id,
            'driver_id' => $driver2->id,
            'type' => DeliveryIncident::TYPE_VEHICLE_BREAKDOWN,
            'description' => 'Pinchazo en la llanta trasera sobre la vía al puerto. Se solicita grúa.',
            'status' => DeliveryIncident::STATUS_OPEN,
            'reported_at' => $now->copy()->subHours(1),
        ]);

        DeliveryIncident::create([
            'order_id' => Order::where('otp_code', '3679')->first()->id,
            'route_id' => $route1->id,
            'driver_id' => $driver1->id,
            'type' => DeliveryIncident::TYPE_CLIENT_NOT_FOUND,
            'description' => 'No había nadie en el punto de entrega a la hora programada.',
            'status' => DeliveryIncident::STATUS_RESOLVED,
            'resolution' => 'Se contactó al cliente y la entrega se reprogramó para la siguiente salida.',
            'reported_at' => $now->copy()->subDay(),
            'resolved_at' => $now->copy()->subHours(6),
        ]);
    }

    /**
     * Estimación inicial de distancia (Haversine × factor carretero) y
     * duración a velocidad media. DirectionService en el cliente la sustituye.
     */
    private function estimateRoute(Route $route): void
    {
        $path = [['latitude' => (float) $route->origin_lat, 'longitude' => (float) $route->origin_lng]];

        foreach ($route->orders()->orderBy('id')->get() as $order) {
            if ($order->latitude !== null && $order->longitude !== null) {
                $path[] = ['latitude' => (float) $order->latitude, 'longitude' => (float) $order->longitude];
            }
        }

        $km = 0.0;

        for ($i = 0; $i < count($path) - 1; $i++) {
            $km += GpsSimulator::distanceKm($path[$i], $path[$i + 1]);
        }

        $km *= self::ROAD_FACTOR;

        $route->update([
            'distance_km' => round($km, 2),
            'duration_min' => $km > 0 ? round(($km / self::AVG_SPEED_KMH) * 60, 1) : 0,
        ]);
    }
}
