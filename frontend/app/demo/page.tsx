"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDemoAccount, startDemoAccount, resetDemoAccount } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Activity, RotateCcw, ArrowLeft } from "lucide-react";

interface Position { symbol: string; amount: number; avg_price: number; value: number; }
interface VirtualTrade { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string; }
interface DemoAccount {
  is_started: boolean;
  balance_usdt: number; start_balance: number; pnl: number; pnl_pct: number;
  positions: Position[]; trades: VirtualTrade[]; created_at: string | null; updated_at: string | null;
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

export default function DemoPage() {
  const router = useRouter();
  const [data, setData] = useState<DemoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [amountInput, setAmountInput] = useState("1000");

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

  async function handleStart() {
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) return;
    setStarting(true);
    await startDemoAccount(amount);
    await fetchData();
    setStarting(false);
  }

  async function handleReset() {
    if (!confirm("Остановить демо-счёт и удалить историю? Можно будет начать заново с новой суммой.")) return;
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

  const pnlColor = data && data.pnl >= 0 ? "#22c97a" : "#ff4d4d";
  const posValue = data ? data.positions.reduce((s, p) => s + p.value, 0) : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🤖</span>
          <div>
            <h1 className="font-bold text-white text-lg leading-none">AI Маклер</h1>
            <span className="text-xs" style={{ color: "#f59e0b" }}>Демо счёт · виртуальная торговля</span>
          </div>
        </div>
        {/* Переключатель Реал / Демо */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Реал</span>
          <button
            onClick={() => router.push("/dashboard")}
            className="relative w-12 h-6 rounded-full transition-colors"
            style={{ background: "#f59e0b44", border: "1px solid #f59e0b88" }}
            title="Вернуться в реальный счёт"
          >
            <span className="absolute left-1 top-1 w-4 h-4 rounded-full transition-transform"
              style={{ background: "#f59e0b", transform: "translateX(24px)" }} />
          </button>
          <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>Демо</span>
        </div>
        {data?.is_started && (
          <button onClick={handleReset} disabled={resetting}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "#ff4d4d55", color: "#ff4d4d", background: "#1a0000" }}>
            <RotateCcw size={14} /> {resetting ? "Сброс..." : "Сбросить и начать заново"}
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Экран ввода суммы — если не запущен */}
        {!data?.is_started ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="text-5xl">🧪</div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Запустить демо-счёт</h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Введите виртуальную сумму — бот начнёт торговать как будто это ваши деньги.
              </p>
              <p className="text-sm mt-1" style={{ color: "#f59e0b" }}>
                Деньги виртуальные — стратегия настоящая.
              </p>
            </div>
            <div className="rounded-xl p-8 border w-full max-w-sm space-y-4"
              style={{ background: "var(--card)", borderColor: "#f59e0b44" }}>
              <label className="block text-sm font-medium" style={{ color: "var(--muted)" }}>
                Сумма виртуального депозита (USDT)
              </label>
              <div className="relative">
                <input
                  type="number" value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStart()}
                  className="w-full rounded-lg px-4 py-3 text-white text-xl font-bold border outline-none"
                  style={{ background: "#0d0d1a", borderColor: "#f59e0b55" }}
                  placeholder="1000"
                  min="1"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "#f59e0b" }}>USDT</span>
              </div>
              <button onClick={handleStart} disabled={starting || !amountInput || parseFloat(amountInput) <= 0}
                className="w-full py-3 rounded-lg font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#000" }}>
                {starting ? "Запускаем..." : "🚀 Старт"}
              </button>
            </div>
          </div>
        ) : (
          <>
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
                { icon: <TrendingUp size={20} />, label: "Стартовый депозит", value: `${data.start_balance.toFixed(2)} $`, color: "#22c97a" },
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

            {data.updated_at && (
              <p className="text-center text-xs pb-4" style={{ color: "var(--muted)" }}>
                Последнее обновление: {new Date(data.updated_at).toLocaleString("ru")} ·
                <span style={{ color: "#f59e0b" }}> Демо режим — виртуальные средства</span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
