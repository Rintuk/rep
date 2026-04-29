"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import {
  getAdminOverview, getAdminForexOverview,
  approveUser, rejectUser,
  updateUserFinancials, updateUserForexFinancials, setReferralLimit,
  deleteUser, getUserDetail, resetUserPassword,
  getAdminDeposits, approveDeposit, rejectDeposit, getAdminPoolHistory,
  getAdminWithdrawals, approveWithdrawal, rejectWithdrawal, getUserHistory,
  cleanupDemoSnapshots, adjustNetInvested,
  getAdminForexDeposits, approveForexDeposit, rejectForexDeposit, getAdminForexPoolHistory,
  getAdminForexWithdrawals, approveForexWithdrawal, rejectForexWithdrawal,
  cleanupForexDemoSnapshots, adjustForexNetInvested,
} from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Activity, Users, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Trash2, Save } from "lucide-react";

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

interface Overview {
  pool_total: number; pool_free: number; pool_positions_usdt: number;
  server_online: boolean; drawdown_pct: number; hwm: number; last_updated: string | null;
  investors_count: number; pending_count: number;
  total_invested: number; total_withdrawn: number;
  admin_income: number; admin_own_capital: number; admin_own_pnl: number; admin_total_income: number; pool_profit: number;
  pool_pnl_usdt: number; pool_pnl_pct: number; real_start_balance: number; net_invested_pool: number;
  positions: { symbol: string; amount: number; avg_price: number; current_price: number; value: number }[];
  trades: { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string }[];
  ai_feed: { timestamp: string; action: string; symbol: string; reason: string }[];
  investors: { id: string; email: string; created_at: string; investment: number; withdrawal: number; pnl: number; referrals_count: number; ref_income: number }[];
  referrals: { id: string; email: string; is_active: boolean; referred_by_email: string; investment: number }[];
  pending_users: { id: string; email: string; created_at: string }[];
}

