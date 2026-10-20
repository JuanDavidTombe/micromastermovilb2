<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * FLUJO DE REGISTRO CON APROBACIÓN DEL ADMINISTRADOR.
     *
     *  status           -> PENDING (espera) / ACTIVE (aprobado) / REJECTED (rechazado)
     *  requested_role   -> rol que el solicitante pidió en /register. Se guarda aparte
     *                      del rol efectivo para que el ADMINISTRADOR pueda asignar
     *                      el rol oficial distinto al solicitado al aprobar.
     *  approved_at/by   -> auditoría de quién aprobó la cuenta.
     *  rejection_reason -> motivo opcional del rechazo.
     *
     * La columna se crea con DEFAULT 'ACTIVE' para que todo el personal ya
     * existente (creado por seeders o por el propio administrador) conserve
     * su acceso: sólo las cuentas nuevas nacen en PENDING.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('status', ['PENDING', 'ACTIVE', 'REJECTED'])
                ->default('ACTIVE')
                ->after('role');

            $table->string('requested_role', 40)->nullable()->after('status');
            $table->timestamp('approved_at')->nullable()->after('requested_role');
            $table->unsignedBigInteger('approved_by')->nullable()->after('approved_at');
            $table->string('rejection_reason', 200)->nullable()->after('approved_by');

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'requested_role', 'approved_at', 'approved_by', 'rejection_reason']);
        });
    }
};