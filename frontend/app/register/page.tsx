"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [refFromUrl, setRefFromUrl] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
      setRefFromUrl(true);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
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

  const passwordsMatch = passwordConfirm === "" || password === passwordConfirm;

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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition pr-11"
                style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                style={{ color: "var(--muted)" }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>
              Повторите пароль
            </label>
            <div className="relative">
              <input
                type={showPasswordConfirm ? "text" : "password"} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required
                className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition pr-11"
                style={{
                  background: "#0d0d1a",
                  borderColor: !passwordsMatch ? "#ff4d4d" : passwordConfirm.length > 0 && passwordsMatch ? "#22c97a" : "var(--border)"
                }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPasswordConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                style={{ color: "var(--muted)" }}>
                {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!passwordsMatch && (
              <p className="text-xs mt-1 text-red-400">Пароли не совпадают</p>
            )}
            {passwordConfirm.length > 0 && passwordsMatch && (
              <p className="text-xs mt-1" style={{ color: "#22c97a" }}>✓ Пароли совпадают</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>
              Реферальный код
              {refFromUrl && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "#0d3a20", color: "#22c97a" }}>✓ из ссылки</span>}
            </label>
            <input
              type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)}
              readOnly={refFromUrl}
              className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition"
              style={{
                background: refFromUrl ? "#0a1a10" : "#0d0d1a",
                borderColor: refFromUrl ? "#22c97a" : "var(--border)",
                cursor: refFromUrl ? "default" : "text"
              }}
              placeholder="Вставьте код из приглашения"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading || !passwordsMatch}
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
