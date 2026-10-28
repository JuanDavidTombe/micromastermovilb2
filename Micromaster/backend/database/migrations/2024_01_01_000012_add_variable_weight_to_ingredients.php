<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('ingredients', 'is_variable_weight')) {
            Schema::table('ingredients', function (Blueprint $table) {
                $table->boolean('is_variable_weight')->default(false)->after('min_stock');
            });
        }

        DB::table('ingredients')
            ->where(function ($query) {
                $query->where('name', 'like', '%pollo%')
                    ->orWhere('name', 'like', '%carne%')
                    ->orWhere('name', 'like', '%cerdo%')
                    ->orWhere('name', 'like', '%pescado%')
                    ->orWhere('name', 'like', '%filete%')
                    ->orWhere('name', 'like', '%res %')
                    ->orWhere('name', 'like', '% de res%');
            })
            ->update(['is_variable_weight' => true]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('ingredients', 'is_variable_weight')) {
            Schema::table('ingredients', function (Blueprint $table) {
                $table->dropColumn('is_variable_weight');
            });
        }
    }
};
