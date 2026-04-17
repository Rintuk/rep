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
    <div className="min-h-screen flex flex-col" style={{ background: "radial-gradient(ellipse at 60% 20%, #0d2233 0%, #080d12 60%)" }}>

      {/* Шапка */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" fill="none" stroke="#00c8b4" strokeWidth="2"/>
            <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" fill="#00c8b414" stroke="#00c8b4" strokeWidth="1"/>
          </svg>
          <span className="font-bold text-white text-lg tracking-wide">AI Маклер</span>
        </div>
      </header>

      {/* Центр */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">

          {/* Карточка */}
          <div className="rounded-2xl p-8 border"
            style={{ background: "#0c1825", borderColor: "#1a2d3d" }}>

            {/* Лого внутри */}
            <div className="flex justify-center mb-1">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border"
                style={{ background: "#0d2233", borderColor: "#1a3a50" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" fill="none" stroke="#00c8b4" strokeWidth="2"/>
                  <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" fill="#00c8b414" stroke="#00c8b4" strokeWidth="1"/>
                </svg>
              </div>
            </div>

            <div className="text-center mb-7 mt-4">
              <h1 className="text-2xl font-bold text-white">Добро пожаловать!</h1>
              <p className="text-sm mt-1" style={{ color: "#5a7a8a" }}>Войдите в свой аккаунт</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-medium" style={{ color: "#8aa8b8" }}>
                  Адрес электронной почты
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full rounded-xl px-4 py-3 text-white outline-none transition"
                  style={{
                    background: "#0f2030",
                    border: "1px solid #1a3a50",
                    caretColor: "#00c8b4",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#00c8b4")}
                  onBlur={e => (e.target.style.borderColor = "#1a3a50")}
                  placeholder="investor@example.com"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 font-medium" style={{ color: "#8aa8b8" }}>
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} required
                    className="w-full rounded-xl px-4 py-3 text-white outline-none transition pr-11"
                    style={{
                      background: "#0f2030",
                      border: "1px solid #1a3a50",
                      caretColor: "#00c8b4",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#00c8b4")}
                    onBlur={e => (e.target.style.borderColor = "#1a3a50")}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                    style={{ color: "#5a7a8a" }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-center py-2 px-3 rounded-lg"
                  style={{ color: "#ff6b6b", background: "#ff4d4d15", border: "1px solid #ff4d4d30" }}>
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white mt-2 transition-all disabled:opacity-50"
                style={{
                  background: loading ? "#006a60" : "linear-gradient(135deg, #00c8b4 0%, #0096a0 100%)",
                  boxShadow: loading ? "none" : "0 4px 20px #00c8b430",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={e => !loading && ((e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 32px #00c8b455")}
                onMouseLeave={e => !loading && ((e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px #00c8b430")}
              >
                {loading ? "Вход..." : "Войти в аккаунт"}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: "#5a7a8a" }}>
              Ещё нет аккаунта?{" "}
              <a href="/register" style={{ color: "#00c8b4" }} className="hover:underline">Пройдите регистрацию</a>
            </p>
          </div>

          {/* Футер */}
          <div className="flex items-center justify-between mt-6 px-1 text-xs" style={{ color: "#2a4a5a" }}>
            <span>2026 · AI Маклер</span>
            <span>Инвестиционная платформа</span>
          </div>
        </div>
      </div>
    </div>
  );
}
