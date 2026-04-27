"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getDashboard, createDepositRequest, getMyDeposits, createWithdrawalRequest, getMyWithdrawals } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Activity, LogOut, Copy, PlusCircle, X, CheckCheck, Settings } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Position { symbol: string; amount: number; avg_price: number; current_price?: number; }
interface Trade { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string; }
interface AIFeed { timestamp: string; action: string; symbol: string; reason: string; }
interface ReferralInfo { email: string; investment_usdt: number; bonus_usdt: number; }
interface Dashboard {
  balance_usdt: number; pool_total_usdt: number; pool_positions_usdt: number;
  mode: string; hwm: number; drawdown_pct: number; server_online: boolean;
  last_updated: string | null;
  user_investment: number; user_pnl: number; user_pnl_pct: number;
  ref_bonus: number; referral_code: string; referrals: ReferralInfo[];
  positions: Position[]; recent_trades: Trade[]; ai_feed: AIFeed[];
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888", DEPOSIT: "#f59e0b" };
const ACTION_LABEL: Record<string, string> = { BUY: "BUY", SELL: "SELL", HOLD: "HOLD", DEPOSIT: "Пополнение" };

// ─── Circuit board background ─────────────────────────────────────────────────
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
    type Pulse = { from: CNode; to: CNode; t: number; speed: number };
    const newPulse = (): Pulse => {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const e = n.edges.length ? n.edges[Math.floor(Math.random() * n.edges.length)] : null;
      return { from: n, to: e ? nodes[e.to] : n, t: 0, speed: 0.004 + Math.random() * 0.006 };
    };
    const pulses: Pulse[] = Array.from({ length: 18 }, newPulse);
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,180,255,0.07)";
      nodes.forEach(n => n.edges.forEach(e => {
        const t = nodes[e.to];
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.mx, e.my); ctx.lineTo(t.x, t.y); ctx.stroke();
      }));
      ctx.fillStyle = "rgba(0,200,255,0.12)";
      nodes.forEach(n => { ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2); ctx.fill(); });
      pulses.forEach((p, i) => {
        p.t += p.speed;
        if (p.t >= 1) { pulses[i] = newPulse(); return; }
        const x = p.from.x + (p.to.x - p.from.x) * p.t;
        const y = p.from.y + (p.to.y - p.from.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, "rgba(0,220,255,0.8)"); g.addColorStop(1, "rgba(0,220,255,0)");
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fillStyle = "rgba(180,240,255,0.9)"; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}

// ─── Shared card style ────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "rgba(8,12,35,0.82)",
  border: "1px solid rgba(0,180,255,0.15)",
  borderRadius: 14,
  backdropFilter: "blur(12px)",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositComment, setDepositComment] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositDone, setDepositDone] = useState(false);
  const [myDeposits, setMyDeposits] = useState<{id:string;amount:number;status:string;created_at:string}[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawComment, setWithdrawComment] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [myWithdrawals, setMyWithdrawals] = useState<{id:string;amount:number;status:string;created_at:string}[]>([]);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchData();
    getMyDeposits().then(setMyDeposits).catch(() => {});
    getMyWithdrawals().then(setMyWithdrawals).catch(() => {});
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const d = await getDashboard();
      setData(d);
      if (d.referral_code) setReferralCode(d.referral_code);
    } catch { setError("Ошибка загрузки. Возможно сессия истекла."); }
  }

  function logout() { localStorage.removeItem("token"); router.push("/login"); }

  async function handleDepositSubmit() {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setDepositLoading(true);
    try {
      await createDepositRequest(amount, depositComment);
      setDepositDone(true); setDepositAmount(""); setDepositComment("");
      setMyDeposits(await getMyDeposits());
    } finally { setDepositLoading(false); }
  }

  async function handleWithdrawSubmit() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;
    setWithdrawLoading(true);
    try {
      await createWithdrawalRequest(amount, withdrawComment);
      setWithdrawDone(true); setWithdrawAmount(""); setWithdrawComment("");
      setMyWithdrawals(await getMyWithdrawals());
    } finally { setWithdrawLoading(false); }
  }

  function copyRefLink() {
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralCode}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#050a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircuitBackground />
      <div style={{ ...card, padding: 32, textAlign: "center", position: "relative", zIndex: 1 }}>
        <p style={{ color: "#ff5555", marginBottom: 16 }}>{error}</p>
        <a href="/login" style={{ color: "#4488dd" }}>Войти снова</a>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "#050a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircuitBackground />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "#4a6a9a" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <p>Загрузка данных...</p>
      </div>
    </div>
  );

  const pnlColor = data.user_pnl >= 0 ? "#22c97a" : "#ff4d4d";

  return (
    <div style={{ minHeight: "100vh", background: "#050a1a" }}>
      <CircuitBackground />

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(5,8,25,0.92)",
        borderBottom: "1px solid rgba(0,180,255,0.15)",
        backdropFilter: "blur(16px)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="26" height="26" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 0 6px rgba(0,200,255,0.6))" }}>
            <defs>
              <radialGradient id="hbg" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#0a1a5c"/><stop offset="100%" stopColor="#050e30"/></radialGradient>
              <radialGradient id="hhd" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#3b6fd4"/><stop offset="100%" stopColor="#1e3a7a"/></radialGradient>
              <radialGradient id="hey" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#e0f0ff"/><stop offset="100%" stopColor="#93c5fd"/></radialGradient>
              <radialGradient id="hpu" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#1d4ed8"/></radialGradient>
            </defs>
            <rect width="96" height="96" rx="22" fill="url(#hbg)"/>
            <rect width="96" height="96" rx="22" fill="white" opacity="0.06"/>
            <line x1="32" y1="10" x2="28" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="28" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
            <line x1="64" y1="10" x2="68" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="68" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
            <ellipse cx="48" cy="52" rx="34" ry="32" fill="url(#hhd)"/>
            <ellipse cx="48" cy="52" rx="34" ry="32" fill="white" opacity="0.05"/>
            <circle cx="33" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
            <circle cx="33" cy="50" r="11" fill="url(#hey)"/>
            <circle cx="33" cy="50" r="6" fill="url(#hpu)"/>
            <circle cx="33" cy="50" r="3" fill="#1e40af"/>
            <circle cx="30" cy="47" r="2.5" fill="white" opacity="0.9"/>
            <circle cx="63" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
            <circle cx="63" cy="50" r="11" fill="url(#hey)"/>
            <circle cx="63" cy="50" r="6" fill="url(#hpu)"/>
            <circle cx="63" cy="50" r="3" fill="#1e40af"/>
            <circle cx="60" cy="47" r="2.5" fill="white" opacity="0.9"/>
            <rect x="36" y="69" width="24" height="8" rx="4" fill="#0d2260" stroke="#3b6fd4" strokeWidth="1"/>
            <rect x="10" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
            <rect x="81" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
          </svg>
          <div>
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 16, lineHeight: 1, letterSpacing: 0.5 }}>AI Маклер</h1>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              background: data.server_online ? "rgba(34,201,122,0.12)" : "rgba(255,77,77,0.12)",
              color: data.server_online ? "#22c97a" : "#ff4d4d",
              border: `1px solid ${data.server_online ? "rgba(34,201,122,0.3)" : "rgba(255,77,77,0.3)"}`,
            }}>
              ● {data.server_online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{
            padding: "8px", borderRadius: 10, cursor: "pointer",
            background: menuOpen ? "rgba(0,180,255,0.1)" : "transparent",
            border: `1px solid ${menuOpen ? "rgba(0,180,255,0.4)" : "rgba(0,180,255,0.15)"}`,
            color: menuOpen ? "#00cfff" : "#4a6a9a", transition: "all 0.2s",
          }}>
            <Settings size={20} />
          </button>

          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div style={{
                position: "absolute", right: 0, top: 44, zIndex: 50, width: 220,
                ...card, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                {[
                  { label: "Реал / Демо", special: "toggle" },
                  { label: "Пополнить счёт", color: "#22c97a", icon: <PlusCircle size={15}/>, action: () => { setMenuOpen(false); setShowDeposit(true); setDepositDone(false); } },
                  { label: "Вывести средства", color: "#ff9944", icon: <Wallet size={15}/>, action: () => { setMenuOpen(false); setShowWithdraw(true); setWithdrawDone(false); } },
                  { label: copied ? "Скопировано!" : "Реф. ссылка", color: "#6b8ab0", icon: <Copy size={15}/>, action: () => { setMenuOpen(false); copyRefLink(); } },
                  { label: "Выйти", color: "#ff4d4d", icon: <LogOut size={15}/>, action: () => { setMenuOpen(false); logout(); } },
                ].map((item, i) => item.special === "toggle" ? (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                    <span style={{ color: "#fff", fontSize: 13 }}>Режим</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>Реал</span>
                      <button onClick={() => { setMenuOpen(false); router.push("/demo"); }}
                        style={{ width: 44, height: 24, borderRadius: 12, background: "#1a2040", border: "1px solid rgba(0,180,255,0.2)", cursor: "pointer", position: "relative" }}>
                        <span style={{ position: "absolute", left: 4, top: 4, width: 14, height: 14, borderRadius: "50%", background: "#4a6a9a" }} />
                      </button>
                      <span style={{ color: "#4a6a9a", fontSize: 11, fontWeight: 600 }}>Демо</span>
                    </div>
                  </div>
                ) : (
                  <button key={i} onClick={item.action} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", color: item.color, fontSize: 13, cursor: "pointer",
                    background: "none", border: "none", borderBottom: i < 4 ? "1px solid rgba(0,180,255,0.08)" : "none",
                    textAlign: "left", transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>

        {/* ── Карточки метрик ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.ref_bonus > 0 ? 5 : 4}, 1fr)`, gap: 12 }} className="metrics-grid">
          <style>{`
            @media (max-width: 768px) { .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
              -webkit-box-shadow: 0 0 0 1000px rgba(5,10,30,0.95) inset !important;
              -webkit-text-fill-color: #e0e8ff !important; caret-color: #e0e8ff;
            }
          `}</style>

          {[
            { icon: <Wallet size={18}/>, label: "Общий пул", value: `${data.pool_total_usdt.toFixed(2)} $`, sub: `свободно: ${data.balance_usdt.toFixed(2)} $`, color: "#4488dd" },
            { icon: <Activity size={18}/>, label: "Пул в позициях", value: `${data.pool_positions_usdt.toFixed(2)} $`, sub: null, color: "#9966ee" },
            { icon: <TrendingUp size={18}/>, label: "Ваш баланс", value: data.user_investment > 0 ? `${data.user_investment.toFixed(2)} $` : "—", sub: data.user_investment > 0 ? "инвестировано" : "нет данных", color: "#22c97a" },
            { icon: data.user_pnl >= 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>, label: "Чистый доход", value: data.user_investment > 0 ? `${data.user_pnl >= 0 ? "+" : ""}${data.user_pnl.toFixed(2)} $` : "—", sub: data.user_investment > 0 ? `${data.user_pnl_pct >= 0 ? "+" : ""}${data.user_pnl_pct.toFixed(2)}%` : "нет вложений", color: pnlColor },
            ...(data.ref_bonus > 0 ? [{ icon: <TrendingUp size={18}/>, label: "Реф. доход", value: `+${data.ref_bonus.toFixed(2)} $`, sub: "3% от прибыли", color: "#f59e0b" }] : []),
          ].map((c, i) => (
            <div key={i} style={{ ...card, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: c.color }}>
                {c.icon}
                <span style={{ color: "#4a6a9a", fontSize: 11 }}>{c.label}</span>
              </div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{c.value}</p>
              {c.sub && <p style={{ color: "#4a6a9a", fontSize: 11, marginTop: 4 }}>{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Рефералы ─────────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: data.referrals.length > 0 ? 16 : 0 }}>
            <div>
              <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>👥 Мои рефералы</h2>
              <p style={{ color: "#4a6a9a", fontSize: 12 }}>Вы получаете 3% от прибыли каждого приглашённого</p>
            </div>
            <button
              onClick={copyRefLink}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: copied ? "rgba(34,201,122,0.15)" : "rgba(68,136,221,0.12)",
                border: `1px solid ${copied ? "rgba(34,201,122,0.4)" : "rgba(68,136,221,0.3)"}`,
                color: copied ? "#22c97a" : "#4488dd", cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              <Copy size={14} />
              {copied ? "Скопировано!" : "Скопировать реф. ссылку"}
            </button>
          </div>
          {data.referrals.length === 0 ? (
            <p style={{ color: "#4a6a9a", fontSize: 13 }}>Пока никто не зарегистрировался по вашей ссылке</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#4a6a9a" }}>
                    <th style={{ textAlign: "left", paddingBottom: 8, fontWeight: 400 }}>Email</th>
                    <th style={{ textAlign: "right", paddingBottom: 8, fontWeight: 400 }}>Инвестиция</th>
                    <th style={{ textAlign: "right", paddingBottom: 8, fontWeight: 400 }}>Ваш бонус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(0,180,255,0.08)" }}>
                      <td style={{ padding: "8px 0", color: "#fff" }}>{r.email}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", color: "#fff" }}>{r.investment_usdt > 0 ? `${r.investment_usdt.toFixed(2)} $` : "—"}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: r.bonus_usdt > 0 ? "#f59e0b" : "#4a6a9a" }}>{r.bonus_usdt > 0 ? `+${r.bonus_usdt.toFixed(2)} $` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {data.ref_bonus > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "1px solid rgba(0,180,255,0.08)" }}>
                      <td colSpan={2} style={{ paddingTop: 8, color: "#4a6a9a", fontSize: 12 }}>Итого бонус</td>
                      <td style={{ paddingTop: 8, textAlign: "right", fontWeight: 700, color: "#f59e0b" }}>+{data.ref_bonus.toFixed(2)} $</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="two-col">
          <style>{`.two-col { @media (max-width:640px) { grid-template-columns: 1fr !important; } }`}</style>

          {/* ── Позиции ────────────────────────────────────────────────────── */}
          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16 }}>💼 Открытые позиции</h2>
            {data.positions.length === 0
              ? <p style={{ color: "#4a6a9a", fontSize: 13 }}>Позиций нет</p>
              : data.positions.map((p, i) => {
                const cur = p.current_price || p.avg_price;
                const value = p.amount * cur;
                const pnl = p.amount * (cur - p.avg_price);
                const pnlPct = ((cur - p.avg_price) / p.avg_price) * 100;
                const c = pnl >= 0 ? "#22c97a" : "#ff4d4d";
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                    <a href={`https://www.tradingview.com/chart/?symbol=BYBIT:${p.symbol}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#00cfff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>{p.symbol}</a>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#fff", fontSize: 13 }}>{value.toFixed(2)} $</p>
                      <p style={{ color: "#4a6a9a", fontSize: 11 }}>avg ${p.avg_price.toFixed(4)} · тек. ${cur.toFixed(4)}</p>
                      <p style={{ color: c, fontSize: 11, fontWeight: 600 }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} $ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</p>
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* ── Последние сделки ───────────────────────────────────────────── */}
          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16 }}>📋 Последние сделки</h2>
            {data.recent_trades.length === 0
              ? <p style={{ color: "#4a6a9a", fontSize: 13 }}>Сделок нет</p>
              : data.recent_trades.slice(0, 8).map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: (ACTION_COLOR[t.action] ?? "#888") + "22", color: ACTION_COLOR[t.action] ?? "#888" }}>{ACTION_LABEL[t.action] ?? t.action}</span>
                    <span style={{ color: "#fff", fontSize: 13 }}>{t.symbol}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {t.action === "DEPOSIT"
                      ? <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>+{t.amount.toFixed(2)} USDT</p>
                      : <>
                          <p style={{ color: "#fff", fontSize: 13 }}>${t.price.toFixed(4)}</p>
                          {t.pnl != null && <p style={{ color: t.pnl >= 0 ? "#22c97a" : "#ff4d4d", fontSize: 11 }}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}$</p>}
                        </>
                    }
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── Лента ИИ ─────────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 20 }}>
          <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16 }}>🧠 Лента решений ИИ</h2>
          {data.ai_feed.length === 0
            ? <p style={{ color: "#4a6a9a", fontSize: 13 }}>Решений пока нет</p>
            : data.ai_feed.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: ACTION_COLOR[a.action] + "22", color: ACTION_COLOR[a.action], alignSelf: "flex-start", marginTop: 2, whiteSpace: "nowrap" }}>{a.action}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{a.symbol}</span>
                    <span style={{ color: "#4a6a9a", fontSize: 11 }}>{a.timestamp}</span>
                  </div>
                  <p style={{ color: "#4a6a9a", fontSize: 12, lineHeight: 1.5 }}>{a.reason}</p>
                </div>
              </div>
            ))
          }
        </div>

        {/* ── Заявки на пополнение ─────────────────────────────────────────── */}
        {myDeposits.length > 0 && (
          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16 }}>💳 Заявки на пополнение</h2>
            {myDeposits.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,180,255,0.08)" }}>
                <div>
                  <p style={{ color: "#fff", fontWeight: 600 }}>{d.amount.toFixed(2)} USDT</p>
                  <p style={{ color: "#4a6a9a", fontSize: 11 }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                  background: d.status === "approved" ? "rgba(34,201,122,0.12)" : d.status === "rejected" ? "rgba(255,77,77,0.12)" : "rgba(245,158,11,0.12)",
                  color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b",
                  border: `1px solid ${d.status === "approved" ? "rgba(34,201,122,0.3)" : d.status === "rejected" ? "rgba(255,77,77,0.3)" : "rgba(245,158,11,0.3)"}`,
                }}>
                  {d.status === "approved" ? "✓ Подтверждено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.last_updated && (
          <p style={{ textAlign: "center", color: "#2a3a5a", fontSize: 11, paddingBottom: 16 }}>
            Последнее обновление: {new Date(data.last_updated).toLocaleString("ru")}
          </p>
        )}
      </main>

      {/* ── Модал: Пополнение ────────────────────────────────────────────────── */}
      {showDeposit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeposit(false); }}>
          <div style={{ ...card, padding: 24, width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", border: "1px solid rgba(34,201,122,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Пополнение депозита</h2>
              <button onClick={() => setShowDeposit(false)} style={{ color: "#4a6a9a", background: "none", border: "none", cursor: "pointer" }}><X size={20}/></button>
            </div>
            {depositDone ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <p style={{ color: "#fff", fontWeight: 600, marginBottom: 8 }}>Заявка принята!</p>
                <p style={{ color: "#4a6a9a", fontSize: 13, marginBottom: 20 }}>Депозит будет обработан <span style={{ color: "#22c97a" }}>в течение суток.</span></p>
                <button onClick={() => setShowDeposit(false)} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "rgba(34,201,122,0.12)", color: "#22c97a", border: "1px solid rgba(34,201,122,0.3)", cursor: "pointer", fontWeight: 600 }}>Закрыть</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {process.env.NEXT_PUBLIC_WALLET_ADDRESS && (() => {
                  const addr = process.env.NEXT_PUBLIC_WALLET_ADDRESS!;
                  return (
                    <div style={{ background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.2)", borderRadius: 12, padding: 16 }}>
                      <p style={{ color: "#4488dd", fontSize: 12, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{process.env.NEXT_PUBLIC_WALLET_NETWORK || "USDT TRC20"}</p>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <div style={{ background: "#fff", padding: 8, borderRadius: 8 }}><QRCodeSVG value={addr} size={130}/></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,20,0.5)", borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ flex: 1, color: "#4a6a9a", fontSize: 11, wordBreak: "break-all", fontFamily: "monospace" }}>{addr}</p>
                        <button onClick={() => { navigator.clipboard.writeText(addr); setCopiedAddress(true); setTimeout(() => setCopiedAddress(false), 2000); }} style={{ color: copiedAddress ? "#22c97a" : "#4488dd", background: "none", border: "none", cursor: "pointer" }}>
                          {copiedAddress ? <CheckCheck size={15}/> : <Copy size={15}/>}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label style={{ color: "#4a6a9a", fontSize: 12, display: "block", marginBottom: 6 }}>Сумма (USDT)</label>
                  <input type="number" min="1" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="100" autoFocus
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(34,201,122,0.3)", borderRadius: 10, padding: "12px 14px", color: "#e0e8ff", fontSize: 20, fontWeight: 700, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: "#4a6a9a", fontSize: 12, display: "block", marginBottom: 6 }}>Комментарий / TXID (необязательно)</label>
                  <input type="text" value={depositComment} onChange={e => setDepositComment(e.target.value)} placeholder="Хэш транзакции или примечание..."
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.2)", borderRadius: 10, padding: "10px 14px", color: "#e0e8ff", fontSize: 13, outline: "none" }} />
                </div>
                <div style={{ background: "rgba(245,158,11,0.08)", borderLeft: "3px solid #f59e0b", borderRadius: 4, padding: 12, fontSize: 12 }}>
                  <p style={{ color: "#f59e0b", marginBottom: 4 }}>⏳ Заявка обрабатывается в течение суток.</p>
                  <p style={{ color: "#a87a30" }}>⚠️ Учтите комиссию сети — на счёт зачислится фактически полученная сумма.</p>
                </div>
                <button onClick={handleDepositSubmit} disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  style={{ padding: "13px", borderRadius: 10, background: "linear-gradient(180deg,#22c97a,#16a360)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: depositLoading || !depositAmount ? 0.5 : 1 }}>
                  {depositLoading ? "Отправка..." : "Отправить заявку"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Модал: Вывод ─────────────────────────────────────────────────────── */}
      {showWithdraw && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowWithdraw(false); }}>
          <div style={{ ...card, padding: 24, width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", border: "1px solid rgba(255,153,68,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Вывод средств</h2>
              <button onClick={() => setShowWithdraw(false)} style={{ color: "#4a6a9a", background: "none", border: "none", cursor: "pointer" }}><X size={20}/></button>
            </div>
            {withdrawDone ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <p style={{ color: "#fff", fontWeight: 700, marginBottom: 8 }}>Заявка отправлена</p>
                <p style={{ color: "#4a6a9a", fontSize: 13, marginBottom: 20 }}>Администратор обработает её в течение суток.</p>
                <button onClick={() => setShowWithdraw(false)} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "linear-gradient(180deg,#ff9944,#cc6600)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Закрыть</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ color: "#4a6a9a", fontSize: 12, display: "block", marginBottom: 6 }}>Сумма вывода (USDT)</label>
                  <input type="number" min="1" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="100"
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(255,153,68,0.3)", borderRadius: 10, padding: "12px 14px", color: "#e0e8ff", fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: "#4a6a9a", fontSize: 12, display: "block", marginBottom: 6 }}>Адрес кошелька / комментарий</label>
                  <input type="text" value={withdrawComment} onChange={e => setWithdrawComment(e.target.value)} placeholder="TRC20 адрес или примечание..."
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.2)", borderRadius: 10, padding: "10px 14px", color: "#e0e8ff", fontSize: 13, outline: "none" }} />
                </div>
                <div style={{ background: "rgba(255,153,68,0.08)", borderLeft: "3px solid #ff9944", borderRadius: 4, padding: 12, fontSize: 12 }}>
                  <p style={{ color: "#ff9944" }}>⏳ Заявка обрабатывается в течение суток.</p>
                </div>
                <button onClick={handleWithdrawSubmit} disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  style={{ padding: "13px", borderRadius: 10, background: "linear-gradient(180deg,#ff9944,#cc6600)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: withdrawLoading || !withdrawAmount ? 0.5 : 1 }}>
                  {withdrawLoading ? "Отправка..." : "Отправить заявку"}
                </button>
                {myWithdrawals.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(0,180,255,0.08)", paddingTop: 12 }}>
                    <p style={{ color: "#4a6a9a", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>МОИ ЗАЯВКИ НА ВЫВОД</p>
                    {myWithdrawals.map(w => (
                      <div key={w.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                        <span style={{ color: "#4a6a9a" }}>{new Date(w.created_at).toLocaleDateString("ru")}</span>
                        <span style={{ color: "#fff" }}>{w.amount} USDT</span>
                        <span style={{ color: w.status === "approved" ? "#22c97a" : w.status === "rejected" ? "#ff4d4d" : "#f59e0b" }}>
                          {w.status === "approved" ? "Выплачено" : w.status === "rejected" ? "Отклонено" : "Ожидает"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
