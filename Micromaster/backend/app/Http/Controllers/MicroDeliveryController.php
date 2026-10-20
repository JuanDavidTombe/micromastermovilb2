<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MicroDeliveryController extends Controller
{
    public function orders(Request $request)
    {
        if (! $this->checkModule('orders_delivery') && ! $this->checkModule('reports_simulations')) {
            return $this->forbidden();
        }

        $user = Auth::guard('sanctum')->user();

        $orders = Order::with('route', 'driver')
            ->when($user && $user->role === User::ROLE_TRANSPORTISTA,
                fn($q) => $q->where('driver_id', $user->id))
            ->when($request->route_id, fn($q) => $q->where('route_id', $request->route_id))
            ->when($request->status, fn($q) => $q->where('payment_status', $request->status))
            ->paginate(20);

        return response()->json(['orders' => $orders->items()]);
    }

    public function verifyOtp(Request $request)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canCreate()) {
            return $this->forbidden();
        }
        $request->validate([
            'otp_code' => 'required|string|size:4',
        ]);

        $order = Order::where('otp_code', $request->otp_code)->first();

        if (! $order) {
            return response()->json(['valid' => false, 'message' => 'Código OTP no válido'], 404);
        }

        return response()->json([
            'valid' => true,
            'order' => [
                'id' => $order->id,
                'destination' => $order->destination,
                'amount' => $order->amount,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
            ],
        ]);
    }

    public function updatePayment(Request $request)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canUpdate()) {
            return $this->forbidden();
        }
        $request->validate([
            'order_id' => 'required|exists:orders,id',
            'payment_method' => 'required|in:cash,qr',
            'received_amount' => 'required|numeric|min:0',
            'contingency' => 'sometimes|boolean',
            'contingency_reason' => 'nullable|string|max:500',
        ]);

        $order = Order::findOrFail($request->order_id);
        $order->payment_method = $request->payment_method;
        $order->received_amount = $request->received_amount;
        $order->change_due = round($request->received_amount - $order->amount, 2);
        $order->payment_status = 'confirmed';

        if ($request->boolean('contingency')) {
            if (! $this->canBypass()) {
                return $this->forbidden();
            }
            if (! $request->filled('contingency_reason')) {
                return response()->json(['message' => 'El motivo de contingencia es obligatorio'], 422);
            }
            $order->contingency = true;
            $order->contingency_reason = $request->contingency_reason;
        }

        $order->save();

        return response()->json([
            'order' => $order,
            'message' => $order->contingency ? 'Pago registrado por contingencia' : 'Pago registrado exitosamente',
            'change_due' => $order->change_due,
        ]);
    }

    public function completePayment(Request $request)
    {
        if (! $this->checkModule('orders_delivery') || ! $this->canCreate()) {
            return $this->forbidden();
        }
        $request->validate([
            'order_id' => 'required|exists:orders,id',
            'otp_code' => 'required|string|size:4',
        ]);

        $order = Order::where('otp_code', $request->otp_code)->first();

        if (! $order) {
            return response()->json(['error' => 'OTP inválido'], 400);
        }

        if ($order->payment_status === 'pending') {
            $order->payment_status = 'completed';
        }
        $order->save();

        return response()->json([
            'order' => $order,
            'message' => 'Pago completado exitosamente',
        ]);
    }

    public function drivers()
    {
        if (! $this->checkModule('orders_delivery')) {
            return $this->forbidden();
        }
        $drivers = User::where('role', User::ROLE_TRANSPORTISTA)
            ->orWhere('role', User::ROLE_OPERARIO_LOGISTICO)
            ->orWhere('role', User::ROLE_ADMINISTRADOR)
            ->get();
        return response()->json(['drivers' => $drivers]);
    }

    public function canCreate(): bool
    {
        $user = Auth::guard('sanctum')->user();
        return $user && in_array('create', $user->role_permissions['can'] ?? []);
    }

    public function canUpdate(): bool
    {
        $user = Auth::guard('sanctum')->user();
        return $user && in_array('update', $user->role_permissions['can'] ?? []);
    }

    public function canBypass(): bool
    {
        $user = Auth::guard('sanctum')->user();
        if (! $user) {
            return false;
        }
        return in_array($user->role, [
            User::ROLE_ADMINISTRADOR,
            User::ROLE_OPERARIO_LOGISTICO,
            User::ROLE_SUPERVISOR_PRODUCCION,
        ]);
    }
}
