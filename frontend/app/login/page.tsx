"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

// ─── Circuit board canvas background ────────────────────────────────────────
function CircuitBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate circuit nodes
    const COLS = 18;
    const ROWS = 12;
    // Edge with pre-computed 90-degree routing direction
    type Edge = { to: number; mx: number; my: number };
    type CNode = { x: number; y: number; edges: Edge[] };
    const nodes: CNode[] = [];

    const jitter = () => (Math.random() - 0.5) * 60;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        nodes.push({ x: (canvas.width / (COLS - 1)) * c + jitter(), y: (canvas.height / (ROWS - 1)) * r + jitter(), edges: [] });

    nodes.forEach((n, i) => {
      [i + 1, i + COLS, i + COLS + 1, i + COLS - 1].forEach(j => {
        if (j < nodes.length && Math.random() > 0.35) {
          const t = nodes[j];
          // routing direction fixed at init — no random in draw loop
          const mx = Math.random() > 0.5 ? t.x : n.x;
          const my = mx === t.x ? n.y : t.y;
          n.edges.push({ to: j, mx, my });
        }
      });
    });

    type Pulse = { from: CNode; to: CNode; t: number; speed: number };
    const pulses: Pulse[] = [];
    const newPulse = (): Pulse => {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const e = n.edges.length ? n.edges[Math.floor(Math.random() * n.edges.length)] : null;
      return { from: n, to: e ? nodes[e.to] : n, t: 0, speed: 0.004 + Math.random() * 0.006 };
    };
    for (let i = 0; i < 18; i++) pulses.push(newPulse());

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Traces — no Math.random() here
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,180,255,0.09)";
      nodes.forEach(n => {
        n.edges.forEach(e => {
          const t = nodes[e.to];
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(e.mx, e.my);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        });
      });

      // Nodes (solder pads)
      ctx.fillStyle = "rgba(0,200,255,0.18)";
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Pulses
      pulses.forEach((p, i) => {
        p.t += p.speed;
        if (p.t >= 1) {
          pulses[i] = newPulse();
          return;
        }
        const x = p.from.x + (p.to.x - p.from.x) * p.t;
        const y = p.from.y + (p.to.y - p.from.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, "rgba(0,220,255,0.9)");
        g.addColorStop(1, "rgba(0,220,255,0)");
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // bright dot
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180,240,255,0.95)";
        ctx.fill();
        void i;
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

// ─── Robot face (eyes follow cursor) ────────────────────────────────────────
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
    <div ref={ref} className="inline-block drop-shadow-[0_0_18px_rgba(0,200,255,0.6)]">
      <svg width="88" height="88" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <rect width="96" height="96" rx="22" fill="url(#bgGrad)"/>
        <rect width="96" height="96" rx="22" fill="white" opacity="0.06"/>
        <line x1="32" y1="10" x2="28" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
        <line x1="64" y1="10" x2="68" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="68" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="url(#headGrad)"/>
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="white" opacity="0.05"/>
        <ellipse cx="36" cy="30" rx="12" ry="6" fill="white" opacity="0.12" transform="rotate(-15 36 30)"/>
        <circle cx="33" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        <circle cx="33" cy="50" r="11" fill="url(#eyeGrad)"/>
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#pupilGrad)" filter="url(#glow)"/>
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="3" fill="#1e40af"/>
        <circle cx={30 + pupil.x * 0.3} cy={47 + pupil.y * 0.3} r="2.5" fill="white" opacity="0.9"/>
        <circle cx="63" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        <circle cx="63" cy="50" r="11" fill="url(#eyeGrad)"/>
        <circle cx={63 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#pupilGrad)" filter="url(#glow)"/>
        <circle cx={63 + pupil.x} cy={50 + pupil.y} r="3" fill="#1e40af"/>
        <circle cx={60 + pupil.x * 0.3} cy={47 + pupil.y * 0.3} r="2.5" fill="white" opacity="0.9"/>
        <rect x="45" y="62" width="6" height="4" rx="2" fill="#2563eb" opacity="0.6"/>
        <rect x="36" y="69" width="24" height="8" rx="4" fill="#0d2260" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="42" y1="69" x2="42" y2="77" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="48" y1="69" x2="48" y2="77" stroke="#3b6fd4" strokeWidth="1"/>
        <line x1="54" y1="69" x2="54" y2="77" stroke="#3b6fd4" strokeWidth="1"/>
        <rect x="10" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
        <rect x="81" y="44" width="5" height="12" rx="2.5" fill="#2563eb" stroke="#4a90d9" strokeWidth="1"/>
      </svg>
    </div>
  );
}