interface InvestorForm {
  investment_usdt: string;
  withdrawal_usdt: string;
  note: string;
  referral_limit: string;
  forex_investment_usdt: string;
  forex_withdrawal_usdt: string;
}

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
          ctx.strokeStyle = `rgba(0,${140 + pulse * 60},${200 + pulse * 55},${0.03 + pulse * 0.02})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        const pulse = (Math.sin(t * 1.5 + i * 0.7) + 1) / 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,180,255,${0.04 + pulse * 0.04})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

export default function AdminPage() {
  const router = useRouter();
  const [activePool, setActivePool] = useState<"crypto" | "forex">("crypto");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "investors" | "referrals" | "trades" | "ai" | "deposits" | "withdrawals">("overview");
  const [deposits, setDeposits] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [withdrawals, setWithdrawals] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [poolHistory, setPoolHistory] = useState<{ts:string;pool_total:number;pnl:number;pnl_pct:number}[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, InvestorForm>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [forexSavingId, setForexSavingId] = useState<string | null>(null);
  const [forexSaveMsg, setForexSaveMsg] = useState<Record<string, string>>({});
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});
  const [confirmingDeposit, setConfirmingDeposit] = useState<string | null>(null);
  const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
  const [confirmingWithdrawal, setConfirmingWithdrawal] = useState<string | null>(null);
  const [actualWithdrawAmounts, setActualWithdrawAmounts] = useState<Record<string, string>>({});
  const [historyUser, setHistoryUser] = useState<{email:string;id:string} | null>(null);
  const [historyData, setHistoryData] = useState<{deposits:{id:string;amount:number;comment:string;status:string;pool_type:string;created_at:string}[];withdrawals:{id:string;amount:number;comment:string;status:string;pool_type:string;created_at:string}[]} | null>(null);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [activePool]);

  async function fetchData() {
    try {
      const isForex = activePool === "forex";
      const [d, dep, wdr] = await Promise.all([
        isForex ? getAdminForexOverview() : getAdminOverview(),
        isForex ? getAdminForexDeposits() : getAdminDeposits(),
        isForex ? getAdminForexWithdrawals() : getAdminWithdrawals(),
      ]);
      setData(d);
      setDeposits(dep);
      setWithdrawals(wdr);
    } catch {
      setError("Нет доступа или ошибка загрузки");
    } finally {
      setLoading(false);
    }
    try {
      const hist = activePool === "forex" ? await getAdminForexPoolHistory() : await getAdminPoolHistory();
      setPoolHistory(hist);
    } catch { /* график недоступен */ }
  }

  async function handleApproveDeposit(id: string) {
    const amount = parseFloat(actualAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    if (activePool === "forex") await approveForexDeposit(id, amount);
    else await approveDeposit(id, amount);
    setConfirmingDeposit(null);
    fetchData();
  }

  async function handleRejectDeposit(id: string) {
    if (!confirm("Отклонить заявку?")) return;
    if (activePool === "forex") await rejectForexDeposit(id);
    else await rejectDeposit(id);
    fetchData();
  }

  async function handleApproveWithdrawal(id: string) {
    const amount = parseFloat(actualWithdrawAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    if (activePool === "forex") await approveForexWithdrawal(id, amount);
    else await approveWithdrawal(id, amount);
    setConfirmingWithdrawal(null);
    fetchData();
  }

  async function handleRejectWithdrawal(id: string) {
    if (!confirm("Отклонить заявку на вывод?")) return;
    if (activePool === "forex") await rejectForexWithdrawal(id);
    else await rejectWithdrawal(id);
    fetchData();
  }

  async function openHistory(userId: string, email: string) {
    setHistoryUser({ id: userId, email });
    setHistoryData(null);
    const data = await getUserHistory(userId);
    setHistoryData(data);
  }

  async function handleApprove(id: string) { await approveUser(id); fetchData(); }
  async function handleReject(id: string) {
    if (!confirm("Отклонить и удалить пользователя?")) return;
    await rejectUser(id); fetchData();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!forms[id]) {
      try {
        const detail = await getUserDetail(id);
        setForms(prev => ({ ...prev, [id]: {
          investment_usdt: String(detail.investment_usdt ?? 0),
          withdrawal_usdt: String(detail.withdrawal_usdt ?? 0),
          note: detail.note ?? "",
          referral_limit: String(detail.referral_limit ?? 5),
          forex_investment_usdt: String(detail.forex_investment_usdt ?? 0),
          forex_withdrawal_usdt: String(detail.forex_withdrawal_usdt ?? 0),
        }}));
      } catch {
        setForms(prev => ({ ...prev, [id]: { investment_usdt: "0", withdrawal_usdt: "0", note: "", referral_limit: "5", forex_investment_usdt: "0", forex_withdrawal_usdt: "0" } }));
      }
    }
  }

  function updateForm(id: string, field: keyof InvestorForm, value: string) {
    setForms(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSave(id: string) {
    const f = forms[id];
    if (!f) return;
    setSavingId(id);
    try {
      await updateUserFinancials(id, parseFloat(f.investment_usdt) || 0, parseFloat(f.withdrawal_usdt) || 0, f.note);
      await setReferralLimit(id, parseInt(f.referral_limit) || 5);
      setSaveMsg(prev => ({ ...prev, [id]: "✓ Сохранено" }));
      setTimeout(() => setSaveMsg(prev => ({ ...prev, [id]: "" })), 2000);
      fetchData();
    } catch {
      setSaveMsg(prev => ({ ...prev, [id]: "✗ Ошибка" }));
    } finally { setSavingId(null); }
  }

  async function handleForexSave(id: string) {
    const f = forms[id];
    if (!f) return;
    setForexSavingId(id);
    try {
      await updateUserForexFinancials(id, parseFloat(f.forex_investment_usdt) || 0, parseFloat(f.forex_withdrawal_usdt) || 0, f.note);
      await setReferralLimit(id, parseInt(f.referral_limit) || 5);
      setForexSaveMsg(prev => ({ ...prev, [id]: "✓ Сохранено" }));
      setTimeout(() => setForexSaveMsg(prev => ({ ...prev, [id]: "" })), 2000);
      fetchData();
    } catch {
      setForexSaveMsg(prev => ({ ...prev, [id]: "✗ Ошибка" }));
    } finally { setForexSavingId(null); }
  }

  async function handleResetPassword(id: string) {
    const pwd = newPasswords[id]?.trim();
    if (!pwd || pwd.length < 6) { setResetMsg(prev => ({ ...prev, [id]: "✗ Минимум 6 символов" })); return; }
    try {
      await resetUserPassword(id, pwd);
      setNewPasswords(prev => ({ ...prev, [id]: "" }));
      setResetMsg(prev => ({ ...prev, [id]: "✓ Пароль изменён" }));
      setTimeout(() => setResetMsg(prev => ({ ...prev, [id]: "" })), 2000);
    } catch { setResetMsg(prev => ({ ...prev, [id]: "✗ Ошибка" })); }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Удалить пользователя ${email}? Это действие необратимо.`)) return;
    try { await deleteUser(id); setExpandedId(null); fetchData(); }
    catch { alert("Ошибка удаления"); }
  }

  const card: React.CSSProperties = {
    background: "rgba(8,12,35,0.85)",
    border: "1px solid rgba(0,180,255,0.12)",
    borderRadius: 14,
    backdropFilter: "blur(12px)",
  };
  const border = "rgba(0,180,255,0.12)";
  const muted = "#6b7bb0";
  const inputStyle: React.CSSProperties = {
    background: "rgba(5,10,30,0.9)",
    border: "1px solid rgba(0,180,255,0.2)",
    borderRadius: 8, color: "#e0e8ff", padding: "8px 12px",
    fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
  };

  const isForex = activePool === "forex";
  const poolColor = isForex ? "#f59e0b" : "#4488dd";
  const poolLabel = isForex ? "Форекс Пул" : "Крипто Пул";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircuitBackground />
      <div style={{ textAlign: "center", color: muted, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <p>Загрузка панели...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircuitBackground />
      <p style={{ color: "#ff4d4d", position: "relative", zIndex: 1 }}>{error}</p>
    </div>
  );

  if (!data) return null;

  const pnlColor = data.drawdown_pct >= 0 ? "#22c97a" : "#ff4d4d";
  const pendingDeposits = deposits.filter(d => d.status === "pending").length;
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").length;
  const TABS = [
    { key: "overview",    label: "📊 Обзор" },
    { key: "investors",   label: `👥 Инв. (${data.investors_count})` },
    { key: "deposits",    label: "💳 Пополнения", badge: pendingDeposits },
    { key: "withdrawals", label: "💸 Выводы", badge: pendingWithdrawals },
    { key: "referrals",   label: `🔗 Реф. (${data.referrals.length})` },
    { key: "trades",      label: "📋 Сделки" },
    ...(!isForex ? [{ key: "ai", label: "🧠 ИИ" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", position: "relative" }}>
      <CircuitBackground />
      <style>{`
        input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 1000px rgba(5,10,30,0.95) inset !important;
          -webkit-text-fill-color:#e0e8ff !important;
        }
        .adm-tab-btn:hover { opacity: 0.85; }
        .adm-row:hover { background: rgba(0,180,255,0.04) !important; }
      `}</style>

      {/* Шапка */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(5,8,25,0.92)",
        borderBottom: "1px solid rgba(0,180,255,0.15)",
        backdropFilter: "blur(16px)",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Левый блок */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 16, lineHeight: 1, letterSpacing: 0.5 }}>Панель администратора</h1>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, marginTop: 3, display: "inline-block",
              background: data.server_online ? "rgba(34,201,122,0.15)" : "rgba(255,77,77,0.15)",
              color: data.server_online ? "#22c97a" : "#ff4d4d",
            }}>
              {data.server_online ? "● Server ONLINE" : "● Server OFFLINE"}
            </span>
          </div>
        </div>

        {/* Правый блок */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pendingDeposits > 0 && (
            <button onClick={() => setActiveTab("deposits")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px",
                borderRadius: 8, border: "1px solid rgba(245,158,11,0.33)", color: "#f59e0b",
                background: "rgba(26,18,0,0.6)", cursor: "pointer" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
              <span>{pendingDeposits} заявк{pendingDeposits === 1 ? "а" : pendingDeposits < 5 ? "и" : ""}</span>
            </button>
          )}
          <button onClick={fetchData}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px",
              borderRadius: 8, border: "1px solid rgba(0,180,255,0.2)", color: muted,
              background: "transparent", cursor: "pointer" }}>
            <RefreshCw size={13} /><span>Обновить</span>
          </button>
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }}
            style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8,
              border: "1px solid rgba(255,77,77,0.33)", color: "#ff4d4d",
              background: "transparent", cursor: "pointer" }}>
            Выйти
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>

        {/* Переключатель пулов */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["crypto", "forex"] as const).map(pool => (
            <button key={pool} onClick={() => { setActivePool(pool); setActiveTab("overview"); }}
              style={{
                padding: "9px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${activePool === pool
                  ? (pool === "forex" ? "rgba(245,158,11,0.7)" : "rgba(68,136,221,0.7)")
                  : "rgba(255,255,255,0.1)"}`,
                background: activePool === pool
                  ? (pool === "forex" ? "rgba(245,158,11,0.18)" : "rgba(68,136,221,0.18)")
                  : "rgba(255,255,255,0.03)",
                color: activePool === pool
                  ? (pool === "forex" ? "#f59e0b" : "#4488dd")
                  : muted,
                transition: "all 0.2s",
              }}>
              {pool === "crypto" ? "₿ Крипто Пул" : "💱 Форекс Пул"}
            </button>
          ))}
        </div>

        {/* Ожидают одобрения */}
        {data.pending_users.length > 0 && (
          <div style={{ ...card, padding: 16, border: "1px solid rgba(245,158,11,0.27)", background: "rgba(26,18,0,0.7)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
              <h2 style={{ color: "#f59e0b", fontWeight: 600, fontSize: 14 }}>Ожидают одобрения ({data.pending_users.length})</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.pending_users.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: 10, background: "rgba(10,8,0,0.6)" }}>
                  <div>
                    <p style={{ color: "#fff", fontWeight: 500 }}>{u.email}</p>
                    <p style={{ fontSize: 11, color: muted }}>{new Date(u.created_at).toLocaleString("ru")}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleApprove(u.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "6px 12px", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                      <CheckCircle size={13} /> Одобрить
                    </button>
                    <button onClick={() => handleReject(u.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "6px 12px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                      <XCircle size={13} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Карточки метрик */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { icon: <Wallet size={18} />, label: "Общий пул", value: `${data.pool_total.toFixed(2)} $`, sub: `свободно: ${data.pool_free.toFixed(2)} $`, color: poolColor },
            { icon: <Activity size={18} />, label: "Пул в позициях", value: `${data.pool_positions_usdt.toFixed(2)} $`, sub: `вложено: ${data.total_invested.toFixed(2)} $`, color: "#9966ee" },
            { icon: <Users size={18} />, label: "Участников", value: `${data.investors_count}`, sub: `инвестиции: ${data.total_invested.toFixed(2)} $`, color: "#22c97a" },
            { icon: data.pool_pnl_usdt >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />, label: "Доход от торговли", value: `${data.pool_pnl_usdt >= 0 ? "+" : ""}${data.pool_pnl_usdt.toFixed(2)} $`, sub: `${data.pool_pnl_pct >= 0 ? "+" : ""}${data.pool_pnl_pct.toFixed(2)}% · итого: ${data.admin_total_income >= 0 ? "+" : ""}${data.admin_total_income.toFixed(2)} $`, color: data.pool_pnl_usdt >= 0 ? "#22c97a" : "#ff4d4d" },
          ].map((c, i) => (
            <div key={i} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: c.color }}>
                {c.icon}
                <span style={{ fontSize: 11, color: muted }}>{c.label}</span>
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{c.value}</p>
              <p style={{ fontSize: 11, marginTop: 4, color: muted }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Табы */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: `1px solid ${border}` }}>
          {TABS.map(t => (
            <button key={t.key} className="adm-tab-btn" onClick={() => setActiveTab(t.key as typeof activeTab)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500,
                borderRadius: "8px 8px 0 0", cursor: "pointer", border: "none",
                color: activeTab === t.key ? "#fff" : muted,
                background: activeTab === t.key ? "rgba(8,12,35,0.9)" : "transparent",
                borderBottom: activeTab === t.key ? `2px solid ${poolColor}` : "2px solid transparent",
              }}>
              {t.label}
              {"badge" in t && (t.badge ?? 0) > 0 && (
                <span style={{ fontSize: 11, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: "#f59e0b", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* График PnL */}
        {activeTab === "overview" && poolHistory.length > 1 && (() => {
          const lastPnl = poolHistory[poolHistory.length - 1]?.pnl ?? 0;
          const chartColor = lastPnl >= 0 ? "#22c97a" : "#ff4d4d";
          const minPnl = Math.min(...poolHistory.map(p => p.pnl));
          const maxPnl = Math.max(...poolHistory.map(p => p.pnl));
          return (
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>📈 Доход от торговли (история) — {poolLabel}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <span style={{ color: muted }}>Точек: {poolHistory.length}</span>
                  <span style={{ fontWeight: 600, color: chartColor }}>
                    {lastPnl >= 0 ? "+" : ""}{lastPnl.toFixed(2)} $ ({poolHistory[poolHistory.length - 1]?.pnl_pct >= 0 ? "+" : ""}{poolHistory[poolHistory.length - 1]?.pnl_pct.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={poolHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGradAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="ts" tick={{ fill: "#6b7bb0", fontSize: 11 }} tickLine={false} axisLine={false} interval={Math.floor(poolHistory.length / 6)} />
                  <YAxis tick={{ fill: "#6b7bb0", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}$`}
                    domain={[minPnl - Math.abs(minPnl) * 0.1, maxPnl + Math.abs(maxPnl) * 0.1]} />
                  <Tooltip contentStyle={{ background: "#0c0e28", border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: muted }}
                    formatter={(v) => { const n = Number(v); return [`${n >= 0 ? "+" : ""}${n.toFixed(2)} $`, "PnL"]; }} />
                  <ReferenceLine y={0} stroke="#ffffff20" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="pnl" stroke={chartColor} strokeWidth={2}
                    fill="url(#pnlGradAdmin)" dot={false} activeDot={{ r: 4, fill: chartColor }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Обзор */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <h2 style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>💼 Открытые позиции</h2>
              {data.positions.length === 0
                ? <p style={{ color: muted, fontSize: 13 }}>Позиций нет</p>
                : data.positions.map((p, i) => {
                  const cur = p.current_price > 0 ? p.current_price : p.avg_price;
                  const pnl = p.amount * (cur - p.avg_price);
                  const pnlPct = ((cur - p.avg_price) / p.avg_price) * 100;
                  const pc = pnl >= 0 ? "#22c97a" : "#ff4d4d";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                      <a href={`https://www.tradingview.com/chart/?symbol=BYBIT:${p.symbol}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#fff", fontWeight: 500, textDecoration: "none" }}>{p.symbol}</a>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: "#fff", fontSize: 13 }}>{p.value.toFixed(2)} $</p>
                        <p style={{ color: muted, fontSize: 11 }}>avg ${p.avg_price.toFixed(4)} · тек. ${cur.toFixed(4)}</p>
                        <p style={{ color: pc, fontSize: 11, fontWeight: 600 }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} $ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
            <div style={{ ...card, padding: 20 }}>
              <h2 style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>📈 Статистика пула</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Пул всего", value: `${data.pool_total.toFixed(2)} $` },
                  { label: "Свободно USDT", value: `${data.pool_free.toFixed(2)} $` },
                  { label: "В позициях", value: `${data.pool_positions_usdt.toFixed(2)} $` },
                  { label: "HWM (пик)", value: `${data.hwm.toFixed(2)} $` },
                  { label: "Изменение от HWM", value: `${data.drawdown_pct >= 0 ? "+" : ""}${data.drawdown_pct.toFixed(2)}%`, color: pnlColor },
                  { label: "Стартовый депозит", value: `${data.real_start_balance.toFixed(2)} $` },
                  { label: "Чистый вклад", value: `${data.net_invested_pool.toFixed(2)} $` },
                  { label: "Доход от торговли", value: `${data.pool_pnl_usdt >= 0 ? "+" : ""}${data.pool_pnl_usdt.toFixed(2)} $ (${data.pool_pnl_pct >= 0 ? "+" : ""}${data.pool_pnl_pct.toFixed(2)}%)`, color: data.pool_pnl_usdt >= 0 ? "#22c97a" : "#ff4d4d" },
                  { label: "Расч. прибыль инвесторов", value: `${data.pool_profit >= 0 ? "+" : ""}${data.pool_profit.toFixed(2)} $`, color: data.pool_profit >= 0 ? poolColor : "#ff4d4d" },
                  { label: "Мой доход (20%)", value: `${data.admin_income >= 0 ? "+" : ""}${data.admin_income.toFixed(2)} $`, color: data.admin_income > 0 ? "#22c97a" : "#888" },
                  { label: "Мой капитал в пуле", value: `${data.admin_own_capital.toFixed(2)} $` },
                  { label: "Доход с моего капитала", value: `${data.admin_own_pnl >= 0 ? "+" : ""}${data.admin_own_pnl.toFixed(2)} $`, color: data.admin_own_pnl >= 0 ? "#22c97a" : "#ff4d4d" },
                  { label: "Итого мой доход", value: `${data.admin_total_income >= 0 ? "+" : ""}${data.admin_total_income.toFixed(2)} $`, color: data.admin_total_income >= 0 ? "#22c97a" : "#ff4d4d" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: muted }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.color || "#fff" }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Очистка демо */}
        {activeTab === "overview" && (
          <div style={{ ...card, padding: 16, border: "1px solid rgba(255,77,77,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>🧹 Очистка демо-снимков ({poolLabel})</p>
                <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Удаляет аномальные снимки и сбрасывает точки входа инвесторов.</p>
                {cleanupMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{cleanupMsg}</p>}
              </div>
              <button
                onClick={async () => {
                  if (!confirm("Удалить демо-снимки и сбросить точки входа инвесторов?")) return;
                  setCleanupLoading(true); setCleanupMsg(null);
                  try {
                    const r = isForex ? await cleanupForexDemoSnapshots() : await cleanupDemoSnapshots();
                    setCleanupMsg(r.message); fetchData();
                  } catch { setCleanupMsg("Ошибка"); }
                  finally { setCleanupLoading(false); }
                }}
                disabled={cleanupLoading}
                style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "rgba(127,29,29,0.7)", color: "#fca5a5", cursor: "pointer", border: "none",
                  opacity: cleanupLoading ? 0.5 : 1 }}>
                {cleanupLoading ? "..." : "Очистить"}
              </button>
            </div>
          </div>
        )}

        {/* Корректировка net_invested */}
        {activeTab === "overview" && (
          <div style={{ ...card, padding: 16, border: `1px solid ${isForex ? "rgba(245,158,11,0.25)" : "rgba(68,136,221,0.25)"}` }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💰 Корректировка депозита в пул ({poolLabel})</p>
            <p style={{ color: muted, fontSize: 12, marginBottom: 10 }}>
              Если в пул добавлен капитал напрямую — введи сумму в USDT. Значение прибавится ко всем снимкам.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                placeholder="Сумма депозита в USDT"
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", outline: "none" }} />
              <button disabled={adjustLoading || !adjustAmount}
                onClick={async () => {
                  const amt = parseFloat(adjustAmount);
                  if (!amt || isNaN(amt)) return;
                  if (!confirm(`Прибавить ${amt} $ к net_invested во всех снимках?`)) return;
                  setAdjustLoading(true); setAdjustMsg(null);
                  try {
                    const r = isForex ? await adjustForexNetInvested(amt) : await adjustNetInvested(amt);
                    setAdjustMsg(r.message); setAdjustAmount(""); fetchData();
                  } catch { setAdjustMsg("Ошибка"); }
                  finally { setAdjustLoading(false); }
                }}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                  background: isForex ? "rgba(245,158,11,0.6)" : "rgba(68,136,221,0.6)", color: "#fff",
                  cursor: "pointer", opacity: (adjustLoading || !adjustAmount) ? 0.5 : 1 }}>
                {adjustLoading ? "..." : "Применить"}
              </button>
            </div>
            {adjustMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 8 }}>{adjustMsg}</p>}
          </div>
        )}

        {/* Инвесторы */}
        {activeTab === "investors" && (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {["Email", "Инвестировано", "Выведено", "PnL", "Реф. доход", "Рефералов", "Дата", ""].map((h, i) => (
                      <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.investors.length === 0
                    ? <tr><td colSpan={8} style={{ padding: "24px 16px", textAlign: "center", color: muted }}>Инвесторов нет</td></tr>
                    : data.investors.map((u) => {
                      const isOpen = expandedId === u.id;
                      const f = forms[u.id];
                      return (
                        <React.Fragment key={u.id}>
                          <tr className="adm-row" style={{ borderBottom: `1px solid ${border}`, background: isOpen ? "rgba(4,8,28,0.8)" : "transparent" }}>
                            <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{u.email}</td>
                            <td style={{ padding: "12px 16px", color: "#fff" }}>{u.investment.toFixed(2)} $</td>
                            <td style={{ padding: "12px 16px", color: muted }}>{u.withdrawal.toFixed(2)} $</td>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: u.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
                              {u.pnl >= 0 ? "+" : ""}{u.pnl.toFixed(2)} $
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: u.ref_income > 0 ? "#f59e0b" : muted }}>
                              {u.ref_income > 0 ? `+${u.ref_income.toFixed(2)} $` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#fff" }}>{u.referrals_count}</td>
                            <td style={{ padding: "12px 16px", fontSize: 11, color: muted }}>{new Date(u.created_at).toLocaleDateString("ru")}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => toggleExpand(u.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${isOpen ? poolColor : "rgba(68,136,221,0.33)"}`, color: poolColor, background: "transparent", cursor: "pointer" }}>
                                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  {isOpen ? "Свернуть" : "Управление"}
                                </button>
                                <button onClick={() => openHistory(u.id, u.email)}
                                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,153,68,0.33)", color: "#ff9944", background: "transparent", cursor: "pointer" }}>
                                  📋 История
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: "rgba(3,6,22,0.95)" }}>
                              <td colSpan={8} style={{ padding: "20px 24px" }}>
                                {!f ? (
                                  <p style={{ color: muted, fontSize: 13 }}>Загрузка...</p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                    {/* Пул-зависимые поля */}
                                    {!isForex ? (
                                      <div>
                                        <p style={{ color: "#4488dd", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>₿ Крипто Пул</p>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                          {[
                                            { label: "Инвестировано (USDT)", field: "investment_usdt" as keyof InvestorForm },
                                            { label: "Выведено (USDT)", field: "withdrawal_usdt" as keyof InvestorForm },
                                          ].map(({ label, field }) => (
                                            <div key={field}>
                                              <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>{label}</label>
                                              <input type="number" value={f[field]}
                                                onChange={e => updateForm(u.id, field, e.target.value)}
                                                style={inputStyle} />
                                            </div>
                                          ))}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                                          <button onClick={() => handleSave(u.id)} disabled={savingId === u.id}
                                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none", opacity: savingId === u.id ? 0.5 : 1 }}>
                                            <Save size={13} />{savingId === u.id ? "Сохранение..." : "Сохранить крипто"}
                                          </button>
                                          {saveMsg[u.id] && <span style={{ fontSize: 13, fontWeight: 600, color: saveMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>{saveMsg[u.id]}</span>}
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>💱 Форекс Пул</p>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                          {[
                                            { label: "Инвестировано (USDT)", field: "forex_investment_usdt" as keyof InvestorForm, type: "number" },
                                            { label: "Выведено (USDT)", field: "forex_withdrawal_usdt" as keyof InvestorForm, type: "number" },
                                            { label: "Лимит рефералов", field: "referral_limit" as keyof InvestorForm, type: "number" },
                                            { label: "Заметка", field: "note" as keyof InvestorForm, type: "text" },
                                          ].map(({ label, field, type }) => (
                                            <div key={field}>
                                              <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>{label}</label>
                                              <input type={type} value={f[field]}
                                                onChange={e => updateForm(u.id, field, e.target.value)}
                                                style={{ ...inputStyle, border: "1px solid rgba(245,158,11,0.3)" }} />
                                            </div>
                                          ))}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                                          <button onClick={() => handleForexSave(u.id)} disabled={forexSavingId === u.id}
                                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(40,30,0,0.8)", color: "#f59e0b", cursor: "pointer", border: "none", opacity: forexSavingId === u.id ? 0.5 : 1 }}>
                                            <Save size={13} />{forexSavingId === u.id ? "Сохранение..." : "Сохранить форекс"}
                                          </button>
                                          {forexSaveMsg[u.id] && <span style={{ fontSize: 13, fontWeight: 600, color: forexSaveMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>{forexSaveMsg[u.id]}</span>}
                                        </div>
                                      </div>
                                    )}

                                    {/* Удалить + смена пароля */}
                                    <div style={{ display: "flex", gap: 12, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
                                      <button onClick={() => handleDelete(u.id, u.email)}
                                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                                        <Trash2 size={13} /> Удалить
                                      </button>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                                      <input type="text" value={newPasswords[u.id] || ""}
                                        onChange={e => setNewPasswords(prev => ({ ...prev, [u.id]: e.target.value }))}
                                        placeholder="Новый пароль..."
                                        style={{ ...inputStyle, width: 200 }} />
                                      <button onClick={() => handleResetPassword(u.id)}
                                        style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(26,26,58,0.8)", color: "#aabbff", cursor: "pointer", border: "none" }}>
                                        Сбросить пароль
                                      </button>
                                      {resetMsg[u.id] && <span style={{ fontSize: 13, fontWeight: 600, color: resetMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>{resetMsg[u.id]}</span>}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Пополнения */}
        {activeTab === "deposits" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {deposits.length === 0 ? (
              <div style={{ ...card, padding: 32, textAlign: "center" }}><p style={{ color: muted }}>Заявок пока нет</p></div>
            ) : deposits.map(d => (
              <div key={d.id} style={{ ...card, padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, border: d.status === "pending" ? "1px solid rgba(245,158,11,0.27)" : `1px solid ${border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{d.email}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: d.status === "approved" ? "rgba(13,58,32,0.8)" : d.status === "rejected" ? "rgba(58,13,13,0.8)" : "rgba(26,18,0,0.8)",
                      color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b" }}>
                      {d.status === "approved" ? "✓ Подтверждено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                    </span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#22c97a", margin: "4px 0" }}>{d.amount.toFixed(2)} USDT</p>
                  {d.comment && <p style={{ fontSize: 13, color: muted }}>💬 {d.comment}</p>}
                  <p style={{ fontSize: 11, color: muted }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                </div>
                {d.status === "pending" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
                    {confirmingDeposit === d.id ? (
                      <>
                        <div>
                          <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 4 }}>Фактически получено (USDT)</label>
                          <input type="number" step="0.01" min="0"
                            value={actualAmounts[d.id] ?? String(d.amount)}
                            onChange={e => setActualAmounts(prev => ({ ...prev, [d.id]: e.target.value }))}
                            style={{ ...inputStyle, border: "1px solid rgba(34,201,122,0.3)" }} autoFocus />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleApproveDeposit(d.id)}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                            <CheckCircle size={13} /> Зачислить
                          </button>
                          <button onClick={() => setConfirmingDeposit(null)}
                            style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "rgba(20,20,40,0.8)", color: muted, cursor: "pointer", border: "none" }}>
                            Отмена
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setConfirmingDeposit(d.id); setActualAmounts(prev => ({ ...prev, [d.id]: String(d.amount) })); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                          <CheckCircle size={14} /> Подтвердить
                        </button>
                        <button onClick={() => handleRejectDeposit(d.id)}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                          <XCircle size={14} /> Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Выводы */}
        {activeTab === "withdrawals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {withdrawals.length === 0 ? (
              <div style={{ ...card, padding: 32, textAlign: "center" }}><p style={{ color: muted }}>Заявок пока нет</p></div>
            ) : withdrawals.map(w => (
              <div key={w.id} style={{ ...card, padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, border: w.status === "pending" ? "1px solid rgba(255,153,68,0.27)" : `1px solid ${border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{w.email}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: w.status === "approved" ? "rgba(13,58,32,0.8)" : w.status === "rejected" ? "rgba(58,13,13,0.8)" : "rgba(26,13,0,0.8)",
                      color: w.status === "approved" ? "#22c97a" : w.status === "rejected" ? "#ff4d4d" : "#ff9944" }}>
                      {w.status === "approved" ? "✓ Выплачено" : w.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                    </span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#ff9944", margin: "4px 0" }}>{w.amount.toFixed(2)} USDT</p>
                  {w.comment && <p style={{ fontSize: 13, color: muted }}>💬 {w.comment}</p>}
                  <p style={{ fontSize: 11, color: muted }}>{new Date(w.created_at).toLocaleString("ru")}</p>
                </div>
                {w.status === "pending" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
                    {confirmingWithdrawal === w.id ? (
                      <>
                        <div>
                          <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 4 }}>Фактически выплачено (USDT)</label>
                          <input type="number" step="0.01" min="0"
                            value={actualWithdrawAmounts[w.id] ?? String(w.amount)}
                            onChange={e => setActualWithdrawAmounts(prev => ({ ...prev, [w.id]: e.target.value }))}
                            style={{ ...inputStyle, border: "1px solid rgba(255,153,68,0.3)" }} autoFocus />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleApproveWithdrawal(w.id)}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(26,13,0,0.8)", color: "#ff9944", cursor: "pointer", border: "none" }}>
                            <CheckCircle size={13} /> Подтвердить вывод
                          </button>
                          <button onClick={() => setConfirmingWithdrawal(null)}
                            style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "rgba(20,20,40,0.8)", color: muted, cursor: "pointer", border: "none" }}>
                            Отмена
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setConfirmingWithdrawal(w.id); setActualWithdrawAmounts(prev => ({ ...prev, [w.id]: String(w.amount) })); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(26,13,0,0.8)", color: "#ff9944", cursor: "pointer", border: "none" }}>
                          <CheckCircle size={14} /> Выплачено
                        </button>
                        <button onClick={() => handleRejectWithdrawal(w.id)}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                          <XCircle size={14} /> Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Рефералы */}
        {activeTab === "referrals" && (
          <div style={{ ...card, overflow: "hidden" }}>
            {data.referrals.length === 0
              ? <p style={{ padding: "24px 20px", color: muted, fontSize: 13 }}>Рефералов пока нет</p>
              : <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      {["Email", "Пригласил", "Инвестиции", "Статус"].map((h, i) => (
                        <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((r) => (
                      <tr key={r.id} className="adm-row" style={{ borderBottom: `1px solid ${border}` }}>
                        <td style={{ padding: "12px 16px", color: "#fff" }}>{r.email}</td>
                        <td style={{ padding: "12px 16px", color: poolColor, fontSize: 13 }}>{r.referred_by_email}</td>
                        <td style={{ padding: "12px 16px", color: "#fff" }}>{r.investment.toFixed(2)} $</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: r.is_active ? "rgba(13,58,32,0.8)" : "rgba(58,32,0,0.8)", color: r.is_active ? "#22c97a" : "#f59e0b" }}>
                            {r.is_active ? "активен" : "ожидает"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </div>
        )}

        {/* Сделки */}
        {activeTab === "trades" && (
          <div style={{ ...card, overflow: "hidden" }}>
            {data.trades.length === 0
              ? <p style={{ padding: "24px 20px", color: muted, fontSize: 13 }}>Сделок нет</p>
              : <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      {["Действие", "Монета", "Цена", "Кол-во", "PnL", "Время"].map((h, i) => (
                        <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.map((t, i) => (
                      <tr key={i} className="adm-row" style={{ borderBottom: `1px solid ${border}` }}>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>{t.action}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{t.symbol}</td>
                        <td style={{ padding: "12px 16px", color: "#fff" }}>${t.price.toFixed(4)}</td>
                        <td style={{ padding: "12px 16px", color: muted }}>{(t.amount || 0).toFixed(6)}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: t.pnl != null ? (t.pnl >= 0 ? "#22c97a" : "#ff4d4d") : muted }}>
                          {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} $` : "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: muted }}>{t.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </div>
        )}

        {/* Лента ИИ */}
        {activeTab === "ai" && (
          <div style={{ ...card, padding: 20 }}>
            {data.ai_feed.length === 0
              ? <p style={{ color: muted, fontSize: 13 }}>Решений пока нет</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {data.ai_feed.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4, background: ACTION_COLOR[a.action] + "22", color: ACTION_COLOR[a.action], alignSelf: "flex-start", marginTop: 2 }}>{a.action}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ color: "#fff", fontWeight: 500, fontSize: 13 }}>{a.symbol}</span>
                        <span style={{ color: muted, fontSize: 11 }}>{a.timestamp}</span>
                      </div>
                      <p style={{ color: muted, fontSize: 13 }}>{a.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {data.last_updated && (
          <p style={{ textAlign: "center", fontSize: 11, color: muted, paddingBottom: 16 }}>
            Последнее обновление бота: {new Date(data.last_updated).toLocaleString("ru")}
          </p>
        )}
      </main>

      {/* Модальное окно — история инвестора */}
      {historyUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryUser(null); }}>
          <div style={{ ...card, padding: 24, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(255,153,68,0.27)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>История операций</h2>
                <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{historyUser.email}</p>
              </div>
              <button onClick={() => setHistoryUser(null)} style={{ color: muted, background: "none", border: "none", cursor: "pointer" }}><XCircle size={22} /></button>
            </div>
            {!historyData ? (
              <p style={{ textAlign: "center", padding: "32px 0", color: muted }}>Загрузка...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h3 style={{ color: "#22c97a", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💳 Пополнения</h3>
                  {historyData.deposits.length === 0
                    ? <p style={{ color: muted, fontSize: 13 }}>Нет записей</p>
                    : historyData.deposits.map(d => (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <p style={{ color: "#fff", fontWeight: 600 }}>+{d.amount.toFixed(2)} USDT</p>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                              background: d.pool_type === "forex" ? "rgba(245,158,11,0.15)" : "rgba(68,136,221,0.15)",
                              color: d.pool_type === "forex" ? "#f59e0b" : "#4488dd" }}>
                              {d.pool_type === "forex" ? "Форекс" : "Крипто"}
                            </span>
                          </div>
                          {d.comment && <p style={{ color: muted, fontSize: 11, marginTop: 2 }}>{d.comment}</p>}
                          <p style={{ color: muted, fontSize: 11 }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                        </div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                          background: d.status === "approved" ? "rgba(13,58,32,0.8)" : d.status === "rejected" ? "rgba(58,13,13,0.8)" : "rgba(26,18,0,0.8)",
                          color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b" }}>
                          {d.status === "approved" ? "✓ Зачислено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                        </span>
                      </div>
                    ))}
                </div>
                <div>
                  <h3 style={{ color: "#ff9944", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💸 Выводы</h3>
                  {historyData.withdrawals.length === 0
                    ? <p style={{ color: muted, fontSize: 13 }}>Нет записей</p>
                    : historyData.withdrawals.map(w => (
                      <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <p style={{ color: "#fff", fontWeight: 600 }}>-{w.amount.toFixed(2)} USDT</p>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                              background: w.pool_type === "forex" ? "rgba(245,158,11,0.15)" : "rgba(68,136,221,0.15)",
                              color: w.pool_type === "forex" ? "#f59e0b" : "#4488dd" }}>
                              {w.pool_type === "forex" ? "Форекс" : "Крипто"}
                            </span>
                          </div>
                          {w.comment && <p style={{ color: muted, fontSize: 11, marginTop: 2 }}>{w.comment}</p>}
                          <p style={{ color: muted, fontSize: 11 }}>{new Date(w.created_at).toLocaleString("ru")}</p>
                        </div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20,
                          background: w.status === "approved" ? "rgba(13,58,32,0.8)" : w.status === "rejected" ? "rgba(58,13,13,0.8)" : "rgba(26,13,0,0.8)",
                          color: w.status === "approved" ? "#22c97a" : w.status === "rejected" ? "#ff4d4d" : "#ff9944" }}>
                          {w.status === "approved" ? "✓ Выплачено" : w.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
