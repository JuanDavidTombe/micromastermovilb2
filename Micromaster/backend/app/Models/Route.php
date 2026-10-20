<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'driver_id',
        'destination',
        'origin_label',
        'origin_lat',
        'origin_lng',
        'route_code',
        'status',
        'scheduled_date',
        'distance_km',
        'duration_min',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'origin_lat' => 'decimal:8',
        'origin_lng' => 'decimal:8',
        'distance_km' => 'decimal:2',
        'duration_min' => 'decimal:2',
    ];

    public function driver()
    {
        return $this->belongsTo(User::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function incidents()
    {
        return $this->hasMany(DeliveryIncident::class);
    }

    /**
     * Paradas de la ruta: pedidos en orden de secuencia (id) que tengan
     * coordenadas. Ése es el array que se pasa a Google Maps para trazar
     * la polilínea y colocar los marcadores.
     */
    public function stops(): array
    {
        $orders = $this->relationLoaded('orders') ? $this->orders : $this->orders()->get();

        return $orders
            ->sortBy('id')
            ->values()
            ->filter(fn($o) => $o->latitude !== null && $o->longitude !== null)
            ->map(fn($o) => [
                'order_id' => $o->id,
                'client_name' => $o->client_name,
                'destination' => $o->destination,
                'latitude' => (float) $o->latitude,
                'longitude' => (float) $o->longitude,
                'status' => $o->status,
                'payment_status' => $o->payment_status,
                'amount' => (float) $o->amount,
            ])
            ->values()
            ->all();
    }

    /**
     * Progreso de la ruta: entregas completadas / total de paradas.
     */
    public function getProgressAttribute(): float
    {
        $total = $this->orders_count ?? $this->orders()->count();

        if ($total === 0) {
            return 0.0;
        }

        $done = $this->orders()->where('status', 'delivered')->count();

        return round(($done / $total) * 100, 1);
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'Pendiente',
            self::STATUS_IN_PROGRESS => 'En Curso',
            self::STATUS_COMPLETED => 'Completada',
            default => ucfirst((string) $this->status),
        };
    }
}
