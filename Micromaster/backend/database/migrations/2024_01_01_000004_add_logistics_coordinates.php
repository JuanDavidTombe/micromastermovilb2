<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Coordenadas para Google Maps:
     *  - routes: origen (depósito) desde el que se traza, distancia/duración
     *            y status normalizado a 'completed' (spec).
     *  - orders: latitud/longitud del destino -> marcadores en el mapa.
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->string('origin_label')->nullable()->after('destination');
            $table->decimal('origin_lat', 10, 8)->nullable()->after('origin_label');
            $table->decimal('origin_lng', 11, 8)->nullable()->after('origin_lat');
            $table->decimal('distance_km', 10, 2)->nullable()->after('scheduled_date');
            $table->decimal('duration_min', 10, 2)->nullable()->after('distance_km');
        });

        // 'delivered' -> 'completed' (nuevo vocabulario de la spec)
        DB::statement("UPDATE routes SET status = 'completed' WHERE status = 'delivered'");
        DB::statement("ALTER TABLE routes MODIFY status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending'");

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('destination');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
        });
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE routes MODIFY status ENUM('pending','in_progress','delivered') NOT NULL DEFAULT 'pending'");

        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn(['origin_label', 'origin_lat', 'origin_lng', 'distance_km', 'duration_min']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude']);
        });
    }
};
