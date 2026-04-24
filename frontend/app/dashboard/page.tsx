"use client";
import { useEffect, useState } from "react";
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
  ref_bonus: number;
  referral_code: string;
  referrals: ReferralInfo[];
  positions: Position[]; recent_trades: Trade[]; ai_feed: AIFeed[];
}

const ACTION_COLOR: Record<string, string> = { BUY: "#22c97a", SELL: "#4488dd", HOLD: "#888" };

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
    } catch {
      setError("Ошибка загрузки. Возможно сессия истекла.");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  async function handleDepositSubmit() {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setDepositLoading(true);
    try {
      await createDepositRequest(amount, depositComment);
      setDepositDone(true);
      setDepositAmount("");
      setDepositComment("");
      const updated = await getMyDeposits();
      setMyDeposits(updated);
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleWithdrawSubmit() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;
    setWithdrawLoading(true);
    try {
      await createWithdrawalRequest(amount, withdrawComment);
      setWithdrawDone(true);
      setWithdrawAmount("");
      setWithdrawComment("");
      const updated = await getMyWithdrawals();
      setMyWithdrawals(updated);
    } finally {
      setWithdrawLoading(false);
    }
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

  const pnlColor = data.user_pnl >= 0 ? "#22c97a" : "#ff4d4d";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Шапка */}
      <header className="border-b px-4 py-3 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="font-bold text-white text-base leading-none">AI Маклер</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: data.server_online ? "#0d3a20" : "#3a0d0d",
              color: data.server_online ? "#22c97a" : "#ff4d4d"
            }}>
              {data.server_online ? "● ONLINE" : "● OFFLINE"}
            </span>
          </div>
        </div>

        {/* Шестерёнка — меню */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-lg border transition hover:opacity-80"
            style={{ borderColor: menuOpen ? "#4488dd" : "var(--border)", color: menuOpen ? "#4488dd" : "var(--muted)" }}>
            <Settings size={20} />
          </button>

          {menuOpen && (
            <>
              {/* Оверлей для закрытия по клику вне */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border shadow-xl overflow-hidden"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}>

                {/* Реал / Демо */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm text-white">Режим</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Реал</span>
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/demo"); }}
                      className="relative w-11 h-6 rounded-full"
                      style={{ background: "#2a2a2a", border: "1px solid #444" }}>
                      <span className="absolute left-1 top-1 w-4 h-4 rounded-full"
                        style={{ background: "#666" }} />
                    </button>
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Демо</span>
                  </div>
                </div>

                {/* Пополнить */}
                <button
                  onClick={() => { setMenuOpen(false); setShowDeposit(true); setDepositDone(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 border-b"
                  style={{ borderColor: "var(--border)", color: "#22c97a" }}>
                  <PlusCircle size={16} /> Пополнить счёт
                </button>

                {/* Вывести */}
                <button
                  onClick={() => { setMenuOpen(false); setShowWithdraw(true); setWithdrawDone(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 border-b"
                  style={{ borderColor: "var(--border)", color: "#ff9944" }}>
                  <Wallet size={16} /> Вывести средства
                </button>

                {/* Реферальная ссылка */}
                <button
                  onClick={() => { setMenuOpen(false); copyRefLink(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 border-b"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  <Copy size={16} /> {copied ? "Скопировано!" : "Реф. ссылка"}
                </button>

                {/* Выйти */}
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5"
                  style={{ color: "#ff4d4d" }}>
                  <LogOut size={16} /> Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Карточки */}
        <div className={`grid gap-4 ${data.ref_bonus > 0 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
          {[
            {
              icon: <Wallet size={20} />,
              label: "Общий пул (USDT)",
              value: `${data.pool_total_usdt.toFixed(2)} $`,
              sub: `свободно: ${data.balance_usdt.toFixed(2)} $`,
              color: "#4488dd"
            },
            {
              icon: <Activity size={20} />,
              label: "Пул в позициях",
              value: `${data.pool_positions_usdt.toFixed(2)} $`,
              sub: null,
              color: "#9966ee"
            },
            {
              icon: <TrendingUp size={20} />,
              label: "Ваш баланс",
              value: data.user_investment > 0 ? `${data.user_investment.toFixed(2)} $` : "—",
              sub: data.user_investment > 0 ? "инвестировано" : "нет данных",
              color: "#22c97a"
            },
            {
              icon: data.user_pnl >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />,
              label: "Чистый доход",
              value: data.user_investment > 0
                ? `${data.user_pnl >= 0 ? "+" : ""}${data.user_pnl.toFixed(2)} $`
                : "—",
              sub: data.user_investment > 0
                ? `${data.user_pnl_pct >= 0 ? "+" : ""}${data.user_pnl_pct.toFixed(2)}% (после комиссий)`
                : "нет вложений",
              color: pnlColor
            },
            ...(data.ref_bonus > 0 ? [{
              icon: <TrendingUp size={20} />,
              label: "Реферальный доход",
              value: `+${data.ref_bonus.toFixed(2)} $`,
              sub: "3% от прибыли рефералов",
              color: "#f59e0b"
            }] : []),
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>
                {c.icon}
                <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{c.value}</p>
              {c.sub && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Рефералы */}
        {data.referrals.length > 0 && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white mb-1">👥 Мои рефералы</h2>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Вы получаете 3% от прибыли каждого приглашённого
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th className="text-left pb-2 font-normal">Email</th>
                    <th className="text-right pb-2 font-normal">Инвестиция</th>
                    <th className="text-right pb-2 font-normal">Ваш бонус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 text-white">{r.email}</td>
                      <td className="py-2 text-right text-white">
                        {r.investment_usdt > 0 ? `${r.investment_usdt.toFixed(2)} $` : "—"}
                      </td>
                      <td className="py-2 text-right font-semibold" style={{ color: r.bonus_usdt > 0 ? "#f59e0b" : "var(--muted)" }}>
                        {r.bonus_usdt > 0 ? `+${r.bonus_usdt.toFixed(2)} $` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.ref_bonus > 0 && (
                  <tfoot>
                    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td colSpan={2} className="pt-2 text-sm" style={{ color: "var(--muted)" }}>Итого бонус</td>
                      <td className="pt-2 text-right font-bold" style={{ color: "#f59e0b" }}>
                        +{data.ref_bonus.toFixed(2)} $
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Открытые позиции */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4">💼 Открытые позиции</h2>
            {data.positions.length === 0
              ? <p className="text-sm" style={{ color: "var(--muted)" }}>Позиций нет</p>
              : <div className="space-y-2">
                {data.positions.map((p, i) => {
                  const cur = p.current_price || p.avg_price;
                  const value = p.amount * cur;
                  const pnl = p.amount * (cur - p.avg_price);
                  const pnlPct = ((cur - p.avg_price) / p.avg_price) * 100;
                  const pnlColor = pnl >= 0 ? "#22c97a" : "#ff4d4d";
                  return (
                    <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <span className="font-medium text-white">{p.symbol}</span>
                      <div className="text-right">
                        <p className="text-sm text-white">{value.toFixed(2)} $</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          avg ${p.avg_price.toFixed(4)} · тек. ${cur.toFixed(4)}
                        </p>
                        <p className="text-xs font-semibold" style={{ color: pnlColor }}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} $ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  );
                })}
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
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: ACTION_COLOR[t.action] + "22", color: ACTION_COLOR[t.action] }}>
                        {t.action}
                      </span>
                      <span className="text-sm text-white">{t.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">${t.price.toFixed(4)}</p>
                      {t.pnl != null && (
                        <p className="text-xs" style={{ color: t.pnl >= 0 ? "#22c97a" : "#ff4d4d" }}>
                          {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}$
                        </p>
                      )}
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

        {/* История заявок */}
        {myDeposits.length > 0 && (
          <div className="rounded-xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold text-white mb-4">💳 Заявки на пополнение</h2>
            <div className="space-y-2">
              {myDeposits.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className="text-white font-medium">{d.amount.toFixed(2)} USDT</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(d.created_at).toLocaleString("ru")}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                    background: d.status === "approved" ? "#0d3a20" : d.status === "rejected" ? "#3a0d0d" : "#1a1200",
                    color: d.status === "approved" ? "#22c97a" : d.status === "rejected" ? "#ff4d4d" : "#f59e0b"
                  }}>
                    {d.status === "approved" ? "✓ Подтверждено" : d.status === "rejected" ? "✗ Отклонено" : "⏳ Ожидает"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.last_updated && (
          <p className="text-center text-xs pb-4" style={{ color: "var(--muted)" }}>
            Последнее обновление: {new Date(data.last_updated).toLocaleString("ru")}
          </p>
        )}
      </main>

      {/* Модальное окно пополнения */}
      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeposit(false); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm border max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)", borderColor: "#22c97a44" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white text-lg">Пополнение депозита</h2>
              <button onClick={() => setShowDeposit(false)} style={{ color: "var(--muted)" }}><X size={20} /></button>
            </div>

            {depositDone ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">✅</div>
                <p className="text-white font-semibold">Заявка принята!</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Ваш депозит будет обработан администратором <span style={{ color: "#22c97a" }}>в течение суток.</span>
                </p>
                <button onClick={() => setShowDeposit(false)}
                  className="w-full py-2 rounded-lg font-semibold text-white mt-2 transition hover:opacity-90"
                  style={{ background: "#22c97a33", color: "#22c97a" }}>
                  Закрыть
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Адрес кошелька */}
                {process.env.NEXT_PUBLIC_WALLET_ADDRESS && (() => {
                  const addr = process.env.NEXT_PUBLIC_WALLET_ADDRESS!;
                  return (
                    <div className="rounded-xl p-4 border space-y-3" style={{ background: "#0d0d1a", borderColor: "#4488dd44" }}>
                      <p className="text-xs font-semibold text-center" style={{ color: "#4488dd" }}>
                        {process.env.NEXT_PUBLIC_WALLET_NETWORK || "USDT TRC20"} — адрес для пополнения
                      </p>
                      <div className="flex justify-center">
                        <div className="p-2 rounded-lg bg-white">
                          <QRCodeSVG value={addr} size={140} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#111130" }}>
                        <p className="flex-1 text-xs break-all font-mono" style={{ color: "var(--muted)" }}>{addr}</p>
                        <button onClick={() => {
                          navigator.clipboard.writeText(addr);
                          setCopiedAddress(true);
                          setTimeout(() => setCopiedAddress(false), 2000);
                        }} className="shrink-0 transition hover:opacity-80" style={{ color: copiedAddress ? "#22c97a" : "#4488dd" }}>
                          {copiedAddress ? <CheckCheck size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Сумма (USDT)</label>
                  <input
                    type="number" min="1" step="0.01"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-lg px-4 py-3 text-white text-xl font-bold border outline-none"
                    style={{ background: "#0d0d1a", borderColor: "#22c97a44" }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Комментарий / TXID (необязательно)</label>
                  <input
                    type="text"
                    value={depositComment}
                    onChange={e => setDepositComment(e.target.value)}
                    placeholder="Хэш транзакции или примечание..."
                    className="w-full rounded-lg px-4 py-3 text-white border outline-none"
                    style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
                  />
                </div>
                <div className="rounded-lg p-3 text-sm space-y-1" style={{ background: "#1a1200", borderLeft: "3px solid #f59e0b" }}>
                  <p style={{ color: "#f59e0b" }}>⏳ Заявка обрабатывается в течение суток.</p>
                  <p style={{ color: "#a87a30" }}>⚠️ Учтите комиссию сети — на счёт будет зачислена фактически полученная сумма, которая может быть меньше отправленной.</p>
                </div>
                <button
                  onClick={handleDepositSubmit}
                  disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="w-full py-3 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#22c97a" }}>
                  {depositLoading ? "Отправка..." : "Отправить заявку"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно — Вывод средств */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowWithdraw(false); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm border max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)", borderColor: "#ff994444" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white text-lg">Вывод средств</h2>
              <button onClick={() => setShowWithdraw(false)} style={{ color: "var(--muted)" }}><X size={20} /></button>
            </div>

            {withdrawDone ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">✅</div>
                <p className="font-bold text-white">Заявка отправлена</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>Администратор обработает её в течение суток.</p>
                <button onClick={() => setShowWithdraw(false)} className="w-full py-3 rounded-lg font-bold text-white" style={{ background: "#ff9944" }}>Закрыть</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Сумма вывода (USDT)</label>
                  <input
                    type="number" min="1" step="0.01"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-lg px-4 py-3 text-white border outline-none"
                    style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Адрес кошелька / комментарий</label>
                  <input
                    type="text"
                    value={withdrawComment}
                    onChange={e => setWithdrawComment(e.target.value)}
                    placeholder="TRC20 адрес или примечание..."
                    className="w-full rounded-lg px-4 py-3 text-white border outline-none"
                    style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
                  />
                </div>
                <div className="rounded-lg p-3 text-sm" style={{ background: "#1a0d00", borderLeft: "3px solid #ff9944" }}>
                  <p style={{ color: "#ff9944" }}>⏳ Заявка обрабатывается в течение суток.</p>
                </div>
                <button
                  onClick={handleWithdrawSubmit}
                  disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  className="w-full py-3 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#ff9944" }}>
                  {withdrawLoading ? "Отправка..." : "Отправить заявку"}
                </button>

                {myWithdrawals.length > 0 && (
                  <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>МОИ ЗАЯВКИ НА ВЫВОД</p>
                    {myWithdrawals.map(w => (
                      <div key={w.id} className="flex justify-between text-xs py-1">
                        <span style={{ color: "var(--muted)" }}>{new Date(w.created_at).toLocaleDateString("ru")}</span>
                        <span className="text-white">{w.amount} USDT</span>
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
