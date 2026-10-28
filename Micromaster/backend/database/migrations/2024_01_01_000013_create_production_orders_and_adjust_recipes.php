<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Agregar campo 'unit' a la tabla pivote recipe_ingredient si no existe
        Schema::table('recipe_ingredient', function (Blueprint $table) {
            if (!Schema::hasColumn('recipe_ingredient', 'unit')) {
                $table->string('unit', 30)->nullable()->after('quantity');
            }
        });

        // 2. Crear tabla de Tandas / Órdenes de Producción
        Schema::create('production_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_code')->unique(); // OP-2026-001
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('target_quantity', 10, 4); // 200.00 kg
            $table->string('target_unit', 20)->default('kg');
            $table->decimal('actual_quantity', 10, 4)->nullable(); // 192.00 kg
            $table->decimal('theoretical_cost', 12, 2)->default(0);
            $table->decimal('real_cost', 12, 2)->nullable();
            $table->decimal('real_unit_cost', 10, 2)->nullable();
            $table->enum('status', ['in_progress', 'completed', 'cancelled'])->default('in_progress');
            $table->json('bom_snapshot'); // Insumos teóricos calculados
            $table->json('consumed_items')->nullable(); // Insumos reales al cierre
            $table->foreignId('output_batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        // 3. Crear tabla de Ajuste de Mermas de Planta (desperdicio diario)
        Schema::create('floor_wastes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ingredient_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 10, 4);
            $table->string('unit', 20)->default('kg');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->string('reason'); // "Contaminación cruzada", "Derrame", etc.
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('floor_wastes');
        Schema::dropIfExists('production_orders');
        Schema::table('recipe_ingredient', function (Blueprint $table) {
            if (Schema::hasColumn('recipe_ingredient', 'unit')) {
                $table->dropColumn('unit');
            }
        });
    }
};
