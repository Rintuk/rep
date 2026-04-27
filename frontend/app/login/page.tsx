"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

function RobotFace() {
  const ref = useRef<HTMLDivElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const max = 4;
      setPupil({ x: (dx / dist) * Math.min(dist * 0.1, max), y: (dy / dist) * Math.min(dist * 0.1, max) });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div ref={ref} className="inline-block">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Антенна */}
        <line x1="36" y1="4" x2="36" y2="14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="36" cy="3" r="3" fill="#60a5fa"/>
        {/* Голова */}
        <rect x="10" y="14" width="52" height="44" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5"/>
        {/* Левый глаз — белок */}
        <circle cx="24" cy="34" r="9" fill="#0f172a" stroke="#3b82f6" strokeWidth="1"/>
        {/* Правый глаз — белок */}
        <circle cx="48" cy="34" r="9" fill="#0f172a" stroke="#3b82f6" strokeWidth="1"/>
        {/* Левый зрачок */}
        <circle cx={24 + pupil.x} cy={34 + pupil.y} r="4.5" fill="#3b82f6"/>
        <circle cx={24 + pupil.x + 1.5} cy={34 + pupil.y - 1.5} r="1.5" fill="#93c5fd" opacity="0.7"/>
        {/* Правый зрачок */}
        <circle cx={48 + pupil.x} cy={34 + pupil.y} r="4.5" fill="#3b82f6"/>
        <circle cx={48 + pupil.x + 1.5} cy={34 + pupil.y - 1.5} r="1.5" fill="#93c5fd" opacity="0.7"/>
        {/* Рот */}
        <rect x="22" y="48" width="28" height="5" rx="2.5" fill="#1d4ed8" opacity="0.8"/>
        <rect x="26" y="49" width="4" height="3" rx="1" fill="#60a5fa"/>
        <rect x="34" y="49" width="4" height="3" rx="1" fill="#60a5fa"/>
        <rect x="42" y="49" width="4" height="3" rx="1" fill="#60a5fa"/>
      </svg>
    </div>
  );
}

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
          <div className="mb-3"><RobotFace /></div>
          <h1 className="text-2xl font-bold text-white">AI Маклер</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Инвестиционная платформа</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl p-4 space-y-4" style={{ background: "#07071299", boxShadow: "0 0 0 1px #ffffff0d, 0 4px 24px #00000066" }}>
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
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow: loading ? "none" : "0 6px 0 #1e3a8a, 0 8px 16px #1d4ed855",
              transform: loading ? "translateY(4px)" : "translateY(0)",
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
              textShadow: "0 1px 2px #00000066",
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(4px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 0 #1e3a8a, 0 4px 8px #1d4ed855";
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 0 #1e3a8a, 0 8px 16px #1d4ed855";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 0 #1e3a8a, 0 8px 16px #1d4ed855";
            }}
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
