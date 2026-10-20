<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    /**
     * REGISTRO PÚBLICO con aprobación obligatoria del administrador.
     *
     * La cuenta se crea con status = PENDING: existe en la base de datos pero
     * /auth/login la rechaza hasta que el ADMINISTRADOR la apruebe.
     *
     * Seguridad:
     *  - NUNCA se emite un token aquí (el solicitante sigue sin acceso).
     *  - El rol se limita a la lista blanca REGISTRABLE_ROLES: nadie puede
     *    pedir ADMINISTRADOR por esta vía.
     *  - El rol oficial lo asigna el ADMINISTRADOR al aprobar, que puede
     *    sustituirlo por uno distinto al solicitado.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'identity_document' => 'required|string|max:40|unique:users,identity_document',
            'email' => 'required|email|max:150|unique:users,email',
            'phone' => 'required|string|max:40',
            'password' => 'required|string|min:6|max:60|confirmed',
            'role' => 'required|string|in:' . implode(',', User::REGISTRABLE_ROLES),
        ], [], [
            'identity_document' => 'documento de identidad',
            'role' => 'rol solicitado',
            'password.confirmed' => 'la contraseña y su confirmación no coinciden',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'identity_document' => $data['identity_document'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            // El cast 'hashed' de Eloquent se encarga de cifrar la contraseña.
            'password' => $data['password'],
            'role' => $data['role'],
            'requested_role' => $data['role'],
            'status' => User::STATUS_PENDING,
            // El alta en el sistema la hace el administrador al aprobar.
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Solicitud de registro enviada. Tu cuenta espera la aprobación del administrador.',
            'status' => User::STATUS_PENDING,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'identity_document' => $user->identity_document,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'status' => $user->status,
                'status_label' => $user->status_label,
                'created_at' => $user->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // La cuenta existe pero el ADMINISTRADOR todavía no la ha aprobado.
        if ($user->isPending()) {
            return response()->json([
                'error' => 'Tu cuenta aún está pendiente de aprobación por el Administrador.',
                'status' => User::STATUS_PENDING,
            ], 403);
        }

        if ($user->status === User::STATUS_REJECTED) {
            return response()->json([
                'error' => 'Tu solicitud de registro fue rechazada. Contacta al Administrador de MicroMaster.',
                'status' => User::STATUS_REJECTED,
            ], 403);
        }

        if (! $user->is_active) {
            return response()->json(['error' => 'Usuario inactivo: contacta al administrador'], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        // El token registra el dispositivo para la pestaña "Sesiones Activas".
        $device = User::describeDevice($request->userAgent());
        $token = $user->createToken($device)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->profileArray(),
            'device' => $device,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => array_merge($user->profileArray(), [
                'modules' => $user->role_permissions['modules'] ?? [],
                'default_module' => $this->getDefaultModule($user->role),
            ]),
        ]);
    }

    private function getDefaultModule(string $role): string
    {
        return match ($role) {
            User::ROLE_OPERARIO_LOGISTICO => 'stock',
            User::ROLE_SUPERVISOR_PRODUCCION => 'recipes_production',
            User::ROLE_CONTADOR => 'reports_simulations',
            default => 'dashboard',
        };
    }
}
