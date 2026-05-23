"use client";

import { ArrowLeft, Users, TrendingUp, Award, Layers } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReferralProgramPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header style={{ 
        padding: "20px 40px", 
        borderBottom: "1px solid rgba(255,255,255,0.05)", 
        display: "flex", 
        alignItems: "center", 
        background: "rgba(0,0,0,0.2)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}>
        <button 
          onClick={() => router.push("/dashboard")}
          style={{ 
            display: "flex", alignItems: "center", gap: 8, 
            background: "none", border: "none", color: "#4a6a9a", 
            cursor: "pointer", fontSize: 14, fontWeight: 500, padding: 0
          }}
        >
          <ArrowLeft size={16} /> Назад в панель
        </button>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
        
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Партнерская программа
          </h1>
          <p style={{ color: "#8b9cba", fontSize: 16, lineHeight: 1.5, maxWidth: 600, margin: "0 auto" }}>
            Приглашайте инвесторов и получайте пассивный доход от их прибыли. 
            Чем больше оборот вашей структуры, тем выше статус и глубже уровни дохода.
          </p>
        </div>

        {/* ── Основные понятия ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingUp size={20} color="#3b82f6" />
            Как считается оборот структуры?
          </h2>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 24 }}>
            <p style={{ color: "#d1d5db", fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
              Для достижения новых статусов система автоматически суммирует ваш общий <strong>структурный оборот</strong>.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15, flexWrap: "wrap", padding: "16px", background: "rgba(0,0,0,0.3)", borderRadius: 12 }}>
              <div style={{ textAlign: "center", color: "#8b9cba", fontSize: 14 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Ваш депозит</div>
                (Крипто + Форекс)
              </div>
              <div style={{ fontSize: 24, color: "#4a6a9a", fontWeight: 700 }}>+</div>
              <div style={{ textAlign: "center", color: "#8b9cba", fontSize: 14 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Депозиты всех рефералов</div>
                (на всю глубину структуры)
              </div>
              <div style={{ fontSize: 24, color: "#22c97a", fontWeight: 700 }}>=</div>
              <div style={{ textAlign: "center", color: "#22c97a", fontSize: 14 }}>
                <div style={{ color: "#22c97a", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Общий оборот</div>
                (влияет на ваш статус)
              </div>
            </div>
          </div>
        </section>

        {/* ── Статусы ──────────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={20} color="#f59e0b" />
            Статусы и условия
          </h2>
          <div style={{ display: "grid", gap: 16 }}>
            {/* Инвестор */}
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(107, 138, 176, 0.2)", borderRadius: 12, padding: "20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🔰</span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Инвестор</h3>
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 10, color: "#aaa" }}>Базовый</span>
                </div>
                <div style={{ display: "flex", gap: 24, color: "#8b9cba", fontSize: 14 }}>
                  <div><strong>Требуемый оборот:</strong> 0 $</div>
                  <div><strong>Доступно приглашений:</strong> 3</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>1</div>
                <div style={{ fontSize: 12, color: "#8b9cba" }}>уровень в глубину</div>
              </div>
            </div>

            {/* Бронза */}
            <div style={{ display: "flex", alignItems: "center", background: "rgba(205,127,50,0.05)", border: "1px solid rgba(205,127,50,0.2)", borderRadius: 12, padding: "20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🥉</span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#cd7f32", margin: 0 }}>Бронза</h3>
                </div>
                <div style={{ display: "flex", gap: 24, color: "#8b9cba", fontSize: 14 }}>
                  <div><strong>Требуемый оборот:</strong> 3 000 $</div>
                  <div><strong>Доступно приглашений:</strong> 5</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#cd7f32" }}>2</div>
                <div style={{ fontSize: 12, color: "#8b9cba" }}>уровня в глубину</div>
              </div>
            </div>

            {/* Золото */}
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, padding: "20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>🥇</span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffd700", margin: 0 }}>Золото</h3>
                </div>
                <div style={{ display: "flex", gap: 24, color: "#8b9cba", fontSize: 14 }}>
                  <div><strong>Требуемый оборот:</strong> 4 000 $</div>
                  <div><strong>Доступно приглашений:</strong> 10</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#ffd700" }}>3</div>
                <div style={{ fontSize: 12, color: "#8b9cba" }}>уровня в глубину</div>
              </div>
            </div>

            {/* VIP */}
            <div style={{ display: "flex", alignItems: "center", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "20px", boxShadow: "0 4px 20px rgba(245,158,11,0.1)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>💎</span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", margin: 0 }}>VIP</h3>
                </div>
                <div style={{ display: "flex", gap: 24, color: "#8b9cba", fontSize: 14 }}>
                  <div><strong>Требуемый оборот:</strong> 5 000 $</div>
                  <div><strong>Доступно приглашений:</strong> Безлимит</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>5</div>
                <div style={{ fontSize: 12, color: "#8b9cba" }}>уровней в глубину</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Проценты вознаграждения ──────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <Layers size={20} color="#8b5cf6" />
            Проценты вознаграждения
          </h2>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#8b9cba", fontSize: 13, display: "grid", gridTemplateColumns: "100px 1fr 100px", fontWeight: 600 }}>
              <div>Уровень</div>
              <div>Кто это?</div>
              <div style={{ textAlign: "right" }}>Бонус от прибыли</div>
            </div>
            
            {[
              { level: 1, who: "Лично приглашенные", pct: "3%" },
              { level: 2, who: "Приглашенные вашими рефералами", pct: "1%" },
              { level: 3, who: "Рефералы третьего поколения", pct: "0.5%" },
              { level: 4, who: "Рефералы четвертого поколения", pct: "0.3%" },
              { level: 5, who: "Рефералы пятого поколения", pct: "0.2%" },
            ].map((row, idx) => (
              <div key={idx} style={{ 
                padding: "16px 24px", 
                borderBottom: idx < 4 ? "1px solid rgba(255,255,255,0.05)" : "none", 
                display: "grid", gridTemplateColumns: "100px 1fr 100px", 
                alignItems: "center"
              }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>{row.level} ур.</div>
                <div style={{ color: "#8b9cba", fontSize: 14 }}>{row.who}</div>
                <div style={{ textAlign: "right", color: "#22c97a", fontWeight: 700, fontSize: 16 }}>{row.pct}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, color: "#8b9cba", fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
            * Бонусы начисляются исключительно от чистой прибыли реферала, заработанной пулом. 
          </p>
        </section>

      </main>
    </div>
  );
}
