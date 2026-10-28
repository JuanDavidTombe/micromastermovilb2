<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Campos contables y conciliación bancaria en orders
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('is_bank_reconciled')->default(false)->after('change_due');
            $table->string('bank_name', 100)->nullable()->after('is_bank_reconciled');
            $table->string('bank_reference', 100)->nullable()->after('bank_name');
            $table->decimal('bank_fee', 10, 2)->default(0)->after('bank_reference');
            $table->timestamp('reconciled_at')->nullable()->after('bank_fee');
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete()->after('reconciled_at');
            $table->integer('credit_days')->default(0)->after('reconciled_by'); // 0 = contado, 15, 30, etc.
        });

        // 2. Tabla de Cierres Contables de Inventario (Foto congelada inamovible)
        Schema::create('inventory_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('period', 20); // ej. '2026-10'
            $table->decimal('total_valuation', 14, 2);
            $table->decimal('total_stock', 14, 4);
            $table->json('valuation_data'); // Detalle de cada insumo: stock, CPU, valorización
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('frozen'); // frozen
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_snapshots');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['reconciled_by']);
            $table->dropColumn([
                'is_bank_reconciled',
                'bank_name',
                'bank_reference',
                'bank_fee',
                'reconciled_at',
                'reconciled_by',
                'credit_days',
            ]);
        });
    }
};
