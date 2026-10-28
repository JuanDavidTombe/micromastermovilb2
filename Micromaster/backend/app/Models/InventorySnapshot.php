<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventorySnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'period',
        'total_valuation',
        'total_stock',
        'valuation_data',
        'closed_by',
        'status',
        'notes',
    ];

    protected $casts = [
        'total_valuation' => 'decimal:2',
        'total_stock' => 'decimal:4',
        'valuation_data' => 'array',
    ];

    public function closedBy()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function closedByUser()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
