import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://rep-production-cf90.up.railway.app";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const baseURL = config.baseURL || "";
    const isLocalhostFallback = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
    const pageHost = window.location.hostname;
    if (isLocalhostFallback && pageHost !== "localhost" && pageHost !== "127.0.0.1") {
      config.baseURL = `${window.location.protocol}//${pageHost}:8000`;
    }
  }
  return config;
});

export async function login(email: string, password: string, remember_me = false) {
  const res = await api.post("/auth/login", { email, password, remember_me });
  return res.data as { access_token: string; is_admin: boolean };
}

export async function register(email: string, nickname: string, password: string, referral_code?: string) {
  const res = await api.post("/auth/register", { email, nickname, password, referral_code });
  return res.data;
}

export async function updateNickname(nickname: string) {
  const res = await api.post("/auth/profile/nickname", { nickname });
  return res.data;
}

export async function changePassword(old_password: string, new_password: string) {
  const res = await api.post("/auth/change-password", null, { params: { old_password, new_password } });
  return res.data as { status: string };
}

export async function getDashboard() {
  const res = await api.get("/api/dashboard");
  return res.data;
}

export async function getAdminUsers() {
  const res = await api.get("/auth/admin/users");
  return res.data;
}

export async function getAdminOverview() {
  const res = await api.get("/auth/admin/overview");
  return res.data;
}

export async function getAdminPoolHistory() {
  const res = await api.get("/auth/admin/pool-history");
  return res.data as { ts: string; pool_total: number; pnl: number; pnl_pct: number }[];
}

// ── Форекс admin ────────────────────────────────────────────────────────────

export async function getAdminForexOverview() {
  const res = await api.get("/auth/admin/forex-overview");
  return res.data;
}

export async function getAdminForexPoolHistory() {
  const res = await api.get("/auth/admin/forex-pool-history");
  return res.data as { ts: string; pool_total: number; pnl: number; pnl_pct: number }[];
}

export async function getAdminForexDeposits() {
  const res = await api.get("/auth/admin/forex-deposits");
  return res.data;
}

