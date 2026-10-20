<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->string('storage_zone')->nullable()->after('supplier_name');
            $table->boolean('is_quarantined')->default(false)->after('status');
            $table->text('quarantine_reason')->nullable()->after('is_quarantined');
            $table->string('quality_status')->default('approved')->after('quarantine_reason');
            $table->string('purchase_order_code')->nullable()->after('quality_status');
        });

        Schema::table('ingredients', function (Blueprint $table) {
            $table->decimal('min_stock', 10, 4)->default(0)->after('cost_per_unit');
        });

        $minimums = [
            'Arroz Graneado' => 300,
            'Fríjoles Rojos' => 200,
            'Aceite Vegetal' => 100,
            'Sal Marina' => 40,
            'Soya Sauce' => 20,
            'Pimienta Negra' => 10,
            'Cebolla Junca' => 150,
            'Pollo Fresco' => 200,
        ];

        foreach ($minimums as $name => $value) {
            DB::table('ingredients')->where('name', $name)->update(['min_stock' => $value]);
        }

        $zones = [
            'Arroz Graneado' => 'A-01',
            'Fríjoles Rojos' => 'A-01',
            'Aceite Vegetal' => 'B-01',
            'Cebolla Junca' => 'C-01',
            'Pollo Fresco' => 'Refrigerado',
            'Sal Marina' => 'A-02',
            'Soya Sauce' => 'B-01',
            'Pimienta Negra' => 'A-02',
        ];

        foreach ($zones as $name => $zone) {
            DB::table('batches')
                ->join('ingredients', 'ingredients.id', '=', 'batches.ingredient_id')
                ->where('ingredients.name', $name)
                ->update(['batches.storage_zone' => $zone]);
        }
    }

    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn(['storage_zone', 'is_quarantined', 'quarantine_reason', 'quality_status', 'purchase_order_code']);
        });

        Schema::table('ingredients', function (Blueprint $table) {
            $table->dropColumn('min_stock');
        });
    }
};
