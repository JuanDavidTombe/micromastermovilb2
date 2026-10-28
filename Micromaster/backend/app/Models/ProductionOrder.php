<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_code',
        'recipe_id',
        'supervisor_id',
        'target_quantity',
        'target_unit',
        'actual_quantity',
        'theoretical_cost',
        'real_cost',
        'real_unit_cost',
        'status',
        'bom_snapshot',
        'consumed_items',
        'output_batch_id',
        'notes',
        'completed_at',
    ];

    protected $casts = [
        'target_quantity' => 'decimal:4',
        'actual_quantity' => 'decimal:4',
        'theoretical_cost' => 'decimal:2',
        'real_cost' => 'decimal:2',
        'real_unit_cost' => 'decimal:2',
        'bom_snapshot' => 'array',
        'consumed_items' => 'array',
        'completed_at' => 'datetime',
    ];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function outputBatch()
    {
        return $this->belongsTo(Batch::class, 'output_batch_id');
    }
}
