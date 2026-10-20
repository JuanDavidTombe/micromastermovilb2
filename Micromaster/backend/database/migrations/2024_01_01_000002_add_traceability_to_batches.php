<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Trazabilidad de inventario: origen del lote, hash QR único
     * y cantidad inicial frente a la cantidad actual.
     */
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Proveedor / origen de la mercancía recibida
            $table->string('supplier_name')->nullable()->after('batch_code');

            // Hash del código QR escaneado con la app móvil (evita duplicados)
            $table->string('qr_code_hash')->unique()->nullable()->after('supplier_name');

            // Cantidad recibida originalmente: quantity = cantidad actual (se descuenta con salidas)
            $table->decimal('initial_quantity', 10, 4)->nullable()->after('quantity');
        });

        // Backfill: los lotes existentes conservan su cantidad como cantidad inicial
        DB::table('batches')->whereNull('initial_quantity')
            ->update(['initial_quantity' => DB::raw('quantity')]);
    }

    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropUnique(['qr_code_hash']);
            $table->dropColumn(['supplier_name', 'qr_code_hash', 'initial_quantity']);
        });
    }
};
