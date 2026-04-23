"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import {
  getAdminOverview, approveUser, rejectUser,
  updateUserFinancials, setReferralLimit, deleteUser, getUserDetail, resetUserPassword,
  getAdminDeposits, approveDeposit, rejectDeposit, getAdminPoolHistory,
  getAdminWithdrawals, approveWithdrawal, rejectWithdrawal, getUserHistory
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
  positions: { symbol: string; amount: number; avg_price: number; value: number }[];
  trades: { symbol: string; action: string; amount: number; price: number; pnl: number | null; timestamp: string }[];
  ai_feed: { timestamp: string; action: string; symbol: string; reason: string }[];
  investors: { id: string; email: string; created_at: string; investment: number; withdrawal: number; pnl: number; referrals_count: number }[];
  referrals: { id: string; email: string; is_active: boolean; referred_by_email: string; investment: number }[];
  pending_users: { id: string; email: string; created_at: string }[];
}

interface InvestorForm {
  investment_usdt: string;
  withdrawal_usdt: string;
  note: string;
  referral_limit: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "investors" | "referrals" | "trades" | "ai" | "deposits" | "withdrawals">("overview");
  const [deposits, setDeposits] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [withdrawals, setWithdrawals] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [poolHistory, setPoolHistory] = useState<{ts:string;pool_total:number;pnl:number;pnl_pct:number}[]>([]);

