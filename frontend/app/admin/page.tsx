"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminUsers, approveUser, rejectUser } from "@/lib/api";
import { CheckCircle, XCircle, Copy } from "lucide-react";

interface User {
  id: string; email: string; is_active: boolean; is_admin: boolean;
  referral_code: string; referral_limit: number; created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch {
      setError("Нет доступа или ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    await approveUser(id);
    fetchUsers();
  }

  async function handleReject(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    await rejectUser(id);
    fetchUsers();
  }

  function copyRefLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${code}`);
  }

  const pending = users.filter(u => !u.is_active && !u.is_admin);
  const active = users.filter(u => u.is_active);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <h1 className="font-bold text-white">Админ-панель</h1>
        </div>
        <a href="/dashboard" className="text-sm text-blue-400 hover:underline">← Дашборд</a>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {error && <p className="text-red-400 text-center">{error}</p>}
        {loading && <p className="text-center" style={{ color: "var(--muted)" }}>Загрузка...</p>}

        {/* Ожидают одобрения */}
        {pending.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
              <h2 className="font-semibold text-white">Ожидают одобрения ({pending.length})</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {pending.map(u => (
                <div key={u.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-white font-medium">{u.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{new Date(u.created_at).toLocaleString("ru")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(u.id)}
                      className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                      style={{ background: "#0d3a20", color: "#22c97a" }}>
                      <CheckCircle size={14} /> Одобрить
                    </button>
                    <button onClick={() => handleReject(u.id)}
                      className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                      style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
                      <XCircle size={14} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Активные пользователи */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white">Активные пользователи ({active.length})</h2>
          </div>
          {active.length === 0
            ? <p className="px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>Нет активных пользователей</p>
            : <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {active.map(u => (
                <div key={u.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-white font-medium flex items-center gap-2">
                      {u.email}
                      {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#1a3a6e", color: "#4488dd" }}>admin</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Реф. лимит: {u.referral_limit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyRefLink(u.referral_code)}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition hover:opacity-80"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                      <Copy size={12} /> Реф. ссылка
                    </button>
                    <button onClick={() => router.push(`/admin/users/${u.id}`)}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition hover:opacity-80"
                      style={{ borderColor: "#4488dd", color: "#4488dd" }}>
                      Открыть →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </main>
    </div>
  );
}
