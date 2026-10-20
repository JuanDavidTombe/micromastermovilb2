<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryIncident extends Model
{
    public const TYPE_CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND';
    public const TYPE_VEHICLE_BREAKDOWN = 'VEHICLE_BREAKDOWN';
    public const TYPE_WRONG_ADDRESS = 'WRONG_ADDRESS';
    public const TYPE_OTHER = 'OTHER';

    public const STATUS_OPEN = 'OPEN';
    public const STATUS_RESOLVED = 'RESOLVED';

    protected $fillable = [
        'order_id',
        'route_id',
        'driver_id',
        'type',
        'description',
        'status',
        'resolution',
        'reported_at',
        'resolved_at',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    protected $appends = ['type_label', 'status_label'];

    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            self::TYPE_CLIENT_NOT_FOUND => 'Cliente ausente',
            self::TYPE_VEHICLE_BREAKDOWN => 'Vehículo varado',
            self::TYPE_WRONG_ADDRESS => 'Dirección incorrecta',
            self::TYPE_OTHER => 'Otra novedad',
            default => ucfirst(str_replace('_', ' ', (string) $this->type)),
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return $this->status === self::STATUS_RESOLVED ? 'Resuelta' : 'Abierta';
    }

    /**
     * Severidad para colorear el panel de novedades.
     */
    public function getSeverityAttribute(): string
    {
        return match ($this->type) {
            self::TYPE_CLIENT_NOT_FOUND => 'critical',
            self::TYPE_VEHICLE_BREAKDOWN => 'warning',
            self::TYPE_WRONG_ADDRESS => 'attention',
            default => 'info',
        };
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function driver()
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * Payload liviano para el panel lateral de incidencias.
     */
    public function toPanelArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => $this->type_label,
            'severity' => $this->severity,
            'description' => $this->description,
            'status' => $this->status,
            'status_label' => $this->status_label,
            'resolution' => $this->resolution,
            'reported_at' => $this->reported_at->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'route_id' => $this->route_id,
            'order_id' => $this->order_id,
            'driver_id' => $this->driver_id,
            'route' => $this->route ? [
                'id' => $this->route->id,
                'route_code' => $this->route->route_code,
                'status' => $this->route->status,
            ] : null,
            'order' => $this->order ? [
                'id' => $this->order->id,
                'client_name' => $this->order->client_name,
                'destination' => $this->order->destination,
                'latitude' => $this->order->latitude !== null ? (float) $this->order->latitude : null,
                'longitude' => $this->order->longitude !== null ? (float) $this->order->longitude : null,
            ] : null,
            'driver' => $this->driver ? $this->driver->toDriverArray() : null,
        ];
    }
}
