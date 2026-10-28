<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Perfil completo del usuario (modal de 4 pestañas del Topbar).
 *
 *  Pestaña 1 - Información personal y contacto: identidad, código de empleado, teléfono.
 *  Pestaña 2 - Información laboral: sede/bodega, turno y jefe directo.
 *  Pestaña 3 - Seguridad: 2FA (banderas; la verificación OTP la aplica el backend).
 *  Pestaña 4 - Preferencias: idioma, tema y canales de notificación.
 *
 * El rol NUNCA se modifica aquí: sólo el ADMINISTRADOR lo hace desde
 * /settings#usuarios. El perfil personal no puede alterar sus permisos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // --- Pestaña 1: identificación y contacto ---
            $table->string('identity_document')->nullable()->after('name');
            $table->string('employee_code')->nullable()->unique()->after('identity_document');

            // --- Pestaña 2: información laboral y operación ---
            $table->string('warehouse_site')->nullable()->after('employee_code');
            $table->string('shift_schedule')->nullable()->after('warehouse_site');
            $table->string('supervisor_name')->nullable()->after('shift_schedule');

            // --- Pestaña 3: seguridad y accesos ---
            $table->boolean('two_factor_enabled')->default(false)->after('supervisor_name');
            $table->string('two_factor_method')->nullable()->after('two_factor_enabled');

            // --- Pestaña 4: preferencias de la aplicación ---
            $table->string('locale', 5)->default('es')->after('two_factor_method');
            $table->string('theme', 10)->default('light')->after('locale');
            $table->boolean('notify_email')->default(true)->after('theme');
            $table->boolean('notify_push')->default(true)->after('notify_email');
            $table->boolean('notify_sound')->default(true)->after('notify_push');
        });

        // Valores por defecto coherentes con la operación de MicroMaster.
        $defaults = [
            'ADMINISTRADOR' => ['Bodega Central - Popayán', 'Turno Mañana: 06:00 - 14:00', 'Directorio Ejecutivo'],
            'OPERARIO_LOGISTICO' => ['Bodega Central - Popayán', 'Turno Mañana: 06:00 - 14:00', 'Juan David Tombe'],
            'SUPERVISOR_PRODUCCION' => ['Planta de Producción - Popayán', 'Turno Mañana: 06:00 - 14:00', 'Juan David Tombe'],
            'CONTADOR' => ['Oficina Administrativa - Popayán', 'Turno Oficina: 08:00 - 17:00', 'Juan David Tombe'],
            'TRANSPORTISTA' => ['Bodega Central - Popayán', 'Turno Ruta: 06:00 - 16:00', 'María Camila Palechor'],
        ];

        foreach ($defaults as $role => [$site, $shift, $boss]) {
            DB::table('users')->where('role', $role)->update([
                'warehouse_site' => $site,
                'shift_schedule' => $shift,
                'supervisor_name' => $boss,
            ]);
        }

        DB::table('users')->whereNull('employee_code')->orWhere('employee_code', '')->update([
            'employee_code' => DB::raw("CONCAT('EMP-', LPAD(id, 3, '0'))"),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['employee_code']);
            $table->dropColumn([
                'identity_document',
                'employee_code',
                'warehouse_site',
                'shift_schedule',
                'supervisor_name',
                'two_factor_enabled',
                'two_factor_method',
                'locale',
                'theme',
                'notify_email',
                'notify_push',
                'notify_sound',
            ]);
        });
    }
};