import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { formatCOP } from '../utils/currencyFormatter';

const DEFAULT_CENTER = [6.2442, -75.5812]; // Medellín / Centro Colombia
const DEFAULT_ZOOM = 6;

// Estilos de rutas según estado
const ROUTE_STYLES = {
  in_progress: { color: '#0F2133', weight: 5, opacity: 0.9, dashArray: null },
  pending: { color: '#64748b', weight: 4, opacity: 0.75, dashArray: '6, 8' },
  completed: { color: '#16a34a', weight: 4, opacity: 0.85, dashArray: null },
};

// Generador de Icono SVG de Camión / Conductor en Vivo
function createTruckIcon(route, isSelected = false) {
  const driverName = route.driver?.name?.split(' ')[0] || 'Conductor';
  const vehiclePlate = route.driver?.vehicle ? route.driver.vehicle.split('-').pop().trim() : 'FLOTA';
  const speed = route.driver_gps?.speed_kmh ? `${Math.round(route.driver_gps.speed_kmh)} km/h` : 'En ruta';
  const isOnline = route.driver_gps?.signal === 'live';

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
      <!-- Etiqueta de Conductor y Placa -->
      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md text-[10px] font-black tracking-tight whitespace-nowrap mb-1 transition-transform group-hover:scale-105 ${
        isSelected ? 'bg-lime-400 text-slate-900 ring-2 ring-slate-900' : 'bg-slate-900 text-white border border-white/20'
      }">
        <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}"></span>
        <span>${driverName}</span>
        <span class="text-[9px] opacity-75 font-mono">(${vehiclePlate})</span>
      </div>

      <!-- Icono de Camión con Aro Pulsante -->
      <div class="relative flex items-center justify-center w-10 h-10 rounded-2xl shadow-xl transition-all ${
        isSelected
          ? 'bg-lime-400 text-slate-900 ring-4 ring-lime-400/50 scale-110'
          : 'bg-slate-900 text-lime-400 border-2 border-lime-400'
      }">
        ${isOnline ? '<span class="absolute -inset-1 rounded-2xl bg-lime-400/30 animate-pulse"></span>' : ''}
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h9A1.5 1.5 0 0 1 12 3.5V5h1.02a1.5 1.5 0 0 1 1.17.563l1.481 1.85a1.5 1.5 0 0 1 .329.938V10.5a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 1 1-4 0H5a2 2 0 1 1-4 0 1 1 0 0 1-1-1V3.5zM11 6V3.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5V10h.08a2 2 0 0 1 3.84 0H9.5a2 2 0 0 1 3.5 0h.5a.5.5 0 0 0 .5-.5V8.351a.5.5 0 0 0-.11-.313L12.56 6.3A.5.5 0 0 0 12.17 6H11z"/>
        </svg>
      </div>

      <!-- Indicador de Velocidad / Estado -->
      <div class="mt-0.5 px-1.5 py-0.2 rounded bg-slate-900/90 text-lime-400 font-mono text-[9px] font-bold shadow-sm whitespace-nowrap">
        ${speed}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-truck-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });
}

