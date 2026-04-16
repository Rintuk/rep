"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboard } from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Wallet, Activity, LogOut, Copy } from "lucide-react";

interface Position { symbol: string; amount: number; avg_price: number; }
interface Trade { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string; }
interface AIFeed { timestamp: string; action: string; symbol: string; reason: string; }
interface Dashboard {
  balance_usdt: number; mode: string; hwm: number; drawdown_pct: number;
  last_updated: string | null; positions: Position[]; recent_trades: Trade[]; ai_feed: AIFeed[];
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    // Извлекаем реферальный код из JWT payload
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setReferralCode(payload.sub || "");
    } catch {}
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const d = await getDashboard();
      setData(d);
    } catch {
      setError("Ошибка загрузки. Возможно сессия истекла.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  function copyRefLink() {
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/login" className="text-blue-400 hover:underline">Войти снова</a>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center" style={{ color: "var(--muted)" }}>
        <div className="text-3xl mb-3 animate-pulse">⚡</div>
        <p>Загрузка данных...</p>
      </div>
    </div>
  );

  const ddColor = data.drawdown_pct >= 0 ? "#22c97a" : "#ff4d4d";
  const totalPositionsValue = data.positions.reduce((s, p) => s + p.amount * p.avg_price, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="font-bold text-white text-lg leading-none">AI Маклер</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: data.mode === "NORMAL" ? "#0d3a20" : "#3a0d0d",
              color: data.mode === "NORMAL" ? "#22c97a" : "#ff4d4d"
            }}>{data.mode}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyRefLink}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <Copy size={14} />
            {copied ? "Скопировано!" : "Реф. ссылка"}
          </button>
          <button onClick={logout}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Карточки статистики */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Wallet size={20} />, label: "Свободно USDT", value: `${data.balance_usdt.toFixed(2)} $`, color: "#4488dd" },
            { icon: <Activity size={20} />, label: "Позиций на сумму", value: `${totalPositionsValue.toFixed(2)} $`, color: "#9966ee" },
            { icon: <TrendingUp size={20} />, label: "HWM (пик)", value: `${data.hwm.toFixed(2)} $`, color: "#22c97a" },
            { icon: <TrendingDown size={20} />, label: "Просадка", value: `${data.drawdown_pct.toFixed(2)}%`, color: ddColor },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>{c.icon}<span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span></div>
              <p className="text-xl font-bold text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Открытые позиции */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">💼 Открытые позиции</h2>
            {data.positions.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Позиций нет</p>
              : <div className="space-y-2">
                {data.positions.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="font-medium text-white">{p.symbol}</span>
                    <div className="text-right">
                      <p className="text-sm text-white">{p.amount.toFixed(4)}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>avg ${p.avg_price.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* Последние сделки */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4">📋 Последние сделки</h2>
            {data.recent_trades.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Сделок нет</p>
              : <div className="space-y-2">
                {data.recent_trades.slice(0, 8).map((t, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>{t.action}</span>
                      <span className="text-sm text-white">{t.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">${t.price.toFixed(4)}</p>
                      {t.pnl != null && <p className="text-xs" style={{ color: t.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}$</p>}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        {/* Лента ИИ */}
        <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h2 className="font-semibold text-white mb-4">🧠 Лента решений ИИ</h2>
          {data.ai_feed.length === 0
            ? <p className="text-sm" style={{ color: "var(--muted)" }}>Решений пока нет</p>
            : <div className="space-y-3">
              {data.ai_feed.map((a, i) => (
                <div key={i} className="flex gap-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs font-bold px-2 py-1 rounded self-start mt-0.5" style={{ background: ACTION_COLOR[a.action] + "22", color: ACTION_COLOR[a.action] }}>{a.action}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{a.symbol}</span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{a.timestamp}</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>{a.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        {data.last_updated && (
          <p className="text-center text-xs pb-4" style={{ color: "var(--muted)" }}>
            Последнее обновление: {new Date(data.last_updated).toLocaleString("ru")}
          </p>
        )}
      </main>
    </div>
  );
}
