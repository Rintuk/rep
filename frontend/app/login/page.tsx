"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem("token", data.access_token);
      router.push(data.is_admin ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md rounded-2xl p-8 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤖</div>
          <h1 className="text-2xl font-bold text-white">AI Маклер</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Инвестиционная платформа</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--muted)" }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-lg px-4 py-3 text-white border outline-none focus:border-blue-500 transition"
              style={{ background: "#0d0d1a", borderColor: "var(--border)" }}
              placeholder="investor@example.com"
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

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--muted)" }}>
          Нет аккаунта?{" "}
          <a href="/register" className="text-blue-400 hover:underline">Зарегистрироваться</a>
        </p>
      </div>
    </div>
  );
}
