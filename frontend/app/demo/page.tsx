"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDemoAccount, resetDemoAccount } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Activity, RotateCcw, ArrowLeft } from "lucide-react";

interface Position { symbol: string; amount: number; avg_price: number; value: number; }
interface VirtualTrade { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string; }
interface DemoAccount {
  balance_usdt: number; start_balance: number; pnl: number; pnl_pct: number;
  positions: Position[]; trades: VirtualTrade[]; created_at: string; updated_at: string;
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

export default function DemoPage() {
  const router = useRouter();
  const [data, setData] = useState<DemoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const d = await getDemoAccount();
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!confirm("Сбросить демо-счёт до 1000 USDT? История сделок будет удалена.")) return;
    setResetting(true);
    await resetDemoAccount();
    await fetchData();
    setResetting(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center" style={{ color: "var(--muted)" }}>
        <div className="text-3xl mb-3 animate-pulse">⚡</div>
        <p>Загрузка демо-счёта...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const pnlColor = data.pnl >= 0 ? "#22c97a" : "#ff4d4d";
  const posValue = data.positions.reduce((s, p) => s + p.value, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm transition hover:opacity-80"
            style={{ color: "var(--muted)" }}>
            <ArrowLeft size={16} /> Назад
          </button>
          <span style={{ color: "var(--border)" }}>|</span>
          <span className="text-xl">🧪</span>
          <div>
            <h1 className="font-bold text-white text-lg leading-none">Демо счёт</h1>
            <span className="text-xs" style={{ color: "#f59e0b" }}>Виртуальная торговля · 1000 USDT стартовый баланс</span>
          </div>
        </div>
        <button onClick={handleReset} disabled={resetting}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: "#f59e0b55", color: "#f59e0b", background: "#1a1000" }}>
          <RotateCcw size={14} /> {resetting ? "Сброс..." : "Сбросить счёт"}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Баннер */}
        <div className="rounded-xl p-4 border flex items-center gap-4" style={{ background: "#1a1000", borderColor: "#f59e0b44" }}>
          <span className="text-3xl">🧪</span>
          <div>
            <p className="text-white font-semibold">Виртуальный портфель — реальная стратегия бота</p>
            <p className="text-sm" style={{ color: "#a87a30" }}>
              Ваш демо-счёт зеркалит реальную торговлю AI Маклера. Деньги виртуальные — стратегия настоящая.
            </p>
          </div>
        </div>

        {/* Карточки */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Wallet size={20} />, label: "Баланс (демо)", value: `${data.balance_usdt.toFixed(2)} $`, color: "#4488dd" },
            { icon: <Activity size={20} />, label: "В позициях", value: `${posValue.toFixed(2)} $`, color: "#9966ee" },
            { icon: <TrendingUp size={20} />, label: "Стартовый баланс", value: `${data.start_balance.toFixed(2)} $`, color: "#22c97a" },
            {
              icon: data.pnl >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />,
              label: "PnL",
              value: `${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)} $ (${data.pnl >= 0 ? "+" : ""}${data.pnl_pct.toFixed(2)}%)`,
              color: pnlColor
            },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "#f59e0b33" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>
                {c.icon}
                <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Позиции */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "#f59e0b33" }}>
            <h2 className="font-semibold text-white mb-4">💼 Виртуальные позиции</h2>
            {data.positions.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Позиций нет — бот ещё не торговал</p>
              : <div className="space-y-2">
                {data.positions.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="font-medium text-white">{p.symbol}</span>
                    <div className="text-right">
                      <p className="text-sm text-white">{p.amount.toFixed(6)}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        avg ${p.avg_price.toFixed(4)} · {p.value.toFixed(2)} $
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* История сделок */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "#f59e0b33" }}>
            <h2 className="font-semibold text-white mb-4">📋 История виртуальных сделок</h2>
            {data.trades.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Сделок пока нет</p>
              : <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.trades.map((t, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>
                        {t.action}
                      </span>
                      <div>
                        <p className="text-sm text-white">{t.symbol}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{t.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">${t.price.toFixed(4)}</p>
                      {t.pnl != null && (
                        <p className="text-xs font-semibold" style={{ color: t.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
                          {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)} $
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        <p className="text-center text-xs pb-4" style={{ color: "var(--muted)" }}>
          Последнее обновление: {new Date(data.updated_at).toLocaleString("ru")} ·
          <span style={{ color: "#f59e0b" }}> Демо режим — виртуальные средства</span>
        </p>
      </main>
    </div>
  );
}
