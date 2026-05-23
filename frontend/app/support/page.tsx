"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket, getMyTickets, investorCloseTicket, markTicketsRead, replyToTicket, SupportTicket } from "@/lib/api";
import { ArrowLeft, Send } from "lucide-react";

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
    const newPulse = (): Pulse => {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const e = n.edges.length ? n.edges[Math.floor(Math.random() * n.edges.length)] : null;
      return { from: n, to: e ? nodes[e.to] : n, t: 0, speed: 0.004 + Math.random() * 0.006 };
    };
    const pulses: Pulse[] = Array.from({ length: 18 }, newPulse);
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,180,255,0.07)";
      nodes.forEach(n => n.edges.forEach(e => {
        const t = nodes[e.to];
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(e.mx, e.my); ctx.lineTo(t.x, t.y); ctx.stroke();
      }));
      ctx.fillStyle = "rgba(0,200,255,0.12)";
      nodes.forEach(n => { ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2); ctx.fill(); });
      pulses.forEach(p => {
        p.t += p.speed;
        if (p.t >= 1) Object.assign(p, newPulse());
        const x = p.from.x + (p.to.x - p.from.x) * p.t;
        const y = p.from.y + (p.to.y - p.from.y) * p.t;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,255,${0.6 - p.t * 0.5})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

const card: React.CSSProperties = {
  background: "rgba(8,12,35,0.82)",
  border: "1px solid rgba(0,180,255,0.15)",
  borderRadius: 14,
  backdropFilter: "blur(12px)",
};

const STATUS_LABEL: Record<string, string> = { open: "Открыт", answered: "Отвечен", closed: "Закрыт" };
const STATUS_COLOR: Record<string, string> = { open: "#f59e0b", answered: "#22c97a", closed: "#8090b0" };

export default function SupportPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    setIsAdmin(localStorage.getItem("is_admin") === "1");
    markTicketsRead().catch(() => {});
    loadTickets();
  }, []);

  async function loadTickets() {
    setTicketsError(null);
    try {
      const data = await getMyTickets();
      setTickets(data);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setTicketsError(errMsg || "Ошибка загрузки тикетов");
    } finally {
      setTicketsLoaded(true);
    }
  }

  async function handleClose(ticketId: string) {
    try {
      await investorCloseTicket(ticketId);
      await loadTickets();
    } catch { /* ignore */ }
  }

  async function handleReply(ticketId: string) {
    const body = replyTexts[ticketId]?.trim();
    if (!body) return;
    setReplyLoading(r => ({ ...r, [ticketId]: true }));
    try {
      await replyToTicket(ticketId, body);
      setReplyTexts(r => ({ ...r, [ticketId]: "" }));
      await loadTickets();
    } finally {
      setReplyLoading(r => ({ ...r, [ticketId]: false }));
    }
  }

  async function handleSubmit() {
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      await createSupportTicket(subject.trim(), message.trim());
      setSubject("");
      setMessage("");
      setMsg({ ok: true, text: "Обращение отправлено. Мы ответим в ближайшее время." });
      await loadTickets();
    } catch {
      setMsg({ ok: false, text: "Ошибка отправки. Попробуйте снова." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "rgba(3,5,20,1)", position: "relative" }}>
      <CircuitBackground />
      <style>{`
        input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 1000px rgba(5,10,30,0.95) inset !important;
          -webkit-text-fill-color:#e0e8ff !important;
        }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(0,180,255,0.2);border-radius:4px}
      `}</style>

      {/* Шапка */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(5,8,25,0.92)", borderBottom: "1px solid rgba(0,180,255,0.1)", backdropFilter: "blur(12px)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a6a9a", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <h1 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>🎧 Техническая поддержка v2</h1>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>

        {/* История обращений — всегда видна */}
        <div style={{ ...card, padding: 24 }}>
          <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 18 }}>
            Мои обращения{ticketsLoaded && !ticketsError && <span style={{ color: "#4a6a9a", fontWeight: 400, fontSize: 13, marginLeft: 8 }}>({tickets.length})</span>}
          </h2>

          {!ticketsLoaded ? (
            <p style={{ color: "#4a6a9a", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Загрузка…</p>
          ) : ticketsError ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ color: "#ff6b6b", fontSize: 12, marginBottom: 10, wordBreak: "break-all" }}>Ошибка: {ticketsError}</p>
              <button onClick={loadTickets} style={{ background: "rgba(0,180,255,0.12)", color: "#00b4ff", fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(0,180,255,0.25)", cursor: "pointer" }}>
                Повторить
              </button>
            </div>
          ) : tickets.length === 0 ? (
            <p style={{ color: "#4a6a9a", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Обращений пока нет</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {tickets.map((t, i) => (
                <div key={t.id} style={{ padding: "16px 0", borderBottom: i < tickets.length - 1 ? "1px solid rgba(0,180,255,0.08)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div>
                      <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{t.subject}</span>
                      {t.user_email && <span style={{ display: "block", color: "#4a6a9a", fontSize: 11, marginTop: 2 }}>{t.user_email}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600, background: STATUS_COLOR[t.status] + "18", color: STATUS_COLOR[t.status] }}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      <span style={{ color: "#4a6a9a", fontSize: 11 }}>{new Date(t.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <p style={{ color: "#8aa0c0", fontSize: 13, lineHeight: 1.6, marginBottom: t.replies.length ? 12 : 0 }}>{t.message}</p>
                  {t.replies.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: t.status !== "closed" ? 12 : 0 }}>
                      {t.replies.map(r => (
                        <div key={r.id} style={{ background: "rgba(34,201,122,0.06)", border: "1px solid rgba(34,201,122,0.15)", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#22c97a" }}>Поддержка</span>
                            <span style={{ color: "#4a6a9a", fontSize: 11 }}>{new Date(r.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p style={{ color: "#e0e8ff", fontSize: 13, lineHeight: 1.6 }}>{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.status !== "closed" && isAdmin && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <input
                        value={replyTexts[t.id] || ""}
                        onChange={e => setReplyTexts(r => ({ ...r, [t.id]: e.target.value }))}
                        placeholder="Ответить инвестору…"
                        style={{ flex: 1, background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: "8px 12px", color: "#e0e8ff", fontSize: 13, outline: "none" }}
                      />
                      <button
                        onClick={() => handleReply(t.id)}
                        disabled={replyLoading[t.id] || !replyTexts[t.id]?.trim()}
                        style={{ background: "linear-gradient(135deg,#0070f3,#0040c0)", color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", opacity: replyLoading[t.id] || !replyTexts[t.id]?.trim() ? 0.5 : 1 }}
                      >
                        {replyLoading[t.id] ? "…" : "Ответить"}
                      </button>
                      <button
                        onClick={() => handleClose(t.id)}
                        style={{ background: "rgba(100,100,120,0.15)", color: "#8090b0", fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(100,100,120,0.25)", cursor: "pointer" }}
                      >
                        Закрыть
                      </button>
                    </div>
                  )}
                  {t.status !== "closed" && !isAdmin && (
                    <button
                      onClick={() => handleClose(t.id)}
                      style={{ marginTop: 8, background: "rgba(100,100,120,0.15)", color: "#8090b0", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(100,100,120,0.25)", cursor: "pointer" }}
                    >
                      Закрыть тикет
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Форма нового обращения — только для инвесторов */}
        {!isAdmin && <div style={{ ...card, padding: 24 }}>
          <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Новое обращение</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ color: "#8aa0c0", fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Тема вопроса</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Кратко опишите тему"
                style={{ width: "100%", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: "10px 14px", color: "#e0e8ff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ color: "#8aa0c0", fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Ваш вопрос</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Опишите ваш вопрос подробно"
                rows={4}
                style={{ width: "100%", background: "rgba(5,10,30,0.8)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: "10px 14px", color: "#e0e8ff", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
            {msg && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: msg.ok ? "rgba(34,201,122,0.1)" : "rgba(255,60,60,0.1)", border: `1px solid ${msg.ok ? "rgba(34,201,122,0.3)" : "rgba(255,60,60,0.3)"}`, color: msg.ok ? "#22c97a" : "#ff6b6b", fontSize: 13 }}>
                {msg.text}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || !subject.trim() || !message.trim()}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg,#0070f3,#0040c0)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading || !subject.trim() || !message.trim() ? 0.5 : 1 }}
            >
              <Send size={16} /> {loading ? "Отправка…" : "Отправить обращение"}
            </button>
          </div>
        </div>}

      </main>
    </div>
  );
}
