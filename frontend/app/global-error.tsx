"use client";

// Баг 11 fix: Next.js 16 требует явный global-error.tsx
// иначе pre-render завершается с InvariantError: Expected workStore to be initialized

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#050a1a",
        color: "#e0e8ff",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{
          background: "rgba(8,12,35,0.92)",
          border: "1px solid rgba(0,180,255,0.2)",
          borderRadius: 18,
          padding: "48px 40px",
          textAlign: "center",
          maxWidth: 440,
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 10, margin: "0 0 10px" }}>
            Что-то пошло не так
          </h2>
          <p style={{ color: "#6b8ab0", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Произошла критическая ошибка приложения.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "linear-gradient(180deg, #2b6bff 0%, #1040cc 100%)",
              border: "none",
              borderRadius: 10,
              padding: "12px 28px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 4px 0 #0d2a80, 0 6px 20px rgba(30,80,255,0.35)",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
