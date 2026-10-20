<?php

namespace App\Http\Controllers;

use App\Models\DeliveryIncident;
use App\Models\DriverLocation;
use App\Models\Order;
use App\Models\Route as DeliveryRoute;
use App\Models\User;
use App\Support\GpsSimulator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * MÓDULO LOGÍSTICA — Google Maps, conductores y novedades de campo.
 *
 *  GESTIÓN  (ADMINISTRADOR, OPERARIO_LOGISTICO)
 *      POST   /api/delivery/routes          crea RTE-00N y asigna pedidos
 *      PATCH  /api/delivery/routes/{id}     estado / fecha
 *      GET    /api/delivery/drivers         conductores + última GPS
 *      PATCH  /api/delivery/incidents/{id}  resolver / reasignar / cambiar ruta
 *
 *  OPERACIÓN (ADMINISTRADOR, OPERARIO_LOGISTICO, TRANSPORTISTA)
 *      GET    /api/delivery/routes          rutas activas con paradas y GPS
 *      GET    /api/delivery/routes/{id}
 *      POST   /api/delivery/location        la app móvil envía lat/lng
 *      GET    /api/delivery/incidents       panel de novedades
 *      POST   /api/delivery/incidents       el conductor reporta
 */
class LogisticsController extends Controller
{
    /**
     * Depósito por defecto desde el que se traza la ruta.
     */
    private const DEFAULT_DEPOT = [
        'label' => 'Planta Principal - Medellín',
        'lat' => 6.24420000,
        'lng' => -75.58120000,
    ];

    /**
     * GPS real considerado "fresco" hasta esta edad (segundos).
     */
    private const FRESH_GPS_SECONDS = 90;

    /**
     * Velocidad media usada para estimar la duración cuando no hay
     * Directions API habilitada (la sustituye DirectionsService en cliente).
     */
    private const AVG_SPEED_KMH = 55;

    /**
     * Factor carretero aplicado a la distancia en línea recta.
     */
    private const ROAD_FACTOR = 1.35;

    // ------------------------------------------------------------------
    //  RUTAS
    // ------------------------------------------------------------------

    public function routes(Request $request)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $user = Auth::guard('sanctum')->user();

        $query = DeliveryRoute::with(['driver.driverLocation'])
            ->withCount('orders')
            ->withCount(['orders as delivered_count' => fn($q) => $q->where('status', 'delivered')])
            ->with('orders:id,route_id,driver_id,destination,client_name,latitude,longitude,status,payment_status,amount')
            ->orderByRaw("FIELD(status,'in_progress','pending','completed')")
            ->orderBy('scheduled_date');

        // El conductor solo ve sus propias rutas
        if ($user->isTransportista()) {
            $query->where('driver_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($qq) => $qq
                ->where('route_code', 'like', "%{$s}%")
                ->orWhere('destination', 'like', "%{$s}%"));
        }

        $routes = $query->get()->map(fn($r) => $this->routePayload($r));

