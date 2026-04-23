import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return res.data as { access_token: string; is_admin: boolean };
}

export async function register(email: string, password: string, referral_code?: string) {
  const res = await api.post("/auth/register", { email, password, referral_code });
  return res.data;
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

export async function getUserHistory(id: string) {
  const res = await api.get(`/auth/admin/users/${id}/history`);
  return res.data as {
    deposits: {id:string;amount:number;comment:string;status:string;created_at:string}[];
    withdrawals: {id:string;amount:number;comment:string;status:string;created_at:string}[];
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
