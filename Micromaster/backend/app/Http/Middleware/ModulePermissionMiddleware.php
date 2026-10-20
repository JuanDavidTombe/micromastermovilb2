<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Autorización por MÓDULO.
 *
 * Uso:
 *   ->middleware('module.permission:reports_simulations')        acceso completo
 *   ->middleware('module.permission:inventory_stock:read')       lectura O completa
 *
 * El sufijo ':read' acepta también los módulos asignados en 'read_modules'
 * (usado para que SUPERVISOR_PRODUCCION consulte disponibilidad de bodega
 * sin tener el módulo de inventario completo).
 */
class ModulePermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $module, string $mode = 'full')
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $allowed = $mode === 'read'
            ? $user->hasReadModuleAccess($module)
            : $user->hasModuleAccess($module);

        if (! $allowed) {
            return response()->json([
                'error' => '403 Forbidden',
                'message' => "Module access denied: {$module}",
            ], 403);
        }

        return $next($request);
    }
}
