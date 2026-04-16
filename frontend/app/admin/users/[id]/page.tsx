"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUserDetail, updateUserFinancials, deleteUser, setReferralLimit } from "@/lib/api";
import { Trash2, Save, ArrowLeft, CheckCircle, XCircle } from "lucide-react";

interface Referral { id: string; email: string; is_active: boolean; created_at: string; }
interface UserDetail {
  id: string; email: string; is_active: boolean; is_admin: boolean;
  referral_code: string; referral_limit: number; referred_by: string | null;
  created_at: string; investment_usdt: number; withdrawal_usdt: number;
  note: string; referrals: Referral[];
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [investment, setInvestment] = useState("0");
  const [withdrawal, setWithdrawal] = useState("0");
  const [note, setNote] = useState("");
  const [refLimit, setRefLimit] = useState("3");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const data = await getUserDetail(id);
      setUser(data);
      setInvestment(String(data.investment_usdt));
      setWithdrawal(String(data.withdrawal_usdt));
      setNote(data.note || "");
      setRefLimit(String(data.referral_limit));
    } catch {
      setError("Ошибка загрузки или нет доступа");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      await updateUserFinancials(id, parseFloat(investment) || 0, parseFloat(withdrawal) || 0, note);
      await setReferralLimit(id, parseInt(refLimit) || 3);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      fetchUser();
    } catch {
      setError("Ошибка сохранения");
    }
  }

  async function handleDelete() {
    if (!confirm(`Удалить пользователя ${user?.email}? Это действие необратимо.`)) return;
    try {
      await deleteUser(id);
      router.push("/admin");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка удаления");
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <p style={{ color: "var(--muted)" }}>Загрузка...</p>
    </div>
  );

  if (error || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || "Пользователь не найден"}</p>
        <button onClick={() => router.push("/admin")} className="text-blue-400 hover:underline text-sm">← Назад</button>
      </div>
    </div>
  );

  const profit = parseFloat(investment) - parseFloat(withdrawal);
  const profitPct = parseFloat(investment) > 0 ? ((profit / parseFloat(investment)) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")}
            className="flex items-center gap-2 text-sm transition hover:opacity-80"
            style={{ color: "var(--muted)" }}>
            <ArrowLeft size={16} /> Назад
          </button>
          <span style={{ color: "var(--border)" }}>|</span>
          <h1 className="font-bold text-white">👤 {user.email}</h1>
          {user.is_admin && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a3a6e", color: "#4488dd" }}>admin</span>}
          <span className="text-xs px-2 py-0.5 rounded" style={{
            background: user.is_active ? "#0d3a20" : "#3a2000",
            color: user.is_active ? "#22c97a" : "#ff9933"
          }}>{user.is_active ? "Активен" : "Ожидает"}</span>
        </div>
        <button onClick={handleDelete}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
          style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
          <Trash2 size={14} /> Удалить
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Финансовая сводка */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Инвестировано", value: `${parseFloat(investment).toFixed(2)} $`, color: "#4488dd" },
            { label: "Выведено", value: `${parseFloat(withdrawal).toFixed(2)} $`, color: "#ff9933" },
            { label: "Чистый результат", value: `${profit >= 0 ? "+" : ""}${profit.toFixed(2)} $ (${profitPct}%)`, color: profit >= 0 ? "#22c97a" : "#ff4d4d" },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{c.label}</p>
              <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Редактирование финансов */}
          <div className="rounded-xl p-5 border space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white">💰 Финансы</h2>

            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Инвестировано (USDT)</label>
              <input type="number" value={investment} onChange={e => setInvestment(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white border outline-none focus:border-blue-500 transition"
                style={{ background: "#0d0d1a", borderColor: "var(--border)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Выведено (USDT)</label>
              <input type="number" value={withdrawal} onChange={e => setWithdrawal(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white border outline-none focus:border-blue-500 transition"
                style={{ background: "#0d0d1a", borderColor: "var(--border)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Реферальный лимит</label>
              <input type="number" value={refLimit} onChange={e => setRefLimit(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white border outline-none focus:border-blue-500 transition"
                style={{ background: "#0d0d1a", borderColor: "var(--border)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Заметка</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                className="w-full rounded-lg px-3 py-2 text-white border outline-none focus:border-blue-500 transition resize-none"
                style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
                placeholder="Любые заметки по инвестору..." />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-white transition hover:opacity-80"
              style={{ background: saved ? "#0d3a20" : "var(--accent)" }}>
              {saved ? <><CheckCircle size={16} /> Сохранено</> : <><Save size={16} /> Сохранить</>}
            </button>
          </div>

          {/* Информация */}
          <div className="space-y-4">
            <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-white mb-3">ℹ️ Данные аккаунта</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: "ID", value: user.id },
                  { label: "Email", value: user.email },
                  { label: "Реф. код", value: user.referral_code },
                  { label: "Зарегистрирован", value: new Date(user.created_at).toLocaleString("ru") },
                  { label: "Приглашён кем", value: user.referred_by ? "Да" : "Нет" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span className="text-white text-right max-w-xs truncate">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Рефералы */}
            <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-white mb-3">👥 Рефералы ({user.referrals.length} / {user.referral_limit})</h2>
              {user.referrals.length === 0
                ? <p className="text-sm" style={{ color: "var(--muted)" }}>Нет приглашённых</p>
                : <div className="space-y-2">
                  {user.referrals.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <p className="text-sm text-white">{r.email}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(r.created_at).toLocaleDateString("ru")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.is_active
                          ? <span className="flex items-center gap-1 text-xs" style={{ color: "#22c97a" }}><CheckCircle size={12} /> Активен</span>
                          : <span className="flex items-center gap-1 text-xs" style={{ color: "#ff9933" }}><XCircle size={12} /> Ожидает</span>
                        }
                        <button onClick={() => router.push(`/admin/users/${r.id}`)}
                          className="text-xs px-2 py-1 rounded border transition hover:opacity-80"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          Открыть →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
