<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * GUARDA GLOBAL DE ESCRITURA
 *
 * Se aplica a TODO el grupo autenticado. Bloquea con 403 Forbidden
 * cualquier intento de escritura (POST / PUT / PATCH / DELETE) realizado
 * por un rol cuya matriz no incluya la acción respectiva en 'can'.
 *
 * Caso crítico resuelto: el CONTADOR solo tiene ['read', 'download'],
 * por lo que TODA llamada de escritura desde su sesión responde 403,
 * independientemente de la ruta que intente usar.
 *
 * Excepción: POST /auth/logout siempre está permitido (no es escritura
 * de negocio, es cierre de sesión).
 *
 * También se exceptúan las rutas /profile/*: el perfil personal es un dato
 * del propio usuario, no una escritura de negocio. De lo contrario el
 * CONTADOR (can = read + download) no podría cambiar su contraseña ni sus
 * preferencias, pese a que son acciones sobre su propia cuenta.
 */
class WriteGuardMiddleware
{
    protected const WRITE_ACTIONS = [
        'POST' => 'create',
        'PUT' => 'update',
        'PATCH' => 'update',
        'DELETE' => 'delete',
    ];

    /** Rutas exentas: acciones sobre la propia cuenta o cierres y conciliaciones contables. */
    protected const EXEMPT_PREFIXES = ['auth/logout', 'profile', 'reports/reconcile-order', 'reports/inventory-snapshots'];

    public function handle(Request $request, Closure $next)
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $action = self::WRITE_ACTIONS[strtoupper($request->method())] ?? null;

        // El cierre de sesión y el perfil propio no requieren permisos de negocio
        if ($action === null || $this->isExempt($request->path())) {
            return $next($request);
        }

        if (! in_array($action, $user->role_permissions['can'] ?? [], true)) {
            return response()->json([
                'error' => '403 Forbidden',
                'message' => "El rol {$user->role} no tiene permiso '{$action}' para esta operación.",
                'role' => $user->role,
                'required_permission' => $action,
            ], 403);
        }

        return $next($request);
    }

    private function isExempt(string $path): bool
    {
        // $request->path() incluye el prefijo registered: 'api/profile/...'
        $path = preg_replace('#^api(/|$)#', '', $path);

        foreach (self::EXEMPT_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return true;
            }
        }

        return false;
    }
}
