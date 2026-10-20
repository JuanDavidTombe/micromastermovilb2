<?php

/*
|--------------------------------------------------------------------------
| Archivos del Sistema
|--------------------------------------------------------------------------
|
| MicroMaster guarda las fotografías de perfil de los usuarios en el disco
| `public` (storage/app/public), servido a través del enlace simbólico
| backend/public/storage. Ese enlace lo crea `php artisan storage:link`.
|
*/

return [

    /*
    | Disco por defecto
    */
    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    | Disco en la nube (no se usa en la instalación local de XAMPP)
    */
    'cloud' => env('FILESYSTEM_CLOUD', 's3'),

    /*
    | Discos disponibles
    */
    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL') . '/storage',
            'visibility' => 'public',
            'throw' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],

    ],

    /*
    | Enlaces simbólicos
    */
    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];