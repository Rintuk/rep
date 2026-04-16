"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, referralCode || undefined);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Заявка отправлена</h2>
          <p style={{ color: "var(--muted)" }}>Ожидайте одобрения администратора. Вы получите уведомление на email.</p>
          <a href="/login" className="inline-block mt-6 text-blue-400 hover:underline text-sm">← Вернуться к входу</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md rounded-2xl p-8 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤖</div>
          <h1 className="text-2xl font-bold text-white">Регистрация</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Доступ только по реферальной ссылке</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition"
              style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition"
              style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Реферальный код</label>
            <input
              type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition"
              style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
              placeholder="Вставьте код из приглашения"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Отправка..." : "Подать заявку"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--muted)" }}>
          Уже есть аккаунт?{" "}
          <a href="/login" className="text-blue-400 hover:underline">Войти</a>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
