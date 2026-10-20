<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    use HasFactory;

    protected $fillable = [
        'ingredient_id',
        'batch_code',
        'supplier_name',
        'storage_zone',
        'qr_code_hash',
        'quantity',
        'initial_quantity',
        'expiration_date',
        'status',
        'is_quarantined',
        'quarantine_reason',
        'quality_status',
        'purchase_order_code',
        'received_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'initial_quantity' => 'decimal:4',
        'expiration_date' => 'date',
        'received_at' => 'datetime',
        'is_quarantined' => 'boolean',
    ];

    protected $appends = ['status_color', 'days_to_expire', 'remaining_percentage'];

    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'critical' => '#FF0000',
            'warning' => '#F09163',
            default => '#CCFF00',
        };
    }

    public function getDaysToExpireAttribute(): int
    {
        return (int) now()->diffInDays($this->expiration_date, false);
    }

    /**
     * % de la cantidad inicial que queda disponible en el lote.
     */
    public function getRemainingPercentageAttribute(): float
    {
        $initial = (float) $this->initial_quantity;

        return $initial > 0 ? round(((float) $this->quantity / $initial) * 100, 1) : 100.0;
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }

    /**
     * Clasificación FEFO calculada a partir de la fecha de vencimiento.
     * optimal > 7 días | warning <= 7 días | critical ya vencido
     */
    public static function fefoStatusFor($expirationDate): string
    {
        $days = (int) now()->diffInDays($expirationDate, false);

        if ($days < 0) {
            return 'critical';
        }

        return $days <= 7 ? 'warning' : 'optimal';
    }
}
