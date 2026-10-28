<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Recipe extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'waste_percentage',
    ];

    protected $casts = [
        'waste_percentage' => 'decimal:2',
    ];

    protected $appends = ['total_cost'];

    public function ingredients()
    {
        return $this->belongsToMany(Ingredient::class, 'recipe_ingredient')
            ->withPivot('quantity', 'unit', 'unit_cost')
            ->withTimestamps();
    }

    public function getTotalCostAttribute(): float
    {
        $total = $this->ingredients->sum(function ($ingredient) {
            return $ingredient->pivot->quantity * $ingredient->pivot->unit_cost;
        });

        return $total * (1 + ($this->waste_percentage / 100));
    }

    public function getCostPerKgAttribute(float $quantityKg): float
    {
        if ($quantityKg <= 0) {
            return 0;
        }

        return $this->totalCost / $quantityKg;
    }

    /**
     * CHECK DE INSUMOS AUTOMÁTICO
     *
     * Compara la cantidad requerida por la receta contra las existencias
     * reales de inventario (lotes no vencidos, criterio FEFO).
     *
     * Retorna:
     *  - sufficient : bool
     *  - status     : 'sufficient' | 'insufficient'
     *  - label      : 'Insumos Suficientes' | 'Insumos Insuficientes'
     *  - items[]    : detalle por insumo (required / available / enough)
     *  - missing[]  : sólo los insumos faltantes con su cantidad exacta
     */
    public function getStockCheckAttribute(): array
    {
        $items = $this->ingredients->map(function ($ingredient) {
            $required = (float) $ingredient->pivot->quantity;

            $available = (float) Batch::where('ingredient_id', $ingredient->id)
                ->where('expiration_date', '>=', now())
                ->sum('quantity');

            $diff = round($available - $required, 4);

            return [
                'ingredient_id' => $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'required' => $required,
                'available' => round($available, 4),
                'difference' => $diff,
                'enough' => $diff >= 0,
                'missing_quantity' => $diff < 0 ? round(abs($diff), 4) : 0.0,
            ];
        })->values();

        $missing = $items->filter(fn($i) => ! $i['enough'])->values();
        $sufficient = $missing->isEmpty();

        return [
            'sufficient' => $sufficient,
            'status' => $sufficient ? 'sufficient' : 'insufficient',
            'label' => $sufficient ? 'Insumos Suficientes' : 'Insumos Insuficientes',
            'items' => $items->all(),
            'missing' => $missing->all(),
        ];
    }
}
