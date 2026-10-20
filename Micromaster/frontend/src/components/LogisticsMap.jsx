import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useJsApiLoader,
  GoogleMap,
  MarkerF,
  Polyline,
  DirectionsRenderer,
  OverlayViewF,
  InfoWindowF,
} from '@react-google-maps/api';

const MAP_ID = 'micromaster-logistics';
const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };

const ROUTE_STYLE = {
  in_progress: { color: '#0F2133', weight: 5, dashed: [] },
  pending: { color: '#94a3b8', weight: 4, dashed: [8, 8] },
  completed: { color: '#16a34a', weight: 4, dashed: [] },
};

const STOP_STYLE = {
  delivered: { fill: '#16a34a', text: '#ffffff' },
  incident: { fill: '#dc2626', text: '#ffffff' },
  transit: { fill: '#EAB308', text: '#0F2133' },
};

const uri = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const DEPOT_ICON = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
  <rect x="4" y="4" width="30" height="30" rx="9" fill="#0F2133" stroke="#CCFF00" stroke-width="3"/>
  <path d="M11 25V17.5L19 12l8 5.5V25z" fill="#CCFF00"/>
  <rect x="16.5" y="19.5" width="5" height="5.5" fill="#0F2133"/>
</svg>`);

const TRUCK_ICON = uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="20" fill="#0F2133" stroke="#CCFF00" stroke-width="3"/>
  <rect x="11" y="16" width="13" height="11" rx="2" fill="#CCFF00"/>
  <path d="M24 19h6.5l4.5 5V27H24z" fill="#CCFF00"/>
  <circle cx="16.5" cy="30" r="2.8" fill="#ffffff"/>
  <circle cx="31" cy="30" r="2.8" fill="#ffffff"/>
</svg>`);

