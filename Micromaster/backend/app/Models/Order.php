<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'route_id',
        'driver_id',
        'destination',
        'latitude',
        'longitude',
        'client_name',
        'status',
        'payment_method',
        'payment_status',
        'otp_code',
        'amount',
        'received_amount',
        'change_due',
        'contingency',
        'contingency_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'received_amount' => 'decimal:2',
        'change_due' => 'decimal:2',
        'contingency' => 'boolean',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
    ];

    protected $appends = ['payment_status_label', 'status_label'];

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'pending' => 'Pendiente',
            'assigned' => 'Asignado',
            'in_transit' => 'En Tránsito',
            'delivered' => 'Entregado',
            'cancelled' => 'Cancelado',
            default => ucfirst((string) $this->status),
        };
    }

    public function getPaymentStatusLabelAttribute(): string
    {
        return match ($this->payment_status) {
            'pending' => 'Pendiente',
            'confirmed' => 'Confirmado',
            'completed' => 'Completado',
            'refunded' => 'Reembolsado',
            default => ucfirst($this->payment_status),
        };
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function driver()
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function incidents()
    {
        return $this->hasMany(DeliveryIncident::class);
    }
}
