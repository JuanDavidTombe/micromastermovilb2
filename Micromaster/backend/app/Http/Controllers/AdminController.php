<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /* ------------------------------------------------------------------
     |  GESTIÓN DE USUARIOS & ROLES  (matriz RBAC)
     | ------------------------------------------------------------------ */

    public function indexUsers(Request $request)
    {
        $users = User::query()
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => $this->serializeUser($u));

        return response()->json([
            'users' => $users,
            'roles' => $this->roleCatalog(),
            'total' => $users->count(),
            'active' => $users->where('status', User::STATUS_ACTIVE)->where('is_active', true)->count(),
            'inactive' => $users->where('status', User::STATUS_ACTIVE)->where('is_active', false)->count(),
            'pending' => $users->where('status', User::STATUS_PENDING)->count(),
            'rejected' => $users->where('status', User::STATUS_REJECTED)->count(),
        ]);
    }

    public function storeUser(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:150|unique:users,email',
            'password' => 'required|string|min:6|max:60',
            'role' => 'required|string|in:' . implode(',', $this->roleCatalogKeys()),
            'phone' => 'nullable|string|max:40',
            'vehicle' => 'nullable|string|max:60',
        ]);

        // El ADMINISTRADOR crea la cuenta ya aprobada: no pasa por el flujo
        // de espera de /register.
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'phone' => $data['phone'] ?? null,
            'vehicle' => $data['vehicle'] ?? null,
            'status' => User::STATUS_ACTIVE,
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Usuario registrado correctamente',
            'user' => $this->serializeUser($user),
        ], 201);
    }

    public function updateUser(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'email' => 'sometimes|required|email|max:150|unique:users,email,' . $user->id,
            'role' => 'sometimes|required|string|in:' . implode(',', $this->roleCatalogKeys()),
            'password' => 'nullable|string|min:6|max:60',
            'phone' => 'nullable|string|max:40',
            'vehicle' => 'nullable|string|max:60',
        ]);

        $payload = array_intersect_key($data, array_flip(['name', 'email', 'role', 'phone', 'vehicle']));

        if (! empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }

        // Un ADMINISTRADOR no puede quitarse a si mismo el acceso.
        if ($user->id === $request->user()->id && isset($payload['role']) && $payload['role'] !== User::ROLE_ADMINISTRADOR) {
            return response()->json(['message' => 'No puedes cambiar tu propio rol de administrador'], 422);
        }

        $user->update($payload);

        return response()->json([
            'message' => 'Usuario actualizado correctamente',
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    /**
     * Conmuta Activo / Inactivo. Nunca se puede desactivar a si mismo
     * (evita dejar el sistema sin ningún administrador con acceso).
     */
    public function toggleUserStatus(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'No puedes desactivar tu propia cuenta'], 422);
        }

        // Una solicitud en espera se resuelve con aprobar/rechazar: sin un rol
        // oficial concedido no tiene sentido "activar" o "inactivar" acceso.
        if ($user->isPending()) {
            return response()->json([
                'message' => 'Esta cuenta está pendiente de aprobación: apruébala o recházala primero.',
            ], 422);
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        // Revocar tokens del personal desactivado para cortar el acceso de inmediato.
        if (! $user->is_active) {
            DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->delete();
        }

        return response()->json([
            'message' => $user->is_active ? 'Usuario reactivado' : 'Usuario inactivado',
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    /* ------------------------------------------------------------------
     |  SOLICITUDES DE REGISTRO PENDIENTES  (flujo de aprobación)
     | ------------------------------------------------------------------ */

    /**
     * Lista las cuentas creadas desde /register que siguen en espera.
     * Alimenta la pestaña "Solicitudes Pendientes" de /settings#usuarios.
     */
    public function pendingUsers()
    {
        $users = User::query()
            ->where('status', User::STATUS_PENDING)
            ->orderBy('created_at')          // más antigua primero
            ->get()
            ->map(fn (User $u) => $this->serializeUser($u));

        return response()->json([
            'users' => $users,
            'pending' => $users->count(),
        ]);
    }

    /**
     * Aprueba la solicitud: la cuenta pasa a ACTIVE y ya puede iniciar sesión.
     * El ADMINISTRADOR puede asignar un rol oficial distinto al solicitado.
     */
    public function approveUser(Request $request, User $user)
    {
        if (! $user->isPending()) {
            return response()->json([
                'message' => "Esta solicitud ya fue resuelta (estado: {$user->status_label}).",
            ], 422);
        }

        $data = $request->validate([
            'role' => 'nullable|string|in:' . implode(',', $this->roleCatalogKeys()),
        ]);

        $user->update([
            'status' => User::STATUS_ACTIVE,
            'is_active' => true,
            'role' => $data['role'] ?? $user->requested_role ?: $user->role,
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
            'rejection_reason' => null,
        ]);

        return response()->json([
            'message' => "Usuario aprobado. {$user->name} ya puede iniciar sesión como {$user->fresh()->role_label}.",
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    /**
     * Rechaza la solicitud: la cuenta queda en REJECTED, se inactiva y se
     * revocan sus tokens por si en algún momento llegó a tener acceso.
     */
    public function rejectUser(Request $request, User $user)
    {
        if (! $user->isPending()) {
            return response()->json([
                'message' => "Esta solicitud ya fue resuelta (estado: {$user->status_label}).",
            ], 422);
        }

        $data = $request->validate([
            'reason' => 'nullable|string|max:200',
        ]);

        $user->update([
            'status' => User::STATUS_REJECTED,
            'is_active' => false,
            'rejection_reason' => $data['reason'] ?? null,
        ]);

        DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->delete();

        return response()->json([
            'message' => "Solicitud de {$user->name} rechazada.",
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    /* ------------------------------------------------------------------
     |  CONFIGURACIÓN DEL SISTEMA  (perfil B2B de la empresa)
     | ------------------------------------------------------------------ */

    public function showCompany()
    {
        $company = CompanySetting::current();

        return response()->json([
            'company' => [
                'company_name' => $company->company_name,
                'tax_id' => $company->tax_id,
                'warehouse_address' => $company->warehouse_address,
                'phone' => $company->phone,
                'email' => $company->email,
                'latitude' => $company->latitude,
                'longitude' => $company->longitude,
            ],
            'system' => [
                'version' => $company->version,
                'environment' => $company->environment,
                'database' => 'MySQL (XAMPP)',
                'backend' => 'Laravel 10 + Sanctum',
                'frontend' => 'React + Vite + Tailwind CSS',
                'auth' => 'Bearer Token (Sanctum)',
                'server' => 'Apache / XAMPP',
            ],
        ]);
    }

    public function updateCompany(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:150',
            'tax_id' => 'nullable|string|max:60',
            'warehouse_address' => 'required|string|max:200',
            'phone' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:150',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $company = CompanySetting::current();
        $company->update($data);

        return response()->json([
            'message' => 'Perfil de la empresa actualizado correctamente',
            'company' => $company->fresh()->only([
                'company_name', 'tax_id', 'warehouse_address', 'phone', 'email', 'latitude', 'longitude',
            ]),
        ]);
    }

    /* ------------------------------------------------------------------
     |  Helpers
     | ------------------------------------------------------------------ */

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'identity_document' => $user->identity_document,
            'role' => $user->role,
            'role_label' => $user->role_label,
            'role_permissions' => $user->role_permissions,
            'requested_role' => $user->requested_role,
            'requested_role_label' => $user->requested_role
                ? (new User(['role' => $user->requested_role]))->role_label
                : null,
            'status' => $user->status ?: User::STATUS_ACTIVE,
            'status_label' => $user->status_label,
            'phone' => $user->phone,
            'vehicle' => $user->vehicle,
            'is_active' => (bool) $user->is_active,
            'approved_at' => $user->approved_at?->toIso8601String(),
            'rejection_reason' => $user->rejection_reason,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function roleCatalogKeys(): array
    {
        return array_keys(User::ROLE_PERMISSIONS);
    }

    /**
     * Catálogo de roles con su matriz de permisos, para pintar el
     * selector del modal de registro sin duplicar la definición en el frontend.
     */
    private function roleCatalog(): array
    {
        return collect(User::ROLE_PERMISSIONS)
            ->map(fn (array $perms, string $key) => [
                'value' => $key,
                'label' => (new User(['role' => $key]))->role_label,
                'modules' => $perms['modules'] ?? [],
                'read_modules' => $perms['read_modules'] ?? [],
                'can' => $perms['can'] ?? [],
            ])
            ->values()
            ->all();
    }
}