export async function approveForexDeposit(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/forex-deposits/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function rejectForexDeposit(id: string) {
  const res = await api.post(`/auth/admin/forex-deposits/${id}/reject`);
  return res.data;
}

export async function getAdminForexWithdrawals() {
  const res = await api.get("/auth/admin/forex-withdrawals");
  return res.data;
}

export async function approveForexWithdrawal(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/forex-withdrawals/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function rejectForexWithdrawal(id: string) {
  const res = await api.post(`/auth/admin/forex-withdrawals/${id}/reject`);
  return res.data;
}

export async function updateUserForexFinancials(id: string, forex_investment_usdt: number, forex_withdrawal_usdt: number, note: string) {
  await api.patch(`/auth/admin/users/${id}/forex-financials`, null, {
    params: { forex_investment_usdt, forex_withdrawal_usdt, note }
  });
}

export async function cleanupForexDemoSnapshots() {
  const res = await api.post("/auth/admin/forex-cleanup-demo");
  return res.data as { deleted_snapshots: number; reset_investors: number; message: string };
}

export async function forexFullReset() {
  const res = await api.post("/auth/admin/forex-full-reset");
  return res.data as { deleted_snapshots: number; reset_investors: number; reset_demo_accounts: number; message: string };
}

export async function forexImportFromCrypto() {
  const res = await api.post("/auth/admin/forex-import-from-crypto");
  return res.data as { deleted_snapshots: number; reset_demo_accounts: number; imported_investors: number; message: string };
}

export async function adjustForexNetInvested(add_amount: number) {
  const res = await api.post("/auth/admin/forex-adjust-net-invested", null, { params: { add_amount } });
  return res.data as { updated_snapshots: number; add_amount: number; message: string };
}

// ── Обычный admin ────────────────────────────────────────────────────────────

export async function approveUser(id: string) {
  await api.post(`/auth/admin/approve/${id}`);
}

export async function rejectUser(id: string) {
  await api.post(`/auth/admin/reject/${id}`);
}

export async function getUserDetail(id: string) {
  const res = await api.get(`/auth/admin/users/${id}`);
  return res.data;
}

export async function getUserReferralTree(id: string) {
  const res = await api.get(`/auth/admin/users/${id}/tree`);
  return res.data.referrals;
}

export async function getUserHistory(id: string) {
  const res = await api.get(`/auth/admin/users/${id}/history`);
  return res.data as {
    deposits: {id:string;amount:number;comment:string;status:string;pool_type:string;created_at:string}[];
    withdrawals: {id:string;amount:number;comment:string;status:string;pool_type:string;created_at:string}[];
  };
}

export async function updateUserFinancials(id: string, investment_usdt: number, withdrawal_usdt: number, note: string) {
  await api.patch(`/auth/admin/users/${id}/financials`, null, {
    params: { investment_usdt, withdrawal_usdt, note }
  });
}

export async function deleteUser(id: string) {
  await api.delete(`/auth/admin/users/${id}`);
}

export async function setReferralLimit(id: string, limit: number) {
  await api.patch(`/auth/admin/referral-limit/${id}`, null, { params: { limit } });
}

export async function resetUserPassword(id: string, new_password: string) {
  await api.post(`/auth/admin/users/${id}/reset-password`, null, { params: { new_password } });
}

// ── Крипто депозиты/выводы (пользователь) ────────────────────────────────────

export async function createDepositRequest(amount: number, comment: string) {
  const res = await api.post("/auth/deposits/request", null, { params: { amount, comment } });
  return res.data;
}

export async function getMyDeposits() {
  const res = await api.get("/auth/deposits/my");
  return res.data;
}

export async function getAdminDeposits() {
  const res = await api.get("/auth/admin/deposits");
  return res.data;
}

export async function approveDeposit(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/deposits/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function rejectDeposit(id: string) {
  const res = await api.post(`/auth/admin/deposits/${id}/reject`);
  return res.data;
}

export async function createWithdrawalRequest(amount: number, comment: string) {
  const res = await api.post("/auth/withdrawals/request", null, { params: { amount, comment } });
  return res.data;
}

export async function getMyWithdrawals() {
  const res = await api.get("/auth/withdrawals/my");
  return res.data;
}

export async function getAdminWithdrawals() {
  const res = await api.get("/auth/admin/withdrawals");
  return res.data;
}

export async function approveWithdrawal(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/withdrawals/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function rejectWithdrawal(id: string) {
  const res = await api.post(`/auth/admin/withdrawals/${id}/reject`);
  return res.data;
}

// ── Форекс депозиты/выводы (пользователь) ────────────────────────────────────

export async function createForexDepositRequest(amount: number, comment: string) {
  const res = await api.post("/auth/forex-deposits/request", null, { params: { amount, comment } });
  return res.data;
}

export async function getMyForexDeposits() {
  const res = await api.get("/auth/forex-deposits/my");
  return res.data;
}

export async function createForexWithdrawalRequest(amount: number, comment: string) {
  const res = await api.post("/auth/forex-withdrawals/request", null, { params: { amount, comment } });
  return res.data;
}

export async function getMyForexWithdrawals() {
  const res = await api.get("/auth/forex-withdrawals/my");
  return res.data;
}

// ── Крипто демо ──────────────────────────────────────────────────────────────

export async function cleanupDemoSnapshots() {
  const res = await api.post("/auth/admin/cleanup-demo-snapshots");
  return res.data as { deleted_snapshots: number; reset_investors: number; message: string };
}

export async function cryptoFullReset() {
  const res = await api.post("/auth/admin/crypto-full-reset");
  return res.data as { deleted_snapshots: number; reset_investors: number; reset_demo_accounts: number; message: string };
}

export async function adjustNetInvested(add_amount: number) {
  const res = await api.post("/auth/admin/adjust-net-invested", null, { params: { add_amount } });
  return res.data as { updated_snapshots: number; add_amount: number; message: string };
}

// ── Поддержка ────────────────────────────────────────────────────────────────

export interface SupportReply {
  id: string;
  body: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  has_unread: boolean;
  replies: SupportReply[];
  user_email?: string;
}

export async function createSupportTicket(subject: string, message: string) {
  const res = await api.post("/auth/support/ticket", { subject, message });
  return res.data as SupportTicket;
}

export async function getMyTickets() {
  const res = await api.get("/auth/support/my-tickets");
  return res.data as SupportTicket[];
}

export async function getAdminTickets() {
  const res = await api.get("/auth/admin/support");
  return res.data as SupportTicket[];
}

export async function replyToTicket(ticketId: string, body: string) {
  const res = await api.post(`/auth/admin/support/${ticketId}/reply`, null, { params: { body } });
  return res.data as SupportTicket;
}

export async function adminCloseTicket(ticketId: string) {
  await api.post(`/auth/admin/support/${ticketId}/close`);
}

export async function clearAllTickets() {
  const res = await api.post("/auth/admin/support/clear-all");
  return res.data as { status: string; message: string };
}

export async function clearClosedTickets() {
  const res = await api.post("/auth/admin/support/clear-closed");
  return res.data as { status: string; message: string };
}

export async function investorCloseTicket(ticketId: string) {
  await api.post(`/auth/support/${ticketId}/close`);
}

export async function markTicketsRead() {
  await api.post("/auth/support/mark-read");
}

// ── Новости ──────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  pool_type: string;
  image_url?: string | null;
  created_at: string;
}

export async function getAdminNews() {
  const res = await api.get("/auth/admin/news");
  return res.data as NewsItem[];
}

export async function createNews(title: string, body: string, pool_type: string, image_url?: string | null) {
  const res = await api.post("/auth/admin/news", { title, body, pool_type, image_url });
  return res.data as NewsItem;
}

export async function uploadNewsImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/auth/admin/news/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url as string;
}

export async function deleteNews(id: string) {
  await api.delete(`/auth/admin/news/${id}`);
}

export async function getNews() {
  const res = await api.get("/api/news");
  return res.data as NewsItem[];
}

export async function getDemoAccount() {
  const res = await api.get("/api/demo/account");
  return res.data;
}

export async function startDemoAccount(amount: number) {
  const res = await api.post("/api/demo/start", null, { params: { amount } });
  return res.data;
}

export async function resetDemoAccount() {
  const res = await api.post("/api/demo/reset");
  return res.data;
}

// ── Форекс демо ──────────────────────────────────────────────────────────────

export async function getForexDemoAccount() {
  const res = await api.get("/api/demo/forex/account");
  return res.data;
}

export async function startForexDemoAccount(amount: number) {
  const res = await api.post("/api/demo/forex/start", null, { params: { amount } });
  return res.data;
}

export async function resetForexDemoAccount() {
  const res = await api.post("/api/demo/forex/reset");
  return res.data;
}

// ── Admin: Migration & Override ──────────────────────────────────────────────

export async function backupDatabase() {
  const res = await api.get("/auth/admin/backup-db");
  return res.data;
}

export async function migratePnL() {
  const res = await api.post("/auth/admin/migrate-pnl");
  return res.data;
}

export async function setStatusOverride(userId: string, status: string | null) {
  const res = await api.patch(`/auth/admin/status-override/${userId}`, null, {
    params: { status: status || "NONE" }
  });
  return res.data;
}

export async function setUserReferrer(userId: string, referredByEmail: string) {
  const res = await api.patch(`/auth/admin/set-referrer/${userId}`, { referred_by_email: referredByEmail || null });
  return res.data;
}

export async function setCustomInvestorShare(userId: string, share: number | null) {
  const res = await api.post(`/auth/admin/investor-share/${userId}`, { share });
  return res.data;
}

export async function silentWithdraw(pool: string, amount: number) {
  const res = await api.post("/auth/admin/silent-withdraw", { pool, amount });
  return res.data;
}

export async function revertSilentWithdraw(pool: string, decreased_base_by: number) {
  const res = await api.post("/auth/admin/revert-silent-withdraw", { pool, decreased_base_by });
  return res.data;
}