// Generador de Icono de Bodega / Planta Origen
function createDepotIcon(label = 'Bodega Principal') {
  const html = `
    <div class="flex flex-col items-center cursor-pointer" style="transform: translate(-50%, -50%);">
      <div class="px-2 py-0.5 rounded-full bg-slate-900 text-lime-400 border border-lime-400 shadow-md text-[9px] font-extrabold whitespace-nowrap mb-1">
        ${label}
      </div>
      <div class="w-9 h-9 rounded-2xl bg-slate-900 border-2 border-lime-400 text-lime-400 flex items-center justify-center shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14.763.075A.5.5 0 0 1 15 .5v15a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V14h-1v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V10a.5.5 0 0 1 .342-.474L6 7.64V4.5a.5.5 0 0 1 .276-.447l8-4a.5.5 0 0 1 .487.022zM6 8.694 1 10.36V15h5V8.694zM7 15h2v-1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15h2V1.809L7 5.309V15z"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-depot-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

// Generador de Icono de Parada Numerada
function createStopIcon(index, status = 'transit', hasIncident = false) {
  let bg = 'bg-amber-500 text-slate-950 border-white';
  let badgeText = `${index}`;

  if (hasIncident) {
    bg = 'bg-red-600 text-white border-white animate-bounce';
    badgeText = '!';
  } else if (status === 'delivered') {
    bg = 'bg-emerald-600 text-white border-white';
    badgeText = '✓';
  }

  const html = `
    <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 font-bold font-mono text-xs ${bg}" style="transform: translate(-50%, -50%);">
      ${badgeText}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-stop-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function LogisticsMap({
  routes = [],
  selectedRouteId = null,
  onSelectRoute = () => {},
  incidentOrderIds = [],
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('voyager'); // 'voyager' | 'osm' | 'satellite'
  const [selectedTruckModal, setSelectedTruckModal] = useState(null);

  // Capas de mapas gratuitas (100% sin clave de pago)
  const TILE_PROVIDERS = {
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      name: 'Calles Limpio (Recomendado)',
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      name: 'OpenStreetMap Estándar',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      name: 'Satelital (Esri)',
    },
  };

  // Inicializar Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false, // Reubicaremos el zoom a la esquina conveniente
      });

      // Añadir control de zoom abajo a la derecha
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Añadir capa base inicial
      const initialTile = L.tileLayer(TILE_PROVIDERS.voyager.url, {
        attribution: TILE_PROVIDERS.voyager.attribution,
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = initialTile;

      // Grupo para elementos dinámicos (rutas, paradas, camiones)
      const layersGroup = L.featureGroup().addTo(map);
      layersGroupRef.current = layersGroup;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cambiar proveedor de mapa en caliente
  const handleSwitchLayer = useCallback((layerKey) => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = TILE_PROVIDERS[layerKey] || TILE_PROVIDERS.voyager;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTile;
    setActiveLayer(layerKey);
  }, []);

  // Centrar en toda la flota
  const handleFitAllFleet = useCallback(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;
    const bounds = layersGroupRef.current.getBounds();
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else {
      mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, []);

  // Renderizar rutas, paradas, depósitos y camiones en el mapa
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    // Limpiar capas previas
    group.clearLayers();

    const allLatLngs = [];

    routes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      const routeStyle = ROUTE_STYLES[route.status] || ROUTE_STYLES.pending;
      const stops = route.stops || [];

      // Coordenadas de la ruta
      const pathCoords = [];

      // Origen / Bodega
      if (route.origin_lat != null && route.origin_lng != null) {
        const originCoord = [Number(route.origin_lat), Number(route.origin_lng)];
        pathCoords.push(originCoord);
        allLatLngs.push(originCoord);

        // Marcador de Bodega
        const depotMarker = L.marker(originCoord, {
          icon: createDepotIcon(route.origin_label || 'Bodega'),
          title: `Origen: ${route.origin_label || 'Planta Principal'}`,
        });

        depotMarker.bindPopup(`
          <div class="p-2 text-xs font-sans">
            <p class="font-bold text-slate-900 text-sm mb-1">${route.origin_label || 'Bodega Principal'}</p>
            <p class="text-slate-600">Punto de partida de la ruta <strong>${route.route_code}</strong></p>
            <p class="text-[11px] text-slate-400 mt-1 font-mono">${originCoord[0].toFixed(4)}, ${originCoord[1].toFixed(4)}</p>
          </div>
        `);

        group.addLayer(depotMarker);
      }

      // Paradas de entrega
      stops.forEach((stop, idx) => {
        if (stop.latitude == null || stop.longitude == null) return;
        const stopCoord = [Number(stop.latitude), Number(stop.longitude)];
        pathCoords.push(stopCoord);
        allLatLngs.push(stopCoord);

        const hasIncident = route.open_incidents > 0 && incidentOrderIds.includes(stop.order_id);
        const stopMarker = L.marker(stopCoord, {
          icon: createStopIcon(idx + 1, stop.status, hasIncident),
          title: `Parada #${idx + 1}: ${stop.client_name || stop.destination}`,
        });

        stopMarker.bindPopup(`
          <div class="p-2.5 text-xs font-sans max-w-xs">
            <div class="flex items-center justify-between mb-1">
              <span class="px-2 py-0.5 rounded bg-slate-900 text-lime-400 font-mono font-bold text-[10px]">
                Parada #${idx + 1}
              </span>
              <span class="font-bold text-[10px] uppercase ${
                stop.status === 'delivered' ? 'text-emerald-600' : 'text-amber-600'
              }">
                ${stop.status === 'delivered' ? '✓ Entregado' : 'En camino'}
              </span>
            </div>
            <h4 class="font-bold text-slate-900 text-sm mt-1">${stop.client_name || 'Cliente B2B'}</h4>
            <p class="text-slate-600 text-xs mt-0.5">${stop.destination || 'Dirección de entrega'}</p>
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span class="text-slate-400 text-[11px]">Valor Pedido:</span>
              <span class="font-bold text-slate-900 font-mono">${formatCOP(stop.amount)}</span>
            </div>
          </div>
        `);

        group.addLayer(stopMarker);
      });

      // Trazado de la Línea de Ruta (Polilínea)
      if (pathCoords.length >= 2) {
        // Línea de brillo exterior si está seleccionada
        if (isSelected) {
          const glowLine = L.polyline(pathCoords, {
            color: '#CCFF00',
            weight: 9,
            opacity: 0.6,
          });
          group.addLayer(glowLine);
        }

        const routeLine = L.polyline(pathCoords, {
          color: isSelected ? '#0F2133' : routeStyle.color,
          weight: isSelected ? 6 : routeStyle.weight,
          opacity: isSelected ? 1 : routeStyle.opacity,
          dashArray: routeStyle.dashArray,
        });

        routeLine.on('click', () => {
          onSelectRoute(route.id);
        });

        group.addLayer(routeLine);
      }

      // Marcador del Conductor / Camión con GPS
      const truckCoord = route.driver_gps
        ? [Number(route.driver_gps.latitude), Number(route.driver_gps.longitude)]
        : pathCoords.length > 0
          ? pathCoords[0]
          : null;

      if (truckCoord && !isNaN(truckCoord[0]) && !isNaN(truckCoord[1])) {
        allLatLngs.push(truckCoord);

        const truckMarker = L.marker(truckCoord, {
          icon: createTruckIcon(route, isSelected),
          zIndexOffset: isSelected ? 1000 : 500,
        });

        // Al hacer clic en el camión, abrimos el panel de Cargas y Telemetría
        truckMarker.on('click', () => {
          onSelectRoute(route.id);
          setSelectedTruckModal(route);
        });

        group.addLayer(truckMarker);
      }
    });

    // Auto-ajustar zoom según selección o flota completa
    if (selectedRouteId) {
      const activeRoute = routes.find((r) => r.id === selectedRouteId);
      if (activeRoute) {
        const routePoints = [];
        if (activeRoute.origin_lat != null) routePoints.push([Number(activeRoute.origin_lat), Number(activeRoute.origin_lng)]);
        (activeRoute.stops || []).forEach((s) => routePoints.push([Number(s.latitude), Number(s.longitude)]));
        if (activeRoute.driver_gps) routePoints.push([Number(activeRoute.driver_gps.latitude), Number(activeRoute.driver_gps.longitude)]);

        if (routePoints.length > 0) {
          const b = L.latLngBounds(routePoints);
          map.fitBounds(b, { padding: [60, 60], maxZoom: 13, animate: true });
        }
      }
    } else if (allLatLngs.length > 0) {
      const b = L.latLngBounds(allLatLngs);
      map.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
    }
  }, [routes, selectedRouteId, onSelectRoute, incidentOrderIds]);

  // Total de carga a bordo de la ruta seleccionada para el popup
  const selectedRouteCargoTotal = useMemo(() => {
    if (!selectedTruckModal?.stops) return 0;
    return selectedTruckModal.stops.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  }, [selectedTruckModal]);

  return (
    <div className="relative w-full h-[360px] md:h-[480px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group">
      {/* Contenedor del mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Barra de Controles Flotante Superior */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
        {/* Badge de estado del mapa y motor OpenStreetMap */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping shrink-0" />
          <span className="text-xs font-bold tracking-tight">OpenStreetMap & Leaflet · Monitoreo en Vivo</span>
          <span className="hidden sm:inline text-[10px] bg-lime-400 text-slate-900 font-extrabold px-1.5 py-0.2 rounded uppercase">
            100% Funcional
          </span>
        </div>

        {/* Acciones del mapa: Capas y Centrar Flota */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-lg">
          <button
            type="button"
            onClick={handleFitAllFleet}
            title="Centrar toda la flota y rutas"
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors flex items-center gap-1"
          >
            <i className="bi bi-arrows-fullscreen text-sm" aria-hidden="true" />
            <span className="hidden md:inline">Centrar Flota</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {/* Selector de capa base */}
          <select
            value={activeLayer}
            onChange={(e) => handleSwitchLayer(e.target.value)}
            className="text-xs font-semibold bg-transparent text-slate-800 pr-2 py-1 outline-none cursor-pointer"
            title="Cambiar estilo de mapa"
          >
            <option value="voyager">Calles Limpio</option>
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satelital</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL / DRAWER INTERACTIVO: CARGA A BORDO Y CONDUCTOR ("Cargas que llevan") */}
      {/* ========================================================================= */}
      {selectedTruckModal && (
        <div className="absolute inset-x-3 bottom-3 z-[500] max-w-lg mx-auto bg-white/95 backdrop-blur-lg rounded-2xl border border-slate-200 p-4 shadow-2xl animate-slide-up">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-400 text-slate-900 flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
                <i className="bi bi-truck" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {selectedTruckModal.driver?.name || 'Conductor no asignado'}
                  </h3>
                  <span className="text-[10px] font-mono bg-slate-900 text-lime-400 px-1.5 py-0.5 rounded font-bold">
                    {selectedTruckModal.route_code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedTruckModal.driver?.vehicle || 'Vehículo de carga'} · Tel: {selectedTruckModal.driver?.phone || 'Sin teléfono'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedTruckModal(null)}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition-colors"
              title="Cerrar detalle"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>

          {/* Telemetría GPS en Vivo */}
          <div className="grid grid-cols-3 gap-2 my-2.5">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Velocidad</span>
              <p className="text-xs font-mono font-bold text-slate-900">
                {selectedTruckModal.driver_gps?.speed_kmh ? `${Math.round(selectedTruckModal.driver_gps.speed_kmh)} km/h` : 'Estacionado'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Señal GPS</span>
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {selectedTruckModal.driver_gps?.signal === 'live' ? 'En Vivo' : 'Estimada'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Carga Total</span>
              <p className="text-xs font-mono font-bold text-emerald-800">
                {formatCOP(selectedRouteCargoTotal)}
              </p>
            </div>
          </div>

          {/* Desglose de Cargas / Pedidos Transportados */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Mercancía & Pedidos a Bordo ({selectedTruckModal.stops?.length || 0} paradas)
              </span>
              <span className="text-[10px] text-slate-500">
                {selectedTruckModal.delivered_count || 0} / {selectedTruckModal.stops_count || 0} entregados
              </span>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {(selectedTruckModal.stops || []).map((stop, i) => (
                <div
                  key={stop.order_id || i}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-lime-50/50 border border-slate-100 text-xs transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-900 truncate">
                      #{i + 1} {stop.client_name || 'Cliente B2B'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{stop.destination}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-slate-900 text-xs">{formatCOP(stop.amount)}</p>
                    <span className={`text-[9px] font-bold uppercase ${
                      stop.status === 'delivered' ? 'text-emerald-700' : 'text-amber-600'
                    }`}>
                      {stop.status === 'delivered' ? '✓ Entregado' : 'En tránsito'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
