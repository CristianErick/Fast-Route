import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function DriverPage() {
  const [tracking, setTracking] = useState(false);
  const [busId, setBusId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Listo para iniciar');
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  
  // Refs para guardar el estado sin causar re-renderizados locos
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const currentPos = useRef<{ lat: number; lon: number } | null>(null);
  
  const router = useRouter();

  // 1. Verificar sesión y obtener Bus ID
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('bus_id, role')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.role !== 'driver') {
        alert("Acceso denegado: No eres conductor.");
        router.push('/');
        return;
      }

      if (profile?.bus_id) {
        setBusId(profile.bus_id);
      } else {
        setStatusMsg("Error: No tienes un Bus asignado.");
      }
    };

    checkSession();

    // Limpieza al salir de la página
    return () => stopTracking();
  }, [router]);

  // 2. Función que envía la ÚLTIMA posición conocida (El Latido)
  const transmitPosition = async () => {
    // Si no tenemos posición o no hay bus, no enviamos nada
    if (!currentPos.current || !busId) return;

    const { lat, lon } = currentPos.current;

    const { error } = await supabase.from('positions').insert({
      bus_id: busId,
      lat,
      lon,
    });

    const time = new Date().toLocaleTimeString();
    if (error) {
      console.error("Error envío:", error);
      setStatusMsg(`Error de red (${time})`);
    } else {
      setLastUpdate(time);
      setStatusMsg('📡 Enviando señal constante...');
    }
  };

  // 3. Iniciar el rastreo (GPS + Intervalo)
  const startTracking = () => {
    if (!busId) {
      alert("No tienes bus asignado.");
      return;
    }
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta GPS");
      return;
    }

    setTracking(true);
    setStatusMsg("Iniciando sistemas...");

    // A) Encendemos el GPS (Solo escucha y actualiza la variable, NO envía)
    const id = navigator.geolocation.watchPosition(
      (position) => {
        // Guardamos la coordenada fresca en la referencia
        currentPos.current = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
      },
      (error) => {
        console.error(error);
        setStatusMsg(`Error GPS: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
    watchId.current = id;

    // B) Encendemos el Cronómetro de Transmisión (Cada 5 segundos)
    // Esto asegura que SIEMPRE se envíe señal, aunque el bus esté quieto.
    intervalId.current = setInterval(transmitPosition, 5000); 
  };

  // 4. Detener todo
  const stopTracking = () => {
    // Apagar GPS
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    // Apagar Intervalo de envío
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    
    setTracking(false);
    setStatusMsg("Ruta detenida");
    currentPos.current = null; // Limpiamos posición
  };

  const handleLogout = async () => {
    stopTracking();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="z-10 w-full max-w-md space-y-8 text-center">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Conductor</h1>
          <p className="text-slate-400 mt-2">Transmisión Constante Activa</p>
        </div>

        <div className={`relative p-8 rounded-2xl border transition-all duration-500 ${
          tracking 
            ? 'bg-emerald-900/30 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
            : 'bg-slate-800/50 border-slate-700 shadow-xl'
        }`}>
          {tracking && (
            <span className="absolute top-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Estado del Servicio
            </h2>
            
            <div className={`text-2xl font-bold flex items-center justify-center gap-2 ${
              tracking ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {tracking ? (
                <>
                  <span className="text-3xl">📡</span> EN RUTA
                </>
              ) : (
                <>
                  <span className="text-3xl"></span> DETENIDO
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1">{statusMsg}</p>
              <p className="font-mono text-xl">Último envío: {lastUpdate}</p>
            </div>
          </div>
        </div>

        <button
          onClick={tracking ? stopTracking : startTracking}
          className={`w-full py-6 rounded-xl font-bold text-lg shadow-lg transform transition active:scale-95 ${
            tracking
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
          }`}
        >
          {tracking ? 'DETENER RUTA' : 'INICIAR RUTA'}
        </button>

        <div className="text-xs text-slate-500 font-mono break-all px-4">
          BUS ID: {busId || 'Cargando...'}
        </div>

        <button 
          onClick={handleLogout}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}