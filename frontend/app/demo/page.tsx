"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDemoAccount, startDemoAccount, resetDemoAccount,
  getForexDemoAccount, startForexDemoAccount, resetForexDemoAccount,
} from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Activity, RotateCcw } from "lucide-react";

interface Position { symbol: string; amount: number; avg_price: number; value: number; }
interface VirtualTrade { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string; }
interface DemoAccount {
  is_started: boolean;
  balance_usdt: number; start_balance: number; pnl: number; pnl_pct: number;
  positions: Position[]; trades: VirtualTrade[]; created_at: string | null; updated_at: string | null;
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

function CircuitBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const COLS = 18, ROWS = 12;
    type Edge = { to: number; mx: number; my: number };
    type CNode = { x: number; y: number; edges: Edge[] };
    const nodes: CNode[] = [];
    const jitter = () => (Math.random() - 0.5) * 60;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        nodes.push({ x: (canvas.width / (COLS - 1)) * c + jitter(), y: (canvas.height / (ROWS - 1)) * r + jitter(), edges: [] });
    nodes.forEach((n, i) => {
      [i + 1, i + COLS, i + COLS + 1, i + COLS - 1].forEach(j => {
        if (j < nodes.length && Math.random() > 0.35) {
          const t = nodes[j];
          const mx = Math.random() > 0.5 ? t.x : n.x;
          const my = mx === t.x ? n.y : t.y;
          n.edges.push({ to: j, mx, my });
        }
      });
    });
    let raf: number;
    let t = 0;
    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n, i) => {
        n.edges.forEach(e => {
          const target = nodes[e.to];
          const pulse = (Math.sin(t + i * 0.3) + 1) / 2;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(e.mx, e.my);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(0,${140 + pulse * 60},${200 + pulse * 55},${0.04 + pulse * 0.03})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        const pulse = (Math.sin(t * 1.5 + i * 0.7) + 1) / 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,180,255,${0.05 + pulse * 0.05})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

const RobotSVG = () => (
  <svg width="26" height="26" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 0 6px rgba(0,200,255,0.6))" }}>
    <defs>
      <radialGradient id="dmbg" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#0a1a5c"/><stop offset="100%" stopColor="#050e30"/></radialGradient>
      <radialGradient id="dmhd" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#3b6fd4"/><stop offset="100%" stopColor="#1e3a7a"/></radialGradient>
      <radialGradient id="dmey" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#e0f0ff"/><stop offset="100%" stopColor="#93c5fd"/></radialGradient>
      <radialGradient id="dmpu" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#1d4ed8"/></radialGradient>
    </defs>
    <rect width="96" height="96" rx="22" fill="url(#dmbg)"/>
    <rect width="96" height="96" rx="22" fill="white" opacity="0.06"/>
    <line x1="32" y1="10" x2="28" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="28" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
    <line x1="64" y1="10" x2="68" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="68" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
    <ellipse cx="48" cy="52" rx="34" ry="32" fill="url(#dmhd)"/>
    <circle cx="33" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
    <circle cx="33" cy="50" r="11" fill="url(#dmey)"/>
    <circle cx="33" cy="50" r="6" fill="url(#dmpu)"/>
    <circle cx="33" cy="50" r="3" fill="#1e40af"/>
    <circle cx="30" cy="47" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="63" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
    <circle cx="63" cy="50" r="11" fill="url(#dmey)"/>
    <circle cx="63" cy="50" r="6" fill="url(#dmpu)"/>
    <circle cx="63" cy="50" r="3" fill="#1e40af"/>
    <circle cx="60" cy="47" r="2.5" fill="white" opacity="0.9"/>
    <rect x="36" y="69" width="24" height="8" rx="4" fill="#0d2260" stroke="#3b6fd4" strokeWidth="1"/>
    <rect x="10" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
    <rect x="81" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
  </svg>
);

export default function DemoPage() {
  const router = useRouter();
  const [data, setData] = useState<DemoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [amountInput, setAmountInput] = useState("1000");
  const [activePool, setActivePool] = useState<"crypto" | "forex">("crypto");

  const card: React.CSSProperties = {
    background: "rgba(8,12,35,0.85)",
    border: "1px solid rgba(0,180,255,0.15)",
    borderRadius: 14,
    backdropFilter: "blur(12px)",
  };
  const muted = "#6b7bb0";

  async function fetchData(pool: "crypto" | "forex") {
    try {
      const d = pool === "forex" ? await getForexDemoAccount() : await getDemoAccount();
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    setData(null);
    fetchData(activePool);
    const interval = setInterval(() => fetchData(activePool), 60000);
    return () => clearInterval(interval);
  }, [activePool]);

  async function handleStart() {
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) return;
    setStarting(true);
    try {
      if (activePool === "forex") await startForexDemoAccount(amount);
      else await startDemoAccount(amount);
      await fetchData(activePool);
    } finally { setStarting(false); }
  }

  async function handleReset() {
    if (!confirm("Остановить демо-счёт и удалить историю? Можно будет начать заново с новой суммой.")) return;
    setResetting(true);
    try {
      if (activePool === "forex") await resetForexDemoAccount();
      else await resetDemoAccount();
      await fetchData(activePool);
    } finally { setResetting(false); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircuitBackground />
      <div style={{ textAlign: "center", color: muted, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <p>Загрузка демо-счёта...</p>
      </div>
    </div>
  );

  const pnlColor = data && data.pnl >= 0 ? "#22c97a" : "#ff4d4d";
  const posValue = data ? data.positions.reduce((s, p) => s + p.value, 0) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", position: "relative" }}>
      <CircuitBackground />
      <style>{`
        input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 1000px rgba(5,10,30,0.95) inset !important;
          -webkit-text-fill-color:#e0e8ff !important;
        }
      `}</style>

      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(5,8,25,0.92)",
        borderBottom: "1px solid rgba(0,180,255,0.15)",
        backdropFilter: "blur(16px)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Лого */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RobotSVG />
          <div>
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 16, lineHeight: 1, letterSpacing: 0.5 }}>AI Маклер</h1>
            <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Демо счёт</span>
          </div>
        </div>

        {/* Переключатель пула */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["crypto", "forex"] as const).map(p => (
            <button key={p} onClick={() => setActivePool(p)} style={{
              padding: "6px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: activePool === p ? "rgba(245,158,11,0.18)" : "transparent",
              border: `1px solid ${activePool === p ? "rgba(245,158,11,0.5)" : "rgba(0,180,255,0.15)"}`,
              color: activePool === p ? "#f59e0b" : "#4a6a9a",
              cursor: "pointer", transition: "all 0.2s",
            }}>
              {p === "crypto" ? "Крипто" : "Форекс"}
            </button>
          ))}
        </div>

        {/* Реал/Демо переключатель + Сброс */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: muted }}>Реал</span>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                position: "relative", width: 48, height: 24, borderRadius: 12, cursor: "pointer",
                background: "rgba(245,158,11,0.27)", border: "1px solid rgba(245,158,11,0.53)",
              }}
              title="Вернуться в реальный счёт"
            >
              <span style={{
                position: "absolute", left: 4, top: 4, width: 16, height: 16, borderRadius: "50%",
                background: "#f59e0b", display: "block", transform: "translateX(24px)",
              }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>Демо</span>
          </div>
          {data?.is_started && (
            <button onClick={handleReset} disabled={resetting}
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px",
                borderRadius: 8, border: "1px solid rgba(255,77,77,0.33)", color: "#ff4d4d",
                background: "rgba(26,0,0,0.6)", cursor: "pointer", opacity: resetting ? 0.5 : 1,
              }}>
              <RotateCcw size={13} />
              <span>{resetting ? "Сброс..." : "Сбросить"}</span>
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>

        {!data?.is_started ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 24 }}>
            <div style={{ fontSize: 48 }}>{activePool === "forex" ? "💱" : "🧪"}</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
                Запустить {activePool === "forex" ? "Форекс" : "Крипто"} демо-счёт
              </h2>
              <p style={{ color: muted, fontSize: 13 }}>Введите виртуальную сумму — бот начнёт торговать как будто это ваши деньги.</p>
              <p style={{ color: "#f59e0b", fontSize: 13, marginTop: 4 }}>Деньги виртуальные — стратегия настоящая.</p>
            </div>
            <div style={{ ...card, padding: 32, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16, border: "1px solid rgba(245,158,11,0.27)" }}>
              <label style={{ fontSize: 13, color: muted }}>Сумма виртуального депозита (USDT)</label>
              <div style={{ position: "relative" }}>
                <input
                  type="number" value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStart()}
                  style={{
                    width: "100%", borderRadius: 10, padding: "12px 52px 12px 16px",
                    background: "rgba(5,10,30,0.9)", border: "1px solid rgba(245,158,11,0.33)",
                    color: "#fff", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box",
                  }}
                  placeholder="1000" min="1"
                />
                <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", color: "#f59e0b", fontWeight: 600 }}>USDT</span>
              </div>
              <button onClick={handleStart} disabled={starting || !amountInput || parseFloat(amountInput) <= 0}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 16,
                  background: "#f59e0b", color: "#000", cursor: "pointer", border: "none",
                  opacity: (starting || !amountInput || parseFloat(amountInput) <= 0) ? 0.5 : 1,
                }}>
                {starting ? "Запускаем..." : "🚀 Старт"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ ...card, padding: 16, border: "1px solid rgba(245,158,11,0.27)", display: "flex", alignItems: "center", gap: 16, background: "rgba(26,16,0,0.7)" }}>
              <span style={{ fontSize: 28 }}>{activePool === "forex" ? "💱" : "🧪"}</span>
              <div>
                <p style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                  {activePool === "forex" ? "Форекс" : "Виртуальный"} портфель — реальная стратегия бота
                </p>
                <p style={{ color: "#a87a30", fontSize: 12, marginTop: 2 }}>
                  Ваш демо-счёт зеркалит реальную торговлю AI Маклера. Деньги виртуальные — стратегия настоящая.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { icon: <Wallet size={18} />, label: "Баланс (демо)", value: `${data.balance_usdt.toFixed(2)} $`, color: "#4488dd" },
                { icon: <Activity size={18} />, label: "В позициях", value: `${posValue.toFixed(2)} $`, color: "#9966ee" },
                { icon: <TrendingUp size={18} />, label: "Стартовый депозит", value: `${data.start_balance.toFixed(2)} $`, color: "#22c97a" },
                {
                  icon: data.pnl >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />,
                  label: "PnL",
                  value: `${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)} $ (${data.pnl >= 0 ? "+" : ""}${data.pnl_pct.toFixed(2)}%)`,
                  color: pnlColor,
                },
              ].map((c, i) => (
                <div key={i} style={{ ...card, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: c.color }}>
                    {c.icon}
                    <span style={{ fontSize: 11, color: muted }}>{c.label}</span>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              <div style={{ ...card, padding: 20 }}>
                <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16, fontSize: 14 }}>💼 Виртуальные позиции</h2>
                {data.positions.length === 0
                  ? <p style={{ color: muted, fontSize: 13 }}>Позиций нет — бот ещё не торговал</p>
                  : data.positions.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                      <span style={{ color: "#fff", fontWeight: 500 }}>{p.symbol}</span>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: "#fff", fontSize: 13 }}>{p.amount.toFixed(6)}</p>
                        <p style={{ color: muted, fontSize: 11 }}>avg ${p.avg_price.toFixed(4)} · {p.value.toFixed(2)} $</p>
                      </div>
                    </div>
                  ))
                }
              </div>

              <div style={{ ...card, padding: 20 }}>
                <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16, fontSize: 14 }}>📋 История виртуальных сделок</h2>
                {data.trades.length === 0
                  ? <p style={{ color: muted, fontSize: 13 }}>Сделок пока нет</p>
                  : <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {data.trades.map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>
                            {t.action}
                          </span>
                          <div>
                            <p style={{ color: "#fff", fontSize: 13 }}>{t.symbol}</p>
                            <p style={{ color: muted, fontSize: 11 }}>{t.timestamp}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ color: "#fff", fontSize: 13 }}>${t.price.toFixed(4)}</p>
                          {t.pnl != null && (
                            <p style={{ fontSize: 11, fontWeight: 600, color: t.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
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
              <p style={{ textAlign: "center", fontSize: 11, color: muted, paddingBottom: 16 }}>
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
