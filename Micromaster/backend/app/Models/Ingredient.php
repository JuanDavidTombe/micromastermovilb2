<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ingredient extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'unit',
        'cost_per_unit',
        'min_stock',
    ];

    protected $casts = [
        'cost_per_unit' => 'decimal:2',
        'min_stock' => 'decimal:4',
    ];

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }

    public function recipeIngredients()
    {
        return $this->hasMany(RecipeIngredient::class);
    }
}
