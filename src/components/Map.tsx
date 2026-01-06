"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { QuadTree, Rectangle } from "@/utils/QuadTree";
import { RouteGraph } from "@/utils/Graph";

// --- CONFIGURACIÓN DE ICONOS ---
const createIcon = (url: string, size: [number, number]) => L.icon({
  iconUrl: url,
  iconSize: size,
  iconAnchor: [size[0] / 2, size[1]], 
  popupAnchor: [0, -size[1]],
});

const icons = {
  user: createIcon("/ubicacion.png", [40, 40]),
  stop: createIcon("/stop.png", [32, 32]),      // Paradero normal
  nearest: createIcon("/stop.png", [50, 50]),   // Resaltado (más grande)
  bus: createIcon("/bus.png", [45, 45]),        // Bus
};

interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seq: number;
  active: boolean;
}

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const walkingRouteRef = useRef<L.Polyline | null>(null);
  const connectionLineRef = useRef<L.Polyline | null>(null);

  // --- REFERENCIAS PARA EVITAR DUPLICADOS ---
  const busMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  const stopMarkersRef = useRef<{ [key: string]: L.Marker }>({}); 
  const lastHighlightedStopId = useRef<string | null>(null);

  const hasCenteredRef = useRef(false);
  const timeoutRef = useRef<any>(null);
  const lastPositionRef = useRef<{lat: number, lon: number} | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now()); 

  const [firstPoint, setFirstPoint] = useState<{ lat: number; lon: number } | null>(null);
  const stopsRef = useRef<Stop[]>([]);
  const quadTreeRef = useRef<QuadTree | null>(null);
  const routeGraphRef = useRef<RouteGraph | null>(null);
  
  // Estados UI
  const [graphInfo, setGraphInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'waiting' | 'active' | 'offline'>('offline');
  const [lastUpdateInfo, setLastUpdateInfo] = useState<string>("Esperando señal...");
  
  // --- ESTADO BUSCADOR (COLLAPSIBLE) ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // <--- NUEVO: Para abrir/cerrar en móvil

  // --- 1. CARGA DE DATOS ---
  async function loadStops(map: L.Map) {
    const { data, error } = await supabase
      .from("stops")
      .select("*")
      .eq("active", true)
      .order("seq", { ascending: true });

    if (error || !data) return;
    const stopsData = data as Stop[];
    stopsRef.current = stopsData;

    const boundary = new Rectangle(-15.84, -70.02, 0.05, 0.05); 
    const qt = new QuadTree(boundary, 4); 
    const graph = new RouteGraph();

    stopsData.forEach((stop, index) => {
      // 1. Crear marcador
      const marker = L.marker([stop.lat, stop.lon], { icon: icons.stop })
        .addTo(map)
        .bindPopup(`<b>${stop.name}</b><br>Paradero #${stop.seq}`);
      
      // 2. Guardar referencia
      stopMarkersRef.current[stop.id] = marker; 

      // 3. Estructuras de datos
      qt.insert({ x: stop.lat, y: stop.lon, data: stop });
      if (index < stopsData.length - 1) {
        const nextStop = stopsData[index + 1];
        const dist = distanceMeters(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        graph.addConnection(stop.id, nextStop.id, dist);
      }
    });

    quadTreeRef.current = qt;
    routeGraphRef.current = graph;
  }

  // --- 2. RUTA ---
  async function loadRoute(map: L.Map) {
    let { data } = await supabase.from("routes").select("geojson").eq("name", "Ruta Principal Universitaria").limit(1);
    
    // Fallback si no encuentra por nombre exacto
    if (!data || data.length === 0) {
        const result = await supabase.from("routes").select("geojson").limit(1);
        data = result.data;
    }

    if (data && data[0]?.geojson) {
      try {
        L.geoJSON(data[0].geojson as any, { style: { weight: 5, opacity: 0.6, color: "#3b82f6" } }).addTo(map);
      } catch (err) { console.error(err); }
    }
  }

  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function getNearestStop(lat: number, lon: number) {
    if (!quadTreeRef.current) return null;
    const range = new Rectangle(lat, lon, 0.01, 0.01);
    let candidates = quadTreeRef.current.query(range); 
    if (candidates.length === 0) candidates = stopsRef.current.map(s => ({ x: s.lat, y: s.lon, data: s }));

    let minDist = Infinity;
    let nearest: { stop: Stop; distance: number } | null = null;
    candidates.forEach((p) => {
      const stop = p.data as Stop;
      const d = distanceMeters(lat, lon, stop.lat, stop.lon);
      if (d < minDist) { minDist = d; nearest = { stop, distance: d }; }
    });
    return nearest;
  }

  // --- 3. INTERACCIÓN VISUAL (SIN DUPLICADOS) ---
  async function highlightNearest(map: L.Map, userLat: number, userLon: number, fromSearch = false) {
    const nearest: any = getNearestStop(userLat, userLon);
    if (!nearest) { setGraphInfo("Sin paraderos cercanos."); return; }
    const { stop } = nearest;

    // Restaurar anterior
    if (lastHighlightedStopId.current && stopMarkersRef.current[lastHighlightedStopId.current]) {
        const prevMarker = stopMarkersRef.current[lastHighlightedStopId.current];
        prevMarker.setIcon(icons.stop); 
        prevMarker.setZIndexOffset(0);  
    }

    // Resaltar nuevo
    if (stopMarkersRef.current[stop.id]) {
        const currentMarker = stopMarkersRef.current[stop.id];
        currentMarker.setIcon(icons.nearest); 
        currentMarker.setZIndexOffset(1000);  
        
        const popupContent = fromSearch 
             ? `<b>🎯 Resultado:</b><br>${stop.name}`
             : `<b>📍 Más cercano:</b><br>${stop.name}<br>Distancia: ${Math.round(nearest.distance)}m`;
        
        currentMarker.bindPopup(popupContent).openPopup();
        lastHighlightedStopId.current = stop.id; 
    }

    // Grafo
    if (routeGraphRef.current && stopsRef.current.length > 0) {
      const currentIndex = stopsRef.current.findIndex(s => s.id === stop.id);
      let mensajeGrafo = "";
      if (currentIndex < stopsRef.current.length - 1) {
        const nextStop = stopsRef.current[currentIndex + 1];
        const pathData = routeGraphRef.current.findShortestPath(stop.id, nextStop.id);
        mensajeGrafo = `Grafo: Siguiente "${nextStop.name}" a ${Math.round(pathData.distance)}m.`;
        if(connectionLineRef.current) connectionLineRef.current.remove();
        connectionLineRef.current = L.polyline([[stop.lat, stop.lon], [nextStop.lat, nextStop.lon]], {
            color: '#8b5cf6', weight: 3, dashArray: '5, 10'
        }).addTo(map);
      } else {
        mensajeGrafo = `Fin de ruta: "${stop.name}".`;
        if(connectionLineRef.current) connectionLineRef.current.remove();
      }
      setGraphInfo(mensajeGrafo);
    }

    // Línea usuario -> paradero
    if (walkingRouteRef.current) walkingRouteRef.current.remove();
    if (fromSearch) {
        map.flyTo([stop.lat, stop.lon], 17, { duration: 1.5 });
    } else {
        walkingRouteRef.current = L.polyline([[userLat, userLon], [stop.lat, stop.lon]], {
            weight: 4, dashArray: "10 10", color: "#ea580c"
        }).addTo(map);
        map.fitBounds(walkingRouteRef.current.getBounds(), { padding: [100, 100] });
    }
  }

  // --- 4. BUSCADOR ---
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.length > 0) {
      setIsSearching(true);
      const results = stopsRef.current.filter(s => s.name.toLowerCase().includes(term.toLowerCase()));
      setFilteredStops(results);
    } else {
      setIsSearching(false);
    }
  };

  const selectStop = (stop: Stop) => {
    setSearchTerm(stop.name);
    setIsSearching(false);
    setIsSearchExpanded(false); // Cerrar al seleccionar en móvil
    if(mapRef.current) highlightNearest(mapRef.current, stop.lat, stop.lon, true);
  };

  // --- 5. TRACKING ---
  function updateBusMarker(payload: any) {
    if (!mapRef.current) return;
    const { bus_id, lat, lon } = payload;
    setLastUpdateInfo(new Date().toLocaleTimeString());
    const now = Date.now();
    const lastLat = lastPositionRef.current?.lat || 0;
    const lastLon = lastPositionRef.current?.lon || 0;
    
    if (lat !== lastLat || lon !== lastLon) {
      lastPositionRef.current = { lat, lon };
      lastMoveTimeRef.current = now; 
      setServiceStatus('active');
      if (!hasCenteredRef.current) {
        mapRef.current.flyTo([lat, lon], 16, { duration: 1.5 });
        hasCenteredRef.current = true;
      }
    } else {
      if (now - lastMoveTimeRef.current > 60000) setServiceStatus('waiting'); 
      else setServiceStatus('active'); 
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setServiceStatus('offline'), 65000); 

    if (busMarkersRef.current[bus_id]) {
      busMarkersRef.current[bus_id].setLatLng([lat, lon]);
    } else {
      busMarkersRef.current[bus_id] = L.marker([lat, lon], { icon: icons.bus }).addTo(mapRef.current).bindPopup(`Bus`);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return; 
    if (mapRef.current) return;

    const map = L.map("map", { center: [-15.84, -70.0219], zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);

    loadStops(map);
    loadRoute(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setFirstPoint({ lat, lon: lng });
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.marker([lat, lng], { icon: icons.user }).addTo(map);
      highlightNearest(map, lat, lng);
    });

    const channel = supabase
      .channel("positions-tracker")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "positions" }, (payload) => updateBusMarker(payload.new))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  let statusColor = serviceStatus === 'active' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    serviceStatus === 'waiting' ? "bg-orange-100 text-orange-700 border-orange-200" :
                    "bg-red-100 text-red-700 border-red-200";

  return (
    <div className="relative w-full h-full font-sans">
      <div id="map" className="w-full h-full z-0 bg-zinc-100" />

      {/* --- BOTÓN PERFIL (Arriba Derecha) --- */}
      <div className="absolute top-4 right-4 z-[1000]">
        <a href="/profile" className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-lg text-slate-600 hover:text-blue-600 hover:scale-110 transition-all cursor-pointer">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </a>
      </div>

      {/* --- BUSCADOR EXPANDIBLE (Arriba Centro) --- */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] transition-all duration-300 w-auto">
        
        {/* ESTADO 1: CERRADO (Solo Lupa) */}
        {!isSearchExpanded ? (
          <button 
            onClick={() => setIsSearchExpanded(true)}
            className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-slate-600 hover:text-blue-600 hover:scale-110 transition-all"
            title="Buscar Paradero"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </button>
        ) : (
          /* ESTADO 2: ABIERTO (Input Completo) */
          <div className="relative w-[85vw] max-w-md animate-in fade-in zoom-in-95 duration-200">
             <div className="relative shadow-xl">
                <input 
                    autoFocus
                    type="text" 
                    placeholder="Buscar paradero..." 
                    className="w-full p-4 pl-12 pr-12 rounded-full border-none outline-none shadow-lg text-slate-700 font-medium bg-white/95 backdrop-blur focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {/* Icono Lupa (Decorativo) */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                {/* Botón Cerrar (X) */}
                <button 
                    onClick={() => { setIsSearchExpanded(false); setSearchTerm(""); setIsSearching(false); }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                {/* Resultados */}
                {isSearching && filteredStops.length > 0 && (
                    <div className="absolute top-16 left-0 w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 max-h-60 overflow-y-auto">
                        {filteredStops.map(stop => (
                            <div key={stop.id} onClick={() => selectStop(stop)} className="p-3 px-5 hover:bg-blue-50 cursor-pointer border-b border-slate-50 flex justify-between items-center">
                                <span className="text-slate-700 font-medium">{stop.name}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">#{stop.seq}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* --- TARJETA DE ESTADO (Izquierda Abajo) --- */}
      <div className="absolute bottom-8 left-4 z-[400] max-w-[280px]">
        <div className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 border border-zinc-200 transition-all duration-300">
          <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-slate-800 text-sm">Estado del Servicio</h3>
             <button onClick={() => setShowDebug(!showDebug)} className="text-slate-400 hover:text-blue-500 transition">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             </button>
          </div>
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border mb-3 ${statusColor}`}>
            <span className="relative flex h-2.5 w-2.5">
              {serviceStatus === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${serviceStatus === 'active' ? 'bg-emerald-500' : serviceStatus === 'waiting' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
            </span>
            {serviceStatus === 'active' ? "EN RUTA" : serviceStatus === 'waiting' ? "ESPERANDO" : "FUERA DE SERVICIO"}
          </div>
          <p className="text-[10px] text-slate-500 font-mono text-center">Última señal: {lastUpdateInfo}</p>
          {showDebug && (
            <div className="mt-3 pt-3 border-t border-zinc-100 animate-in fade-in">
              <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Algoritmos en uso:</p>
              <div className="bg-blue-50/50 p-2 rounded border border-blue-100/50">
                <p className="text-[10px] text-slate-600 leading-snug">{graphInfo || "Usa el buscador para ver el Grafo."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}