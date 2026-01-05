import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

type UserRow = {
  user_id: string;
  email: string;
  role: string;
  bus_id: string | null;
};

type BusRow = {
  id: string;
  label: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  /* =========================
     1. Verificación ADMIN
     ========================= */
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId) // ✅ CORRECTO
        .single();

      if (error || !profile || profile.role !== "admin") {
        router.replace("/");
        return;
      }

      setAuthorized(true);
      await fetchData();
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  /* =========================
     2. Cargar datos
     ========================= */
  async function fetchData() {
    const { data: usersData, error: usersError } =
      await supabase.rpc("get_all_users");

    const { data: busesData, error: busesError } =
      await supabase.from("buses").select("id, label");

    if (usersError) {
      console.error("Error cargando usuarios:", usersError);
    } else {
      setUsers(usersData || []);
    }

    if (busesError) {
      console.error("Error cargando buses:", busesError);
    } else {
      setBuses(busesData || []);
    }
  }

  /* =========================
     3. Actualizar usuario
     ========================= */
  async function updateUser(
    userId: string,
    field: "role" | "bus_id",
    value: any
  ) {
    const { error } = await supabase.rpc("admin_update_user", {
      p_user_id: userId,
      p_field: field,
      p_value: value,
    });

    if (error) {
      console.error("Error actualizando usuario:", error);
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId ? { ...u, [field]: value } : u
      )
    );
  }

  /* =========================
     4. Logout
     ========================= */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  /* =========================
     LOADING / BLOQUEO
     ========================= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Verificando permisos...
      </div>
    );
  }

  if (!authorized) return null;

  /* =========================
     UI
     ========================= */
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Panel de Administración</h1>
            <p className="text-slate-400 text-sm">
              Gestión de usuarios, roles y flota
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Bus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-slate-700/30">

                  <td className="p-4 font-mono text-sm">
                    {user.email}
                  </td>

                  <td className="p-4">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateUser(user.user_id, "role", e.target.value)
                      }
                      className="bg-slate-900 text-white rounded px-2 py-1"
                    >
                      <option value="reader">Lector</option>
                      <option value="driver">Conductor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td className="p-4">
                    {user.role === "driver" ? (
                      <select
                        value={user.bus_id || ""}
                        onChange={(e) =>
                          updateUser(user.user_id, "bus_id", e.target.value)
                        }
                        className="bg-slate-900 text-white rounded px-2 py-1"
                      >
                        <option value="">-- Sin bus --</option>
                        {buses.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-500 text-xs italic">
                        No aplica
                      </span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-500 text-center">
          Mostrando {users.length} usuarios
        </div>

      </div>
    </div>
  );
}
