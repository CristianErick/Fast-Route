import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. Verificar si soy Admin al entrar
  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      // Verificamos el rol directamente
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (myProfile?.role !== 'admin') {
        alert("Acceso denegado. No eres Administrador.");
        router.push('/');
      } else {
        fetchData();
      }
    }
    checkAdmin();
  }, [router]);

  // 2. Cargar datos (USANDO EL "TÚNEL" RPC)
  async function fetchData() {
    setLoading(true);
    
    // AQUI ESTA LA MAGIA: Usamos la función RPC que creamos en Supabase
    // Esto nos trae el email (de auth) y el rol (de profiles) juntos
    const { data: usersData, error } = await supabase.rpc('get_all_users');

    // Cargamos los buses para el selector
    const { data: busesData } = await supabase.from('buses').select('*');
    
    if (error) {
      console.error("Error cargando usuarios:", error);
      // No alertamos si es un error menor, solo log
    }
    
    // Si la RPC devuelve datos, los usamos
    if (usersData) {
        // Ordenamos por email localmente por si acaso
        const sorted = (usersData as any[]).sort((a, b) => a.email.localeCompare(b.email));
        setUsers(sorted);
    }
    
    if (busesData) setBuses(busesData);
    
    setLoading(false);
  }

  // 3. Actualizar Rol o Bus
  async function updateUser(userId: string, field: 'role' | 'bus_id', value: any) {
    // Si el valor es "", lo convertimos a null para la base de datos
    const finalValue = value === "" ? null : value;

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: finalValue })
      .eq('user_id', userId);

    if (error) {
      alert("Error actualizando: " + error.message);
    } else {
      // Actualización optimista en la UI para que se sienta rápido
      setUsers(users.map(u => u.user_id === userId ? { ...u, [field]: finalValue } : u));
    }
  }

  // 4. Cerrar Sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 text-sm animate-pulse">Cargando sistema...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 relative overflow-hidden font-sans">
      
      {/* Luces de fondo (Efecto Neón) - Con pointer-events-none para no bloquear clicks */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 border-b border-slate-800 pb-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Panel de Control
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Administración centralizada de usuarios y flota</p>
          </div>
          
          <div className="flex gap-3">
             <button 
              onClick={() => fetchData()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm transition-all flex items-center gap-2"
            >
              🔄 Recargar
            </button>
            <button 
              onClick={handleLogout}
              className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors shadow-lg font-medium"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Tabla Estilizada */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden ring-1 ring-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                  <th className="p-6 font-bold">Usuario / Credenciales</th>
                  <th className="p-6 font-bold">Rol del Sistema</th>
                  <th className="p-6 font-bold">Asignación de Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-700/30 transition-colors group">
                    
                    {/* Columna Email */}
                    <td className="p-6">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-4 text-sm font-bold shadow-lg ${
                            user.role === 'admin' ? 'bg-purple-500 text-white' :
                            user.role === 'driver' ? 'bg-emerald-500 text-white' :
                            'bg-slate-700 text-slate-300'
                        }`}>
                          {user.email ? user.email.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                            <span className="block font-medium text-slate-200">{user.email || 'Sin Correo'}</span>
                            <span className="text-xs text-slate-500 font-mono">{user.user_id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>

                    {/* Columna Rol */}
                    <td className="p-6">
                      <div className="relative">
                        <select 
                            value={user.role || 'user'}
                            onChange={(e) => updateUser(user.user_id, 'role', e.target.value)}
                            className={`appearance-none w-40 text-sm rounded-lg pl-3 pr-8 py-2 border-0 ring-1 ring-inset font-semibold outline-none transition-all cursor-pointer shadow-sm ${
                            user.role === 'admin' 
                                ? 'bg-purple-500/10 text-purple-400 ring-purple-500/20 focus:ring-purple-500' 
                                : user.role === 'driver' 
                                ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 focus:ring-emerald-500' 
                                : 'bg-slate-700/50 text-slate-400 ring-slate-600 focus:ring-blue-500'
                            }`}
                        >
                            <option value="user" className="bg-slate-800">👤 Estudiante</option>
                            <option value="driver" className="bg-slate-800">🚌 Conductor</option>
                            <option value="admin" className="bg-slate-800">🛡️ Admin</option>
                        </select>
                        {/* Icono de flecha custom para mejor UI */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      </div>
                    </td>

                    {/* Columna Bus */}
                    <td className="p-6">
                      {user.role === 'driver' ? (
                        <select
                          value={user.bus_id || ''}
                          onChange={(e) => updateUser(user.user_id, 'bus_id', e.target.value)}
                          className="w-full max-w-[220px] bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors hover:border-slate-500"
                        >
                          <option value="">-- Sin Asignar --</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>
                                {b.label || `Bus ${b.id.slice(0,4)}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-500">
                          No aplica
                        </span>
                      )}
                    </td>

                  </tr>
                ))}
                
                {users.length === 0 && (
                    <tr>
                        <td colSpan={3} className="p-12 text-center text-slate-500">
                            No se encontraron usuarios o la base de datos está vacía.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-6 text-center">
            <span className="inline-block px-4 py-1 rounded-full bg-slate-800 text-xs text-slate-500 border border-slate-700">
                Total Registros: {users.length}
            </span>
        </div>

      </div>
    </div>
  );
}