        return response()->json([
            'routes' => $routes,
            'summary' => [
                'total' => $routes->count(),
                'active' => $routes->filter(fn($r) => $r['status'] === DeliveryRoute::STATUS_IN_PROGRESS)->count(),
                'pending' => $routes->filter(fn($r) => $r['status'] === DeliveryRoute::STATUS_PENDING)->count(),
                'completed' => $routes->filter(fn($r) => $r['status'] === DeliveryRoute::STATUS_COMPLETED)->count(),
                'open_incidents' => $routes->sum(fn($r) => (int) $r['open_incidents']),
            ],
        ]);
    }

    public function routeDetail($id)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $route = DeliveryRoute::with(['driver.driverLocation', 'orders'])
            ->withCount('orders')
            ->withCount(['orders as delivered_count' => fn($q) => $q->where('status', 'delivered')])
            ->findOrFail($id);

        $user = Auth::guard('sanctum')->user();

        if ($user->isTransportista() && (int) $route->driver_id !== (int) $user->id) {
            return $this->forbidden();
        }

        return response()->json(['route' => $this->routePayload($route)]);
    }

    /**
     * POST /api/delivery/routes — crea la ruta y asigna los pedidos.
     */
    public function storeRoute(Request $request)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->checkRole(User::ROLE_ADMINISTRADOR, User::ROLE_OPERARIO_LOGISTICO)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'driver_id' => 'required|integer|exists:users,id',
            'scheduled_date' => 'required|date',
            'origin_label' => 'nullable|string|max:255',
            'origin_lat' => 'nullable|numeric|between:-90,90',
            'origin_lng' => 'nullable|numeric|between:-180,180',
        ]);

        $driver = User::findOrFail($data['driver_id']);

        if ($driver->role !== User::ROLE_TRANSPORTISTA) {
            return response()->json([
                'error' => 'DRIVER_NOT_TRANSPORTISTA',
                'message' => 'El conductor seleccionado no tiene el rol TRANSPORTISTA.',
            ], 422);
        }

        $orders = Order::whereIn('id', $data['order_ids'])->get();

        // Regla de negocio: sólo pedidos pendientes y SIN ruta asignada
        $blocked = $orders->filter(fn($o) => $o->route_id !== null || ! in_array($o->status, ['pending', 'assigned'], true));

        if ($blocked->isNotEmpty()) {
            return response()->json([
                'error' => 'ORDERS_NOT_AVAILABLE',
                'message' => 'Algunos pedidos ya tienen ruta o no están en estado pendiente.',
                'orders' => $blocked->map(fn($o) => [
                    'id' => $o->id,
                    'client_name' => $o->client_name,
                    'status' => $o->status,
                    'route_id' => $o->route_id,
                ])->values(),
            ], 422);
        }

        return DB::transaction(function () use ($data, $orders, $driver) {
            $origin = [
                'label' => $data['origin_label'] ?? self::DEFAULT_DEPOT['label'],
                'lat' => $data['origin_lat'] ?? self::DEFAULT_DEPOT['lat'],
                'lng' => $data['origin_lng'] ?? self::DEFAULT_DEPOT['lng'],
            ];

            $destinations = $orders->pluck('destination')->unique()->values();

            $route = DeliveryRoute::create([
                'driver_id' => $driver->id,
                'route_code' => $this->nextRouteCode(),
                'destination' => $this->composeDestination($destinations),
                'origin_label' => $origin['label'],
                'origin_lat' => $origin['lat'],
                'origin_lng' => $origin['lng'],
                'status' => DeliveryRoute::STATUS_IN_PROGRESS,
                'scheduled_date' => $data['scheduled_date'],
            ]);

            $orders->each(function ($order) use ($route, $driver) {
                $order->update([
                    'route_id' => $route->id,
                    'driver_id' => $driver->id,
                    'status' => 'assigned',
                ]);
            });

            // Estimación inicial (se sustituye por DirectionsService en cliente)
            $path = array_merge(
                [['latitude' => (float) $origin['lat'], 'longitude' => (float) $origin['lng']]],
                $orders->map(fn($o) => [
                    'latitude' => $o->latitude !== null ? (float) $o->latitude : (float) $origin['lat'],
                    'longitude' => $o->longitude !== null ? (float) $o->longitude : (float) $origin['lng'],
                ])->all()
            );

            $distance = 0.0;
            for ($i = 0; $i < count($path) - 1; $i++) {
                $distance += GpsSimulator::distanceKm($path[$i], $path[$i + 1]);
            }
            $distance *= self::ROAD_FACTOR;

            $route->update([
                'distance_km' => round($distance, 2),
                'duration_min' => $distance > 0 ? round(($distance / self::AVG_SPEED_KMH) * 60, 1) : 0,
            ]);

            $route->load(['driver.driverLocation', 'orders']);
            $route->setRelation('orders', $orders->fresh());

            return response()->json([
                'message' => "Ruta {$route->route_code} creada y conductor asignado",
                'route' => $this->routePayload($route->loadCount('orders')->loadCount(['orders as delivered_count' => fn($q) => $q->where('status', 'delivered')])),
            ], 201);
        });
    }

    public function updateRoute(Request $request, $id)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->checkRole(User::ROLE_ADMINISTRADOR, User::ROLE_OPERARIO_LOGISTICO)) {
            return $this->forbidden();
        }

        $request->validate([
            'status' => 'sometimes|nullable|in:pending,in_progress,completed',
            'scheduled_date' => 'sometimes|nullable|date',
            'driver_id' => 'sometimes|nullable|integer|exists:users,id',
        ]);

        $route = DeliveryRoute::with(['driver.driverLocation', 'orders'])->findOrFail($id);

        if ($request->filled('status')) {
            $route->status = $request->status;
        }

        if ($request->filled('scheduled_date')) {
            $route->scheduled_date = $request->scheduled_date;
        }

        if ($request->filled('driver_id')) {
            $driver = User::findOrFail($request->driver_id);

            if ($driver->role !== User::ROLE_TRANSPORTISTA) {
                return response()->json([
                    'error' => 'DRIVER_NOT_TRANSPORTISTA',
                    'message' => 'El conductor seleccionado no tiene el rol TRANSPORTISTA.',
                ], 422);
            }

            $route->driver_id = $driver->id;
            Order::where('route_id', $route->id)->update(['driver_id' => $driver->id]);
        }

        $route->save();
        $route->refresh()->load(['driver.driverLocation', 'orders']);

        return response()->json([
            'message' => 'Ruta actualizada',
            'route' => $this->routePayload($route),
        ]);
    }

    // ------------------------------------------------------------------
    //  CONDUCTORES
    // ------------------------------------------------------------------

    public function drivers()
    {
        if (! $this->checkRole(User::ROLE_ADMINISTRADOR, User::ROLE_OPERARIO_LOGISTICO)) {
            return $this->forbidden();
        }

        $drivers = User::where('role', User::ROLE_TRANSPORTISTA)
            ->with('driverLocation')
            ->withCount(['routes as active_routes_count' => fn($q) => $q->where('status', '!=', DeliveryRoute::STATUS_COMPLETED)])
            ->orderBy('name')
            ->get()
            ->map(fn($d) => $d->toDriverArray() + [
                'active_routes' => (int) $d->active_routes_count,
            ]);

        return response()->json(['drivers' => $drivers]);
    }

    // ------------------------------------------------------------------
    //  GPS (app móvil -> API web)
    // ------------------------------------------------------------------

    /**
     * POST /api/delivery/location — el conductor envía su coordenada.
     */
    public function sendLocation(Request $request)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'speed_kmh' => 'nullable|numeric|min:0|max:400',
            'heading' => 'nullable|numeric|min:0|max:360',
            'driver_id' => 'nullable|integer|exists:users,id',
        ]);

        $auth = Auth::guard('sanctum')->user();

        $driverId = (int) ($data['driver_id'] ?? $auth->id);

        // Sólo logística/admin puede registrar GPS en nombre de otro conductor
        if ($driverId !== (int) $auth->id && ! $this->checkRole(User::ROLE_ADMINISTRADOR, User::ROLE_OPERARIO_LOGISTICO)) {
            return $this->forbidden();
        }

        $location = DriverLocation::updateOrCreate(
            ['driver_id' => $driverId],
            [
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'speed_kmh' => $data['speed_kmh'] ?? null,
                'heading' => $data['heading'] ?? null,
                'recorded_at' => now(),
            ]
        );

        $driver = User::with('driverLocation')->findOrFail($driverId);

        return response()->json([
            'message' => 'Ubicación registrada',
            'location' => [
                'latitude' => (float) $location->latitude,
                'longitude' => (float) $location->longitude,
                'recorded_at' => $location->recorded_at->toIso8601String(),
                'signal' => $location->signal(),
            ],
            'driver' => $driver->toDriverArray(),
        ], 201);
    }

    // ------------------------------------------------------------------
    //  INCIDENCIAS / NOVEDADES DE CAMPO
    // ------------------------------------------------------------------

    public function incidents(Request $request)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $user = Auth::guard('sanctum')->user();

        $query = DeliveryIncident::with(['route:id,route_code,status', 'order:id,client_name,destination,latitude,longitude', 'driver.driverLocation'])
            ->orderByRaw("FIELD(status,'OPEN','RESOLVED')")
            ->orderByDesc('reported_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('route_id')) {
            $query->where('route_id', $request->route_id);
        }

        if ($user->isTransportista()) {
            $query->where('driver_id', $user->id);
        }

        $incidents = $query->get();

        return response()->json([
            'incidents' => $incidents->map(fn($i) => $i->toPanelArray()),
            'summary' => [
                'total' => $incidents->count(),
                'open' => $incidents->filter(fn($i) => $i->status === DeliveryIncident::STATUS_OPEN)->count(),
                'resolved' => $incidents->filter(fn($i) => $i->status === DeliveryIncident::STATUS_RESOLVED)->count(),
            ],
        ]);
    }

    public function storeIncident(Request $request)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
            'type' => 'required|in:' . implode(',', [
                DeliveryIncident::TYPE_CLIENT_NOT_FOUND,
                DeliveryIncident::TYPE_VEHICLE_BREAKDOWN,
                DeliveryIncident::TYPE_WRONG_ADDRESS,
                DeliveryIncident::TYPE_OTHER,
            ]),
            'description' => 'nullable|string|max:1000',
            'route_id' => 'nullable|integer|exists:routes,id',
            'driver_id' => 'nullable|integer|exists:users,id',
        ]);

        $order = Order::findOrFail($data['order_id']);

        $routeId = $data['route_id'] ?? $order->route_id;

        if (! $routeId) {
            return response()->json([
                'error' => 'ORDER_WITHOUT_ROUTE',
                'message' => 'El pedido no tiene ruta asignada: no es posible reportar una novedad de campo.',
            ], 422);
        }

        $auth = Auth::guard('sanctum')->user();
        $driverId = (int) ($data['driver_id'] ?? $order->driver_id ?? $auth->id);

        $incident = DeliveryIncident::create([
            'order_id' => $order->id,
            'route_id' => $routeId,
            'driver_id' => $driverId,
            'type' => $data['type'],
            'description' => $data['description'] ?? null,
            'status' => DeliveryIncident::STATUS_OPEN,
            'reported_at' => now(),
        ]);

        $incident->load(['route:id,route_code,status', 'order:id,client_name,destination,latitude,longitude', 'driver.driverLocation']);

        return response()->json([
            'message' => 'Novedad registrada',
            'incident' => $incident->toPanelArray(),
        ], 201);
    }

    /**
     * PATCH /api/delivery/incidents/{id}
     *
     * Tres acciones sobre una novedad (todas desde el panel lateral):
     *   status=RESOLVED  -> Marcar como Resuelta
     *   driver_id        -> Reasignar Conductor (cambia el de la ruta y sus pedidos)
     *   route_id         -> Cambiar Ruta (mueve el pedido a otra ruta)
     */
    public function updateIncident(Request $request, $id)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->checkRole(User::ROLE_ADMINISTRADOR, User::ROLE_OPERARIO_LOGISTICO)) {
            return $this->forbidden();
        }

        $request->validate([
            'status' => 'sometimes|nullable|in:OPEN,RESOLVED',
            'resolution' => 'nullable|string|max:500',
            'driver_id' => 'sometimes|nullable|integer|exists:users,id',
            'route_id' => 'sometimes|nullable|integer|exists:routes,id',
        ]);

        $incident = DeliveryIncident::with(['route', 'order', 'driver'])
            ->findOrFail($id);

        $actions = [];

        // 1) Reasignar conductor
        if ($request->filled('driver_id')) {
            $driver = User::findOrFail($request->driver_id);

            if ($driver->role !== User::ROLE_TRANSPORTISTA) {
                return response()->json([
                    'error' => 'DRIVER_NOT_TRANSPORTISTA',
                    'message' => 'El conductor seleccionado no tiene el rol TRANSPORTISTA.',
                ], 422);
            }

            $incident->driver_id = $driver->id;

            if ($incident->route) {
                $incident->route->driver_id = $driver->id;
                $incident->route->save();
                Order::where('route_id', $incident->route_id)->update(['driver_id' => $driver->id]);
            }

            $actions[] = "Conductor reasignado a {$driver->name}";
        }

        // 2) Cambiar de ruta (mueve el pedido afectado)
        if ($request->filled('route_id')) {
            $newRoute = DeliveryRoute::findOrFail($request->route_id);

            if ($incident->order) {
                $incident->order->route_id = $newRoute->id;
                $incident->order->driver_id = $newRoute->driver_id;
                $incident->order->save();
            }

            $incident->route_id = $newRoute->id;
            $incident->driver_id = $newRoute->driver_id;
            $actions[] = "Pedido movido a la ruta {$newRoute->route_code}";
        }

        // 3) Marcar como resuelta
        if ($request->filled('status')) {
            $incident->status = $request->status;

            if ($request->status === DeliveryIncident::STATUS_RESOLVED) {
                $incident->resolved_at = now();
                $incident->resolution = $request->resolution ?? 'Resuelta desde el panel de Logística';
                $actions[] = 'Novedad marcada como resuelta';
            } else {
                $incident->resolved_at = null;
                $incident->resolution = null;
                $actions[] = 'Novedad reabierta';
            }
        }

        $incident->save();
        $incident->refresh()->load(['route:id,route_code,status', 'order:id,client_name,destination,latitude,longitude', 'driver.driverLocation']);

        return response()->json([
            'message' => implode(' · ', $actions) ?: 'Novedad actualizada',
            'incident' => $incident->toPanelArray(),
        ]);
    }

    // ------------------------------------------------------------------
    //  Utilidades
    // ------------------------------------------------------------------

    private function routePayload(DeliveryRoute $route): array
    {
        $stops = $route->stops();
        $total = $route->orders_count ?? $route->orders()->count();
        $delivered = $route->delivered_count ?? $route->orders()->where('status', 'delivered')->count();

        return [
            'id' => $route->id,
            'route_code' => $route->route_code,
            'destination' => $route->destination,
            'origin_label' => $route->origin_label,
            'origin_lat' => $route->origin_lat !== null ? (float) $route->origin_lat : null,
            'origin_lng' => $route->origin_lng !== null ? (float) $route->origin_lng : null,
            'status' => $route->status,
            'status_label' => $route->status_label,
            'scheduled_date' => $route->scheduled_date?->toDateString(),
            'distance_km' => $route->distance_km !== null ? (float) $route->distance_km : null,
            'duration_min' => $route->duration_min !== null ? (float) $route->duration_min : null,
            'progress' => $total > 0 ? round(($delivered / $total) * 100, 1) : 0.0,
            'stops_count' => $total,
            'delivered_count' => $delivered,
            'stops' => $stops,
            'driver' => $route->driver ? $route->driver->toDriverArray() : null,
            'driver_gps' => $this->driverGps($route, $stops),
            'open_incidents' => $route->incidents()->where('status', DeliveryIncident::STATUS_OPEN)->count(),
            'created_at' => $route->created_at?->toIso8601String(),
        ];
    }

    /**
     * Posición del camión en el mapa.
     *  1. GPS real transmitido por la app si tiene <= 90 s   -> source: real
     *  2. si no, interpolación sobre las paradas de la ruta  -> source: simulated
     *  Ruta sin iniciar -> depósito.  Ruta completada -> última parada.
     *  Señal: en ruta en curso -> live, ruta pendiente -> weak, cerrada -> stale.
     */
    private function driverGps(DeliveryRoute $route, array $stops): ?array
    {
        $location = $route->driver?->driverLocation;

        if ($location && $location->ageSeconds() <= self::FRESH_GPS_SECONDS) {
            return [
                'latitude' => (float) $location->latitude,
                'longitude' => (float) $location->longitude,
                'heading' => (float) ($location->heading ?? 0),
                'speed_kmh' => $location->speed_kmh !== null ? (float) $location->speed_kmh : null,
                'source' => 'real',
                'signal' => $location->signal(),
                'updated_at' => $location->recorded_at->toIso8601String(),
                'age_seconds' => $location->ageSeconds(),
            ];
        }

        if ($route->origin_lat === null && $stops === []) {
            return null;
        }

        $path = array_merge(
            $route->origin_lat !== null
                ? [['latitude' => (float) $route->origin_lat, 'longitude' => (float) $route->origin_lng]]
                : [],
            $stops
        );

        $position = match ($route->status) {
            DeliveryRoute::STATUS_PENDING => ['latitude' => (float) $path[0]['latitude'], 'longitude' => (float) $path[0]['longitude'], 'heading' => 0.0, 'leg_index' => 0],
            DeliveryRoute::STATUS_COMPLETED => ['latitude' => (float) $path[count($path) - 1]['latitude'], 'longitude' => (float) $path[count($path) - 1]['longitude'], 'heading' => 0.0, 'leg_index' => count($path) - 2],
            default => GpsSimulator::position($path, GpsSimulator::phase($route->driver_id, max(count($stops), 3))),
        };

        if (! $position) {
            return null;
        }

        $age = $location ? $location->ageSeconds() : null;
        $signal = match ($route->status) {
            DeliveryRoute::STATUS_IN_PROGRESS => 'live',
            DeliveryRoute::STATUS_PENDING => 'weak',
            default => 'stale',
        };

        return [
            'latitude' => round($position['latitude'], 8),
            'longitude' => round($position['longitude'], 8),
            'heading' => $position['heading'],
            'speed_kmh' => $route->status === DeliveryRoute::STATUS_IN_PROGRESS ? 32.0 : 0.0,
            'source' => 'simulated',
            'signal' => $signal,
            'updated_at' => $signal === 'stale'
                ? ($location ? $location->recorded_at->toIso8601String() : null)
                : now()->toIso8601String(),
            'age_seconds' => $signal === 'stale' ? $age : 0,
        ];
    }

    private function nextRouteCode(): string
    {
        $last = 0;

        foreach (DeliveryRoute::pluck('route_code') as $code) {
            if (preg_match('/(\d+)$/', (string) $code, $m)) {
                $last = max($last, (int) $m[1]);
            }
        }

        return 'RTE-' . str_pad((string) ($last + 1), 3, '0', STR_PAD_LEFT);
    }

    private function composeDestination($destinations): string
    {
        $destinations = collect($destinations)->filter()->unique()->values();

        if ($destinations->isEmpty()) {
            return 'Ruta de entrega';
        }

        if ($destinations->count() <= 2) {
            return $destinations->implode(' → ');
        }

        return $destinations->first() . ' → +' . ($destinations->count() - 1) . ' paradas';
    }
}