// ─── Main page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [waking, setWaking] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  async function tryLogin(emailVal: string, passwordVal: string, rememberVal: boolean): Promise<boolean> {
    try {
      const data = await login(emailVal, passwordVal, rememberVal);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("is_admin", data.is_admin ? "1" : "0");
      router.push(data.is_admin ? "/admin" : "/dashboard");
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } }; code?: string };
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      // Сетевая ошибка или 503 — сервер спит
      if (!status || status === 503 || status === 502 || e?.code === "ERR_NETWORK") {
        return false; // retry
      }
      setError(detail || "Ошибка входа");
      return true; // не повторяем
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setWaking(false);

    const ok = await tryLogin(email, password, rememberMe);
    if (ok) { setLoading(false); return; }

    // Сервер не ответил — ждём пока проснётся
    setWaking(true);
    let attempts = 0;
    const MAX = 6;
    const interval = setInterval(async () => {
      attempts++;
      const done = await tryLogin(email, password, rememberMe);
      if (done || attempts >= MAX) {
        clearInterval(interval);
        setWaking(false);
        setLoading(false);
        if (!done) setError("Сервер не отвечает. Попробуйте ещё раз.");
      }
    }, 8000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#050a1a" }}>

      <style>{`
        .login-form-panel { padding: 48px 32px; }
        @media (max-width: 480px) {
          .login-form-panel { padding: 32px 20px; }
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(5,10,30,0.95) inset !important;
          -webkit-text-fill-color: #e0e8ff !important;
          caret-color: #e0e8ff;
        }
        .form-title-desktop { display: block; }
        .form-title-mobile  { display: none; }
        @media (max-width: 767px) {
          .form-title-desktop { display: none; }
          .form-title-mobile  { display: block; }
        }
      `}</style>

      <CircuitBackground />

      {/* Radial glow center */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,100,255,0.08) 0%, transparent 70%)",
      }} />

      {/* ── Robot mascot + status badge ─────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center mb-4">
        <RobotFace />
        <div style={{
          marginTop: 10,
          background: "rgba(0,200,100,0.12)",
          border: "1px solid rgba(0,200,100,0.4)",
          borderRadius: 20,
          padding: "3px 14px",
          fontSize: 12,
          color: "#22c97a",
          display: "flex",
          alignItems: "center",
          gap: 6,
          backdropFilter: "blur(4px)",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#22c97a",
            boxShadow: "0 0 6px #22c97a",
            display: "inline-block",
          }} />
          AI Аналитик: Онлайн
        </div>
      </div>

      {/* ── Main card ───────────────────────────────────────────── */}
      <div className="relative z-10 w-full flex" style={{ maxWidth: 860 }}>
        {/* Glow border effect */}
        <div style={{
          position: "absolute", inset: -1, borderRadius: 20,
          background: "linear-gradient(135deg, rgba(0,180,255,0.35) 0%, rgba(0,80,200,0.1) 50%, rgba(0,180,255,0.25) 100%)",
          zIndex: -1,
          filter: "blur(1px)",
        }} />

        <div style={{
          width: "100%",
          display: "flex",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(8,12,35,0.92)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,180,255,0.2)",
          boxShadow: "0 0 60px rgba(0,100,255,0.12), 0 0 120px rgba(0,60,180,0.08)",
        }}>

          {/* Left panel */}
          <div className="hidden md:flex flex-col justify-center items-center text-center px-10 py-12"
            style={{ flex: 1, borderRight: "1px solid rgba(0,180,255,0.1)" }}>
            <h1 style={{
              fontSize: 46,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.15,
              letterSpacing: 1,
              marginBottom: 12,
              textTransform: "uppercase",
              textShadow: "0 0 15px rgba(0,180,255,0.8), 0 0 30px rgba(0,100,255,0.5)"
            }}>
              AI MAKLER
            </h1>
            <p style={{ color: "#6b8ab0", fontSize: 16, marginBottom: 32 }}>
              Инвестиционная платформа
            </p>
            {/* decorative chart lines */}
            <svg width="180" height="80" viewBox="0 0 180 80" fill="none">
              <polyline points="0,70 30,55 60,60 90,35 120,40 150,20 180,25"
                stroke="rgba(0,180,255,0.25)" strokeWidth="2" fill="none"/>
              <polyline points="0,80 30,72 60,75 90,58 120,62 150,45 180,50"
                stroke="rgba(0,100,200,0.15)" strokeWidth="1.5" fill="none"/>
              {/* dots */}
              {[0,30,60,90,120,150,180].map((x,i) => {
                const ys = [70,55,60,35,40,20,25];
                return <circle key={i} cx={x} cy={ys[i]} r="3"
                  fill="rgba(0,200,255,0.5)" stroke="rgba(0,200,255,0.8)" strokeWidth="1"/>;
              })}
            </svg>
            <button type="button" onClick={() => setShowAbout(true)}
              style={{
                marginTop: 32, background: "linear-gradient(135deg, rgba(43,107,255,0.15) 0%, rgba(16,64,204,0.3) 100%)",
                border: "1px solid rgba(0,180,255,0.3)", borderRadius: 12, padding: "10px 28px", color: "#6b8ab0",
                fontWeight: 600, fontSize: 13, letterSpacing: 1, cursor: "pointer", boxShadow: "0 4px 15px rgba(0,100,255,0.1)",
                transition: "all 0.2s", textTransform: "uppercase"
              }}
              onMouseEnter={e => {
                const t = e.currentTarget as HTMLButtonElement;
                t.style.background = "linear-gradient(135deg, rgba(43,107,255,0.3) 0%, rgba(16,64,204,0.5) 100%)";
                t.style.color = "#fff"; t.style.borderColor = "rgba(0,180,255,0.6)";
                t.style.boxShadow = "0 6px 20px rgba(0,180,255,0.3)"; t.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                const t = e.currentTarget as HTMLButtonElement;
                t.style.background = "linear-gradient(135deg, rgba(43,107,255,0.15) 0%, rgba(16,64,204,0.3) 100%)";
                t.style.color = "#6b8ab0"; t.style.borderColor = "rgba(0,180,255,0.3)";
                t.style.boxShadow = "0 4px 15px rgba(0,100,255,0.1)"; t.style.transform = "translateY(0)";
              }}
            >О проекте</button>
          </div>

          {/* Right panel — form */}
          <div className="login-form-panel flex flex-col justify-center" style={{ flex: 1 }}>
            {/* Desktop: обычный заголовок */}
            <h2 className="form-title-desktop" style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
              Вход в аккаунт
            </h2>
            {/* Mobile: стильный заголовок */}
            <h1 className="form-title-mobile" style={{
              marginBottom: 8,
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 4,
              textTransform: "uppercase",
              textAlign: "center",
              color: "#fff",
              textShadow: "0 0 15px rgba(0,180,255,0.8), 0 0 30px rgba(0,100,255,0.5)",
              lineHeight: 1.2,
            }}>
              AI MAKLER
            </h1>
            
            <div className="form-title-mobile" style={{ textAlign: "center", marginBottom: 24 }}>
              <button type="button" onClick={() => setShowAbout(true)}
                style={{
                  background: "linear-gradient(135deg, rgba(43,107,255,0.15) 0%, rgba(16,64,204,0.3) 100%)",
                  border: "1px solid rgba(0,180,255,0.3)", borderRadius: 10, padding: "6px 20px", color: "#8ab4f8",
                  fontWeight: 600, fontSize: 12, letterSpacing: 1, cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >О проекте</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", pointerEvents: "none" }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="Email"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(5,10,30,0.8)",
                      border: "1px solid rgba(0,140,255,0.2)",
                      borderRadius: 10, padding: "12px 14px 12px 40px",
                      color: "#e0e8ff", fontSize: 14, outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,180,255,0.6)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,140,255,0.2)")}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>
                  Пароль
                </label>
                <div className="relative">
                  <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", pointerEvents: "none" }} />
                  <input
                    type={showPassword ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} required
                    placeholder="Пароль"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(5,10,30,0.8)",
                      border: "1px solid rgba(0,140,255,0.2)",
                      borderRadius: 10, padding: "12px 40px 12px 40px",
                      color: "#e0e8ff", fontSize: 14, outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,180,255,0.6)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,140,255,0.2)")}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", background: "none", border: "none", cursor: "pointer" }}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#2b6bff", cursor: "pointer" }}
                />
                <span style={{ color: "#8899bb", fontSize: 13 }}>Запомнить меня на 30 дней</span>
              </label>

              {error && <p style={{ color: "#ff5555", fontSize: 13, textAlign: "center" }}>{error}</p>}

              {waking && (
                <p style={{ color: "#f5a623", fontSize: 12, textAlign: "center", lineHeight: 1.4 }}>
                  ⏳ Сервер просыпается после простоя, подождите ~30 сек...
                </p>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                style={{
                  marginTop: 4,
                  background: loading ? "#1a3060" : "linear-gradient(180deg, #2b6bff 0%, #1040cc 100%)",
                  border: "none", borderRadius: 10, padding: "13px",
                  color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)",
                  transform: loading ? "translateY(3px)" : "translateY(0)",
                  transition: "transform 0.1s, box-shadow 0.1s, background 0.2s",
                  letterSpacing: 0.5,
                }}
                onMouseDown={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(4px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 0 #0d2a80, 0 2px 8px rgba(30,80,255,0.2)";
                  }
                }}
                onMouseUp={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)";
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)";
                  }
                }}
              >
                {waking ? "Запускается..." : loading ? "Вход..." : "Войти"}
              </button>
            </form>

            <p style={{ color: "#4a5a7a", fontSize: 13, textAlign: "center", marginTop: 20 }}>
              Нет аккаунта?{" "}
              <a href="/register" style={{ color: "#4488dd" }}
                onMouseEnter={e => ((e.target as HTMLAnchorElement).style.textDecoration = "underline")}
                onMouseLeave={e => ((e.target as HTMLAnchorElement).style.textDecoration = "none")}>
                Зарегистрироваться
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Модальное окно "О проекте" */}
      {showAbout && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", padding: 20 }}>
          <div style={{ background: "linear-gradient(180deg, #0a132e 0%, #050a1a 100%)", border: "1px solid rgba(0,180,255,0.4)", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 15px 50px rgba(0,100,255,0.2), inset 0 0 40px rgba(0,180,255,0.05)" }}>
            <div style={{ padding: "24px 30px", borderBottom: "1px solid rgba(0,180,255,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,100,255,0.05)" }}>
              <h3 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: 1, textTransform: "uppercase", textShadow: "0 0 10px rgba(0,180,255,0.5)" }}>О проекте AI MAKLER</h3>
              <button onClick={() => setShowAbout(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 36, height: 36, color: "#8ab4f8", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#fff"; }} onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#8ab4f8"; }}>&times;</button>
            </div>
            <div style={{ padding: "30px", overflowY: "auto", color: "#a0b0d0", fontSize: 15, lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 32, background: "rgba(0,180,255,0.1)", padding: 12, borderRadius: 16, border: "1px solid rgba(0,180,255,0.2)" }}>🚀</div>
                <div>
                  <h4 style={{ color: "#e0e8ff", fontSize: 17, fontWeight: 700, margin: "0 0 8px 0" }}>Инновационная платформа для алгоритмической торговли</h4>
                  <p style={{ margin: 0 }}>AI MAKLER — это закрытый инвестиционный пул, использующий передовые алгоритмы машинного обучения для торговли на криптовалютных и классических финансовых рынках. Наша система анализирует тысячи переменных в секунду, находя оптимальные точки входа и выхода.</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 32, background: "rgba(34,201,122,0.1)", padding: 12, borderRadius: 16, border: "1px solid rgba(34,201,122,0.2)" }}>🛡️</div>
                <div>
                  <h4 style={{ color: "#e0e8ff", fontSize: 17, fontWeight: 700, margin: "0 0 8px 0" }}>Адаптивный риск-менеджмент</h4>
                  <p style={{ margin: 0 }}>Встроенная система защиты капитала автоматически реагирует на аномальную волатильность, снижая риски в периоды неопределенности. Интеллектуальный алгоритм балансирует между агрессивной и консервативной стратегиями.</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 32, background: "rgba(245,166,35,0.1)", padding: 12, borderRadius: 16, border: "1px solid rgba(245,166,35,0.2)" }}>📊</div>
                <div>
                  <h4 style={{ color: "#e0e8ff", fontSize: 17, fontWeight: 700, margin: "0 0 8px 0" }}>Абсолютная прозрачность для инвесторов</h4>
                  <p style={{ margin: 0 }}>Каждый участник пула получает доступ к личному кабинету с детальной статистикой в реальном времени. Отслеживайте свой портфель, анализируйте PnL, историю сделок и выводите средства в несколько кликов.</p>
                </div>
              </div>

              <div style={{ background: "rgba(0,180,255,0.05)", borderLeft: "4px solid #00b4ff", padding: "16px 20px", borderRadius: "0 8px 8px 0", marginTop: 10 }}>
                <strong style={{ color: "#00b4ff" }}>Условия участия:</strong> Платформа работает в формате закрытого клуба. Регистрация доступна только по персональным реферальным приглашениям от действующих резидентов пула.
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
