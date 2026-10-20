<?php

namespace App\Support;

/**
 * Simulador de GPS para el módulo Logística.
 *
 * Cuando el conductor no está transmitiendo (o su último ping es viejo),
 * interpola su posición sobre la polilínea de paradas de la ruta para que
 * el mapa muestre el camión en movimiento. En cuanto la app móvil envía
 * una coordenada real a POST /api/delivery/location, ésta tiene prioridad.
 */
class GpsSimulator
{
    /**
     * Radio terrestre en km.
     */
    private const EARTH_KM = 6371.0;

    /**
     * Duración simulada (segundos) de cada tramo entre dos paradas.
     */
    private const SECONDS_PER_LEG = 90;

    /**
     * Punto interpolado sobre la polilínea.
     *
     * @param  array<int, array{latitude: float, longitude: float}> $path
     * @return array{latitude: float, longitude: float, heading: float, leg_index: int, leg_progress: float}|null
     */
    public static function position(array $path, float $phase): ?array
    {
        $path = array_values(array_filter($path, fn($p) => isset($p['latitude'], $p['longitude'])));

        if (count($path) === 0) {
            return null;
        }

        $phase = max(0.0, min(1.0, $phase));

        // Punto único -> no hay dónde moverse
        if (count($path) === 1) {
            return [
                'latitude' => (float) $path[0]['latitude'],
                'longitude' => (float) $path[0]['longitude'],
                'heading' => 0.0,
                'leg_index' => 0,
                'leg_progress' => 1.0,
            ];
        }

        $segments = [];
        $total = 0.0;

        for ($i = 0; $i < count($path) - 1; $i++) {
            $len = self::distanceKm($path[$i], $path[$i + 1]);
            $segments[$i] = $len;
            $total += $len;
        }

        if ($total <= 0.0) {
            return [
                'latitude' => (float) $path[0]['latitude'],
                'longitude' => (float) $path[0]['longitude'],
                'heading' => 0.0,
                'leg_index' => 0,
                'leg_progress' => 0.0,
            ];
        }

        $target = $phase * $total;
        $acc = 0.0;

        foreach ($segments as $i => $len) {
            if ($acc + $len >= $target || $i === count($segments) - 1) {
                $ratio = $len > 0 ? min(1.0, max(0.0, ($target - $acc) / $len)) : 1.0;
                $a = $path[$i];
                $b = $path[$i + 1];

                return [
                    'latitude' => (float) ($a['latitude'] + ($b['latitude'] - $a['latitude']) * $ratio),
                    'longitude' => (float) ($a['longitude'] + ($b['longitude'] - $a['longitude']) * $ratio),
                    'heading' => self::bearing($a, $b),
                    'leg_index' => $i,
                    'leg_progress' => round($ratio, 3),
                ];
            }

            $acc += $len;
        }

        return null;
    }

    /**
     * Fase 0..1 determinística y siempre en movimiento, desfasada por
     * conductor para que los camiones no viajen sincronizados.
     * El ciclo dura el equivalente a SECONDS_PER_LEG por parada.
     */
    public static function phase(?int $driverId, int $stopCount = 6): float
    {
        $period = self::periodSeconds($stopCount);
        $offset = abs(($driverId ?? 0) * 37) % $period;

        return ((now()->getTimestamp() + $offset) % $period) / $period;
    }

    /**
     * Segundos de duración simulada de toda la ruta.
     */
    public static function periodSeconds(int $stopCount): int
    {
        return max(1, $stopCount) * self::SECONDS_PER_LEG;
    }

    /**
     * Distancia Haversine en kilómetros.
     */
    public static function distanceKm(array $a, array $b): float
    {
        $lat1 = deg2rad((float) $a['latitude']);
        $lon1 = deg2rad((float) $a['longitude']);
        $lat2 = deg2rad((float) $b['latitude']);
        $lon2 = deg2rad((float) $b['longitude']);

        $dLat = $lat2 - $lat1;
        $dLon = $lon2 - $lon1;

        $h = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLon / 2) ** 2;

        return 2 * self::EARTH_KM * asin(min(1.0, sqrt($h)));
    }

    /**
     * Rumbo (heading) en grados de a hacia b.
     */
    public static function bearing(array $a, array $b): float
    {
        $lat1 = deg2rad((float) $a['latitude']);
        $lat2 = deg2rad((float) $b['latitude']);
        $dLon = deg2rad((float) $b['longitude'] - (float) $a['longitude']);

        $y = sin($dLon) * cos($lat2);
        $x = cos($lat1) * sin($lat2) - sin($lat1) * cos($lat2) * cos($dLon);

        return round(rad2deg(atan2($y, $x)) + 360) % 360;
    }
}
