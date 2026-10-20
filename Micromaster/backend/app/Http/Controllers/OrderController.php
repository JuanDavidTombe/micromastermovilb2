<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Route;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $user = Auth::guard('sanctum')->user();

        // El TRANSPORTISTA sólo ve sus propios pedidos
        $mine = $user && $user->role === User::ROLE_TRANSPORTISTA;

        $base = fn() => $mine ? Order::where('driver_id', $user->id) : Order::query();

        $orders = $base()
            ->with('route', 'driver')
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->payment_status, fn($q) => $q->where('payment_status', $request->payment_status))
            ->when($request->route_id, fn($q) => $q->where('route_id', $request->route_id))
            ->when($request->search, function ($q) use ($request) {
                $s = $request->search;
                $q->where(fn($qq) => $qq->where('client_name', 'like', "%{$s}%")
                    ->orWhere('destination', 'like', "%{$s}%"));
            })
            ->orderByDesc('id')
            ->paginate(15);

        return response()->json([
            'orders' => $orders->items(),
            'meta' => [
                'total' => $orders->total(),
                'pages' => $orders->lastPage(),
                'current_page' => $orders->currentPage(),
            ],
            'summary' => [
                'total' => $base()->count(),
                'pending' => $base()->where('status', 'pending')->count(),
                'in_transit' => $base()->where('status', 'in_transit')->count(),
                'delivered' => $base()->where('status', 'delivered')->count(),
                'total_amount' => round($base()->sum('amount'), 2),
            ],
        ]);
    }

    public function store(Request $request)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canCreate()) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'client_name' => 'required|string|max:255',
            'destination' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,qr',
            'route_id' => 'nullable|exists:routes,id',
        ]);

        $route = null;
        if (! empty($data['route_id'])) {
            $route = Route::find($data['route_id']);
            if (! $route) {
                return response()->json(['message' => 'La ruta seleccionada no existe'], 422);
            }
        }

        $order = Order::create([
            'client_name' => $data['client_name'],
            'destination' => $data['destination'],
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'],
            'route_id' => $route?->id,
            'driver_id' => $route?->driver_id,
            'status' => $route ? 'assigned' : 'pending',
            'payment_status' => 'pending',
            'otp_code' => $this->generateOtp(),
        ]);

        $order->load('route', 'driver');

        return response()->json(['order' => $order, 'message' => 'Pedido creado exitosamente'], 201);
    }

    public function show($id)
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }

        $order = Order::with('route', 'driver')->findOrFail($id);

        $user = Auth::guard('sanctum')->user();

        if ($user->role === User::ROLE_TRANSPORTISTA && (int) $order->driver_id !== (int) $user->id) {
            return $this->forbidden();
        }

        return response()->json(['order' => $order]);
    }

    public function update(Request $request, $id)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canUpdate()) {
            return $this->forbidden();
        }

        $order = Order::findOrFail($id);

        $data = $request->validate([
            'client_name' => 'sometimes|string|max:255',
            'destination' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0.01',
            'payment_method' => 'sometimes|in:cash,qr',
            'status' => 'sometimes|in:pending,assigned,in_transit,delivered,cancelled',
            'route_id' => 'nullable|exists:routes,id',
        ]);

        if (array_key_exists('route_id', $data)) {
            if ($data['route_id']) {
                $route = Route::find($data['route_id']);
                $order->route_id = $route->id;
                $order->driver_id = $route->driver_id;
                if ($order->status === 'pending') {
                    $order->status = 'assigned';
                }
            } else {
                $order->route_id = null;
                $order->driver_id = null;
            }
            unset($data['route_id']);
        }

        if (isset($data['status']) && $data['status'] === 'delivered' && ! $order->route_id) {
            return response()->json(['message' => 'Asigna una ruta antes de marcar como entregado'], 422);
        }

        $order->fill($data);
        $order->save();
        $order->load('route', 'driver');

        return response()->json(['order' => $order, 'message' => 'Pedido actualizado exitosamente']);
    }

    public function destroy($id)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canDelete()) {
            return $this->forbidden();
        }

        $order = Order::findOrFail($id);

        if (in_array($order->status, ['delivered', 'in_transit'])) {
            return response()->json(['message' => 'No se puede eliminar un pedido en tránsito o entregado'], 422);
        }

        $order->delete();

        return response()->json(['message' => 'Pedido eliminado exitosamente']);
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

    protected function generateOtp(): string
    {
        do {
            $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (Order::where('otp_code', $code)->exists());

        return $code;
    }
}