  // Inline investor management
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, InvestorForm>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});
  const [confirmingDeposit, setConfirmingDeposit] = useState<string | null>(null);
  const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
  const [confirmingWithdrawal, setConfirmingWithdrawal] = useState<string | null>(null);
  const [actualWithdrawAmounts, setActualWithdrawAmounts] = useState<Record<string, string>>({});
  const [historyUser, setHistoryUser] = useState<{email:string;id:string} | null>(null);
  const [historyData, setHistoryData] = useState<{deposits:{id:string;amount:number;comment:string;status:string;created_at:string}[];withdrawals:{id:string;amount:number;comment:string;status:string;created_at:string}[]} | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [d, dep, wdr] = await Promise.all([getAdminOverview(), getAdminDeposits(), getAdminWithdrawals()]);
      setData(d);
      setDeposits(dep);
      setWithdrawals(wdr);
    } catch {
      setError("Нет доступа или ошибка загрузки");
    } finally {
      setLoading(false);
    }
    // График грузим отдельно — его ошибка не должна ломать остальное
    try {
      const hist = await getAdminPoolHistory();
      setPoolHistory(hist);
    } catch {
      // график недоступен — не критично
    }
  }

  async function handleApproveDeposit(id: string) {
    const amount = parseFloat(actualAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    await approveDeposit(id, amount);
    setConfirmingDeposit(null);
    fetchData();
  }

  async function openHistory(userId: string, email: string) {
    setHistoryUser({ id: userId, email });
    setHistoryData(null);
    const data = await getUserHistory(userId);
    setHistoryData(data);
  }

  async function handleApproveWithdrawal(id: string) {
    const amount = parseFloat(actualWithdrawAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    await approveWithdrawal(id, amount);
    setConfirmingWithdrawal(null);
    fetchData();
  }

  async function handleRejectWithdrawal(id: string) {
    if (!confirm("Отклонить заявку на вывод?")) return;
    await rejectWithdrawal(id);
    fetchData();
  }

  async function handleRejectDeposit(id: string) {
    if (!confirm("Отклонить заявку?")) return;
    await rejectDeposit(id);
    fetchData();
  }

  async function handleApprove(id: string) {
    await approveUser(id);
    fetchData();
  }

  async function handleReject(id: string) {
    if (!confirm("Отклонить и удалить пользователя?")) return;
    await rejectUser(id);
    fetchData();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    // Load detail if not already in forms
    if (!forms[id]) {
      try {
        const detail = await getUserDetail(id);
        setForms(prev => ({
          ...prev,
          [id]: {
            investment_usdt: String(detail.investment_usdt ?? 0),
            withdrawal_usdt: String(detail.withdrawal_usdt ?? 0),
            note: detail.note ?? "",
            referral_limit: String(detail.referral_limit ?? 5),
          }
        }));
      } catch {
        setForms(prev => ({
          ...prev,
          [id]: { investment_usdt: "0", withdrawal_usdt: "0", note: "", referral_limit: "5" }
        }));
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
    } finally {
      setSavingId(null);
    }
  }

  async function handleResetPassword(id: string) {
    const pwd = newPasswords[id]?.trim();
    if (!pwd || pwd.length < 6) {
      setResetMsg(prev => ({ ...prev, [id]: "✗ Минимум 6 символов" }));
      return;
    }
    try {
      await resetUserPassword(id, pwd);
      setNewPasswords(prev => ({ ...prev, [id]: "" }));
      setResetMsg(prev => ({ ...prev, [id]: "✓ Пароль изменён" }));
      setTimeout(() => setResetMsg(prev => ({ ...prev, [id]: "" })), 2000);
    } catch {
      setResetMsg(prev => ({ ...prev, [id]: "✗ Ошибка" }));
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Удалить пользователя ${email}? Это действие необратимо.`)) return;
    try {
      await deleteUser(id);
      setExpandedId(null);
      fetchData();
    } catch {
      alert("Ошибка удаления");
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center" style={{ color: "var(--muted)" }}>
        <div className="text-3xl mb-3 animate-pulse">⚡</div>
        <p>Загрузка панели...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <p className="text-red-400">{error}</p>
    </div>
  );

  if (!data) return null;

  const pnlColor = data.drawdown_pct >= 0 ? "#22c97a" : "#ff4d4d";
  const incomeColor = data.admin_income > 0 ? "#22c97a" : "#888";

  const pendingDeposits = deposits.filter(d => d.status === "pending").length;
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").length;
  const TABS = [
    { key: "overview",     label: "📊 Обзор" },
    { key: "investors",    label: `👥 Инв. (${data.investors_count})` },
    { key: "deposits",     label: "💳 Пополнения", badge: pendingDeposits },
    { key: "withdrawals",  label: "💸 Выводы", badge: pendingWithdrawals },
    { key: "referrals",    label: `🔗 Реф. (${data.referrals.length})` },
    { key: "trades",       label: "📋 Сделки" },
    { key: "ai",         label: "🧠 ИИ" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <div>
            <h1 className="font-bold text-white text-lg leading-none">Панель администратора</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: data.server_online ? "#0d3a20" : "#3a0d0d",
              color: data.server_online ? "#22c97a" : "#ff4d4d"
            }}>
              {data.server_online ? "● Server ONLINE" : "● Server OFFLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingDeposits > 0 && (
            <button onClick={() => setActiveTab("deposits")}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition hover:opacity-80"
              style={{ background: "#1a1200", border: "1px solid #f59e0b55", color: "#f59e0b" }}>
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
              <span>{pendingDeposits} заявк{pendingDeposits === 1 ? "а" : pendingDeposits < 5 ? "и" : ""}</span>
            </button>
          )}
          <button onClick={fetchData} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <RefreshCw size={13} /><span className="hidden sm:inline">Обновить</span>
          </button>
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }}
            className="text-sm px-3 py-2 rounded-lg border transition hover:opacity-80"
            style={{ borderColor: "#ff4d4d55", color: "#ff4d4d" }}>
            Выйти
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Ожидают одобрения */}
        {data.pending_users.length > 0 && (
          <div className="rounded-xl border p-4" style={{ background: "#1a1200", borderColor: "#f59e0b55" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
              <h2 className="font-semibold" style={{ color: "#f59e0b" }}>Ожидают одобрения ({data.pending_users.length})</h2>
            </div>
            <div className="space-y-2">
              {data.pending_users.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "#0d0d00" }}>
                  <div>
                    <p className="text-white font-medium">{u.email}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(u.created_at).toLocaleString("ru")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(u.id)}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "#0d3a20", color: "#22c97a" }}>
                      <CheckCircle size={13} /> Одобрить
                    </button>
                    <button onClick={() => handleReject(u.id)}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
                      <XCircle size={13} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Карточки */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Wallet size={20} />, label: "Общий пул", value: `${data.pool_total.toFixed(2)} $`, sub: `свободно: ${data.pool_free.toFixed(2)} $`, color: "#4488dd" },
            { icon: <Activity size={20} />, label: "Пул в позициях", value: `${data.pool_positions_usdt.toFixed(2)} $`, sub: `вложено всего: ${data.total_invested.toFixed(2)} $`, color: "#9966ee" },
            { icon: <Users size={20} />, label: "Участников", value: `${data.investors_count}`, sub: `общие инвестиции: ${data.total_invested.toFixed(2)} $`, color: "#22c97a" },
            { icon: data.pool_pnl_usdt >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />, label: "Доход от торговли", value: `${data.pool_pnl_usdt >= 0 ? "+" : ""}${data.pool_pnl_usdt.toFixed(2)} $`, sub: `${data.pool_pnl_pct >= 0 ? "+" : ""}${data.pool_pnl_pct.toFixed(2)}% · мой итого: ${data.admin_total_income >= 0 ? "+" : ""}${data.admin_total_income.toFixed(2)} $`, color: data.pool_pnl_usdt >= 0 ? "#22c97a" : "#ff4d4d" },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>
                {c.icon}
                <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{c.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Табы */}
        <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium transition rounded-t-lg"
              style={{
                color: activeTab === t.key ? "white" : "var(--muted)",
                background: activeTab === t.key ? "var(--card)" : "transparent",
                borderBottom: activeTab === t.key ? "2px solid #4488dd" : "2px solid transparent",
              }}>
              {t.label}
              {"badge" in t && (t.badge ?? 0) > 0 && (
                <span className="text-xs min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold"
                  style={{ background: "#f59e0b", color: "#000" }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* График PnL пула */}
        {activeTab === "overview" && poolHistory.length > 1 && (() => {
          const lastPnl = poolHistory[poolHistory.length - 1]?.pnl ?? 0;
          const chartColor = lastPnl >= 0 ? "#22c97a" : "#ff4d4d";
          const minPnl = Math.min(...poolHistory.map(p => p.pnl));
          const maxPnl = Math.max(...poolHistory.map(p => p.pnl));
          return (
            <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">📈 Доход от торговли (история)</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span style={{ color: "var(--muted)" }}>Точек: {poolHistory.length}</span>
                  <span className="font-semibold" style={{ color: chartColor }}>
                    {lastPnl >= 0 ? "+" : ""}{lastPnl.toFixed(2)} $ ({poolHistory[poolHistory.length - 1]?.pnl_pct >= 0 ? "+" : ""}{poolHistory[poolHistory.length - 1]?.pnl_pct.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={poolHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="ts" tick={{ fill: "#6b6b8a", fontSize: 11 }} tickLine={false} axisLine={false}
                    interval={Math.floor(poolHistory.length / 6)} />
                  <YAxis tick={{ fill: "#6b6b8a", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}$`}
                    domain={[minPnl - Math.abs(minPnl) * 0.1, maxPnl + Math.abs(maxPnl) * 0.1]} />
                  <Tooltip
                    contentStyle={{ background: "#13132a", border: "1px solid #1e1e40", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#6b6b8a" }}
                    formatter={(v) => { const n = Number(v); return [`${n >= 0 ? "+" : ""}${n.toFixed(2)} $`, "PnL"]; }}
                  />
                  <ReferenceLine y={0} stroke="#ffffff20" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="pnl" stroke={chartColor} strokeWidth={2}
                    fill="url(#pnlGrad)" dot={false} activeDot={{ r: 4, fill: chartColor }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Обзор — позиции */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-white mb-4">💼 Открытые позиции</h2>
              {data.positions.length === 0
                ? <p className="text-sm" style={{ color: "var(--muted)" }}>Позиций нет</p>
                : <div className="space-y-2">
                  {data.positions.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <span className="font-medium text-white">{p.symbol}</span>
                      <div className="text-right">
                        <p className="text-sm text-white">{p.amount.toFixed(6)}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>avg ${p.avg_price.toFixed(4)} · {p.value.toFixed(2)} $</p>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
            <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-white mb-4">📈 Статистика пула</h2>
              <div className="space-y-3">
                {[
                  { label: "Пул всего", value: `${data.pool_total.toFixed(2)} $` },
                  { label: "Свободно USDT", value: `${data.pool_free.toFixed(2)} $` },
                  { label: "В позициях", value: `${data.pool_positions_usdt.toFixed(2)} $` },
                  { label: "HWM (пик)", value: `${data.hwm.toFixed(2)} $` },
                  { label: "Изменение от HWM", value: `${data.drawdown_pct >= 0 ? "+" : ""}${data.drawdown_pct.toFixed(2)}%`, color: pnlColor },
                  { label: "Стартовый депозит", value: `${data.real_start_balance.toFixed(2)} $` },
                  { label: "Чистый вклад (с пополн.)", value: `${data.net_invested_pool.toFixed(2)} $` },
                  { label: "Доход от торговли", value: `${data.pool_pnl_usdt >= 0 ? "+" : ""}${data.pool_pnl_usdt.toFixed(2)} $ (${data.pool_pnl_pct >= 0 ? "+" : ""}${data.pool_pnl_pct.toFixed(2)}%)`, color: data.pool_pnl_usdt >= 0 ? "#22c97a" : "#ff4d4d" },
                  { label: "Расч. прибыль инвесторов", value: `${data.pool_profit >= 0 ? "+" : ""}${data.pool_profit.toFixed(2)} $`, color: data.pool_profit >= 0 ? "#4488dd" : "#ff4d4d" },
                  { label: "Мой доход (20% от инвесторов)", value: `${data.admin_income >= 0 ? "+" : ""}${data.admin_income.toFixed(2)} $`, color: incomeColor },
                  { label: "Мой капитал в пуле", value: `${data.admin_own_capital.toFixed(2)} $` },
                  { label: "Доход с моего капитала", value: `${data.admin_own_pnl >= 0 ? "+" : ""}${data.admin_own_pnl.toFixed(2)} $`, color: data.admin_own_pnl >= 0 ? "#22c97a" : "#ff4d4d" },
                  { label: "Итого мой доход", value: `${data.admin_total_income >= 0 ? "+" : ""}${data.admin_total_income.toFixed(2)} $`, color: data.admin_total_income >= 0 ? "#22c97a" : "#ff4d4d" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: "var(--muted)" }}>{r.label}</span>
                    <span className="text-sm font-semibold" style={{ color: r.color || "white" }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Инвесторы */}
        {activeTab === "investors" && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  {["Email", "Инвестировано", "Выведено", "PnL", "Рефералов", "Дата", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.investors.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>Инвесторов нет</td></tr>
                  : data.investors.map((u) => {
                    const isOpen = expandedId === u.id;
                    const f = forms[u.id];
                    return (
                      <React.Fragment key={u.id}>
                        <tr className="border-b transition"
                          style={{ borderColor: "var(--border)", background: isOpen ? "#0d1a2a" : "transparent" }}>
                          <td className="px-4 py-3 text-white font-medium">{u.email}</td>
                          <td className="px-4 py-3 text-white">{u.investment.toFixed(2)} $</td>
                          <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{u.withdrawal.toFixed(2)} $</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: u.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
                            {u.pnl >= 0 ? "+" : ""}{u.pnl.toFixed(2)} $
                          </td>
                          <td className="px-4 py-3 text-white">{u.referrals_count}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{new Date(u.created_at).toLocaleDateString("ru")}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => toggleExpand(u.id)}
                                className="flex items-center gap-1 text-xs px-3 py-1 rounded border transition hover:opacity-80"
                                style={{ borderColor: isOpen ? "#4488dd" : "#4488dd55", color: "#4488dd" }}>
                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                {isOpen ? "Свернуть" : "Управление"}
                              </button>
                              <button onClick={() => openHistory(u.id, u.email)}
                                className="flex items-center gap-1 text-xs px-3 py-1 rounded border transition hover:opacity-80"
                                style={{ borderColor: "#ff994455", color: "#ff9944" }}>
                                📋 История
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr style={{ background: "#071420" }}>
                            <td colSpan={7} className="px-6 py-5">
                              {!f ? (
                                <p className="text-sm" style={{ color: "var(--muted)" }}>Загрузка...</p>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Инвестировано (USDT)</label>
                                      <input
                                        type="number" step="0.01" min="0"
                                        value={f.investment_usdt}
                                        onChange={e => updateForm(u.id, "investment_usdt", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-blue-500"
                                        style={{ background: "#0d1a2a", borderColor: "var(--border)" }}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Выведено (USDT)</label>
                                      <input
                                        type="number" step="0.01" min="0"
                                        value={f.withdrawal_usdt}
                                        onChange={e => updateForm(u.id, "withdrawal_usdt", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-blue-500"
                                        style={{ background: "#0d1a2a", borderColor: "var(--border)" }}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Лимит рефералов</label>
                                      <input
                                        type="number" min="0"
                                        value={f.referral_limit}
                                        onChange={e => updateForm(u.id, "referral_limit", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-blue-500"
                                        style={{ background: "#0d1a2a", borderColor: "var(--border)" }}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Заметка</label>
                                      <input
                                        type="text"
                                        value={f.note}
                                        onChange={e => updateForm(u.id, "note", e.target.value)}
                                        placeholder="Комментарий..."
                                        className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-blue-500"
                                        style={{ background: "#0d1a2a", borderColor: "var(--border)" }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleSave(u.id)}
                                      disabled={savingId === u.id}
                                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                                      style={{ background: "#0d3a20", color: "#22c97a" }}>
                                      <Save size={13} />
                                      {savingId === u.id ? "Сохранение..." : "Сохранить"}
                                    </button>
                                    <button
                                      onClick={() => handleDelete(u.id, u.email)}
                                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                                      style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
                                      <Trash2 size={13} /> Удалить
                                    </button>
                                    {saveMsg[u.id] && (
                                      <span className="text-sm font-medium" style={{ color: saveMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>
                                        {saveMsg[u.id]}
                                      </span>
                                    )}
                                  </div>
                                  {/* Сброс пароля */}
                                  <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                                    <input
                                      type="text"
                                      value={newPasswords[u.id] || ""}
                                      onChange={e => setNewPasswords(prev => ({ ...prev, [u.id]: e.target.value }))}
                                      placeholder="Новый пароль..."
                                      className="px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-blue-500 w-48"
                                      style={{ background: "#0d1a2a", borderColor: "var(--border)" }}
                                    />
                                    <button
                                      onClick={() => handleResetPassword(u.id)}
                                      className="text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                                      style={{ background: "#1a1a3a", color: "#aabbff" }}>
                                      Сбросить пароль
                                    </button>
                                    {resetMsg[u.id] && (
                                      <span className="text-sm font-medium" style={{ color: resetMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>
                                        {resetMsg[u.id]}
                                      </span>
                                    )}
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

        {/* Заявки на пополнение */}
        {activeTab === "deposits" && (
          <div className="space-y-3">
            {deposits.length === 0 ? (
              <div className="rounded-xl p-8 text-center border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p style={{ color: "var(--muted)" }}>Заявок пока нет</p>
              </div>
            ) : deposits.map(d => (
              <div key={d.id} className="rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ background: "var(--card)", borderColor: d.status === "pending" ? "#f59e0b44" : "var(--border)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{d.email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                      background: d.status === "approved" ? "#0d3a20" : d.status === "rejected" ? "#3a0d0d" : "#1a1200",
                      color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b"
                    }}>
                      {d.status === "approved" ? "✓ Подтверждено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                    </span>
                  </div>
                  <p className="text-xl font-bold mt-1" style={{ color: "#22c97a" }}>{d.amount.toFixed(2)} USDT</p>
                  {d.comment && <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>💬 {d.comment}</p>}
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                </div>
                {d.status === "pending" && (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {confirmingDeposit === d.id ? (
                      <>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Фактически получено (USDT)</label>
                          <input
                            type="number" step="0.01" min="0"
                            value={actualAmounts[d.id] ?? String(d.amount)}
                            onChange={e => setActualAmounts(prev => ({ ...prev, [d.id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-white font-bold border outline-none"
                            style={{ background: "#0d1a2a", borderColor: "#22c97a44" }}
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveDeposit(d.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                            style={{ background: "#0d3a20", color: "#22c97a" }}>
                            <CheckCircle size={13} /> Зачислить
                          </button>
                          <button onClick={() => setConfirmingDeposit(null)}
                            className="text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                            style={{ background: "#1a1a2a", color: "var(--muted)" }}>
                            Отмена
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setConfirmingDeposit(d.id);
                          setActualAmounts(prev => ({ ...prev, [d.id]: String(d.amount) }));
                        }}
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                          style={{ background: "#0d3a20", color: "#22c97a" }}>
                          <CheckCircle size={14} /> Подтвердить
                        </button>
                        <button onClick={() => handleRejectDeposit(d.id)}
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                          style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
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

        {/* Заявки на вывод */}
        {activeTab === "withdrawals" && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="rounded-xl p-8 text-center border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p style={{ color: "var(--muted)" }}>Заявок пока нет</p>
              </div>
            ) : withdrawals.map(w => (
              <div key={w.id} className="rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ background: "var(--card)", borderColor: w.status === "pending" ? "#ff994444" : "var(--border)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{w.email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                      background: w.status === "approved" ? "#0d3a20" : w.status === "rejected" ? "#3a0d0d" : "#1a0d00",
                      color: w.status === "approved" ? "#22c97a" : w.status === "rejected" ? "#ff4d4d" : "#ff9944"
                    }}>
                      {w.status === "approved" ? "✓ Выплачено" : w.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                    </span>
                  </div>
                  <p className="text-xl font-bold mt-1" style={{ color: "#ff9944" }}>{w.amount.toFixed(2)} USDT</p>
                  {w.comment && <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>💬 {w.comment}</p>}
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{new Date(w.created_at).toLocaleString("ru")}</p>
                </div>
                {w.status === "pending" && (
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {confirmingWithdrawal === w.id ? (
                      <>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Фактически выплачено (USDT)</label>
                          <input
                            type="number" step="0.01" min="0"
                            value={actualWithdrawAmounts[w.id] ?? String(w.amount)}
                            onChange={e => setActualWithdrawAmounts(prev => ({ ...prev, [w.id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-white font-bold border outline-none"
                            style={{ background: "#0d1a2a", borderColor: "#ff994444" }}
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveWithdrawal(w.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                            style={{ background: "#1a0d00", color: "#ff9944" }}>
                            <CheckCircle size={13} /> Подтвердить вывод
                          </button>
                          <button onClick={() => setConfirmingWithdrawal(null)}
                            className="text-sm px-3 py-2 rounded-lg transition hover:opacity-80"
                            style={{ background: "#1a1a2a", color: "var(--muted)" }}>
                            Отмена
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setConfirmingWithdrawal(w.id);
                          setActualWithdrawAmounts(prev => ({ ...prev, [w.id]: String(w.amount) }));
                        }}
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                          style={{ background: "#1a0d00", color: "#ff9944" }}>
                          <CheckCircle size={14} /> Выплачено
                        </button>
                        <button onClick={() => handleRejectWithdrawal(w.id)}
                          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition hover:opacity-80"
                          style={{ background: "#3a0d0d", color: "#ff4d4d" }}>
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
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            {data.referrals.length === 0
              ? <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>Рефералов пока нет</p>
              : <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    {["Email", "Пригласил", "Инвестиции", "Статус"].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r, i) => (
                    <tr key={r.id} className="border-b hover:bg-white/5 transition" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3 text-white">{r.email}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4488dd" }}>{r.referred_by_email}</td>
                      <td className="px-4 py-3 text-white">{r.investment.toFixed(2)} $</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: r.is_active ? "#0d3a20" : "#3a2000",
                          color: r.is_active ? "#22c97a" : "#f59e0b"
                        }}>
                          {r.is_active ? "активен" : "ожидает"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            }
          </div>
        )}

        {/* Сделки */}
        {activeTab === "trades" && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            {data.trades.length === 0
              ? <p className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>Сделок нет</p>
              : <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    {["Действие", "Монета", "Цена", "Кол-во", "PnL", "Время"].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((t, i) => (
                    <tr key={i} className="border-b hover:bg-white/5 transition" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>
                          {t.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{t.symbol}</td>
                      <td className="px-4 py-3 text-white">${t.price.toFixed(4)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{(t.amount || 0).toFixed(6)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: t.pnl != null ? (t.pnl >= 0 ? "#22c97a" : "#ff4d4d") : "var(--muted)" }}>
                        {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} $` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{t.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            }
          </div>
        )}

        {/* Лента ИИ */}
        {activeTab === "ai" && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            {data.ai_feed.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Решений пока нет</p>
              : <div className="space-y-3">
                {data.ai_feed.map((a, i) => (
                  <div key={i} className="flex gap-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded self-start mt-0.5"
                      style={{ background: ACTION_COLOR[a.action] + "22", color: ACTION_COLOR[a.action] }}>
                      {a.action}
                    </span>
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
        )}

        {data.last_updated && (
          <p className="text-center text-xs pb-4" style={{ color: "var(--muted)" }}>
            Последнее обновление бота: {new Date(data.last_updated).toLocaleString("ru")}
          </p>
        )}
      </main>

      {/* Модальное окно — история инвестора */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryUser(null); }}>
          <div className="rounded-2xl p-6 w-full max-w-lg border max-h-[85vh] overflow-y-auto" style={{ background: "var(--card)", borderColor: "#ff994444" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-white text-lg">История операций</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{historyUser.email}</p>
              </div>
              <button onClick={() => setHistoryUser(null)} style={{ color: "var(--muted)" }}><XCircle size={22} /></button>
            </div>

            {!historyData ? (
              <p className="text-center py-8" style={{ color: "var(--muted)" }}>Загрузка...</p>
            ) : (
              <div className="space-y-6">
                {/* Пополнения */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "#22c97a" }}>💳 Пополнения</h3>
                  {historyData.deposits.length === 0
                    ? <p className="text-sm" style={{ color: "var(--muted)" }}>Нет записей</p>
                    : <div className="space-y-2">
                      {historyData.deposits.map(d => (
                        <div key={d.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <p className="text-white font-semibold">+{d.amount.toFixed(2)} USDT</p>
                            {d.comment && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{d.comment}</p>}
                            <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: d.status === "approved" ? "#0d3a20" : d.status === "rejected" ? "#3a0d0d" : "#1a1200",
                            color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b"
                          }}>
                            {d.status === "approved" ? "✓ Зачислено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                </div>

                {/* Выводы */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "#ff9944" }}>💸 Выводы</h3>
                  {historyData.withdrawals.length === 0
                    ? <p className="text-sm" style={{ color: "var(--muted)" }}>Нет записей</p>
                    : <div className="space-y-2">
                      {historyData.withdrawals.map(w => (
                        <div key={w.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <p className="text-white font-semibold">-{w.amount.toFixed(2)} USDT</p>
                            {w.comment && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{w.comment}</p>}
                            <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(w.created_at).toLocaleString("ru")}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: w.status === "approved" ? "#0d3a20" : w.status === "rejected" ? "#3a0d0d" : "#1a0d00",
                            color: w.status === "approved" ? "#22c97a" : w.status === "rejected" ? "#ff4d4d" : "#ff9944"
                          }}>
                            {w.status === "approved" ? "✓ Выплачено" : w.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
