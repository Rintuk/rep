"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import {
  api,
  getAdminOverview, getAdminForexOverview, getAdminNotebook, resetCryptoNotebook,
  approveUser, rejectUser,
  updateUserFinancials, updateUserForexFinancials, setReferralLimit,
  deleteUser, getUserDetail, resetUserPassword,
  getAdminDeposits, approveDeposit, rejectDeposit, getAdminPoolHistory,
  getAdminWithdrawals, approveWithdrawal, rejectWithdrawal, getUserHistory,
  cleanupDemoSnapshots, adjustNetInvested,
  getAdminForexDeposits, approveForexDeposit, rejectForexDeposit, getAdminForexPoolHistory,
  getAdminForexWithdrawals, approveForexWithdrawal, rejectForexWithdrawal,
  cleanupForexDemoSnapshots, adjustForexNetInvested, forexFullReset, forexImportFromCrypto, startNewCycle, wipeProfits,
  cryptoFullReset, backupDatabase, restoreFullBackup, migratePnL, diagEntryPoints, fixBrokenEntryPoints, lockReferralBaseline, emergencyFixForexPnl, setStatusOverride, setCustomInvestorShare, getUserReferralTree,
  getAdminNews, createNews, deleteNews, NewsItem as NewsItemType, uploadNewsImage,
  getAdminTickets, replyToTicket, adminCloseTicket, clearAllTickets, clearClosedTickets, SupportTicket,
  silentWithdraw, revertSilentWithdraw, depositFromPool, depositForexFromPool, externalDeposit, forexExternalDeposit,
  getPublicSettings, updateAdminSettings,
} from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Activity, Users, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Trash2, Save } from "lucide-react";
import dynamic from 'next/dynamic';

const ReferralNetwork = dynamic(() => import('../dashboard/ReferralNetwork'), { ssr: false });

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
  investors: { id: string; email: string; nickname?: string | null; created_at: string; investment: number; withdrawal: number; pnl: number; referrals_count: number; ref_income: number; status?: string; total_volume?: number; next_vol?: number; }[];
  referrals: { id: string; email: string; nickname?: string | null; is_active: boolean; referred_by_email: string; investment: number }[];
  pending_users: { id: string; email: string; nickname?: string | null; created_at: string }[];
}

