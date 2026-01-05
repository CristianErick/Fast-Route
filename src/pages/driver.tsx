import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';
import { RouteGraph } from '@/utils/Graph';

export default function DriverPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [busId, setBusId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Listo para iniciar');
  const [lastUpdate, setLastUpdate] = useState('--:--:--');
  const [graphReady, setGraphReady] = useState(false);

  const routeGraph = useRef<RouteGraph>(new RouteGraph());
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const currentPos = useRef<{ lat: number; lon: number } | null>(null);

  /* ======================
     UTILIDAD: DISTANCIA
     ====================== */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ======================
     GRAFO (Dijkstra)
     ====================== */
  const buildRouteGraph = async () => {
    const { data: stops, error } = await supabase
      .from('stops')
      .select('*')
      .eq('active', true)
      .order('seq', { ascending: true });

    if (error || !stops || stops.length === 0) return;

    stops.forEach(s => routeGraph.current.addStop(s.id));

    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const dist = calculateDistance(a.lat, a.lon, b.lat, b.lon);
      routeGraph.current.addConnection(a.id, b.id, dist);
    }

    setGraphReady(true);
  };

  /* ======================
     INIT + SEGURIDAD
     ====================== */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, bus_id')
        .eq('user_id', session.user.id)
        .single();

      if (error || profile?.role !== 'driver') {
        alert('Acceso solo para conductores');
        router.replace('/');
        return;
      }

      if (!profile.bus_id) {
        alert('No tienes un bus asignado');
        router.replace('/');
        return;
      }

      setBusId(profile.bus_id);
      await buildRouteGraph();
      setLoading(false);
    };

    init();
    return () => stopTracking();
  }, []);

  /* ======================
     TRACKING
     ====================== */
  const transmitPosition = async () => {
    if (!currentPos.current || !busId) return;

    const { lat, lon } = currentPos.current;

    const { error } = await supabase
      .from('positions')
      .insert({ bus_id: busId, lat, lon });

    if (!error) {
      setLastUpdate(new Date().toLocaleTimeString());
      setStatusMsg('📡 Enviando señal...');
    }
  };

  const startTracking = () => {
    if (!busId || !navigator.geolocation) return;

    setTracking(true);
    setStatusMsg('Iniciando GPS...');

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        currentPos.current = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
      },
      err => console.error(err),
      { enableHighAccuracy: true }
    );

    intervalId.current = setInterval(transmitPosition, 5000);
  };

  const stopTracking = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if (intervalId.current) clearInterval(intervalId.current);
    setTracking(false);
    setStatusMsg('Detenido');
  };

  const handleLogout = async () => {
    stopTracking();
    await supabase.auth.signOut();
    router.push('/login');
  };

  /* ======================
     LOADING
     ====================== */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin h-12 w-12 rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  /* ======================
     UI
     ====================== */
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        <h1 className="text-3xl font-bold">Panel de Conductor</h1>

        {graphReady && (
          <div className="text-xs bg-blue-900/40 border border-blue-500/30 rounded px-3 py-1 font-mono">
            Grafo activo (Dijkstra)
          </div>
        )}

        <div className={`p-6 rounded-2xl border ${
          tracking ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-800 border-slate-700'
        }`}>
          <h2 className="text-xl font-bold">
            {tracking ? '📡 EN RUTA' : '💤 DETENIDO'}
          </h2>
          <p className="text-slate-400 mt-1">{statusMsg}</p>
          <p className="font-mono text-lg mt-1">{lastUpdate}</p>
        </div>

        <button
          onClick={tracking ? stopTracking : startTracking}
          className={`w-full py-3 rounded-xl font-bold ${
            tracking ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {tracking ? 'DETENER' : 'INICIAR'}
        </button>

        <button
          onClick={handleLogout}
          className="text-slate-400 text-sm"
        >
          Salir
        </button>

      </div>
    </div>
  );
}
