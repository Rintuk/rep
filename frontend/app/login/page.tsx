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
      const max = 5;
      setPupil({ x: (dx / dist) * Math.min(dist * 0.08, max), y: (dy / dist) * Math.min(dist * 0.08, max) });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div ref={ref} className="inline-block">
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#0a1a5c"/>
            <stop offset="100%" stopColor="#050e30"/>
          </radialGradient>
          <radialGradient id="headGrad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3b6fd4"/>
            <stop offset="100%" stopColor="#1e3a7a"/>
          </radialGradient>
          <radialGradient id="eyeGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#e0f0ff"/>
            <stop offset="100%" stopColor="#93c5fd"/>
          </radialGradient>
          <radialGradient id="pupilGrad" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#60a5fa"/>
            <stop offset="100%" stopColor="#1d4ed8"/>
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Фон — скруглённый квадрат */}
        <rect width="96" height="96" rx="22" fill="url(#bgGrad)"/>
        <rect width="96" height="96" rx="22" fill="white" opacity="0.06"/>

        {/* Антенны */}
        <line x1="32" y1="10" x2="28" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
        <line x1="64" y1="10" x2="68" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="68" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>

        {/* Голова */}
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="url(#headGrad)"/>
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="white" opacity="0.05"/>
        {/* Блик на голове */}
        <ellipse cx="36" cy="30" rx="12" ry="6" fill="white" opacity="0.12" transform="rotate(-15 36 30)"/>

        {/* Левый глаз — внешнее кольцо */}
        <circle cx="33" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        {/* Левый глаз — белок */}
        <circle cx="33" cy="50" r="11" fill="url(#eyeGrad)"/>
        {/* Левый зрачок */}
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#pupilGrad)" filter="url(#glow)"/>
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="3" fill="#1e40af"/>
        {/* Блик левого глаза */}
        <circle cx={30 + pupil.x * 0.3} cy={47 + pupil.y * 0.3} r="2.5" fill="white" opacity="0.9"/>
        <circle cx={33 + pupil.x * 0.3} cy={52 + pupil.y * 0.3} r="1" fill="white" opacity="0.5"/>

        {/* Правый глаз — внешнее кольцо */}
        <circle cx="63" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        {/* Правый глаз — белок */}
        <circle cx="63" cy="50" r="11" fill="url(#eyeGrad)"/>
        {/* Правый зрачок */}
        <circle cx={63 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#pupilGrad)" filter="url(#glow)"/>
        <circle cx={63 + pupil.x} cy={50 + pupil.y} r="3" fill="#1e40af"/>
        {/* Блик правого глаза */}
        <circle cx={60 + pupil.x * 0.3} cy={47 + pupil.y * 0.3} r="2.5" fill="white" opacity="0.9"/>
        <circle cx={63 + pupil.x * 0.3} cy={52 + pupil.y * 0.3} r="1" fill="white" opacity="0.5"/>

        {/* Нос */}
        <rect x="45" y="62" width="6" height="4" rx="2" fill="#2563eb" opacity="0.6"/>

        {/* Рот — решётка */}
        <rect x="36" y="69" width="24" height="8" rx="4" fill="#0d2260" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="42" y1="69" x2="42" y2="77" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="48" y1="69" x2="48" y2="77" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="54" y1="69" x2="54" y2="77" stroke="#3b6fd4" strokeWidth="1"/>

        {/* Уши */}
        <rect x="10" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
        <rect x="81" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
