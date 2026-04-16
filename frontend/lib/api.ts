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
  return res.data as { access_token: string };
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
