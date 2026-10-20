<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Order;
use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * REPORTES & SIMULACIONES (reports_simulations)
 *
 * Acceso: ADMINISTRADOR (create/read/download)
 *         CONTADOR      (read/download)  -> cualquier escritura = 403
 * Sin acceso: OPERARIO_LOGISTICO, SUPERVISOR_PRODUCCION
 *
 * Este controlador NO delega en MicroStock/MicroCost/MicroDelivery para
 * que el CONTADOR no dependa de la matriz de esos módulos.
 */
class ReportController extends Controller
{
    public function index(Request $request)
    {
        if (! $this->checkReports()) {
            return $this->forbidden();
        }

        return response()->json([
            'available' => ['costs', 'stock', 'orders', 'reconciliation'],
            'generated_at' => now()->toIso8601String(),
            'generated_by' => $request->user()->only(['id', 'name', 'role']),
        ]);
    }

    public function costs()
    {
        if (! $this->checkReports()) {
            return $this->forbidden();
        }

        $recipes = Recipe::with('ingredients')->get()->map(fn($r) => [
            'recipe_id' => $r->id,
            'name' => $r->name,
            'waste_percentage' => $r->waste_percentage,
            'total_cost' => $r->total_cost,
            'ingredients_count' => $r->ingredients->count(),
            'stock_status' => $r->stock_check['status'],
        ]);

        return response()->json(['costs' => $recipes]);
    }

    public function stock()
    {
        if (! $this->checkReports()) {
            return $this->forbidden();
        }

        $batches = Batch::with('ingredient')->orderBy('expiration_date')->get()->map(fn($b) => [
            'batch_code' => $b->batch_code,
            'ingredient' => $b->ingredient->name ?? '-',
            'supplier_name' => $b->supplier_name,
            'quantity' => $b->quantity,
            'initial_quantity' => $b->initial_quantity,
            'expiration_date' => $b->expiration_date->toDateString(),
            'status' => Batch::fefoStatusFor($b->expiration_date),
            'received_at' => $b->received_at,
        ]);

        return response()->json(['stock' => $batches]);
    }

    public function orders()
    {
        if (! $this->checkReports()) {
            return $this->forbidden();
        }

        $orders = Order::with('route', 'driver')->orderByDesc('created_at')->get()->map(fn($o) => [
            'id' => $o->id,
            'client_name' => $o->client_name,
            'amount' => $o->amount,
            'payment_status' => $o->payment_status,
            'status' => $o->status,
            'created_at' => $o->created_at,
        ]);

        return response()->json(['orders' => $orders]);
    }

    /**
     * DESCARGA: CSV en claro para el CONTADOR.
     */
    public function download(Request $request)
    {
        if (! $this->checkReports()) {
            return $this->forbidden();
        }

        $type = $request->query('type', 'stock');
        $user = $request->user();

        // sólo read/download permiten el archivo
        if (! in_array('download', $user->role_permissions['can'] ?? [], true)) {
            return $this->forbidden();
        }

        $rows = match ($type) {
            'costs' => $this->costRows(),
            'orders' => $this->orderRows(),
            default => $this->stockRows(),
        };

        $filename = 'micromaster_' . $type . '_' . now()->format('Ymd_His') . '.csv';

        $callback = function () use ($rows) {
            $out = fopen('php://output', 'w');
            // BOM UTF-8 para que Excel abra bien los acentos
            fwrite($out, "\xEF\xBB\xBF");
            foreach ($rows as $row) {
                fputcsv($out, $row, ';');
            }
            fclose($out);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    // ------------------------------------------------------------------

    private function stockRows(): array
    {
        $rows = [['Lote', 'Insumo', 'Proveedor', 'Cantidad Actual', 'Cantidad Inicial', 'Vencimiento', 'Estado', 'Recepción']];

        foreach (Batch::with('ingredient')->orderBy('expiration_date')->get() as $b) {
            $rows[] = [
                $b->batch_code,
                $b->ingredient->name ?? '-',
                $b->supplier_name ?? '-',
                $b->quantity,
                $b->initial_quantity,
                $b->expiration_date->toDateString(),
                Batch::fefoStatusFor($b->expiration_date),
                $b->received_at?->toDateTimeString(),
            ];
        }

        return $rows;
    }

    private function costRows(): array
    {
        $rows = [['Receta', '% Merma', 'Costo Total', 'Insumos', 'Estado de Insumos']];

        foreach (Recipe::with('ingredients')->get() as $r) {
            $rows[] = [
                $r->name,
                $r->waste_percentage,
                $r->total_cost,
                $r->ingredients->count(),
                $r->stock_check['status'],
            ];
        }

        return $rows;
    }

    private function orderRows(): array
    {
        $rows = [['ID', 'Cliente', 'Monto', 'Estado Pago', 'Estado', 'Creado']];

        foreach (Order::orderByDesc('created_at')->get() as $o) {
            $rows[] = [
                $o->id,
                $o->client_name ?? '-',
                $o->amount,
                $o->payment_status,
                $o->status,
                $o->created_at->toDateTimeString(),
            ];
        }

        return $rows;
    }

    protected function checkReports(): bool
    {
        $user = Auth::guard('sanctum')->user();

        return $user && $user->hasModuleAccess('reports_simulations');
    }
}
