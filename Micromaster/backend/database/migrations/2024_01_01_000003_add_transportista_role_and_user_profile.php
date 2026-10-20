<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 5º rol de la matriz RBAC: TRANSPORTISTA (conductor).
     * + perfil de conductor en users: teléfono, foto y vehículo
     *   (el panel de Logística muestra foto/nombre/teléfono).
     */
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE users MODIFY role ENUM('ADMINISTRADOR','OPERARIO_LOGISTICO','SUPERVISOR_PRODUCCION','CONTADOR','TRANSPORTISTA') NOT NULL DEFAULT 'ADMINISTRADOR'"
        );

        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('role');
            $table->string('vehicle')->nullable()->after('phone');
            $table->string('photo_url')->nullable()->after('vehicle');
        });
    }

    public function down(): void
    {
        DB::statement('UPDATE users SET role = \'OPERARIO_LOGISTICO\' WHERE role = \'TRANSPORTISTA\'');
        DB::statement(
            "ALTER TABLE users MODIFY role ENUM('ADMINISTRADOR','OPERARIO_LOGISTICO','SUPERVISOR_PRODUCCION','CONTADOR') NOT NULL DEFAULT 'ADMINISTRADOR'"
        );

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'vehicle', 'photo_url']);
        });
    }
};
