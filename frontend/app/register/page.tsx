"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/api";
import { Eye, EyeOff, Mail, Lock, Link } from "lucide-react";

// ─── Circuit board canvas background ────────────────────────────────────────
function CircuitBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const COLS = 18, ROWS = 12;
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
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,180,255,0.09)";
      nodes.forEach(n => {
        n.edges.forEach(e => {
          const t = nodes[e.to];
          ctx.beginPath(); ctx.moveTo(n.x, n.y);
          ctx.lineTo(e.mx, e.my); ctx.lineTo(t.x, t.y); ctx.stroke();
        });
      });
      ctx.fillStyle = "rgba(0,200,255,0.18)";
      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2); ctx.fill();
      });
      pulses.forEach((p, i) => {
        p.t += p.speed;
        if (p.t >= 1) { pulses[i] = newPulse(); return; }
        const x = p.from.x + (p.to.x - p.from.x) * p.t;
        const y = p.from.y + (p.to.y - p.from.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, "rgba(0,220,255,0.9)"); g.addColorStop(1, "rgba(0,220,255,0)");
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = "rgba(180,240,255,0.95)"; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

// ─── Robot face ──────────────────────────────────────────────────────────────
function RobotFace() {
  const ref = useRef<HTMLDivElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      setPupil({ x: (dx / dist) * Math.min(dist * 0.08, 5), y: (dy / dist) * Math.min(dist * 0.08, 5) });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <div ref={ref} className="inline-block drop-shadow-[0_0_18px_rgba(0,200,255,0.6)]">
      <svg width="88" height="88" viewBox="0 0 96 96" fill="none">
        <defs>
          <radialGradient id="rBg" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#0a1a5c"/><stop offset="100%" stopColor="#050e30"/></radialGradient>
          <radialGradient id="rHead" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#3b6fd4"/><stop offset="100%" stopColor="#1e3a7a"/></radialGradient>
          <radialGradient id="rEye" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#e0f0ff"/><stop offset="100%" stopColor="#93c5fd"/></radialGradient>
          <radialGradient id="rPupil" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#1d4ed8"/></radialGradient>
          <filter id="rGlow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="96" height="96" rx="22" fill="url(#rBg)"/>
        <rect width="96" height="96" rx="22" fill="white" opacity="0.06"/>
        <line x1="32" y1="10" x2="28" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
        <line x1="64" y1="10" x2="68" y2="20" stroke="#7eb8f7" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="68" cy="8" r="4" fill="#93c5fd" stroke="#bfdbfe" strokeWidth="1"/>
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="url(#rHead)"/>
        <ellipse cx="48" cy="52" rx="34" ry="32" fill="white" opacity="0.05"/>
        <ellipse cx="36" cy="30" rx="12" ry="6" fill="white" opacity="0.12" transform="rotate(-15 36 30)"/>
        <circle cx="33" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        <circle cx="33" cy="50" r="11" fill="url(#rEye)"/>
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#rPupil)" filter="url(#rGlow)"/>
        <circle cx={33 + pupil.x} cy={50 + pupil.y} r="3" fill="#1e40af"/>
        <circle cx={30 + pupil.x * 0.3} cy={47 + pupil.y * 0.3} r="2.5" fill="white" opacity="0.9"/>
        <circle cx="63" cy="50" r="14" fill="#0d2260" stroke="#4a90d9" strokeWidth="1.5"/>
        <circle cx="63" cy="50" r="11" fill="url(#rEye)"/>
        <circle cx={63 + pupil.x} cy={50 + pupil.y} r="6" fill="url(#rPupil)" filter="url(#rGlow)"/>
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

// ─── Shared input style helper ────────────────────────────────────────────────
const inputStyle = (borderColor?: string): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box",
  background: "rgba(5,10,30,0.8)",
  border: `1px solid ${borderColor ?? "rgba(0,140,255,0.2)"}`,
  borderRadius: 10, padding: "12px 14px 12px 40px",
  color: "#e0e8ff", fontSize: 14, outline: "none",
  transition: "border-color 0.2s",
});

// ─── Register form ────────────────────────────────────────────────────────────
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
    if (ref) { setReferralCode(ref); setRefFromUrl(true); }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) { setError("Пароли не совпадают"); return; }
    if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
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

  const passwordsMatch = passwordConfirm === "" || password === passwordConfirm;

  // ── Экран успеха ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ background: "#050a1a" }}>
        <CircuitBackground />
        <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,100,255,0.08) 0%, transparent 70%)" }} />
        <div className="relative z-10 text-center" style={{
          background: "rgba(8,12,35,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,180,255,0.2)", borderRadius: 18,
          padding: "48px 40px", maxWidth: 440,
          boxShadow: "0 0 60px rgba(0,100,255,0.12)",
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Заявка отправлена</h2>
          <p style={{ color: "#6b8ab0", fontSize: 14, lineHeight: 1.6 }}>
            Ожидайте одобрения администратора.<br />Вы получите уведомление на email.
          </p>
          <a href="/login" style={{
            display: "inline-block", marginTop: 24, color: "#4488dd", fontSize: 14,
          }}
            onMouseEnter={e => ((e.target as HTMLAnchorElement).style.textDecoration = "underline")}
            onMouseLeave={e => ((e.target as HTMLAnchorElement).style.textDecoration = "none")}
          >
            ← Вернуться к входу
          </a>
        </div>
      </div>
    );
  }

  // ── Основная страница ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ background: "#050a1a" }}>

      <style>{`
        .reg-form-panel { padding: 40px 32px; }
        @media (max-width: 480px) { .reg-form-panel { padding: 28px 20px; } }
      `}</style>

      <CircuitBackground />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,100,255,0.08) 0%, transparent 70%)" }} />

      {/* Робот + бейдж */}
      <div className="relative z-10 flex flex-col items-center mb-4">
        <RobotFace />
        <div style={{
          marginTop: 10, background: "rgba(0,200,100,0.12)", border: "1px solid rgba(0,200,100,0.4)",
          borderRadius: 20, padding: "3px 14px", fontSize: 12, color: "#22c97a",
          display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(4px)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c97a", boxShadow: "0 0 6px #22c97a", display: "inline-block" }} />
          AI Аналитик: Онлайн
        </div>
      </div>

      {/* Карточка */}
      <div className="relative z-10 w-full flex" style={{ maxWidth: 860 }}>
        <div style={{ position: "absolute", inset: -1, borderRadius: 20, background: "linear-gradient(135deg, rgba(0,180,255,0.35) 0%, rgba(0,80,200,0.1) 50%, rgba(0,180,255,0.25) 100%)", zIndex: -1, filter: "blur(1px)" }} />
        <div style={{ width: "100%", display: "flex", borderRadius: 18, overflow: "hidden", background: "rgba(8,12,35,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(0,180,255,0.2)", boxShadow: "0 0 60px rgba(0,100,255,0.12)" }}>

          {/* Левая панель */}
          <div className="hidden md:flex flex-col justify-center px-10 py-12" style={{ flex: 1, borderRight: "1px solid rgba(0,180,255,0.1)" }}>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: -1, marginBottom: 12 }}>
              Присоединиться
            </h1>
            <p style={{ color: "#6b8ab0", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
              Инвестиционная платформа<br />с AI-управлением
            </p>
            {/* Фичи */}
            {[
              { icon: "⚡", text: "AI торгует 24/7 без остановок" },
              { icon: "📊", text: "Прозрачная статистика в реальном времени" },
              { icon: "🔒", text: "Доступ только по приглашению" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ color: "#4a6a9a", fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Правая панель — форма */}
          <div className="reg-form-panel flex flex-col justify-center" style={{ flex: 1 }}>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Регистрация</h2>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Email */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>Email</label>
                <div className="relative">
                  <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", pointerEvents: "none" }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                    style={inputStyle()}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,180,255,0.6)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,140,255,0.2)")}
                  />
                </div>
              </div>

              {/* Пароль */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>Пароль</label>
                <div className="relative">
                  <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", pointerEvents: "none" }} />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                    style={{ ...inputStyle(), paddingRight: 40 }}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,180,255,0.6)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,140,255,0.2)")}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", background: "none", border: "none", cursor: "pointer" }}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Повторите пароль */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>Повторите пароль</label>
                <div className="relative">
                  <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", pointerEvents: "none" }} />
                  <input type={showPasswordConfirm ? "text" : "password"} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required placeholder="••••••••"
                    style={{
                      ...inputStyle(
                        !passwordsMatch ? "rgba(255,77,77,0.6)" :
                        passwordConfirm.length > 0 ? "rgba(34,201,122,0.5)" :
                        undefined
                      ),
                      paddingRight: 40,
                    }}
                    onFocus={e => { if (passwordsMatch && !passwordConfirm.length) e.target.style.borderColor = "rgba(0,180,255,0.6)"; }}
                    onBlur={e => { if (passwordsMatch && !passwordConfirm.length) e.target.style.borderColor = "rgba(0,140,255,0.2)"; }}
                  />
                  <button type="button" onClick={() => setShowPasswordConfirm(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#3b5a8a", background: "none", border: "none", cursor: "pointer" }}>
                    {showPasswordConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {!passwordsMatch && <p style={{ color: "#ff5555", fontSize: 12, marginTop: 4 }}>Пароли не совпадают</p>}
                {passwordConfirm.length > 0 && passwordsMatch && <p style={{ color: "#22c97a", fontSize: 12, marginTop: 4 }}>✓ Пароли совпадают</p>}
              </div>

              {/* Реферальный код */}
              <div>
                <label style={{ color: "#6b8ab0", fontSize: 13, display: "block", marginBottom: 6 }}>
                  Реферальный код
                  {refFromUrl && (
                    <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(34,201,122,0.12)", color: "#22c97a", border: "1px solid rgba(34,201,122,0.3)" }}>
                      ✓ из ссылки
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Link size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: refFromUrl ? "#22c97a" : "#3b5a8a", pointerEvents: "none" }} />
                  <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)}
                    readOnly={refFromUrl} placeholder="Вставьте код из приглашения"
                    style={inputStyle(refFromUrl ? "rgba(34,201,122,0.4)" : undefined)}
                    onFocus={e => { if (!refFromUrl) e.target.style.borderColor = "rgba(0,180,255,0.6)"; }}
                    onBlur={e => { if (!refFromUrl) e.target.style.borderColor = "rgba(0,140,255,0.2)"; }}
                  />
                </div>
              </div>

              {error && <p style={{ color: "#ff5555", fontSize: 13, textAlign: "center" }}>{error}</p>}

              {/* Кнопка */}
              <button type="submit" disabled={loading || !passwordsMatch}
                style={{
                  marginTop: 4,
                  background: loading || !passwordsMatch ? "#1a3060" : "linear-gradient(180deg, #2b6bff 0%, #1040cc 100%)",
                  border: "none", borderRadius: 10, padding: "13px",
                  color: "#fff", fontWeight: 700, fontSize: 15,
                  cursor: loading || !passwordsMatch ? "not-allowed" : "pointer",
                  boxShadow: loading || !passwordsMatch ? "none" : "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)",
                  transition: "transform 0.1s, box-shadow 0.1s, background 0.2s",
                  letterSpacing: 0.5, opacity: !passwordsMatch ? 0.5 : 1,
                }}
                onMouseDown={e => { if (!loading && passwordsMatch) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(4px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 0 #0d2a80, 0 2px 8px rgba(30,80,255,0.2)"; } }}
                onMouseUp={e => { if (!loading && passwordsMatch) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)"; } }}
                onMouseLeave={e => { if (!loading && passwordsMatch) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)"; } }}
              >
                {loading ? "Отправка..." : "Подать заявку"}
              </button>
            </form>

            <p style={{ color: "#4a5a7a", fontSize: 13, textAlign: "center", marginTop: 18 }}>
              Уже есть аккаунт?{" "}
              <a href="/login" style={{ color: "#4488dd" }}
                onMouseEnter={e => ((e.target as HTMLAnchorElement).style.textDecoration = "underline")}
                onMouseLeave={e => ((e.target as HTMLAnchorElement).style.textDecoration = "none")}>
                Войти
              </a>
            </p>
          </div>
        </div>
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
