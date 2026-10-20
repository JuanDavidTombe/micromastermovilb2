<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LogisticsController;
use App\Http\Controllers\MicroCostController;
use App\Http\Controllers\MicroStockController;
use App\Http\Controllers\MicroDeliveryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ProfileController;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\ModulePermissionMiddleware;

Route::post('/auth/register', [AuthController::class, 'register'])
    ->middleware('throttle:10,1');

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'write.guard'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/photo', [ProfileController::class, 'uploadPhoto']);
    Route::get('/profile/photo', [ProfileController::class, 'photo']);
    Route::delete('/profile/photo', [ProfileController::class, 'deletePhoto']);
    Route::patch('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::patch('/profile/preferences', [ProfileController::class, 'updatePreferences']);
    Route::delete('/profile/sessions', [ProfileController::class, 'revokeSessions']);
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO,SUPERVISOR_PRODUCCION')->group(function () {
        Route::get('/stock/batches', [MicroStockController::class, 'index']);
        Route::get('/stock/alerts', [MicroStockController::class, 'alerts']);
        Route::get('/stock/ingredients', [MicroStockController::class, 'ingredientStock']);
        Route::get('/stock/purchase-orders/{code}', [MicroStockController::class, 'purchaseOrder']);
    });
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO')->group(function () {
        Route::post('/stock/batches', [MicroStockController::class, 'store']);
        Route::post('/stock/entry', [MicroStockController::class, 'entry']);
        Route::post('/stock/exit', [MicroStockController::class, 'exit']);
        Route::patch('/stock/batches/{id}/block', [MicroStockController::class, 'block']);
        // *** Sincronización QR (app móvil -> API web) ***
        Route::post('/stock/qr-scan', [MicroStockController::class, 'qrScan']);
    });

    /*
    |------------------------------------------------------------------
    | RECETAS & PRODUCCIÓN  (recipes_production)
    |------------------------------------------------------------------
    | Acceso COMPLETO : ADMINISTRADOR, SUPERVISOR_PRODUCCION
    | Sin acceso      : OPERARIO_LOGISTICO, CONTADOR, TRANSPORTISTA
    */
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,SUPERVISOR_PRODUCCION')->group(function () {
        Route::get('/cost/recipes', [MicroCostController::class, 'recipes']);
        Route::get('/cost/recipes/{id}/stock-check', [MicroCostController::class, 'stockCheck']);
        Route::post('/cost/recipes', [MicroCostController::class, 'storeRecipe']);
        Route::patch('/cost/recipes/{id}', [MicroCostController::class, 'updateRecipe']);
        Route::delete('/cost/recipes/{id}', [MicroCostController::class, 'destroyRecipe']);
        Route::post('/cost/simulate-scale', [MicroCostController::class, 'simulateScale']);
        Route::get('/cost/ingredients', [MicroCostController::class, 'ingredients']);
    });

    /*
    |------------------------------------------------------------------
    | PEDIDOS & ENTREGAS  (orders_delivery)
    |------------------------------------------------------------------
    | GESTIÓN   : ADMINISTRADOR, OPERARIO_LOGISTICO
    | OPERACIÓN : ADMINISTRADOR, OPERARIO_LOGISTICO, TRANSPORTISTA
    | Sin acceso: SUPERVISOR_PRODUCCION, CONTADOR
    */

    // --- 1. GESTIÓN de la ruta: crear, editar, drivers, resolver novedades
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO')->group(function () {
        Route::post('/delivery/routes', [LogisticsController::class, 'storeRoute']);
        Route::patch('/delivery/routes/{id}', [LogisticsController::class, 'updateRoute']);
        Route::get('/delivery/drivers', [LogisticsController::class, 'drivers']);
        Route::patch('/delivery/incidents/{id}', [LogisticsController::class, 'updateIncident']);

        // Gestión de pedidos
        Route::post('/orders', [OrderController::class, 'store']);
        Route::patch('/orders/{id}', [OrderController::class, 'update']);
        Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
    });

    // --- 2. OPERACIÓN en campo: rutas asignadas, GPS y novedades
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR,OPERARIO_LOGISTICO,TRANSPORTISTA')->group(function () {
        Route::get('/delivery/routes', [LogisticsController::class, 'routes']);
        Route::get('/delivery/routes/{id}', [LogisticsController::class, 'routeDetail']);
        Route::get('/delivery/orders', [MicroDeliveryController::class, 'orders']);
        Route::get('/delivery/incidents', [LogisticsController::class, 'incidents']);
        Route::post('/delivery/incidents', [LogisticsController::class, 'storeIncident']);

        // La app móvil del conductor transmite su coordenada
        Route::post('/delivery/location', [LogisticsController::class, 'sendLocation']);

        // Cobro con OTP en destino
        Route::post('/delivery/verify-otp', [MicroDeliveryController::class, 'verifyOtp']);
        Route::patch('/delivery/update-payment', [MicroDeliveryController::class, 'updatePayment']);
        Route::post('/delivery/complete-payment', [MicroDeliveryController::class, 'completePayment']);

        // Pedidos (el TRANSPORTISTA sólo ve los suyos — filtrado en controlador)
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{id}', [OrderController::class, 'show']);
    });

    /*
    |------------------------------------------------------------------
    | REPORTES & SIMULACIONES  (reports_simulations)
    |------------------------------------------------------------------
    | Acceso COMPLETO  : ADMINISTRADOR  (create/download)
    | Solo LECTURA     : CONTADOR       (read/download, sin escritura)
    | Sin acceso       : OPERARIO_LOGISTICO, SUPERVISOR_PRODUCCION, TRANSPORTISTA
    |
    | Nota: todos los endpoints son GET; el CONTADOR no tiene rutas de
    | escritura en este módulo y write.guard bloquea cualquier POST/PUT/
    | DELETE que intente con su token => 403 Forbidden.
    */
    Route::middleware(ModulePermissionMiddleware::class.':reports_simulations')->group(function () {
        Route::get('/reports', [ReportController::class, 'index']);
        Route::get('/reports/costs', [ReportController::class, 'costs']);
        Route::get('/reports/stock', [ReportController::class, 'stock']);
        Route::get('/reports/orders', [ReportController::class, 'orders']);
        Route::get('/reports/download', [ReportController::class, 'download']);
    });

    /*
    |------------------------------------------------------------------
    | ADMINISTRACIÓN  (administration) — solo ADMINISTRADOR
    |------------------------------------------------------------------
    */
    Route::middleware(RoleMiddleware::class.':ADMINISTRADOR')->group(function () {
        // GESTIÓN DE USUARIOS & ROLES
        Route::get('/settings/users', [AdminController::class, 'indexUsers']);
        Route::post('/settings/users', [AdminController::class, 'storeUser']);
        Route::patch('/settings/users/{user}', [AdminController::class, 'updateUser']);
        Route::patch('/settings/users/{user}/status', [AdminController::class, 'toggleUserStatus']);

        /*
        |------------------------------------------------------------------
        | SOLICITUDES DE REGISTRO PENDIENTES  (flujo /register)
        |------------------------------------------------------------------
        | La cuenta se crea en PENDING y /auth/login la rechaza con 403.
        | Sólo el ADMINISTRADOR la habilita (aprobando) o la descarta.
        */
        Route::get('/admin/pending-users', [AdminController::class, 'pendingUsers']);
        Route::post('/admin/users/{user}/approve', [AdminController::class, 'approveUser']);
        Route::post('/admin/users/{user}/reject', [AdminController::class, 'rejectUser']);

        // CONFIGURACIÓN DEL SISTEMA (perfil B2B de la empresa)
        Route::get('/settings/company', [AdminController::class, 'showCompany']);
        Route::patch('/settings/company', [AdminController::class, 'updateCompany']);
    });
});
