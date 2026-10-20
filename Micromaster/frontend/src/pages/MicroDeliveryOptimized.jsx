import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { delivery, orders as ordersApi } from '../services/api';
import FreshCard from '../components/FreshCard';
import TechBadge from '../components/TechBadge';
import StatusBadge from '../components/StatusBadge';
import LogisticsMap from '../components/LogisticsMap';
import { hasModuleAccess, can } from '../constants/roles';

const POLL_MS = 5000;
const GPS_PING_MS = 8000;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(a, b) {
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function routePath(route) {
  const path = [];
  if (route.origin_lat != null) path.push({ lat: Number(route.origin_lat), lng: Number(route.origin_lng) });
  route.stops.forEach((s) => path.push({ lat: s.latitude, lng: s.longitude }));
  return path;
}

function interpolate(path, phase) {
  if (!path.length) return null;
  if (path.length === 1) return { latitude: path[0].lat, longitude: path[0].lng, heading: 0 };
  const lens = path.slice(0, -1).map((p, i) => haversineKm(p, path[i + 1]));
  const total = lens.reduce((s, v) => s + v, 0) || 1;
  let target = Math.max(0, Math.min(1, phase)) * total;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= target || i === lens.length - 1) {
      const ratio = lens[i] > 0 ? Math.max(0, Math.min(1, (target - acc) / lens[i])) : 1;
      const a = path[i];
      const b = path[i + 1];
      return {
        latitude: a.lat + (b.lat - a.lat) * ratio,
        longitude: a.lng + (b.lng - a.lng) * ratio,
        heading: bearing(a, b),
      };
    }
    acc += lens[i];
  }
  return null;
}

