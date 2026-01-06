import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para las estadísticas
  const [stats, setStats] = useState({ totalUsers: 0, activeBuses: 0, totalStops: 0 });
  
  const router = useRouter();

  // 1. Verificar si soy Admin
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
  }, [router]);

  // 2. Cargar datos
  async function fetchData() {
    setLoading(true);
    
    // Traer usuarios
    const { data: usersData } = await supabase.rpc('get_all_users');
    // Traer buses
    const { data: busesData } = await supabase.from('buses').select('*');
    // Traer conteo de paraderos (Simulando lectura de matriz)
    const { count: stopsCount } = await supabase.from('stops').select('*', { count: 'exact', head: true });

    if (usersData) {
        const sorted = (usersData as any[]).sort((a, b) => a.email.localeCompare(b.email));
        setUsers(sorted);
        
        // Calcular Estadísticas
        const activeDrivers = sorted.filter(u => u.role === 'driver').length;
        setStats({
            totalUsers: sorted.length,
            activeBuses: busesData?.length || 0,
            totalStops: stopsCount || 0
        });
    }
    
    if (busesData) setBuses(busesData);
    
    setLoading(false);
  }

  // 3. Actualizar
  async function updateUser(userId: string, field: 'role' | 'bus_id', value: any) {
    const finalValue = value === "" ? null : value;
    const { error } = await supabase.from('profiles').update({ [field]: finalValue }).eq('user_id', userId);
    if (error) alert("Error: " + error.message);
    else setUsers(users.map(u => u.user_id === userId ? { ...u, [field]: finalValue } : u));
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans relative overflow-hidden">
      
      {/* Fondo */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-blob pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Panel Admin</h1>
            <p className="text-slate-400 text-sm">Sistema de Gestión de Transporte</p>
          </div>
          <div className="flex gap-3">
             <button onClick={() => fetchData()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all">🔄 Recargar</button>
            <button onClick={handleLogout} className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm">Salir</button>
          </div>
        </div>

        {/* --- TARJETAS DE ESTADÍSTICAS (NUEVO) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Card 1 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </div>
                <div>
                    <p className="text-slate-400 text-xs uppercase font-bold">Total Usuarios</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalUsers}</h3>
                </div>
            </div>
            {/* Card 2 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <p className="text-slate-400 text-xs uppercase font-bold">Flota Activa</p>
                    <h3 className="text-2xl font-bold text-white">{stats.activeBuses} Und.</h3>
                </div>
            </div>
            {/* Card 3 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-lg flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <div>
                    <p className="text-slate-400 text-xs uppercase font-bold">Nodos (Paraderos)</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalStops}</h3>
                </div>
            </div>
        </div>

        {/* Tabla */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                  <th className="p-6 font-bold">Usuario / Email</th>
                  <th className="p-6 font-bold">Rol</th>
                  <th className="p-6 font-bold">Bus Asignado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-6 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.role === 'admin' ? 'bg-purple-600' : 'bg-slate-700'}`}>
                            {user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-200 text-sm">{user.email}</span>
                    </td>
                    <td className="p-6">
                      <select 
                        value={user.role || 'user'} 
                        onChange={(e) => updateUser(user.user_id, 'role', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                      >
                        <option value="user">Estudiante</option>
                        <option value="driver">Conductor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-6">
                      {user.role === 'driver' ? (
                        <select
                          value={user.bus_id || ''}
                          onChange={(e) => updateUser(user.user_id, 'bus_id', e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        >
                          <option value="">-- Sin Bus --</option>
                          {buses.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                        </select>
                      ) : <span className="text-slate-600 text-xs">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}