interface InvestorForm {
  investment_usdt: string;
  withdrawal_usdt: string;
  note: string;
  referral_limit: string;
  manual_status_override: string;
  forex_investment_usdt: string;
  forex_withdrawal_usdt: string;
  custom_investor_share: string;
  referred_by_email: string;
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

const STATUS_COLORS: Record<string, string> = { PARTNER: "#6b8ab0", BRONZE: "#cd7f32", SILVER: "#c0c0c0", GOLD: "#ffd700", VIP: "#f59e0b" };
const STATUS_LABELS: Record<string, string> = { PARTNER: "🔰 Инвестор", BRONZE: "🥉 Бронза", SILVER: "🥈 Серебро", GOLD: "🥇 Золото", VIP: "💎 VIP" };

const getNextStatusName = (vol: number) => {
  if (vol === 3000) return "Бронзы";
  if (vol === 3500) return "Серебра";
  if (vol === 4000) return "Золота";
  if (vol === 5000) return "VIP";
  return "след. статуса";
};

const INVESTOR_HEADERS = [
  { label: "Email", key: "email" },
  { label: "Инвестировано", key: "investment" },
  { label: "Выведено", key: "withdrawal" },
  { label: "PnL", key: "pnl" },
  { label: "Реф. доход", key: "ref_income" },
  { label: "Рефералы / Статус", key: "referrals_count" },
  { label: "Дата", key: "created_at" },
  { label: "", key: null }
];

export default function AdminPage() {
  const router = useRouter();
  const [activePool, setActivePool] = useState<"crypto" | "forex">("forex");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notebookData, setNotebookData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "investors" | "referrals" | "trades" | "ai" | "deposits" | "withdrawals" | "news" | "support">("overview");
  const [deposits, setDeposits] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [withdrawals, setWithdrawals] = useState<{id:string;email:string;amount:number;comment:string;status:string;created_at:string}[]>([]);
  const [poolHistory, setPoolHistory] = useState<{ts:string;pool_total:number;pnl:number;pnl_pct:number}[]>([]);

  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({ key: "investment", direction: "desc" });
  const [hideInactiveInvestors, setHideInactiveInvestors] = useState(true);

  const sortedInvestors = React.useMemo(() => {
    if (!data?.investors) return [];
    let sortableItems = [...data.investors];
    if (hideInactiveInvestors) {
      sortableItems = sortableItems.filter(i => 
        (i.investment && i.investment > 0) || 
        (i.referrals_count && i.referrals_count > 0) ||
        (i.pnl && Math.abs(i.pnl) > 0) ||
        (i.withdrawal && i.withdrawal > 0) ||
        (i.ref_income && i.ref_income > 0)
      );
    }
    if (sortConfig.key !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key!];
        let bValue = b[sortConfig.key!];
        
        if (sortConfig.key === "created_at") {
          aValue = new Date(aValue as string).getTime();
          bValue = new Date(bValue as string).getTime();
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [data?.investors, sortConfig]);

  const requestSort = (key: string | null) => {
    if (!key) return;
    let direction: "asc" | "desc" = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trees, setTrees] = useState<Record<string, any[]>>({});
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
  const [fullResetMsg, setFullResetMsg] = useState<string | null>(null);
  const [fullResetLoading, setFullResetLoading] = useState(false);
  const [importFromCryptoMsg, setImportFromCryptoMsg] = useState<string | null>(null);
  const [importFromCryptoLoading, setImportFromCryptoLoading] = useState(false);
  const [cryptoResetMsg, setCryptoResetMsg] = useState<string | null>(null);
  const [cryptoResetLoading, setCryptoResetLoading] = useState(false);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [investorDangerOpen, setInvestorDangerOpen] = useState<Record<string, boolean>>({});
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  const [newCycleLoading, setNewCycleLoading] = useState(false);
  const [newCycleMsg, setNewCycleMsg] = useState<string | null>(null);

  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeMsg, setWipeMsg] = useState<string | null>(null);

  const [statusOverrideMsg, setStatusOverrideMsg] = useState<Record<string, string>>({});
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineResult, setBaselineResult] = useState<any>(null);

  const [silentWAmount, setSilentWAmount] = useState("");
  const [silentWLoading, setSilentWLoading] = useState(false);
  const [silentWMsg, setSilentWMsg] = useState<string | null>(null);
  const [revertSWAmount, setRevertSWAmount] = useState("");
  const [revertSWLoading, setRevertSWLoading] = useState(false);
  const [revertSWMsg, setRevertSWMsg] = useState<string | null>(null);

  const [newsList, setNewsList] = useState<NewsItemType[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsPool, setNewsPool] = useState<"all" | "crypto" | "forex">("all");
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMsg, setNewsMsg] = useState<string | null>(null);
  const [newsImageUrl, setNewsImageUrl] = useState<string | null>(null);
  const [newsImageLoading, setNewsImageLoading] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<string | null>(null);
  const [clearTicketsLoading, setClearTicketsLoading] = useState(false);
  const [clearClosedLoading, setClearClosedLoading] = useState(false);
  const [clearTicketsMsg, setClearTicketsMsg] = useState<string | null>(null);
  const [selectedSupportUser, setSelectedSupportUser] = useState<string | null>(null);

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Техобслуживание сайта. Скоро вернемся.");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchData();
    fetchTickets();
    fetchSettings();
    const interval = setInterval(() => { fetchData(); fetchTickets(); }, 60000);
    return () => clearInterval(interval);
  }, [activePool]);

  async function fetchSettings() {
    try {
      const st = await getPublicSettings();
      setMaintenanceEnabled(st.maintenance_enabled);
      setMaintenanceMessage(st.maintenance_message);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (activeTab === "news") fetchNews();
    if (activeTab === "support") fetchTickets();
  }, [activeTab]);

  async function fetchNews() {
    try {
      const items = await getAdminNews();
      setNewsList(items);
    } catch { /* ignore */ }
  }

  async function handleCreateNews() {
    if (!newsTitle.trim() || !newsBody.trim()) return;
    setNewsLoading(true);
    setNewsMsg(null);
    try {
      await createNews(newsTitle.trim(), newsBody.trim(), newsPool, newsImageUrl);
      setNewsTitle("");
      setNewsBody("");
      setNewsPool("all");
      setNewsImageUrl(null);
      setNewsMsg("Новость опубликована");
      await fetchNews();
    } catch {
      setNewsMsg("Ошибка публикации");
    } finally {
      setNewsLoading(false);
      setTimeout(() => setNewsMsg(null), 3000);
    }
  }

  async function handleNewsImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewsImageLoading(true);
    try {
      const url = await uploadNewsImage(file);
      setNewsImageUrl(url);
    } catch {
      setNewsMsg("Ошибка загрузки картинки");
    } finally {
      setNewsImageLoading(false);
    }
  }

  async function handleDeleteNews(id: string) {
    if (!confirm("Удалить новость?")) return;
    try {
      await deleteNews(id);
      await fetchNews();
    } catch { /* ignore */ }
  }

  async function fetchTickets() {
    try {
      const data = await getAdminTickets();
      setTickets(data);
    } catch { /* ignore */ }
  }

  async function handleReply(ticketId: string) {
    const body = (replyTexts[ticketId] || "").trim();
    if (!body) return;
    setReplyLoading(ticketId);
    try {
      await replyToTicket(ticketId, body);
      setReplyTexts(prev => ({ ...prev, [ticketId]: "" }));
      await fetchTickets();
    } catch { /* ignore */ }
    finally { setReplyLoading(null); }
  }

  async function handleAdminClose(ticketId: string) {
    if (!confirm("Закрыть тикет?")) return;
    try {
      await adminCloseTicket(ticketId);
      setExpandedTicket(null);
      await fetchTickets();
    } catch { /* ignore */ }
  }

  async function handleClearAllTickets() {
    if (!confirm("Удалить ВСЮ историю тикетов?\n\nЭто действие необратимо.")) return;
    setClearTicketsLoading(true);
    setClearTicketsMsg(null);
    try {
      const r = await clearAllTickets();
      setClearTicketsMsg(r.message);
      setExpandedTicket(null);
      await fetchTickets();
    } catch {
      setClearTicketsMsg("Ошибка удаления");
    } finally {
      setClearTicketsLoading(false);
      setTimeout(() => setClearTicketsMsg(null), 4000);
    }
  }

  async function handleClearClosedTickets() {
    if (!confirm("Удалить все закрытые тикеты?\n\nЭто действие необратимо.")) return;
    setClearClosedLoading(true);
    setClearTicketsMsg(null);
    try {
      const r = await clearClosedTickets();
      setClearTicketsMsg(r.message);
      setExpandedTicket(null);
      await fetchTickets();
    } catch {
      setClearTicketsMsg("Ошибка удаления");
    } finally {
      setClearClosedLoading(false);
      setTimeout(() => setClearTicketsMsg(null), 4000);
    }
  }

  async function fetchData() {
    try {
      const isForex = activePool === "forex";
      const [d, dep, wdr, nb] = await Promise.all([
        isForex ? getAdminForexOverview() : getAdminOverview(),
        isForex ? getAdminForexDeposits() : getAdminDeposits(),
        isForex ? getAdminForexWithdrawals() : getAdminWithdrawals(),
        getAdminNotebook(),
      ]);
      setData(d);
      setDeposits(dep);
      setWithdrawals(wdr);
        setNotebookData(nb);
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
    try {
      const treeData = await getUserReferralTree(id);
      setTrees(prev => ({ ...prev, [id]: treeData }));
    } catch (e) {
      console.error("Failed to load referral tree", e);
    }
    if (!forms[id]) {
      try {
        const detail = await getUserDetail(id);
        setForms(prev => ({ ...prev, [id]: {
          investment_usdt: String(detail.investment_usdt ?? 0),
          withdrawal_usdt: String(detail.withdrawal_usdt ?? 0),
          note: detail.note ?? "",
          referral_limit: String(detail.referral_limit ?? 5),
          manual_status_override: detail.manual_status_override || "NONE",
          forex_investment_usdt: String(detail.forex_investment_usdt ?? 0),
          forex_withdrawal_usdt: String(detail.forex_withdrawal_usdt ?? 0),
          custom_investor_share: detail.custom_investor_share !== null ? String(detail.custom_investor_share * 100) : "75",
          referred_by_email: detail.referred_by_email || "",
        }}));
      } catch {
        setForms(prev => ({ ...prev, [id]: { investment_usdt: "0", withdrawal_usdt: "0", note: "", referral_limit: "5", manual_status_override: "NONE", forex_investment_usdt: "0", forex_withdrawal_usdt: "0", custom_investor_share: "75", referred_by_email: "" } }));
      }
    }
  }

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const data = await backupDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ошибка при создании бэкапа");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleMigrate() {
    if (!confirm("Фиксировать историческую прибыль по старым ставкам? Это действие сбросит точки входа (entry_pool_pct) на текущие!")) return;
    setMigrateLoading(true); setMigrateMsg(null);
    try {
      const r = await migratePnL();
      setMigrateMsg(`Успешно. Обновлено инвесторов: ${r.updated_investors}. Залочено профита (Крипто): $${r.total_crypto_locked}`);
      fetchData();
    } catch {
      setMigrateMsg("Ошибка миграции");
    } finally {
      setMigrateLoading(false);
    }
  }

  async function handleDiagEntryPoints() {
    setDiagLoading(true); setDiagResult(null);
    try {
      const r = await diagEntryPoints();
      setDiagResult(r);
    } catch {
      setDiagResult({ error: "Ошибка запроса" });
    } finally {
      setDiagLoading(false);
    }
  }

  async function handleLockReferralBaseline() {
    if (!confirm("Зафиксировать текущие рефбонусы как базу и начать рост от текущего уровня пула?")) return;
    setBaselineLoading(true); setBaselineResult(null);
    try {
      const r = await lockReferralBaseline();
      setBaselineResult(r);
    } catch {
      setBaselineResult({ error: "Ошибка" });
    } finally {
      setBaselineLoading(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      await updateAdminSettings(maintenanceEnabled, maintenanceMessage);
      setSettingsMsg("Настройки сохранены");
    } catch {
      setSettingsMsg("Ошибка сохранения");
    } finally {
      setSettingsSaving(false);
      setTimeout(() => setSettingsMsg(null), 3000);
    }
  }

  async function handleFixEntryPoints() {
    if (!confirm("Сбросить завышенные точки входа? locked_pnl не будет тронут — накопленная прибыль сохранится.")) return;
    setFixLoading(true); setFixResult(null);
    try {
      const r = await fixBrokenEntryPoints();
      setFixResult(r);
      setDiagResult(null);
    } catch {
      setFixResult({ error: "Ошибка" });
    } finally {
      setFixLoading(false);
    }
  }

  async function handleSilentWithdraw() {
    const amt = parseFloat(silentWAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!confirm(`Точно применить тихий вывод $${amt} из ${poolLabel}?`)) return;
    setSilentWLoading(true); setSilentWMsg(null);
    try {
      const r = await silentWithdraw(activePool, amt);
      setSilentWMsg(`Успешно! База сжата на $${r.decreased_base_by.toFixed(2)}`);
      setSilentWAmount("");
      fetchData();
    } catch (err: any) {
      setSilentWMsg(err?.response?.data?.detail || "Ошибка");
    } finally { setSilentWLoading(false); }
  }

  async function handleRevertSilentWithdraw() {
    const amt = parseFloat(revertSWAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!confirm(`Точно откатить тихий вывод сжатия $${amt} для ${poolLabel}?`)) return;
    setRevertSWLoading(true); setRevertSWMsg(null);
    try {
      await revertSilentWithdraw(activePool, amt);
      setRevertSWMsg("Успешный откат");
      setRevertSWAmount("");
      fetchData();
    } catch (err: any) {
      setRevertSWMsg(err?.response?.data?.detail || "Ошибка");
    } finally { setRevertSWLoading(false); }
  }

  async function handleStatusSave(id: string) {
    const f = forms[id];
    if (!f) return;
    setStatusOverrideMsg(prev => ({ ...prev, [id]: "Сохранение..." }));
    try {
        await setStatusOverride(id, f.manual_status_override);
        await setReferralLimit(id, Number(f.referral_limit));
        await setCustomInvestorShare(id, f.custom_investor_share ? Number(f.custom_investor_share) / 100 : null);
        setStatusOverrideMsg(prev => ({ ...prev, [id]: "✓ Сохранено!" }));
        setTimeout(() => setStatusOverrideMsg(prev => ({ ...prev, [id]: "" })), 2000);
        fetchData();
    } catch {
        setStatusOverrideMsg(prev => ({ ...prev, [id]: "Ошибка сохранения" }));
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
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Ошибка";
      setSaveMsg(prev => ({ ...prev, [id]: "✗ " + detail }));
    } finally { setSavingId(null); }
  }

  async function handleForexSave(id: string) {
    const f = forms[id];
    if (!f) return;
    setForexSavingId(id);
    try {
      await updateUserForexFinancials(id, parseFloat(f.forex_investment_usdt) || 0, parseFloat(f.forex_withdrawal_usdt) || 0, f.note);
      await setReferralLimit(id, parseInt(f.referral_limit) || 5);
      await setCustomInvestorShare(id, f.custom_investor_share ? parseFloat(f.custom_investor_share) / 100 : null);
      setForexSaveMsg(prev => ({ ...prev, [id]: "✓ Сохранено" }));
      setTimeout(() => setForexSaveMsg(prev => ({ ...prev, [id]: "" })), 2000);
      fetchData();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Ошибка";
      setForexSaveMsg(prev => ({ ...prev, [id]: "✗ " + detail }));
      setTimeout(() => setForexSaveMsg(prev => ({ ...prev, [id]: "" })), 5000);
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
    { key: "news", label: "📰 Новости" },
    { key: "support", label: "🎧 Поддержка", badge: tickets.filter(t => t.status === "open").length },
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

        {/* Открытые тикеты поддержки */}
        {tickets.filter(t => t.status === "open").length > 0 && (
          <button
            onClick={() => setActiveTab("support")}
            style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "none", border: "none", padding: 0 }}
          >
            <div style={{ ...card, padding: "14px 18px", border: "1px solid rgba(255,60,60,0.4)", background: "rgba(40,5,5,0.75)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff3c3c", display: "inline-block", flexShrink: 0, boxShadow: "0 0 8px #ff3c3c" }} />
              <span style={{ color: "#ff3c3c", fontWeight: 700, fontSize: 14 }}>
                Открытые тикеты! — {tickets.filter(t => t.status === "open").length} {tickets.filter(t => t.status === "open").length === 1 ? "обращение ожидает ответа" : "обращений ожидают ответа"}
              </span>
              <span style={{ marginLeft: "auto", color: "#ff3c3c", fontSize: 12, opacity: 0.7 }}>Перейти →</span>
            </div>
          </button>
        )}

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
                    <p style={{ color: "#fff", fontWeight: 500 }}>{u.nickname ? `${u.nickname} (${u.email})` : u.email}</p>
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
                  { label: "Средства пула", value: `${(data.admin_own_capital + data.admin_own_pnl).toFixed(2)} $`, color: (data.admin_own_capital + data.admin_own_pnl) >= 0 ? "#22c97a" : "#ff4d4d" },
                  { label: "Свободно USDT", value: `${(data.net_invested_pool - data.pool_positions_usdt).toFixed(2)} $` },
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

            {/* NOTEBOOK BLOCK */}
            {notebookData && (
              <div style={{ ...card, padding: 20 }}>
                <h2 style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📓</span> Записная книжка дохода
                  </div>
                  {!isForex && (
                    <button
                      onClick={async () => {
                        if (!confirm("Сбросить все крипто-доходы в записной книжке? Это обнулит статистику (сегодня, вчера, неделя, месяц, всего). Действие необратимо.")) return;
                        try {
                          await resetCryptoNotebook();
                          const nb = await getAdminNotebook();
                          setNotebookData(nb);
                        } catch (e: any) {
                          alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                        }
                      }}
                      style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                        background: "rgba(220,38,38,0.1)", color: "#ff4d4d",
                        border: "1px solid rgba(220,38,38,0.3)", fontWeight: 600,
                      }}
                    >
                      🗑 Сбросить
                    </button>
                  )}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Заработано сегодня", value: notebookData[activePool]?.today || 0 },
                    { label: "Заработано вчера", value: notebookData[activePool]?.yesterday || 0 },
                    { label: "За неделю", value: notebookData[activePool]?.week || 0 },
                    { label: "За месяц", value: notebookData[activePool]?.month || 0 },
                    { label: "Всего", value: notebookData[activePool]?.total || 0 },
                  ].map((r, i) => (
                    <div key={`nb-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: muted }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: r.value >= 0 ? "#22c97a" : "#ff4d4d" }}>
                        {r.value >= 0 ? "+" : ""}{Number(r.value).toFixed(2)} $
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 12, textAlign: "center", fontStyle: "italic" }}>
                  *Растет от закрытых сделок. Не уменьшается при выводах.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Служебные операции — сворачивающийся блок */}
        {activeTab === "overview" && (
          <div style={{ ...card, padding: 0, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <button
              onClick={() => setDangerZoneOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", color: muted }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>🛠 Служебные операции</span>
              {dangerZoneOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {dangerZoneOpen && (
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Тихий вывод (Сжатие базы) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(43,107,255,0.5)" }}>
                  <div>
                    <p style={{ color: "#4d8eff", fontSize: 13, fontWeight: 600 }}>🥷 Тихий вывод (Сжатие базы)</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Уменьшает баланс пула и строку "Средства пула" без влияния на PnL.</p>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input
                      type="number"
                      placeholder="Сумма вывода ($)"
                      value={silentWAmount}
                      onChange={e => setSilentWAmount(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: 13 }}
                    />
                    <button onClick={handleSilentWithdraw} disabled={silentWLoading || !silentWAmount}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(43,107,255,0.2)", color: "#4d8eff", cursor: "pointer", border: "1px solid rgba(43,107,255,0.4)", opacity: (silentWLoading || !silentWAmount) ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {silentWLoading ? "..." : "Сжать базу"}
                    </button>
                  </div>
                  {silentWMsg && <p style={{ fontSize: 12, color: silentWMsg.includes("Успешно") ? "#22c97a" : "#ff4d4d", marginTop: 4 }}>{silentWMsg}</p>}
                </div>

                {/* Откат сжатия базы */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div>
                    <p style={{ color: "#aaa", fontSize: 13, fontWeight: 600 }}>↩️ Откат сжатия (Revert)</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Если ошиблись с суммой сжатия, введите ту же сумму здесь для отмены.</p>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input
                      type="number"
                      placeholder="Сумма отката ($)"
                      value={revertSWAmount}
                      onChange={e => setRevertSWAmount(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: 13 }}
                    />
                    <button onClick={handleRevertSilentWithdraw} disabled={revertSWLoading || !revertSWAmount}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: "#aaa", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", opacity: (revertSWLoading || !revertSWAmount) ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {revertSWLoading ? "..." : "Откатить"}
                    </button>
                  </div>
                  {revertSWMsg && <p style={{ fontSize: 12, color: revertSWMsg.includes("Успешно") ? "#22c97a" : "#ff4d4d", marginTop: 4 }}>{revertSWMsg}</p>}
                </div>

                {/* Скачать Бэкап */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(13,58,32,0.8)" }}>
                  <div>
                    <p style={{ color: "#22c97a", fontSize: 13, fontWeight: 600 }}>💾 Создать бэкап финансов</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Выгрузить всех пользователей и их финансы в JSON.</p>
                  </div>
                  <button onClick={handleBackup} disabled={backupLoading}
                    style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "1px solid rgba(34,201,122,0.3)", opacity: backupLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {backupLoading ? "..." : "Скачать"}
                  </button>
                </div>

                {/* Восстановление из бэкапа */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(220,38,38,0.4)" }}>
                  <div>
                    <p style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>♻️ Восстановить из бэкапа (полный)</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Восстанавливает финансы всех инвесторов и данные пулов из JSON-бэкапа. Необратимо.</p>
                  </div>
                  <label style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "rgba(80,20,20,0.8)", color: "#f87171", cursor: restoreLoading ? "not-allowed" : "pointer",
                    border: "1px solid rgba(220,38,38,0.4)", opacity: restoreLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {restoreLoading ? "Загрузка..." : "Загрузить JSON"}
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!confirm("ВНИМАНИЕ: это перезапишет финансы ВСЕХ инвесторов и данные пулов. Продолжить?")) return;
                      setRestoreLoading(true);
                      try {
                        const res = await restoreFullBackup(file);
                        alert(`✅ Восстановлено!\nИнвесторов: ${res.investors_restored}\nПулы: ${res.pool_snapshots_restored ? "да" : "нет"}\nДата бэкапа: ${res.backup_timestamp}`);
                        fetchData();
                      } catch (err: any) {
                        alert("Ошибка: " + (err?.response?.data?.detail || err.message));
                      } finally {
                        setRestoreLoading(false);
                        e.target.value = "";
                      }
                    }} />
                  </label>
                </div>

                {/* Начать новый цикл */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${isForex ? "rgba(245,158,11,0.5)" : "rgba(34,211,238,0.5)"}`, marginBottom: 16 }}>
                  <div>
                    <p style={{ color: isForex ? "#f59e0b" : "#22d3ee", fontSize: 13, fontWeight: 600 }}>🔄 Начать новый цикл ({poolLabel})</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Прибавляет всю прибыль к депозитам инвесторов и сбрасывает PnL пула до 0%.</p>
                    {newCycleMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{newCycleMsg}</p>}
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`ВНИМАНИЕ! Вы точно хотите начать новый цикл для ${poolLabel}? Вся невыведенная прибыль админа растворится в базе пула.`)) return;
                    setNewCycleLoading(true); setNewCycleMsg(null);
                    try {
                      const res = await startNewCycle(isForex ? "forex" : "crypto");
                      setNewCycleMsg(`✅ Успех: капитализировано ${res.total_capitalized} $. База пула: ${res.new_pool_base} $.`);
                      fetchData();
                    } catch (e: any) {
                      setNewCycleMsg("Ошибка: " + (e?.response?.data?.detail || e.message));
                    } finally {
                      setNewCycleLoading(false);
                    }
                  }} disabled={newCycleLoading}
                    style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(255,255,255,0.05)", color: isForex ? "#f59e0b" : "#22d3ee", cursor: "pointer", border: `1px solid ${isForex ? "rgba(245,158,11,0.3)" : "rgba(34,211,238,0.3)"}`, opacity: newCycleLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {newCycleLoading ? "Загрузка..." : "Запустить реинвест"}
                  </button>
                </div>

                {/* Сбросить всю прибыль (обнуление) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(220,38,38,0.5)`, marginBottom: 16 }}>
                  <div>
                    <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>🗑 Сбросить всю прибыль ({poolLabel}) на 0</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Просто удаляет всю прибыль и бонусы инвесторов. Балансы (депозиты) остаются без изменений.</p>
                    {wipeMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{wipeMsg}</p>}
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`ВНИМАНИЕ! Вы точно хотите УДАЛИТЬ всю прибыль и бонусы инвесторов в пуле ${poolLabel}? Это действие необратимо!`)) return;
                    setWipeLoading(true); setWipeMsg(null);
                    try {
                      const res = await wipeProfits(isForex ? "forex" : "crypto");
                      setWipeMsg(res.message);
                      fetchData();
                    } catch (e: any) {
                      setWipeMsg("Ошибка: " + (e?.response?.data?.detail || e.message));
                    } finally {
                      setWipeLoading(false);
                    }
                  }} disabled={wipeLoading}
                    style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(220,38,38,0.2)", color: "#ef4444", cursor: "pointer", border: `1px solid rgba(220,38,38,0.5)`, opacity: wipeLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {wipeLoading ? "..." : "Сбросить в 0"}
                  </button>
                </div>

                {/* Миграция PnL */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,153,68,0.3)" }}>
                  <div>
                    <p style={{ color: "#ff9944", fontSize: 13, fontWeight: 600 }}>🛠 Миграция PnL (Сохранение старой прибыли)</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Зафиксировать текущую прибыль (по 77%) в locked_pnl и сбросить точки входа.</p>
                    {migrateMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{migrateMsg}</p>}
                  </div>
                  <button onClick={handleMigrate} disabled={migrateLoading}
                    style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(68,34,13,0.8)", color: "#ff9944", cursor: "pointer", border: "1px solid rgba(255,153,68,0.3)", opacity: migrateLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {migrateLoading ? "..." : "Запустить миграцию"}
                  </button>
                </div>

                {/* Диагностика точек входа */}
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,180,255,0.3)", marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: "#64b4ff", fontSize: 13, fontWeight: 600 }}>🔍 Диагностика точек входа (рефбонусы)</p>
                      <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Показывает инвесторов у которых entry_pct завышен — их рефбонусы не растут.</p>
                    </div>
                    <button onClick={handleDiagEntryPoints} disabled={diagLoading}
                      style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "rgba(13,34,68,0.8)", color: "#64b4ff", cursor: "pointer", border: "1px solid rgba(100,180,255,0.3)", opacity: diagLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {diagLoading ? "..." : "Проверить"}
                    </button>
                  </div>
                  {diagResult && (
                    <div style={{ marginTop: 12, fontSize: 12, color: muted }}>
                      <p>Крипто пул: <b style={{ color: "#fff" }}>{diagResult.current_crypto_pool_pct}%</b> &nbsp;|&nbsp; Форекс пул: <b style={{ color: "#fff" }}>{diagResult.current_forex_pool_pct}%</b></p>
                      {diagResult.broken_crypto_count === 0 && diagResult.broken_forex_count === 0 ? (
                        <p style={{ color: "#22c97a", marginTop: 6 }}>✅ Всё в порядке — сломанных точек входа нет</p>
                      ) : (
                        <>
                          {diagResult.broken_crypto_count > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <p style={{ color: "#ff6b6b", fontWeight: 600 }}>❌ Крипто — сломано: {diagResult.broken_crypto_count}</p>
                              {diagResult.broken_crypto.map((r: any, i: number) => (
                                <div key={i} style={{ marginTop: 4, padding: "6px 10px", background: "rgba(255,60,60,0.07)", borderRadius: 6 }}>
                                  <b style={{ color: "#fff" }}>{r.email}</b> &nbsp;
                                  депозит: ${r.investment} &nbsp;|&nbsp;
                                  entry: <b style={{ color: "#ff6b6b" }}>{r.entry_pct}%</b> &nbsp;→&nbsp;
                                  текущий pct: <b style={{ color: "#22c97a" }}>{r.current_pct}%</b> &nbsp;|&nbsp;
                                  разрыв: <b style={{ color: "#ff9944" }}>+{r.gap_pct}%</b> &nbsp;|&nbsp;
                                  locked: ${r.locked_pnl}
                                </div>
                              ))}
                            </div>
                          )}
                          {diagResult.broken_forex_count > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <p style={{ color: "#ff6b6b", fontWeight: 600 }}>❌ Форекс — сломано: {diagResult.broken_forex_count}</p>
                              {diagResult.broken_forex.map((r: any, i: number) => (
                                <div key={i} style={{ marginTop: 4, padding: "6px 10px", background: "rgba(255,60,60,0.07)", borderRadius: 6 }}>
                                  <b style={{ color: "#fff" }}>{r.email}</b> &nbsp;
                                  депозит: ${r.forex_investment} &nbsp;|&nbsp;
                                  entry: <b style={{ color: "#ff6b6b" }}>{r.entry_pct}%</b> &nbsp;→&nbsp;
                                  текущий pct: <b style={{ color: "#22c97a" }}>{r.current_pct}%</b> &nbsp;|&nbsp;
                                  разрыв: <b style={{ color: "#ff9944" }}>+{r.gap_pct}%</b> &nbsp;|&nbsp;
                                  locked: ${r.locked_forex_pnl}
                                </div>
                              ))}
                            </div>
                          )}
                          <button onClick={handleFixEntryPoints} disabled={fixLoading}
                            style={{ marginTop: 12, padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: "rgba(60,13,13,0.9)", color: "#ff6b6b", cursor: "pointer",
                              border: "1px solid rgba(255,107,107,0.4)", opacity: fixLoading ? 0.5 : 1 }}>
                            {fixLoading ? "Исправляю..." : "⚡ Исправить точки входа (locked_pnl не трогать)"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {fixResult && (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                      {fixResult.error
                        ? <p style={{ color: "#ff6b6b" }}>Ошибка: {fixResult.error}</p>
                        : <p style={{ color: "#22c97a" }}>✅ Исправлено инвесторов: {fixResult.fixed_count}. Нажми «Проверить» чтобы убедиться.</p>
                      }
                    </div>
                  )}
                </div>

                {/* Зафиксировать рефбонусы как базу */}
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,153,68,0.3)", marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: "#ff9944", fontSize: 13, fontWeight: 600 }}>📌 Зафиксировать базу рефбонусов</p>
                      <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Сохраняет текущие значения бонусов и включает рост от текущего уровня пула. Запускать один раз.</p>
                    </div>
                    <button onClick={handleLockReferralBaseline} disabled={baselineLoading}
                      style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "rgba(68,34,13,0.8)", color: "#ff9944", cursor: "pointer",
                        border: "1px solid rgba(255,153,68,0.3)", opacity: baselineLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {baselineLoading ? "..." : "Зафиксировать"}
                    </button>
                  </div>
                  {baselineResult && (
                    <p style={{ marginTop: 8, fontSize: 12, color: baselineResult.error ? "#ff6b6b" : "#22c97a" }}>
                      {baselineResult.error ? `Ошибка: ${baselineResult.error}` : `✅ Обновлено инвесторов: ${baselineResult.updated_count}`}
                    </p>
                  )}
                </div>

                {/* Восстановление реф. дохода */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,201,122,0.3)", marginTop: 16 }}>
                  <div>
                    <p style={{ color: "#22c97a", fontSize: 13, fontWeight: 600 }}>👥 Восстановление Реф. Дохода</p>
                    <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Загрузите backup.json чтобы восстановить потерянный реф. доход.</p>
                  </div>
                  <label style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "rgba(13,68,34,0.8)", color: "#22c97a", cursor: "pointer", border: "1px solid rgba(34,201,122,0.3)", whiteSpace: "nowrap" }}>
                    Загрузить Backup
                    <input type="file" accept=".json" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!confirm("Восстановить реферальный доход из этого бэкапа?")) return;
                      try {
                        const formData = new FormData();
                        formData.append("backup_file", file);
                        const res = await api.post("/auth/admin/restore-ref-bonus", formData);
                        const data = res.data;
                        if (data.status === "success") {
                          alert("Успешно!\nОбновлено инвесторов: " + data.updated);
                          fetchData();
                        } else alert("Ошибка: " + (data.detail || JSON.stringify(data)));
                      } catch (err: any) { alert("Ошибка: " + err.message); }
                      finally { e.target.value = ""; }
                    }} style={{ display: "none" }} />
                  </label>
                  
                  <button onClick={async () => {
                    if (!confirm("Это действие отменит влияние последней кнопки 'Пополнить из пула' на баланс пула. Продолжить?")) return;
                    try {
                      const res = await api.post("/auth/admin/emergency-revert-reinvest");
                      if (res.data.status === "success") {
                        alert(`Готово! Отменено крипто: ${res.data.crypto_reverted}$, форекс: ${res.data.forex_reverted}$`);
                        fetchData();
                      }
                    } catch (e: any) { alert("Ошибка: " + e.message); }
                  }} style={{ background: "rgba(255, 100, 100, 0.1)", color: "#ff4d4d", padding: "6px 12px", border: "1px solid #ff4d4d", borderRadius: 4, cursor: "pointer", fontSize: 13, marginTop: 10 }}>
                    Сбросить глюк пула
                  </button>
                </div>

                {/* Очистка демо */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,77,77,0.15)" }}>
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
                      opacity: cleanupLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {cleanupLoading ? "..." : "Очистить"}
                  </button>
                </div>

                {/* Полный сброс крипто */}
                {!isForex && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,77,77,0.3)" }}>
                    <div>
                      <p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 600 }}>⚠️ Полный сброс крипто-пула</p>
                      <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Удаляет все снапшоты, обнуляет инвестиции и выводы всех пользователей, сбрасывает демо-счета.</p>
                      {cryptoResetMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{cryptoResetMsg}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("ПОЛНЫЙ СБРОС крипто-пула?\n\nБудут удалены все снапшоты и обнулены данные ВСЕХ пользователей. Это необратимо.")) return;
                        setCryptoResetLoading(true); setCryptoResetMsg(null);
                        try {
                          const r = await cryptoFullReset();
                          setCryptoResetMsg(r.message); fetchData();
                        } catch { setCryptoResetMsg("Ошибка"); }
                        finally { setCryptoResetLoading(false); }
                      }}
                      disabled={cryptoResetLoading}
                      style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: "rgba(127,29,29,0.9)", color: "#fca5a5", cursor: "pointer", border: "1px solid rgba(255,77,77,0.4)",
                        opacity: cryptoResetLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {cryptoResetLoading ? "..." : "Сбросить всё"}
                    </button>
                  </div>
                )}

                {/* Полный сброс форекс + перенос из крипто */}
                {isForex && (
                  <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,77,77,0.3)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 600 }}>⚠️ Полный сброс форекс-пула</p>
                        <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Удаляет все снапшоты, обнуляет инвестиции и выводы всех пользователей, сбрасывает демо-счета.</p>
                        {fullResetMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{fullResetMsg}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm("ПОЛНЫЙ СБРОС форекс-пула?\n\nБудут удалены все снапшоты и обнулены данные ВСЕХ пользователей. Это необратимо.")) return;
                          setFullResetLoading(true); setFullResetMsg(null);
                          try {
                            const r = await forexFullReset();
                            setFullResetMsg(r.message); fetchData();
                          } catch { setFullResetMsg("Ошибка"); }
                          finally { setFullResetLoading(false); }
                        }}
                        disabled={fullResetLoading}
                        style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: "rgba(127,29,29,0.9)", color: "#fca5a5", cursor: "pointer", border: "1px solid rgba(255,77,77,0.4)",
                          opacity: fullResetLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                        {fullResetLoading ? "..." : "Сбросить всё"}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <p style={{ color: "#fcd34d", fontSize: 13, fontWeight: 600 }}>⬇️ Перенести депозиты из крипто-пула</p>
                        <p style={{ color: muted, fontSize: 12, marginTop: 4 }}>Сбрасывает форекс-пул, затем копирует суммы депозитов/выводов из крипто. Точка входа у всех — с нуля.</p>
                        {importFromCryptoMsg && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>{importFromCryptoMsg}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm("Перенести депозиты из крипто-пула в форекс?\n\nФорекс-пул будет сброшен, затем депозиты скопированы. Точка входа — с нуля.")) return;
                          setImportFromCryptoLoading(true); setImportFromCryptoMsg(null);
                          try {
                            const r = await forexImportFromCrypto();
                            setImportFromCryptoMsg(r.message); fetchData();
                          } catch { setImportFromCryptoMsg("Ошибка"); }
                          finally { setImportFromCryptoLoading(false); }
                        }}
                        disabled={importFromCryptoLoading}
                        style={{ marginLeft: 16, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: "rgba(120,83,0,0.9)", color: "#fcd34d", cursor: "pointer", border: "1px solid rgba(252,211,77,0.4)",
                          opacity: importFromCryptoLoading ? 0.5 : 1, whiteSpace: "nowrap" }}>
                        {importFromCryptoLoading ? "..." : "Перенести"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Корректировка net_invested */}
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${isForex ? "rgba(245,158,11,0.2)" : "rgba(68,136,221,0.2)"}` }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💰 Корректировка депозита в пул ({poolLabel})</p>
                  <p style={{ color: muted, fontSize: 12, marginBottom: 10 }}>Если в пул добавлен капитал напрямую — введи сумму в USDT. Значение прибавится ко всем снимкам.</p>
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

                {/* Заглушки */}
                <div style={{ marginTop: 24, borderTop: `1px solid rgba(0,180,255,0.2)`, paddingTop: 24 }}>
                  <details style={{ background: "rgba(3,5,20,0.5)", borderRadius: 8, border: "1px solid rgba(0,180,255,0.12)", overflow: "hidden" }}>
                    <summary style={{ padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontWeight: 600, color: "#00b4ff", userSelect: "none" }}>
                      <span style={{ fontSize: 18 }}>🚧</span>
                      Управление заглушками для инвесторов
                    </summary>
                    <div style={{ padding: "0 16px 16px 16px" }}>
                      <p style={{ color: muted, fontSize: 13, marginBottom: 16 }}>
                        Включите заглушку, чтобы закрыть доступ к дашборду и демо-счету для инвесторов.
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input type="checkbox" checked={maintenanceEnabled} onChange={e => setMaintenanceEnabled(e.target.checked)} />
                          <span style={{ color: "#fff", fontWeight: 500 }}>Включить заглушку</span>
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setMaintenanceMessage("Техобслуживание сайта. Скоро вернемся.")}
                          style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, background: "rgba(255,255,255,0.05)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                          Техобслуживание
                        </button>
                        <button onClick={() => setMaintenanceMessage("Идет приходование депозита клиента. Бот делает апгрейт счета. Сайт заработает сегодня в ближайшее время.")}
                          style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, background: "rgba(255,255,255,0.05)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                          Апгрейт счета
                        </button>
                      </div>
                      <textarea
                        value={maintenanceMessage}
                        onChange={e => setMaintenanceMessage(e.target.value)}
                        placeholder="Текст заглушки..."
                        style={{ width: "100%", height: 80, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none", resize: "vertical", fontSize: 13, marginBottom: 12 }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button onClick={handleSaveSettings} disabled={settingsSaving}
                          style={{ padding: "8px 24px", borderRadius: 8, background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.3)", color: "#00b4ff", fontWeight: 600, cursor: "pointer", opacity: settingsSaving ? 0.5 : 1 }}>
                          {settingsSaving ? "Сохранение..." : "💾 Сохранить настройки"}
                        </button>
                        {settingsMsg && <span style={{ color: "#22c97a", fontSize: 13 }}>{settingsMsg}</span>}
                      </div>
                    </div>
                  </details>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Инвесторы */}
        {activeTab === "investors" && (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="hideInactive" checked={hideInactiveInvestors} onChange={e => setHideInactiveInvestors(e.target.checked)} style={{ cursor: "pointer" }} />
              <label htmlFor="hideInactive" style={{ color: muted, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                Скрыть неактивных (с нулевым балансом)
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {INVESTOR_HEADERS.map((h, i) => (
                      <th key={i} onClick={() => requestSort(h.key)} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500, color: muted, cursor: h.key ? "pointer" : "default", userSelect: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {h.label}
                          {h.key && sortConfig.key === h.key && (
                            <span style={{ fontSize: 10 }}>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedInvestors.length === 0
                    ? <tr><td colSpan={8} style={{ padding: "24px 16px", textAlign: "center", color: muted }}>Инвесторов нет</td></tr>
                    : sortedInvestors.map((u) => {
                      const isOpen = expandedId === u.id;
                      const f = forms[u.id];
                      return (
                        <React.Fragment key={u.id}>
                          <tr className="adm-row" style={{ borderBottom: `1px solid ${border}`, background: isOpen ? "rgba(4,8,28,0.8)" : "transparent" }}>
                            <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{u.nickname ? `${u.nickname} (${u.email})` : u.email}</td>
                            <td style={{ padding: "12px 16px", color: "#fff" }}>{u.investment.toFixed(2)} $</td>
                            <td style={{ padding: "12px 16px", color: muted }}>{u.withdrawal.toFixed(2)} $</td>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: u.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
                              {u.pnl >= 0 ? "+" : ""}{u.pnl.toFixed(2)} $
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: u.ref_income > 0 ? "#f59e0b" : muted }}>
                              {u.ref_income > 0 ? `+${u.ref_income.toFixed(2)} $` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ color: "#fff", fontSize: 13, marginBottom: 8 }}>
                                <span style={{ color: muted, marginRight: 4 }}>Рефералы:</span>
                                {u.referrals_count}
                              </div>
                              <div style={{ 
                                display: "inline-block",
                                padding: "4px 8px", 
                                background: u.status ? `${STATUS_COLORS[u.status]}22` : "rgba(107, 138, 176, 0.15)",
                                border: `1px solid ${u.status ? STATUS_COLORS[u.status] : "#6b8ab0"}`,
                                borderRadius: 6,
                                fontSize: 11, 
                                color: u.status ? STATUS_COLORS[u.status] : "#6b8ab0", 
                                fontWeight: 600 
                              }}>
                                {u.status ? STATUS_LABELS[u.status] || u.status : "🔰 Инвестор"}
                              </div>
                              {u.next_vol ? (
                                <div style={{ marginTop: 8, width: 120 }}>
                                  <div style={{ fontSize: 9, color: muted, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                                    <span>Оборот: {u.total_volume ? u.total_volume.toFixed(0) : 0} $</span>
                                    <span>До {getNextStatusName(u.next_vol)}: {u.next_vol} $</span>
                                  </div>
                                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(((u.total_volume || 0) / u.next_vol) * 100, 100)}%`, height: "100%", background: u.status && STATUS_COLORS[u.status] ? STATUS_COLORS[u.status] : "#6b8ab0" }} />
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 10, color: muted, marginTop: 6 }}>
                                  Оборот: {u.total_volume ? u.total_volume.toFixed(0) : "0"} $
                                </div>
                              )}
                            </td>
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
                                        {/* Пополнение из пула */}
                                        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(34,201,122,0.05)", border: "1px solid rgba(34,201,122,0.2)" }}>
                                          <p style={{ color: "#22c97a", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>💰 Пополнить из средств пула (Крипто)</p>
                                          <p style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Деньги уже физически в пуле. Только регистрирует вклад в базе, не меняет баланс пула.</p>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <input type="number" id={`pool-deposit-${u.id}`}
                                              placeholder="Сумма USDT..."
                                              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(34,201,122,0.3)",
                                                color: "#fff", outline: "none" }} />
                                            <button
                                              onClick={async () => {
                                                const inp = document.getElementById(`pool-deposit-${u.id}`) as HTMLInputElement;
                                                const amt = parseFloat(inp?.value || "0");
                                                if (!amt || isNaN(amt) || amt <= 0) return alert("Введите корректную сумму");
                                                if (!confirm(`Пополнить депозит ${u.email} на ${amt} $ из пула? Баланс пула не изменится.`)) return;
                                                try {
                                                  const r = await depositFromPool(u.id, amt);
                                                  alert(`✅ Готово! Депозит зарегистрирован. entry_pct: ${r.entry_pct}%`);
                                                  if (inp) inp.value = "";
                                                  fetchData();
                                                } catch (e: any) {
                                                  alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                                                }
                                              }}
                                              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                                                background: "rgba(34,201,122,0.6)", color: "#fff", cursor: "pointer" }}>
                                              Пополнить из пула
                                            </button>
                                          </div>
                                        </div>
                                        {/* Внешний депозит */}
                                        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "rgba(77,142,255,0.06)", border: "1px solid rgba(77,142,255,0.3)" }}>
                                          <p style={{ color: "#4d8eff", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📥 Внешний депозит (деньги пришли извне)</p>
                                          <p style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Деньги поступили на счёт снаружи. Увеличивает баланс пула и регистрирует вклад.</p>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <input type="number" id={`ext-deposit-${u.id}`}
                                              placeholder="Сумма USDT..."
                                              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(77,142,255,0.3)",
                                                color: "#fff", outline: "none" }} />
                                            <button
                                              onClick={async () => {
                                                const inp = document.getElementById(`ext-deposit-${u.id}`) as HTMLInputElement;
                                                const amt = parseFloat(inp?.value || "0");
                                                if (!amt || isNaN(amt) || amt <= 0) return alert("Введите корректную сумму");
                                                if (!confirm(`Зарегистрировать внешний депозит ${u.email} на ${amt} $? Баланс пула увеличится на эту сумму.`)) return;
                                                try {
                                                  const r = await externalDeposit(u.id, amt);
                                                  alert(`✅ Готово! Депозит зарегистрирован. entry_pct: ${r.entry_pct}%`);
                                                  if (inp) inp.value = "";
                                                  fetchData();
                                                } catch (e: any) {
                                                  alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                                                }
                                              }}
                                              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                                                background: "rgba(77,142,255,0.6)", color: "#fff", cursor: "pointer" }}>
                                              Внешний депозит
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>💱 Форекс Пул</p>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                          {[
                                            { label: "Инвестировано (USDT)", field: "forex_investment_usdt" as keyof InvestorForm, type: "number" },
                                            { label: "Выведено (USDT)", field: "forex_withdrawal_usdt" as keyof InvestorForm, type: "number" },
                                            { label: "Лимит рефералов (глубина)", field: "referral_limit" as keyof InvestorForm, type: "number" },
                                            { label: "Индивид. % (напр. 80)", field: "custom_investor_share" as keyof InvestorForm, type: "number" },
                                          ].map(({ label, field, type }) => (
                                            <div key={field}>
                                              <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>{label}</label>
                                              <input type={type} value={f[field]}
                                                onChange={e => updateForm(u.id, field, e.target.value)}
                                                style={{ ...inputStyle, border: "1px solid rgba(245,158,11,0.3)" }} />
                                            </div>
                                          ))}
                                          <div style={{ gridColumn: "span 2" }}>
                                            <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>Заметка</label>
                                            <input type="text" value={f.note}
                                              onChange={e => updateForm(u.id, "note", e.target.value)}
                                              style={{ ...inputStyle, border: "1px solid rgba(245,158,11,0.3)" }} />
                                          </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                                          <button onClick={() => handleForexSave(u.id)} disabled={forexSavingId === u.id}
                                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(40,30,0,0.8)", color: "#f59e0b", cursor: "pointer", border: "none", opacity: forexSavingId === u.id ? 0.5 : 1 }}>
                                            <Save size={13} />{forexSavingId === u.id ? "Сохранение..." : "Сохранить форекс"}
                                          </button>
                                          {forexSaveMsg[u.id] && <span style={{ fontSize: 13, fontWeight: 600, color: forexSaveMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>{forexSaveMsg[u.id]}</span>}
                                          <button onClick={async () => {
                                            if (!confirm(`Сбросить locked_forex_pnl до 0 и установить entry на текущий pct для ${u.email}? Используй только при аномальных значениях прибыли.`)) return;
                                            try {
                                              await emergencyFixForexPnl(u.email);
                                              alert("✅ Сброшено. Обнови страницу.");
                                              fetchData();
                                            } catch (e: any) {
                                              alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                                            }
                                          }} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                                            background: "rgba(60,10,10,0.8)", color: "#ff6b6b", cursor: "pointer",
                                            border: "1px solid rgba(255,107,107,0.3)" }}>
                                            ⚠ Сбросить аномалию
                                          </button>
                                        </div>
                                        {/* Пополнение из форекс-пула */}
                                        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                          <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>💰 Пополнить из средств пула (Форекс)</p>
                                          <p style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Деньги уже физически в пуле. Только регистрирует вклад, не меняет баланс пула.</p>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <input type="number" id={`forex-pool-deposit-${u.id}`}
                                              placeholder="Сумма USDT..."
                                              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,158,11,0.3)",
                                                color: "#fff", outline: "none" }} />
                                            <button
                                              onClick={async () => {
                                                const inp = document.getElementById(`forex-pool-deposit-${u.id}`) as HTMLInputElement;
                                                const amt = parseFloat(inp?.value || "0");
                                                if (!amt || isNaN(amt) || amt <= 0) return alert("Введите корректную сумму");
                                                if (!confirm(`Пополнить Форекс-депозит ${u.email} на ${amt} $ из пула? Баланс пула не изменится.`)) return;
                                                try {
                                                  const r = await depositForexFromPool(u.id, amt);
                                                  alert(`✅ Готово! Форекс-депозит зарегистрирован. entry_pct: ${r.entry_pct}%`);
                                                  if (inp) inp.value = "";
                                                  fetchData();
                                                } catch (e: any) {
                                                  alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                                                }
                                              }}
                                              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                                                background: "rgba(245,158,11,0.6)", color: "#fff", cursor: "pointer" }}>
                                              Пополнить из пула
                                            </button>
                                          </div>
                                        </div>
                                        {/* Внешний депозит Форекс */}
                                        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "rgba(77,142,255,0.06)", border: "1px solid rgba(77,142,255,0.3)" }}>
                                          <p style={{ color: "#4d8eff", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📥 Внешний депозит Форекс (деньги пришли извне)</p>
                                          <p style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Деньги поступили снаружи и уже на счёте. Увеличивает баланс Форекс пула и регистрирует вклад.</p>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <input type="number" id={`forex-ext-deposit-${u.id}`}
                                              placeholder="Сумма USDT..."
                                              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(77,142,255,0.3)",
                                                color: "#fff", outline: "none" }} />
                                            <button
                                              onClick={async () => {
                                                const inp = document.getElementById(`forex-ext-deposit-${u.id}`) as HTMLInputElement;
                                                const amt = parseFloat(inp?.value || "0");
                                                if (!amt || isNaN(amt) || amt <= 0) return alert("Введите корректную сумму");
                                                if (!confirm(`Зарегистрировать внешний Форекс-депозит ${u.email} на ${amt} $? Баланс Форекс пула увеличится на эту сумму.`)) return;
                                                try {
                                                  const r = await forexExternalDeposit(u.id, amt);
                                                  alert(`✅ Готово! Форекс-депозит зарегистрирован. entry_pct: ${r.entry_pct}%`);
                                                  if (inp) inp.value = "";
                                                  fetchData();
                                                } catch (e: any) {
                                                  alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                                                }
                                              }}
                                              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                                                background: "rgba(77,142,255,0.6)", color: "#fff", cursor: "pointer" }}>
                                              Внешний депозит
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Настройки статуса и лимитов (Общие) */}
                                    <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, marginTop: 8 }}>
                                      <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Партнерские настройки (Общие)</p>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                        <div>
                                          <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>Пригласитель (Email)</label>
                                          <input type="email" value={f.referred_by_email}
                                            onChange={e => updateForm(u.id, "referred_by_email", e.target.value)}
                                            placeholder="admin@example.com"
                                            style={inputStyle} />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>Статус (Вручную)</label>
                                          <select value={f.manual_status_override} onChange={e => updateForm(u.id, "manual_status_override", e.target.value)}
                                            style={{ ...inputStyle, background: "rgba(0,0,0,0.5)" }}>
                                            <option value="NONE">Автоматически</option>
                                            <option value="PARTNER">Партнер</option>
                                            <option value="BRONZE">Бронза</option>
                                            <option value="GOLD">Золото</option>
                                            <option value="VIP">VIP</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 6 }}>Лимит инвайтов (Минимум)</label>
                                          <input type="number" value={f.referral_limit}
                                            onChange={e => updateForm(u.id, "referral_limit", e.target.value)}
                                            style={inputStyle} />
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                                        <button onClick={() => handleStatusSave(u.id)}
                                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(68,136,221,0.2)", color: "#4488dd", cursor: "pointer", border: "1px solid rgba(68,136,221,0.4)" }}>
                                          <Save size={13} /> Сохранить настройки
                                        </button>
                                        {statusOverrideMsg[u.id] && <span style={{ fontSize: 13, fontWeight: 600, color: statusOverrideMsg[u.id].startsWith("✓") ? "#22c97a" : "#ff4d4d" }}>{statusOverrideMsg[u.id]}</span>}
                                      </div>
                                    </div>

                                    {trees[u.id] && (
                                      <div style={{ borderTop: `1px solid ${border}`, marginTop: 16, paddingTop: 16 }}>
                                        <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Дерево рефералов</p>
                                        <ReferralNetwork data={trees[u.id]} rootEmail={u.email} />
                                      </div>
                                    )}

                                    {/* Служебные операции инвестора */}
                                    <div style={{ borderTop: `1px solid ${border}`, marginTop: 16, paddingTop: 8 }}>
                                      <button
                                        onClick={() => setInvestorDangerOpen(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "10px 0",
                                          background: "transparent", border: "none", cursor: "pointer", color: muted }}>
                                        <span>🛠 Служебные операции</span>
                                        {investorDangerOpen[u.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </button>
                                      {investorDangerOpen[u.id] && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
                                          <div style={{ display: "flex", gap: 12 }}>
                                            <button onClick={() => handleDelete(u.id, u.email)}
                                              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                                              <Trash2 size={13} /> Удалить
                                            </button>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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

        {/* Новости */}
        {activeTab === "news" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Форма создания */}
            <div style={{ ...card, padding: 20 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Новая новость</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  value={newsTitle}
                  onChange={e => setNewsTitle(e.target.value)}
                  placeholder="Заголовок"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }}
                />
                <textarea
                  value={newsBody}
                  onChange={e => setNewsBody(e.target.value)}
                  placeholder="Текст новости..."
                  rows={4}
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                />

                {/* Загрузка картинки */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(0,180,255,0.1)", border: `1px solid rgba(0,180,255,0.3)`,
                    borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#00cfff",
                    opacity: newsImageLoading ? 0.6 : 1,
                  }}>
                    📷 {newsImageLoading ? "Загрузка..." : newsImageUrl ? "Заменить картинку" : "Добавить картинку"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleNewsImageUpload}
                      disabled={newsImageLoading}
                    />
                  </label>
                  {newsImageUrl && (
                    <>
                      <img src={newsImageUrl} alt="preview" style={{ height: 48, width: 80, objectFit: "cover", borderRadius: 6, border: `1px solid ${border}` }} />
                      <button
                        onClick={() => setNewsImageUrl(null)}
                        style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                        title="Удалить картинку"
                      >✕</button>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <select
                    value={newsPool}
                    onChange={e => setNewsPool(e.target.value as "all" | "crypto" | "forex")}
                    style={{ background: "rgba(5,10,30,0.95)", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#e0e8ff", fontSize: 13, outline: "none", cursor: "pointer" }}
                  >
                    <option value="all">Все пулы</option>
                    <option value="crypto">Крипто пул</option>
                    <option value="forex">Форекс пул</option>
                  </select>
                  <button
                    onClick={handleCreateNews}
                    disabled={newsLoading || newsImageLoading || !newsTitle.trim() || !newsBody.trim()}
                    style={{ background: poolColor, color: "#000", fontWeight: 700, fontSize: 13, padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", opacity: (newsLoading || newsImageLoading || !newsTitle.trim() || !newsBody.trim()) ? 0.5 : 1 }}
                  >
                    {newsLoading ? "Публикация..." : "Опубликовать"}
                  </button>
                  {newsMsg && <span style={{ fontSize: 13, color: newsMsg.includes("Ошибка") ? "#ff4d4d" : "#22c97a" }}>{newsMsg}</span>}
                </div>
              </div>
            </div>

            {/* Список новостей */}
            <div style={{ ...card, padding: 20 }}>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Опубликованные новости</h3>
              {newsList.length === 0
                ? <p style={{ color: muted, fontSize: 13 }}>Новостей пока нет</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {newsList.map(n => (
                    <div key={n.id} style={{ padding: "14px 0", borderBottom: `1px solid ${border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                            background: n.pool_type === "forex" ? "rgba(245,158,11,0.15)" : n.pool_type === "crypto" ? "rgba(68,136,221,0.15)" : "rgba(34,201,122,0.12)",
                            color: n.pool_type === "forex" ? "#f59e0b" : n.pool_type === "crypto" ? "#4488dd" : "#22c97a" }}>
                            {n.pool_type === "forex" ? "Форекс" : n.pool_type === "crypto" ? "Крипто" : "Все пулы"}
                          </span>
                          <span style={{ color: muted, fontSize: 11 }}>{new Date(n.created_at).toLocaleString("ru")}</span>
                        </div>
                        <p style={{ color: muted, fontSize: 13, whiteSpace: "pre-wrap" }}>{n.body}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        style={{ color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}

        {/* Поддержка — двухуровневый UI */}
        {activeTab === "support" && (() => {
          // Группируем тикеты по email пользователя
          const userMap = new Map<string, typeof tickets>();
          tickets.forEach(t => {
            const email = t.user_email || "—";
            if (!userMap.has(email)) userMap.set(email, []);
            userMap.get(email)!.push(t);
          });
          const userList = Array.from(userMap.entries()).sort((a, b) => {
            // Сначала пользователи с открытыми тикетами
            const aOpen = a[1].some(t => t.status === "open") ? 0 : 1;
            const bOpen = b[1].some(t => t.status === "open") ? 0 : 1;
            return aOpen - bOpen;
          });

          const userTickets = selectedSupportUser ? (userMap.get(selectedSupportUser) || []) : [];

          return (
            <div style={{ ...card, padding: 20 }}>
              {/* Шапка */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {selectedSupportUser && (
                    <button
                      onClick={() => { setSelectedSupportUser(null); setExpandedTicket(null); }}
                      style={{ background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.25)", borderRadius: 8, color: "#00b4ff", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      ← Назад
                    </button>
                  )}
                  <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>
                    {selectedSupportUser
                      ? <span>👤 <span style={{ color: "#00b4ff" }}>{selectedSupportUser}</span></span>
                      : <>Обращения в поддержку
                        {tickets.filter(t => t.status === "open").length > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                            {tickets.filter(t => t.status === "open").length} новых
                          </span>
                        )}
                      </>
                    }
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {clearTicketsMsg && (
                    <span style={{ fontSize: 12, color: clearTicketsMsg.includes("Ошибка") ? "#ff4d4d" : "#22c97a" }}>
                      {clearTicketsMsg}
                    </span>
                  )}
                  {!selectedSupportUser && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleClearClosedTickets}
                        disabled={clearClosedLoading || tickets.filter(t => t.status === "closed").length === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                          border: "1px solid rgba(245,158,11,0.3)",
                          opacity: (clearClosedLoading || tickets.filter(t => t.status === "closed").length === 0) ? 0.5 : 1,
                        }}
                      >
                        🗑 {clearClosedLoading ? "Удаление…" : "Удалить закрытые"}
                      </button>
                      <button
                        onClick={handleClearAllTickets}
                        disabled={clearTicketsLoading || tickets.length === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: "rgba(127,29,29,0.7)", color: "#fca5a5",
                          border: "1px solid rgba(255,77,77,0.3)",
                          opacity: (clearTicketsLoading || tickets.length === 0) ? 0.5 : 1,
                        }}
                      >
                        🗑 {clearTicketsLoading ? "Удаление…" : "Очистить историю"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Уровень 1: список пользователей */}
              {!selectedSupportUser && (
                tickets.length === 0
                  ? <p style={{ color: muted, fontSize: 13 }}>Обращений пока нет</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {userList.map(([email, userTix]) => {
                      const openCount = userTix.filter(t => t.status === "open").length;
                      const answeredCount = userTix.filter(t => t.status === "answered").length;
                      const lastDate = userTix[0]?.created_at;
                      return (
                        <button
                          key={email}
                          onClick={() => { setSelectedSupportUser(email); setExpandedTicket(null); }}
                          style={{
                            width: "100%", textAlign: "left", background: openCount > 0
                              ? "rgba(245,158,11,0.06)"
                              : "rgba(255,255,255,0.02)",
                            border: `1px solid ${openCount > 0 ? "rgba(245,158,11,0.25)" : border}`,
                            borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            transition: "background 0.15s",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 18 }}>👤</span>
                              <span style={{ color: "#e0e8ff", fontWeight: 600, fontSize: 14 }}>{email}</span>
                              {openCount > 0 && (
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                                  {openCount} открыт{openCount === 1 ? "" : "о"}
                                </span>
                              )}
                              {answeredCount > 0 && (
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: "rgba(34,201,122,0.12)", color: "#22c97a" }}>
                                  {answeredCount} отвечено
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 12, color: muted, fontSize: 12 }}>
                              <span>Тикетов: <b style={{ color: "#8aa0c0" }}>{userTix.length}</b></span>
                              {lastDate && <span>Последний: {new Date(lastDate).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                            </div>
                          </div>
                          <span style={{ color: "#4a6a9a", fontSize: 18, flexShrink: 0 }}>›</span>
                        </button>
                      );
                    })}
                  </div>
              )}

              {/* Уровень 2: тикеты выбранного пользователя */}
              {selectedSupportUser && (
                userTickets.length === 0
                  ? <p style={{ color: muted, fontSize: 13 }}>Нет тикетов</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {userTickets.map(t => (
                      <div key={t.id} style={{ borderBottom: `1px solid ${border}` }}>
                        <button
                          onClick={() => setExpandedTicket(expandedTicket === t.id ? null : t.id)}
                          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textAlign: "left" }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{t.subject}</span>
                              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                                background: t.status === "open" ? "rgba(245,158,11,0.15)" : t.status === "closed" ? "rgba(100,100,120,0.2)" : "rgba(34,201,122,0.12)",
                                color: t.status === "open" ? "#f59e0b" : t.status === "closed" ? "#8090b0" : "#22c97a" }}>
                                {t.status === "open" ? "Открыт" : t.status === "closed" ? "Закрыт" : "Отвечен"}
                              </span>
                              {t.replies.length > 0 && (
                                <span style={{ fontSize: 10, color: muted }}>💬 {t.replies.length}</span>
                              )}
                            </div>
                            <span style={{ color: muted, fontSize: 11 }}>{new Date(t.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <span style={{ color: muted, fontSize: 16 }}>{expandedTicket === t.id ? "▲" : "▼"}</span>
                        </button>

                        {expandedTicket === t.id && (
                          <div style={{ paddingBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 14px" }}>
                              <p style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>ВОПРОС</p>
                              <p style={{ color: "#e0e8ff", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.message}</p>
                            </div>
                            {t.replies.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {t.replies.map(r => (
                                  <div key={r.id} style={{ background: "rgba(34,201,122,0.06)", border: "1px solid rgba(34,201,122,0.15)", borderRadius: 8, padding: "10px 14px" }}>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                                      <span style={{ color: "#22c97a", fontSize: 11, fontWeight: 700 }}>Ваш ответ</span>
                                      <span style={{ color: muted, fontSize: 11 }}>{new Date(r.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <p style={{ color: "#e0e8ff", fontSize: 13, lineHeight: 1.6 }}>{r.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {t.status !== "closed" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <textarea
                                  value={replyTexts[t.id] || ""}
                                  onChange={e => setReplyTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  placeholder="Ваш ответ..."
                                  rows={3}
                                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                                />
                                <div style={{ display: "flex", gap: 10 }}>
                                  <button
                                    onClick={() => handleReply(t.id)}
                                    disabled={replyLoading === t.id || !(replyTexts[t.id] || "").trim()}
                                    style={{ background: "#22c97a", color: "#000", fontWeight: 700, fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", opacity: (replyLoading === t.id || !(replyTexts[t.id] || "").trim()) ? 0.5 : 1 }}
                                  >
                                    {replyLoading === t.id ? "Отправка..." : "Ответить"}
                                  </button>
                                  <button
                                    onClick={() => handleAdminClose(t.id)}
                                    style={{ background: "rgba(100,100,120,0.2)", color: "#8090b0", fontWeight: 600, fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(100,100,120,0.3)", cursor: "pointer" }}
                                  >
                                    Закрыть тикет
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
              )}
            </div>
          );
        })()}

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

