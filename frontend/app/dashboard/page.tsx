"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboard } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Activity, LogOut, Copy, FlaskConical, TestTube } from "lucide-react";

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

  // Демо-режим
  const [isDemo, setIsDemo] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("demo_mode") === "1";
    return false;
  });
  const [demoAmount, setDemoAmount] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("demo_amount") || "1000";
    return "1000";
  });
  const [demoInput, setDemoInput] = useState(demoAmount);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
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

  function toggleDemo() {
    const next = !isDemo;
    setIsDemo(next);
    localStorage.setItem("demo_mode", next ? "1" : "0");
  }

  function applyDemoAmount() {
    const val = parseFloat(demoInput) || 1000;
    setDemoAmount(String(val));
    localStorage.setItem("demo_amount", String(val));
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

  // Реальные значения
  const realTotal = data.balance_usdt + data.positions.reduce((s, p) => s + p.amount * p.avg_price, 0);

  // Коэффициент масштаба для демо
  const demoAmt = parseFloat(demoAmount) || 1000;
  const scale = realTotal > 0 ? demoAmt / realTotal : 1;

  // Итоговые значения (реал или демо)
  const dispBalance = isDemo ? data.balance_usdt * scale : data.balance_usdt;
  const dispPosValue = isDemo
    ? data.positions.reduce((s, p) => s + p.amount * p.avg_price, 0) * scale
    : data.positions.reduce((s, p) => s + p.amount * p.avg_price, 0);
  const dispHwm = isDemo ? demoAmt : data.hwm;
  const dispTotal = isDemo ? demoAmt * (realTotal > 0 ? realTotal / realTotal : 1) : realTotal;

  // PnL в демо: та же % что у реального бота, применённая к виртуальной сумме
  const realPnlPct = realTotal > 0 && data.hwm > 0 ? ((realTotal - data.hwm) / data.hwm) * 100 : 0;
  const demoPnl = demoAmt * (realPnlPct / 100);

  const ddColor = data.drawdown_pct >= 0 ? "#22c97a" : "#ff4d4d";

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
          {/* Кнопка перехода в Демо */}
          <button onClick={() => router.push("/demo")}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border font-semibold transition hover:opacity-80"
            style={{ borderColor: "#f59e0b55", background: "#1a1000", color: "#f59e0b" }}>
            <FlaskConical size={14} /> Демо счёт
          </button>

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

        {/* Панель демо-режима */}
        {isDemo && (
          <div className="rounded-xl p-5 border" style={{ background: "#1a1000", borderColor: "#f59e0b55" }}>
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical size={16} color="#f59e0b" />
              <h2 className="font-semibold" style={{ color: "#f59e0b" }}>Демо режим — виртуальный портфель</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: "#a87a30" }}>
              Введите виртуальную сумму и посмотрите как бы работали ваши деньги с реальной стратегией бота.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="number" value={demoInput} onChange={e => setDemoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyDemoAmount()}
                  className="rounded-lg px-4 py-2 text-white border outline-none transition"
                  style={{ background: "#0d0d1a", borderColor: "#f59e0b55", width: 180 }}
                  placeholder="Сумма USDT"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#f59e0b" }}>USDT</span>
              </div>
              <button onClick={applyDemoAmount}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition hover:opacity-80"
                style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b55" }}>
                Применить
              </button>
              <div className="ml-4 text-sm">
                <span style={{ color: "var(--muted)" }}>Виртуальный PnL: </span>
                <span style={{ color: demoPnl >= 0 ? "#22c97a" : "#ff4d4d", fontWeight: "bold" }}>
                  {demoPnl >= 0 ? "+" : ""}{demoPnl.toFixed(2)} $ ({realPnlPct >= 0 ? "+" : ""}{realPnlPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Карточки статистики */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Wallet size={20} />, label: "Свободно USDT", value: `${dispBalance.toFixed(2)} $`, color: "#4488dd" },
            { icon: <Activity size={20} />, label: "Позиций на сумму", value: `${dispPosValue.toFixed(2)} $`, color: "#9966ee" },
            { icon: <TrendingUp size={20} />, label: isDemo ? "Вложено (демо)" : "HWM (пик)", value: `${dispHwm.toFixed(2)} $`, color: "#22c97a" },
            { icon: <TrendingDown size={20} />, label: "Просадка", value: `${data.drawdown_pct.toFixed(2)}%`, color: ddColor },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{
              background: "var(--card)",
              borderColor: isDemo ? "#f59e0b33" : "var(--border)"
            }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>{c.icon}<span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span></div>
              <p className="text-xl font-bold text-white">{c.value}</p>
              {isDemo && <p className="text-xs mt-1" style={{ color: "#f59e0b88" }}>виртуально</p>}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Открытые позиции */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: isDemo ? "#f59e0b33" : "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4">💼 Открытые позиции</h2>
            {data.positions.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Позиций нет</p>
              : <div className="space-y-2">
                {data.positions.map((p, i) => {
                  const dispAmt = isDemo ? p.amount * scale : p.amount;
                  const dispVal = dispAmt * p.avg_price;
                  return (
                    <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <span className="font-medium text-white">{p.symbol}</span>
                      <div className="text-right">
                        <p className="text-sm text-white">{dispAmt.toFixed(6)}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          avg ${p.avg_price.toFixed(4)} · {dispVal.toFixed(2)} $
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>

          {/* Последние сделки */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: isDemo ? "#f59e0b33" : "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4">📋 Последние сделки</h2>
            {data.recent_trades.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Сделок нет</p>
              : <div className="space-y-2">
                {data.recent_trades.slice(0, 8).map((t, i) => {
                  const dispPnl = isDemo && t.pnl != null ? t.pnl * scale : t.pnl;
                  return (
                    <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>{t.action}</span>
                        <span className="text-sm text-white">{t.symbol}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white">${t.price.toFixed(4)}</p>
                        {dispPnl != null && <p className="text-xs" style={{ color: dispPnl >= 0 ? "#22c97a" : "#ff4d4d" }}>{dispPnl >= 0 ? "+" : ""}{dispPnl.toFixed(2)}$</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>

        {/* Лента ИИ */}
        <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: isDemo ? "#f59e0b33" : "var(--border)" }}>
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
            {isDemo && <span style={{ color: "#f59e0b" }}> · Демо режим</span>}
          </p>
        )}
      </main>
    </div>
  );
}
