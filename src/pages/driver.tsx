import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import { RouteGraph } from '../utils/Graph'; 

export default function DriverPage() {
  const router = useRouter();
  
  // Estados
  const [tracking, setTracking] = useState(false);
  const [busId, setBusId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Listo para iniciar');
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  const [graphReady, setGraphReady] = useState(false);

  // Referencias (Lógica de fondo)
  const routeGraph = useRef<RouteGraph>(new RouteGraph());
  const wakeLock = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const currentPos = useRef<{ lat: number; lon: number } | null>(null);

  // Algoritmo: Distancia Haversine
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Wake Lock (Mantener pantalla encendida)
  const toggleWakeLock = async (active: boolean) => {
    try {
      if (active && 'wakeLock' in navigator) {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
      } else if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
      }
    } catch (err) { console.error(err); }
  };

  // Construcción del Grafo (Dijkstra Pre-calentamiento)
  const buildRouteGraph = async () => {
    try {
      const { data: stops } = await supabase
        .from('stops')
        .select('*')
        .eq('active', true)
        .order('seq', { ascending: true });

      if (!stops || stops.length === 0) return;

      stops.forEach(stop => routeGraph.current.addStop(stop.id));

      for (let i = 0; i < stops.length - 1; i++) {
        const current = stops[i];
        const next = stops[i + 1];
        const dist = calculateDistance(current.lat, current.lon, next.lat, next.lon);
        routeGraph.current.addConnection(current.id, next.id, dist);
      }

      setGraphReady(true);
      
      // Test de integridad del Grafo
      if(stops.length > 1) {
          const result = routeGraph.current.findShortestPath(stops[0].id, stops[stops.length - 1].id);
          console.log("Grafo verificado (Dijkstra):", result);
      }
    } catch (err) { console.error("Error grafo:", err); }
  };

  // Inicialización y Auth
  useEffect(() => {
    const initSystem = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('bus_id, role')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.role !== 'driver') {
        alert("Acceso denegado");
        return router.push('/');
      }

      if (profile?.bus_id) setBusId(profile.bus_id);
      await buildRouteGraph();
    };

    initSystem();
    return () => stopTracking();
  }, [router]);

  // Efecto: Activar pantalla al iniciar rastreo
  useEffect(() => {
    toggleWakeLock(tracking);
    return () => { toggleWakeLock(false); };
  }, [tracking]);

  // Transmisión de datos
  const transmitPosition = async () => {
    if (!currentPos.current || !busId) return;
    const { lat, lon } = currentPos.current;
    
    const { error } = await supabase.from('positions').insert({ bus_id: busId, lat, lon });
    if (!error) {
        setLastUpdate(new Date().toLocaleTimeString());
        setStatusMsg('📡 Enviando señal constante...');
    }
  };

  // Controles de Rastreo
  const startTracking = () => {
    if (!busId || !navigator.geolocation) return;
    setTracking(true);
    setStatusMsg("Iniciando...");
    
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => { currentPos.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    
    intervalId.current = setInterval(transmitPosition, 5000); 
  };

  const stopTracking = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if (intervalId.current) clearInterval(intervalId.current);
    setTracking(false);
    setStatusMsg("Detenido");
  };

  const handleLogout = async () => {
    stopTracking();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      
      {/* Fondo Decorativo */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-blob pointer-events-none"></div>

      <div className="z-10 w-full max-w-md space-y-8 text-center relative">
        <h1 className="text-3xl font-bold">Panel de Conductor</h1>
        
        {graphReady && (
            <div className="bg-blue-900/50 text-blue-200 text-xs py-1 px-2 rounded border border-blue-500/30 font-mono inline-block">
                Estructura de Datos: Grafo (Dijkstra) Activo
            </div>
        )}

        <div className={`p-8 rounded-2xl border transition-all duration-500 ${tracking ? 'bg-emerald-900/30 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-slate-700'}`}>
             <h2 className="text-2xl font-bold">{tracking ? 'EN RUTA' : 'DETENIDO'}</h2>
             <p className="mt-2 text-sm text-slate-400">{statusMsg}</p>
             <p className="font-mono text-xl mt-1 text-emerald-400">{lastUpdate}</p>
        </div>

        <button 
            onClick={tracking ? stopTracking : startTracking} 
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 ${tracking ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
            {tracking ? 'DETENER TRANSMISIÓN' : 'INICIAR RUTA'}
        </button>
        
        <button onClick={handleLogout} className="text-slate-400 text-sm hover:text-white transition-colors">Cerrar Sesión</button>
      </div>
    </div>
  );
}