function stopIcon(index, kind) {
  const s = STOP_STYLE[kind] || STOP_STYLE.transit;
  return uri(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="14" fill="${s.fill}" stroke="#0F2133" stroke-width="3"/>
  <text x="17" y="22" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="bold"
        text-anchor="middle" fill="${s.text}">${index}</text>
</svg>`);
}

function stopKind(route, stop) {
  if (route.open_incidents > 0 && route.openIncidentOrderIds?.includes(stop.order_id)) return 'incident';
  if (stop.status === 'delivered') return 'delivered';
  return 'transit';
}

function pathOf(route) {
  const path = [];
  if (route.origin_lat != null && route.origin_lng != null) {
    path.push({ lat: Number(route.origin_lat), lng: Number(route.origin_lng) });
  }
  route.stops.forEach((s) => path.push({ lat: s.latitude, lng: s.longitude }));
  return path;
}

export default function LogisticsMap({ routes = [], selectedRouteId, onSelectRoute, incidentOrderIds = [] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: MAP_ID,
    googleMapsApiKey: apiKey || '',
    version: 'weekly',
  });

  const mapRef = useRef(null);
  const [trucks, setTrucks] = useState({});
  const [activeStop, setActiveStop] = useState(null);
  const [activeTruck, setActiveTruck] = useState(null);
  const [roads, setRoads] = useState({});

  const enriched = useMemo(
    () => routes.map((r) => ({ ...r, openIncidentOrderIds: incidentOrderIds })),
    [routes, incidentOrderIds]
  );

  const targets = useRef({});
  targets.current = useMemo(() => {
    const t = {};
    enriched.forEach((r) => {
      if (r.driver_gps) t[r.id] = { lat: Number(r.driver_gps.latitude), lng: Number(r.driver_gps.longitude) };
    });
    return t;
  }, [enriched]);

  useEffect(() => {
    if (!isLoaded) return undefined;
    let raf;
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTrucks((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(targets.current).forEach(([id, target]) => {
          const cur = next[id];
          if (!cur) {
            next[id] = { ...target };
            changed = true;
            return;
          }
          const k = 1 - Math.pow(0.0008, dt);
          const lat = cur.lat + (target.lat - cur.lat) * k;
          const lng = cur.lng + (target.lng - cur.lng) * k;
          if (Math.abs(lat - cur.lat) > 1e-7 || Math.abs(lng - cur.lng) > 1e-7) {
            next[id] = { lat, lng };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isLoaded]);

  const boundsKey = enriched
    .map((r) => `${r.id}:${r.origin_lat ?? '-'}:${r.stops.length}:${r.stops.map((s) => s.order_id).join('.')}`)
    .join('|');

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let has = false;
    enriched.forEach((r) => {
      if (r.origin_lat != null) {
        bounds.extend({ lat: Number(r.origin_lat), lng: Number(r.origin_lng) });
        has = true;
      }
      r.stops.forEach((s) => {
        bounds.extend({ lat: s.latitude, lng: s.longitude });
        has = true;
      });
      if (r.driver_gps) {
        bounds.extend({ lat: Number(r.driver_gps.latitude), lng: Number(r.driver_gps.longitude) });
        has = true;
      }
    });
    if (has) map.fitBounds(bounds, 70);
  }, [enriched]);

  useEffect(() => {
    if (isLoaded) {
      const id = setTimeout(fitBounds, 120);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [isLoaded, boundsKey, fitBounds]);

  useEffect(() => {
    if (!isLoaded || !enriched.length) return undefined;
    let cancelled = false;
    const service = new window.google.maps.DirectionsService();

    Promise.all(
      enriched.map(
        (r) =>
          new Promise((resolve) => {
            if (r.origin_lat == null || !r.stops.length) return resolve([r.id, null]);
            const destination = r.stops[r.stops.length - 1];
            service.route(
              {
                origin: { lat: Number(r.origin_lat), lng: Number(r.origin_lng) },
                destination: { lat: destination.latitude, lng: destination.longitude },
                waypoints: r.stops.slice(0, -1).map((s) => ({
                  location: { lat: s.latitude, lng: s.longitude },
                  stopover: true,
                })),
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
              },
              (res, status) => resolve([r.id, status === 'OK' ? res : null])
            );
          })
      )
    ).then((pairs) => {
      if (cancelled) return;
      setRoads(Object.fromEntries(pairs.filter(([, v]) => v)));
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, boundsKey]);

  if (!apiKey) {
    return <MapPlaceholder title="Google Maps no configurado" text="Define VITE_GOOGLE_MAPS_API_KEY en frontend/.env y reinicia el servidor de desarrollo." />;
  }

  if (loadError) {
    return <MapPlaceholder title="No se pudo cargar Google Maps" text="Verifica la clave y las APIs habilitadas en la consola de Google Cloud." />;
  }

  if (!isLoaded) {
    return <MapPlaceholder title="Cargando mapa…" text="Inicializando Google Maps JavaScript API" />;
  }

  return (
    <div className="relative w-full h-[320px] md:h-[420px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={DEFAULT_CENTER}
        zoom={6}
        onLoad={(m) => {
          mapRef.current = m;
        }}
        options={{
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: false,
          zoomControl: true,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#f4f3ec' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe3ef' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
            { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dfe8cf' }] },
          ],
        }}
      >
        {enriched.map((route) => {
          const style = ROUTE_STYLE[route.status] || ROUTE_STYLE.pending;
          const selected = route.id === selectedRouteId;
          const raw = pathOf(route);
          const path = roads[route.id]
            ? roads[route.id].routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
            : raw;

          if (path.length < 2) return null;

          return (
            <React.Fragment key={route.id}>
              <Polyline
                path={path}
                options={{
                  strokeColor: '#ffffff',
                  strokeOpacity: 0.9,
                  strokeWeight: style.weight + 4,
                  zIndex: selected ? 3 : 1,
                }}
              />
              <Polyline
                path={path}
                onClick={() => onSelectRoute?.(route.id)}
                options={{
                  strokeColor: style.color,
                  strokeOpacity: selected ? 1 : 0.85,
                  strokeWeight: selected ? style.weight + 2 : style.weight,
                  strokeDashArray: style.dashed.length ? style.dashed : null,
                  zIndex: selected ? 4 : 2,
                  clickable: true,
                }}
              />
            </React.Fragment>
          );
        })}

        {enriched.map((route) => {
          const nodes = [];
          if (route.origin_lat != null) {
            nodes.push(
              <MarkerF
                key={`d-${route.id}`}
                position={{ lat: Number(route.origin_lat), lng: Number(route.origin_lng) }}
                icon={{ url: DEPOT_ICON, scaledSize: new window.google.maps.Size(38, 38) }}
                title={`${route.origin_label} · origen de ${route.route_code}`}
                zIndex={20}
              />
            );
          }
          route.stops.forEach((stop, i) => {
            nodes.push(
              <MarkerF
                key={`s-${route.id}-${stop.order_id}`}
                position={{ lat: stop.latitude, lng: stop.longitude }}
                icon={{ url: stopIcon(i + 1, stopKind(route, stop)), scaledSize: new window.google.maps.Size(34, 34) }}
                title={`${route.route_code} · ${stop.client_name}`}
                zIndex={30}
                onClick={() => setActiveStop({ route, stop, index: i + 1 })}
              />
            );
          });
          return nodes;
        })}

        {enriched.map((route) => {
          const pos = trucks[route.id];
          if (!pos) return null;
          return (
            <OverlayViewF
              key={`t-${route.id}`}
              position={pos}
              mapPaneName="overlayMouseTarget"
              zIndex={60}
              getPixelPositionOffset={() => ({ x: -24, y: -24 })}
            >
              <div
                className="cursor-pointer select-none"
                onClick={() => setActiveTruck(route)}
                title={route.driver?.name}
              >
                <img
                  src={TRUCK_ICON}
                  alt=""
                  draggable={false}
                  className="drop-shadow-[0_2px_4px_rgba(15,33,51,0.45)]"
                  style={{
                    animation: route.status === 'in_progress' ? 'truckPulse 2s ease-in-out infinite' : 'none',
                  }}
                />
              </div>
            </OverlayViewF>
          );
        })}

        {activeStop && (
          <InfoWindowF
            position={{ lat: activeStop.stop.latitude, lng: activeStop.stop.longitude }}
            onCloseClick={() => setActiveStop(null)}
          >
            <div style={{ minWidth: 190, fontFamily: 'Inter, system-ui, sans-serif' }}>
              <p style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
                {activeStop.route.route_code} · parada {activeStop.index}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0F2133', margin: '4px 0 2px' }}>
                {activeStop.stop.client_name}
              </p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{activeStop.stop.destination}</p>
              <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0' }}>
                Estado: <strong>{activeStop.stop.status}</strong> · ${activeStop.stop.amount}
              </p>
            </div>
          </InfoWindowF>
        )}

        {activeTruck && trucks[activeTruck.id] && (
          <InfoWindowF
            position={trucks[activeTruck.id]}
            onCloseClick={() => setActiveTruck(null)}
          >
            <div style={{ minWidth: 210, fontFamily: 'Inter, system-ui, sans-serif' }}>
              <p style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
                {activeTruck.route_code} · {activeTruck.status}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0F2133', margin: '4px 0 2px' }}>
                {activeTruck.driver?.name}
              </p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{activeTruck.driver?.vehicle}</p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{activeTruck.driver?.phone}</p>
              <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0' }}>
                GPS:{' '}
                <strong>
                  {activeTruck.driver_gps?.source === 'real' ? 'transmitida en vivo' : 'simulada sobre la ruta'}
                </strong>
                {activeTruck.driver_gps?.speed_kmh != null && ` · ${Math.round(activeTruck.driver_gps.speed_kmh)} km/h`}
              </p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      <div className="absolute left-3 top-3 bg-white/95 backdrop-blur rounded-xl border border-slate-200 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-500 shadow-sm">
        Google Maps · Logística MICROMASTER
      </div>

      <div className="absolute left-3 bottom-3 flex flex-wrap gap-2 bg-white/95 backdrop-blur rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
        <LegendDot color="#16a34a" label="Entregado" />
        <LegendDot color="#EAB308" label="En tránsito / pendiente" />
        <LegendDot color="#dc2626" label="Con incidencia" />
        <LegendDot color="#0F2133" label="Depósito" square />
      </div>
    </div>
  );
}

function LegendDot({ color, label, square }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
      <span
        className={square ? 'w-2.5 h-2.5 rounded-[3px]' : 'w-2.5 h-2.5 rounded-full'}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function MapPlaceholder({ title, text }) {
  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[420px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6 md:px-8">
      <i className="bi bi-map text-4xl mb-3" aria-hidden="true" />
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{text}</p>
    </div>
  );
}
