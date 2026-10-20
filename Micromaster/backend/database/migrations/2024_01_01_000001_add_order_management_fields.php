<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('client_name')->nullable()->after('destination');
            $table->enum('status', ['pending', 'assigned', 'in_transit', 'delivered', 'cancelled'])
                ->default('pending')
                ->after('client_name');
        });

        DB::statement('ALTER TABLE orders MODIFY route_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE orders MODIFY driver_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders MODIFY route_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE orders MODIFY driver_id BIGINT UNSIGNED NOT NULL');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['client_name', 'status']);
        });
    }
};
