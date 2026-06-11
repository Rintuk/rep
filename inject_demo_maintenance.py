with open('frontend/app/demo/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''export default function DemoDashboardPage() {
  const router = useRouter();'''

replacement = '''export default function DemoDashboardPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "rgba(8,12,35,0.82)", border: "1px solid rgba(0,180,255,0.15)", borderRadius: 14, backdropFilter: "blur(12px)", padding: 40, textAlign: "center", position: "relative", zIndex: 1, maxWidth: 400 }}>
        <h1 style={{ color: "#fff", fontSize: 24, marginBottom: 16, fontWeight: 700 }}>Техническое обслуживание 🛠️</h1>
        <p style={{ color: "#8aa0c0", fontSize: 15, lineHeight: 1.5 }}>
          Сайт на техническом обслуживании.<br/><br/>
          Ориентировочное время восстановления работы:<br/>
          <strong style={{ color: "#00cfff" }}>Понедельник, 13:00</strong>.
        </p>
      </div>
    </div>
  );

  const router = useRouter();'''

content = content.replace(target, replacement)

with open('frontend/app/demo/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
