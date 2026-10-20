<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * Perfil del usuario autenticado (modal de 4 pestañas del Topbar).
 *
 * SEGURIDAD:
 *  - Todo se resuelve contra $request->user(): nadie puede leer ni editar
 *    el perfil de otro usuario, sin importar el rol.
 *  - El campo `role` NO es editable aquí. Los permisos dependen exclusivamente
 *    del login de Laravel Sanctum y sólo el ADMINISTRADOR los cambia
 *    desde /settings#usuarios.
 *  - Cambiar la contraseña revoca el resto de tokens (sesiones).
 */
class ProfileController extends Controller
{
    /** GET /api/profile */
    public function show(Request $request)
    {
        return response()->json([
            'profile' => $request->user()->profileArray(),
            'sessions' => $this->sessionsPayload($request),
        ]);
    }

    /** PATCH /api/profile — pestaña 1 (información personal y contacto). */
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'identity_document' => ['nullable', 'string', 'max:40'],
            'employee_code' => ['nullable', 'string', 'max:40', 'unique:users,employee_code,' . $user->id],
            'email' => ['required', 'email', 'max:180', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);

        $user->fill($data)->save();

        return response()->json([
            'message' => 'Información personal actualizada correctamente',
            'profile' => $user->fresh()->profileArray(),
        ]);
    }

    /** POST /api/profile/photo — carga/actualiza la fotografía de perfil. */
    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();
        $path = $request->file('photo')->store("photos/{$user->id}", 'public');

        // Elimina la fotografía anterior para no dejar archivos huérfanos.
        if ($user->photo_url) {
            Storage::disk('public')->delete($user->photo_url);
        }

        $user->forceFill(['photo_url' => $path])->save();

        // Data URL para la vista previa inmediata (evita otro viaje al servidor).
        $preview = 'data:' . Storage::disk('public')->mimeType($path) . ';base64,'
            . base64_encode(Storage::disk('public')->get($path));

        return response()->json([
            'message' => 'Fotografía actualizada correctamente',
            'photo_url' => $path,
            'preview' => $preview,
            'profile' => $user->fresh()->profileArray(),
        ]);
    }

    /** GET /api/profile/photo — imagen autenticada (se consume como blob). */
    public function photo(Request $request)
    {
        $user = $request->user();

        if (! $user->photo_url || ! Storage::disk('public')->exists($user->photo_url)) {
            return response()->json(['message' => 'Sin fotografía'], 404);
        }

        return Storage::disk('public')->response($user->photo_url);
    }

    /** DELETE /api/profile/photo */
    public function deletePhoto(Request $request)
    {
        $user = $request->user();

        if ($user->photo_url) {
            Storage::disk('public')->delete($user->photo_url);
        }

        $user->forceFill(['photo_url' => null])->save();

        return response()->json([
            'message' => 'Fotografía eliminada',
            'profile' => $user->fresh()->profileArray(),
        ]);
    }

    /** PATCH /api/profile/password — pestaña 3 (cambio de contraseña). */
    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'message' => 'La contraseña actual no es correcta',
                'errors' => ['current_password' => ['La contraseña actual no es correcta']],
            ], 422);
        }

        $user->forceFill(['password' => Hash::make($data['password'])])->save();

        // Tras cambiar la contraseña se revocan las sesiones ajenas.
        $revoked = $user->tokens()
            ->where('id', '!=', optional($request->user()->currentAccessToken())->id)
            ->delete();

        return response()->json([
            'message' => 'Contraseña actualizada. Se cerraron ' . $revoked . ' sesión(es) externa(s).',
            'revoked' => $revoked,
            'sessions' => $this->sessionsPayload($request),
        ]);
    }

    /** PATCH /api/profile/preferences — pestaña 4 (idioma, tema, notificaciones). */
    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'locale' => ['nullable', 'in:es,en'],
            'theme' => ['nullable', 'in:light,dark'],
            'notify_email' => ['nullable', 'boolean'],
            'notify_push' => ['nullable', 'boolean'],
            'notify_sound' => ['nullable', 'boolean'],
            'two_factor_enabled' => ['nullable', 'boolean'],
            'two_factor_method' => ['nullable', 'in:AUTHENTICATOR,OTP'],
        ]);

        $user = $request->user();

        // 2FA: sólo puede activarse con un método explícito.
        if (! empty($data['two_factor_enabled']) && empty($data['two_factor_method'])) {
            $data['two_factor_method'] = 'AUTHENTICATOR';
        }

        $user->fill(array_filter($data, fn ($v) => $v !== null))->save();

        return response()->json([
            'message' => 'Preferencias guardadas correctamente',
            'profile' => $user->fresh()->profileArray(),
        ]);
    }

    /** DELETE /api/profile/sessions — cerrar todas las sesiones externas. */
    public function revokeSessions(Request $request)
    {
        $currentId = optional($request->user()->currentAccessToken())->id;

        $revoked = $request->user()->tokens()->where('id', '!=', $currentId)->delete();

        return response()->json([
            'message' => $revoked . ' sesión(es) externa(s) cerrada(s)',
            'sessions' => $this->sessionsPayload($request),
        ]);
    }

    /** Sesiones activas derivadas de los tokens de Sanctum. */
    private function sessionsPayload(Request $request): array
    {
        $currentId = optional($request->user()->currentAccessToken())->id;

        return $request->user()->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'device' => $token->name,
                'is_current' => (string) $token->id === (string) $currentId,
                'created_at' => optional($token->created_at)->toIso8601String(),
                'last_used_at' => optional($token->last_used_at)->toIso8601String(),
            ])
            ->all();
    }
}