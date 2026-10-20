<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        return response()->json(['error' => 'Unauthenticated'], 401);
    }

    /**
     * Backend 100% API: cualquier ruta /api/* responde SIEMPRE en JSON.
     *
     * Sin esto, un cliente que no envíe `Accept: application/json` (curl,
     * Postman, un formulario nativo) recibe un 302 a la SPA de Vite en lugar
     * del 422 con el detalle de la validación.
     */
    protected function shouldReturnJson($request, Throwable $e)
    {
        return $request->is('api/*') || $request->expectsJson();
    }

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }
}
