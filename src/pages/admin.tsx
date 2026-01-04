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
  }, []);

  // 2. Cargar datos
  async function fetchData() {
    setLoading(true);
    
    // Llamamos a la función RPC
    const { data: usersData, error } = await supabase.rpc('get_all_users');
    const { data: busesData } = await supabase.from('buses').select('*');
    
    if (error) {
      console.error("Error cargando usuarios:", error);
      alert("Error cargando usuarios: " + error.message);
    }
    
    // Como ahora devolvemos JSON, usersData ya es el array que necesitamos
    if (usersData) setUsers(usersData);
    if (busesData) setBuses(busesData);
    
    setLoading(false);
  }

  // 3. Actualizar Rol o Bus
  async function updateUser(userId: string, field: 'role' | 'bus_id', value: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('user_id', userId);

    if (error) {
      alert("Error actualizando: " + error.message);
    } else {
      setUsers(users.map(u => u.user_id === userId ? { ...u, [field]: value } : u));
    }
  }

  // 4. Cerrar Sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 relative overflow-hidden">
      
      {/* Luces de fondo (Efecto Neón) */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Panel de Administración
            </h1>
            <p className="text-slate-400 mt-1">Gestión de Usuarios, Roles y Flota</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors shadow-lg"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Tabla Estilizada */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <th className="p-5 font-semibold">Usuario / Email</th>
                  <th className="p-5 font-semibold">Rol del Sistema</th>
                  <th className="p-5 font-semibold">Asignación de Bus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-700/30 transition-colors">
                    
                    {/* Columna Email */}
                    <td className="p-5">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center mr-3 text-xs font-bold text-slate-300">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-mono text-sm text-slate-200">{user.email}</span>
                      </div>
                    </td>

                    {/* Columna Rol */}
                    <td className="p-5">
                      <select 
                        value={user.role || 'reader'}
                        onChange={(e) => updateUser(user.user_id, 'role', e.target.value)}
                        className={`text-sm rounded-lg px-3 py-1.5 border-0 ring-1 ring-inset focus:ring-2 focus:ring-inset font-medium outline-none transition-all cursor-pointer ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 ring-purple-500/20 focus:ring-purple-500' 
                            : user.role === 'driver' 
                              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 focus:ring-emerald-500' 
                              : 'bg-blue-500/10 text-blue-400 ring-blue-500/20 focus:ring-blue-500'
                        }`}
                      >
                        <option value="reader" className="bg-slate-800 text-slate-200">Lector</option>
                        <option value="driver" className="bg-slate-800 text-slate-200">Conductor</option>
                        <option value="admin" className="bg-slate-800 text-slate-200">Admin</option>
                      </select>
                    </td>

                    {/* Columna Bus */}
                    <td className="p-5">
                      {user.role === 'driver' ? (
                        <select
                          value={user.bus_id || ''}
                          onChange={(e) => updateUser(user.user_id, 'bus_id', e.target.value)}
                          className="w-full max-w-[200px] bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        >
                          <option value="">-- Sin Bus --</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>{b.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 text-xs italic">No requiere bus</span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-4 text-center text-xs text-slate-500">
          Mostrando {users.length} usuarios registrados
        </div>

      </div>
    </div>
  );
}