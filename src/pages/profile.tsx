import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function UserProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const getProfile = async () => {
      // 1. Obtener usuario logueado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      // 2. Obtener su rol desde la tabla profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (profile) setRole(profile.role);
      setLoading(false);
    };

    getProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6 relative overflow-hidden font-sans">
      
      {/* Fondo decorativo */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-2000"></div>

      {/* Navbar Simple */}
      <div className="w-full max-w-md flex justify-between items-center mb-10 z-10">
        <Link href="/map" className="flex items-center text-slate-400 hover:text-white transition">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          Volver al Mapa
        </Link>
        <h1 className="font-bold tracking-wider text-sm uppercase text-slate-500">Mi Cuenta</h1>
      </div>

      {/* Tarjeta de Perfil */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10 flex flex-col items-center text-center">
        
        {/* Avatar */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
               <span className="text-4xl">🎓</span>
            </div>
          </div>
          <div className="absolute bottom-0 right-0 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-800" title="Online"></div>
        </div>

        {/* Datos */}
        <h2 className="text-2xl font-bold text-white mb-1">
          {user?.email?.split('@')[0] || 'Estudiante'}
        </h2>
        <p className="text-blue-400 text-sm font-medium mb-6 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
          {user?.email}
        </p>

        {/* Detalles */}
        <div className="w-full bg-slate-900/50 rounded-xl p-4 mb-8 border border-slate-700/50 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-400 text-sm">Rol del Sistema</span>
            <span className="text-slate-200 text-sm font-semibold capitalize">{role || 'Usuario'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 text-sm">ID de Usuario</span>
            <span className="text-slate-500 text-xs font-mono truncate max-w-[120px]">{user?.id}</span>
          </div>
           <div className="flex justify-between">
            <span className="text-slate-400 text-sm">Estado</span>
            <span className="text-emerald-400 text-sm">Activo</span>
          </div>
        </div>

        {/* Acciones */}
        <button 
          onClick={handleLogout}
          className="w-full py-3.5 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all shadow-lg"
        >
          Cerrar Sesión
        </button>

      </div>
      
      <p className="mt-8 text-slate-500 text-xs text-center max-w-xs leading-relaxed z-10">
        Si necesitas cambiar tu contraseña o reportar un problema, contacta con la administración de la UNA Puno.
      </p>

    </div>
  );
}