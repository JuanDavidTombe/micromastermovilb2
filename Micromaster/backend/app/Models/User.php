<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    const ROLE_ADMINISTRADOR = 'ADMINISTRADOR';
    const ROLE_OPERARIO_LOGISTICO = 'OPERARIO_LOGISTICO';
    const ROLE_SUPERVISOR_PRODUCCION = 'SUPERVISOR_PRODUCCION';
    const ROLE_CONTADOR = 'CONTADOR';
    const ROLE_TRANSPORTISTA = 'TRANSPORTISTA';

    const STATUS_PENDING = 'PENDING';

    /** Aprobado por el administrador: acceso completo según su rol. */
    const STATUS_ACTIVE = 'ACTIVE';

    /** Solicitud rechazada: no puede volver a iniciar sesión. */
    const STATUS_REJECTED = 'REJECTED';

    /**
     * Roles que un solicitante puede pedir desde /register.
     * ADMINISTRADOR
     */
    public const REGISTRABLE_ROLES = [
        self::ROLE_OPERARIO_LOGISTICO,
        self::ROLE_SUPERVISOR_PRODUCCION,
        self::ROLE_CONTADOR,
        self::ROLE_TRANSPORTISTA,
    ];

    /** Etiquetas legibles del estado de la solicitud. */
    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'Pendiente de aprobación',
        self::STATUS_ACTIVE => 'Activo',
        self::STATUS_REJECTED => 'Rechazado',
    ];

    public function getStatusLabelAttribute(): string
    {
        return self::STATUS_LABELS[$this->status] ?? ucfirst((string) $this->status);
    }

    /** El registro fue aprobado: es el único estado que permite iniciar sesión. */
    public function isApproved(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /** Acceso efectivo = aprobado por el administrador Y no inactivado. */
    public function canAccessSystem(): bool
    {
        return $this->isApproved() && (bool) $this->is_active;
    }

    /**
     * MATRIZ RBAC OFICIAL MICROMASTER
     *
     *  Rol                 | Inventario & Stock | Recetas & Producción | Pedidos & Entregas | Reportes & Sim | Administración
     *  --------------------|--------------------|----------------------|--------------------|----------------|---------------
     *  ADMINISTRADOR       | Completo           | Completo             | Completo           | Completo       | Completo
     *  OPERARIO_LOGISTICO  | Completo           | Sin acceso           | Completo           | Sin acceso     | Sin acceso
     *  SUPERVISOR_PRODUCC. | Solo consulta      | Completo             | Sin acceso         | Sin acceso     | Sin acceso
     *  CONTADOR            | Sin acceso         | Sin acceso           | Sin acceso         | Solo lectura   | Sin acceso
     *  TRANSPORTISTA       | Sin acceso         | Sin acceso           | Lectura + cobro    | Sin acceso     | Sin acceso
     */
    public const ROLE_PERMISSIONS = [
        self::ROLE_ADMINISTRADOR => [
            'modules' => [
                'dashboard',
                'inventory_stock',
                'recipes_production',
                'orders_delivery',
                'reports_simulations',
                'administration',
            ],
            'read_modules' => [],
            'can' => ['create', 'read', 'update', 'delete', 'download'],
        ],
        self::ROLE_OPERARIO_LOGISTICO => [
            'modules' => ['inventory_stock', 'orders_delivery'],
            'read_modules' => [],
            'can' => ['create', 'read', 'update', 'delete'],
        ],
        self::ROLE_SUPERVISOR_PRODUCCION => [
            'modules' => ['recipes_production'],
            'read_modules' => ['inventory_stock'],
            'can' => ['create', 'read', 'update', 'delete'],
        ],
        self::ROLE_CONTADOR => [
            'modules' => ['reports_simulations'],
            'read_modules' => [],
            'can' => ['read', 'download'],
        ],
        self::ROLE_TRANSPORTISTA => [
            'modules' => ['orders_delivery'],
            'read_modules' => [],
            'can' => ['create', 'read', 'update'],
        ],
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'vehicle',
        'photo_url',
        'is_active',
        'identity_document',
        'employee_code',
        'warehouse_site',
        'shift_schedule',
        'supervisor_name',
        'two_factor_enabled',
        'two_factor_method',
        'locale',
        'theme',
        'notify_email',
        'notify_push',
        'notify_sound',
        'status',
        'requested_role',
        'approved_at',
        'approved_by',
        'rejection_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_active' => 'boolean',
        'last_login_at' => 'datetime',
        'approved_at' => 'datetime',
        'two_factor_enabled' => 'boolean',
        'notify_email' => 'boolean',
        'notify_push' => 'boolean',
        'notify_sound' => 'boolean',
    ];

    protected $appends = ['role_label', 'role_permissions', 'status_label'];

    /**
     * Ficha completa del perfil propio (modal de 4 pestañas).
     * NUNCA incluye password ni roles editables por el usuario.
     */
    public function profileArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'identity_document' => $this->identity_document,
            'employee_code' => $this->employee_code,
            'email' => $this->email,
            'phone' => $this->phone,
            'photo_url' => $this->photo_url,
            'role' => $this->role,
            'role_label' => $this->role_label,
            'role_permissions' => $this->role_permissions,
            'warehouse_site' => $this->warehouse_site,
            'shift_schedule' => $this->shift_schedule,
            'supervisor_name' => $this->supervisor_name,
            'two_factor_enabled' => (bool) $this->two_factor_enabled,
            'two_factor_method' => $this->two_factor_method,
            'locale' => $this->locale ?: 'es',
            'theme' => $this->theme ?: 'light',
            'notify_email' => (bool) $this->notify_email,
            'notify_push' => (bool) $this->notify_push,
            'notify_sound' => (bool) $this->notify_sound,
            'is_active' => (bool) $this->is_active,
            'status' => $this->status ?: self::STATUS_ACTIVE,
            'status_label' => $this->status_label,
            'last_login_at' => optional($this->last_login_at)->toIso8601String(),
        ];
    }

    /**
     * Etiqueta legible del dispositivo para la lista de sesiones activas.
     * Traduce el User-Agent a algo tipo "Chrome · Windows".
     */
    public static function describeDevice(?string $userAgent): string
    {
        $ua = (string) $userAgent;

        $browser = 'Navegador';
        foreach ([
            'Edg' => 'Edge', 'OPR' => 'Opera', 'Chrome' => 'Chrome',
            'Firefox' => 'Firefox', 'Safari' => 'Safari',
        ] as $needle => $name) {
            if (stripos($ua, $needle) !== false) { $browser = $name; break; }
        }

        $platform = 'Otro dispositivo';
        foreach ([
            'Windows' => 'Windows', 'Android' => 'Android', 'iPhone' => 'iPhone',
            'iPad' => 'iPad', 'Mac OS' => 'macOS', 'Linux' => 'Linux',
        ] as $needle => $name) {
            if (stripos($ua, $needle) !== false) { $platform = $name; break; }
        }

        if (stripos($ua, 'Mobile') !== false || stripos($ua, 'Android') !== false) {
            return "{$browser} · {$platform} (App Móvil)";
        }

        return "{$browser} · {$platform} (Navegador Web)";
    }

    public function getRoleLabelAttribute(): string
    {
        return match ($this->role) {
            self::ROLE_ADMINISTRADOR => 'Administrador',
            self::ROLE_OPERARIO_LOGISTICO => 'Operario Logístico',
            self::ROLE_SUPERVISOR_PRODUCCION => 'Supervisor de Producción',
            self::ROLE_CONTADOR => 'Contador',
            self::ROLE_TRANSPORTISTA => 'Transportista',
            default => ucfirst($this->role),
        };
    }

    public function getRolePermissionsAttribute(): array
    {
        return self::ROLE_PERMISSIONS[$this->role] ?? ['modules' => [], 'can' => []];
    }

    public function hasModuleAccess(string $module): bool
    {
        return in_array($module, $this->role_permissions['modules'] ?? []);
    }

    /**
     * Acceso de SOLO LECTURA: true si el rol tiene el módulo completo o sólo de consulta.
     * Usado por los endpoints GET de Inventario para que SUPERVISOR_PRODUCCION
     * pueda verificar disponibilidad sin tener el módulo completo.
     */
    public function hasReadModuleAccess(string $module): bool
    {
        $perms = $this->role_permissions;

        return in_array($module, $perms['modules'] ?? [])
            || in_array($module, $perms['read_modules'] ?? []);
    }

    /**
     * Acceso de ESCRITURA: requiere el módulo COMPLETO más la acción respectiva.
     */
    public function canWriteOn(string $module, string $action): bool
    {
        return $this->hasModuleAccess($module) && $this->hasPermission($action);
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->role_permissions['can'] ?? []);
    }

    public function canCreate(): bool { return $this->hasPermission('create'); }
    public function canRead(): bool { return $this->hasPermission('read'); }
    public function canUpdate(): bool { return $this->hasPermission('update'); }
    public function canDelete(): bool { return $this->hasPermission('delete'); }
    public function canDownload(): bool { return $this->hasPermission('download'); }

    public function isAdmin(): bool { return $this->role === self::ROLE_ADMINISTRADOR; }
    public function isLogisticOperator(): bool { return $this->role === self::ROLE_OPERARIO_LOGISTICO; }
    public function isProductionSupervisor(): bool { return $this->role === self::ROLE_SUPERVISOR_PRODUCCION; }
    public function isAccountant(): bool { return $this->role === self::ROLE_CONTADOR; }
    public function isTransportista(): bool { return $this->role === self::ROLE_TRANSPORTISTA; }

    /**
     * Ficha ligera para el panel de Logística:
     * foto, nombre, teléfono, vehículo y última posición GPS conocida.
     */
    public function toDriverArray(): array
    {
        $location = $this->driverLocation;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'phone' => $this->phone,
            'vehicle' => $this->vehicle,
            'photo_url' => $this->photo_url,
            'last_location' => $location ? [
                'latitude' => (float) $location->latitude,
                'longitude' => (float) $location->longitude,
                'recorded_at' => $location->recorded_at->toIso8601String(),
                'age_seconds' => $location->recorded_at->diffInSeconds(now()),
            ] : null,
            'tracking' => $this->trackingArray(),
        ];
    }

    /**
     * Estado del seguimiento del conductor para el panel de Logística.
     *
     *  - GPS real transmitido por la app (<= 120 s) -> online / real
     *  - sin GPS fresco pero con ruta activa       -> online / simulado
     *  - sin ruta activa                           -> offline
     */
    public function trackingArray(): array
    {
        $location = $this->driverLocation;
        $age = $location ? $location->ageSeconds() : null;

        if ($location && $age <= 120) {
            return [
                'online' => true,
                'source' => 'real',
                'signal' => $location->signal(),
                'age_seconds' => $age,
            ];
        }

        $activeStatuses = $this->routes()
            ->where('status', '!=', Route::STATUS_COMPLETED)
            ->pluck('status');

        if ($activeStatuses->isEmpty()) {
            return ['online' => false, 'source' => null, 'signal' => 'stale', 'age_seconds' => $age];
        }

        return [
            'online' => true,
            'source' => 'simulated',
            'signal' => $activeStatuses->contains(Route::STATUS_IN_PROGRESS) ? 'live' : 'weak',
            'age_seconds' => $age,
        ];
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'driver_id');
    }

    public function routes()
    {
        return $this->hasMany(Route::class, 'driver_id');
    }

    public function driverLocation()
    {
        return $this->hasOne(DriverLocation::class, 'driver_id');
    }

    public function incidents()
    {
        return $this->hasMany(DeliveryIncident::class, 'driver_id');
    }
}
