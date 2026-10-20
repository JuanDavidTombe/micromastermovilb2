<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Módulo de ADMINISTRACIÓN (CONFIGURACIÓN):
     *  - users.is_active  -> conmutar Estado Activo/Inactivo del personal
     *  - company_settings -> perfil B2B editable de la empresa (singleton, id=1)
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('photo_url');
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });

        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('MICROMASTER B2B');
            $table->string('tax_id')->nullable();              // NIT / ID Tributario
            $table->string('warehouse_address')->nullable();    // Direccion de Bodega Central (origen GPS)
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('version')->default('2.4.1');
            $table->string('environment')->default('Produccion');
            $table->decimal('latitude', 10, 7)->nullable();     // GPS de la bodega central
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();
        });

        DB::table('company_settings')->insert([
            'company_name' => 'MICROMASTER B2B',
            'tax_id' => '901.456.789-1',
            'warehouse_address' => 'Cra. 45 # 12-40, Bodega Central, Medellin',
            'phone' => '+57 604 123 4567',
            'email' => 'contacto@micromaster.com',
            'latitude' => 6.2442,
            'longitude' => -75.5812,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_active', 'last_login_at']);
        });
    }
};