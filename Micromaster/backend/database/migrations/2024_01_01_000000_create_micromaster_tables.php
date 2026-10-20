<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['ADMINISTRADOR', 'OPERARIO_LOGISTICO', 'SUPERVISOR_PRODUCCION', 'CONTADOR'])->default('ADMINISTRADOR');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit');
            $table->decimal('cost_per_unit', 10, 2);
            $table->timestamps();
        });

        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('waste_percentage', 5, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('recipe_ingredient', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 10, 4);
            $table->decimal('unit_cost', 10, 2);
            $table->timestamps();
        });

        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id')->constrained()->cascadeOnDelete();
            $table->string('batch_code');
            $table->decimal('quantity', 10, 4);
            $table->date('expiration_date');
            $table->enum('status', ['optimal', 'warning', 'critical'])->default('optimal');
            $table->dateTime('received_at');
            $table->timestamps();
        });

        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->string('destination');
            $table->string('route_code');
            $table->enum('status', ['pending', 'in_progress', 'delivered'])->default('pending');
            $table->date('scheduled_date');
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->string('destination');
            $table->enum('payment_method', ['cash', 'qr'])->default('cash');
            $table->enum('payment_status', ['pending', 'confirmed', 'completed', 'refunded'])->default('pending');
            $table->string('otp_code')->nullable();
            $table->decimal('amount', 10, 2)->default(0);
            $table->decimal('received_amount', 10, 2)->default(0);
            $table->decimal('change_due', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
        Schema::dropIfExists('routes');
        Schema::dropIfExists('batches');
        Schema::dropIfExists('recipe_ingredient');
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('users');
    }
};
