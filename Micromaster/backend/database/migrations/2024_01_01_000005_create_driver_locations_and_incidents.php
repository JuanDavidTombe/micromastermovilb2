<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tablas nuevas del módulo Logística:
     *  - driver_locations   : última posición GPS transmitida por la app móvil
     *  - delivery_incidents : novedades de campo reportadas por el conductor
     */
    public function up(): void
    {
        Schema::create('driver_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);
            $table->decimal('speed_kmh', 6, 2)->nullable();
            $table->decimal('heading', 6, 2)->nullable();
            $table->dateTime('recorded_at');
            $table->timestamps();

            // una sola fila por conductor -> upsert desde la app
            $table->unique('driver_id');
        });

        Schema::create('delivery_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('route_id')->constrained('routes')->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['CLIENT_NOT_FOUND', 'VEHICLE_BREAKDOWN', 'WRONG_ADDRESS', 'OTHER'])
                ->default('OTHER');
            $table->text('description')->nullable();
            $table->enum('status', ['OPEN', 'RESOLVED'])->default('OPEN');
            $table->string('resolution')->nullable();
            $table->dateTime('reported_at');
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('route_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_incidents');
        Schema::dropIfExists('driver_locations');
    }
};
