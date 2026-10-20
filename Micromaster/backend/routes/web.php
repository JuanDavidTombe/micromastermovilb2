<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'MICROMASTER API',
        'status' => 'running',
        'version' => '2.4.1',
        'endpoints' => [
            'login' => 'POST /api/auth/login',
            'me' => 'GET /api/auth/me',
            'dashboard' => 'GET /api/dashboard',
            'cost_recipes' => 'GET /api/cost/recipes',
            'stock_batches' => 'GET /api/stock/batches',
            'delivery_routes' => 'GET /api/delivery/routes',
        ],
    ]);
});
