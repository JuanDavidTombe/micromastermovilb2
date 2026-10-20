<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    protected $fillable = [
        'company_name',
        'tax_id',
        'warehouse_address',
        'phone',
        'email',
        'version',
        'environment',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * El perfil B2B es un singleton: siempre la fila id = 1.
     */
    public static function current(): self
    {
        return static::firstOrCreate(
            ['id' => 1],
            [
                'company_name' => 'MICROMASTER B2B',
                'tax_id' => '901.456.789-1',
                'warehouse_address' => 'Cra. 45 # 12-40, Bodega Central, Medellin',
                'phone' => '+57 604 123 4567',
                'email' => 'contacto@micromaster.com',
            ]
        );
    }
}