export default function MicroDelivery({ user }) {
  const role = user?.role || 'ADMINISTRADOR';
  const canAccess = hasModuleAccess(role, 'orders_delivery');
  const isManager = role === 'ADMINISTRADOR' || role === 'OPERARIO_LOGISTICO';
  const canCreate = can(role, 'create') && canAccess;

  const location = useLocation();
  const view = location.pathname === '/delivery' ? 'mapa' : location.pathname.split('/')[2] || 'mapa';

  const [routes, setRoutes] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incSummary, setIncSummary] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLive, setGpsLive] = useState(false);
  const gpsTimer = useRef(null);
  const [activeMapRoute, setActiveMapRoute] = useState(null);

  const refreshRoutes = useCallback(() => {
    return delivery
      .getRoutes()
      .then((res) => {
        setRoutes(res.data.routes || []);
        setRouteSummary(res.data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshIncidents = useCallback(() => {
    return delivery
      .getIncidents()
      .then((res) => {
        setIncidents(res.data.incidents || []);
        setIncSummary(res.data.summary || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAccess) return undefined;
    refreshRoutes();
    refreshIncidents();
    if (isManager) {
      delivery.getDrivers().then((res) => setDrivers(res.data.drivers || [])).catch(() => {});
    }
    const id = setInterval(() => {
      refreshRoutes();
      refreshIncidents();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [canAccess, isManager, refreshRoutes, refreshIncidents]);

  const pingGps = useCallback(async () => {
    const route = routes.find((r) => r.id === selectedRouteId) || routes.find((r) => r.status === 'in_progress') || routes[0];
    if (!route) return;
    const path = routePath(route);
    if (!path.length) return;
    const period = Math.max(1, route.stops.length) * 90;
    const phase = ((Date.now() / 1000) % period) / period;
    const pos = interpolate(path, phase);
    if (!pos) return;
    const payload = {
      latitude: Number(pos.latitude.toFixed(6)),
      longitude: Number(pos.longitude.toFixed(6)),
      speed_kmh: route.status === 'in_progress' ? 46.5 : 0,
      heading: pos.heading,
    };
    if (isManager && route.driver?.id) payload.driver_id = route.driver.id;
    try {
      await delivery.sendLocation(payload);
    } catch (e) {
    }
  }, [routes, selectedRouteId, isManager]);

  useEffect(() => {
    if (!gpsLive) {
      if (gpsTimer.current) clearInterval(gpsTimer.current);
      gpsTimer.current = null;
      return undefined;
    }
    pingGps();
    gpsTimer.current = setInterval(pingGps, GPS_PING_MS);
    return () => clearInterval(gpsTimer.current);
  }, [gpsLive, pingGps]);

  const onlineDrivers = drivers.filter((d) => d.tracking?.online).length;
  const incidentOrderIds = useMemo(() => {
    const ids = [];
    incidents.filter((i) => i.status === 'OPEN').forEach((i) => i.order_id && ids.push(i.order_id));
    return ids;
  }, [incidents]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-cream">
        <div className="text-center">
          <i className="bi bi-lock-fill text-6xl mb-4" aria-hidden="true" />
          <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para acceder a Logística</p>
          <p className="text-xs text-slate-400 mt-4">Rol: {user?.role_label}</p>
        </div>
      </div>
    );
  }

  if (view !== 'mapa') {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rutas & Mapa GPS</h1>
          <p className="text-sm text-slate-500">Rutas, conductores, mapa en vivo y novedades</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <TechBadge label="LOGÍSTICA EN VIVO" color="terracotta" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FreshCard title="Rutas activas" value={routeSummary?.active ?? 0} subtitle="En curso" icon="signpost-2" color="lime" />
        <FreshCard title="Novedades abiertas" value={incSummary?.open ?? 0} subtitle="Requieren gestión" icon="exclamation-octagon" color="terracotta" />
        <FreshCard title="Conductores en línea" value={isManager ? `${onlineDrivers}/${drivers.length}` : '—'} subtitle="GPS real o en ruta" icon="truck" color="lime" />
        <FreshCard title="Entregas" value={routeSummary?.completed ?? 0} subtitle="Rutas cerradas" icon="box-seam" color="cream" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-white/80 rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Lista de Control de Flota</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{routes.length} rutas · {routes.filter((r) => (r.open_incidents || 0) > 0).length} con incidencia</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {loading && routes.length === 0 && (
              <p className="text-xs text-slate-400 p-4 text-center">Cargando rutas…</p>
            )}
            {!loading && routes.length === 0 && (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-600">Sin rutas asignadas</p>
              </div>
            )}

            {routes.map((route) => {
              const delivered = Number(route.delivered_count || 0);
              const totalStops = Number(route.stops_count || route.stops?.length || 0);
              const progress = route.progress != null ? Number(route.progress) : totalStops > 0 ? Math.round((delivered / totalStops) * 100) : 0;
              const status = route.status || '';
              const isActive = activeMapRoute?.id === route.id;
              return (
                <div key={route.id} className="p-4 rounded-2xl border border-slate-200 bg-white/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-slate-500">{route.route_code}</span>
                    <StatusBadge status={status} />
                  </div>

                  <p className="font-medium text-sm text-slate-900">{route.destination}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{route.driver?.name || 'Sin conductor'} · {route.driver?.vehicle || '—'}</p>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Progreso de la ruta</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                      <div className="h-full rounded-full bg-lime-400" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span>{delivered} / {totalStops} clientes entregados</span>
                    {route.open_incidents > 0 && (
                      <span className="text-red-600 font-semibold">{route.open_incidents} incidencia(s)</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-2">
                      {status === 'delivered' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lime-400/30 text-[#3F5600]">A tiempo</span>}
                      {status === 'in_transit' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-700">En ruta</span>}
                      {status === 'assigned' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700">Asignado</span>}
                      {status === 'cancelled' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600">Cancelado</span>}
                      {route.open_incidents > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600">Incidencia</span>}
                    </div>
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActiveMapRoute(null);
                          setSelectedRouteId(null);
                          return;
                        }
                        setActiveMapRoute(route);
                        setSelectedRouteId(route.id);
                        setGpsLive(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        isActive ? 'bg-slate-900 text-lime-400' : 'bg-lime-400 text-slate-900 hover:bg-lime-500'
                      }`}
                    >
                      {isActive ? 'Desactivar Rastreo en Mapa' : `Activar Rastreo en Mapa para ${route.driver?.name?.split(' ')[0] || 'Conductor'}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          {activeMapRoute ? (
            <div className="bg-white/80 rounded-3xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Mapa de operación</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeMapRoute.route_code} · {activeMapRoute.driver?.name || 'Sin conductor'} · {activeMapRoute.stops_count || 0} paradas
                  </p>
                </div>
                {canCreate && (
                  <button
                    onClick={() => setGpsLive((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      gpsLive
                        ? 'bg-lime-400 text-slate-900 shadow'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {gpsLive ? 'GPS en vivo · ON' : 'Simular transmisión GPS'}
                  </button>
                )}
              </div>

              <LogisticsMap
                routes={routes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={setSelectedRouteId}
                incidentOrderIds={incidentOrderIds}
              />

              <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-slate-400">
                <span>Refresco automático cada {POLL_MS / 1000}s</span>
                <span>·</span>
                <span>{gpsLive ? `Transmisión GPS cada ${GPS_PING_MS / 1000}s` : 'Posición simulada sobre la ruta'}</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-3xl border border-slate-900 p-8 text-white">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-lime-400/20 flex items-center justify-center text-lime-400">
                  <i className="bi bi-geo-alt text-2xl" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Vista Previa / Mapa Bajo Demanda</h2>
                  <p className="text-sm text-white/60 mt-1">El mapa no se carga por defecto para optimizar costos de Google Maps</p>
                </div>
                <p className="text-xs text-white/50">Selecciona una ruta de la lista y activa el rastreo en mapa para cargarlo bajo demanda</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}