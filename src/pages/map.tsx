import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle"; 

// Cargar Leaflet sin SSR
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
      <div className="animate-pulse flex flex-col items-center">
        <p>Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const goHome = () => {
    router.push("/");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-slate-900 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="flex-none h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={goHome}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            F
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
            FAST ROUTE <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-1 border border-slate-200">Puno</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all active:scale-95"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ÁREA DEL MAPA (Limpia, el cuadro flotante ya está dentro de <Map />) */}
      <main className="flex-1 relative w-full h-full bg-zinc-100 overflow-hidden">
        <Map />
      </main>
    </div>
  );
}