import codecs

with codecs.open('frontend/app/dashboard/page.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace(
    'changePassword, getNews, NewsItem as NewsItemType, getMyTickets, markTicketsRead,\n',
    'changePassword, getNews, NewsItem as NewsItemType, getMyTickets, markTicketsRead, updateNickname,\n'
)

content = content.replace(
    'last_updated: string | null;',
    'last_updated: string | null; nickname?: string | null;'
)

content = content.replace(
    'const [changePassMsg, setChangePassMsg] = useState<{ ok: boolean; text: string } | null>(null);',
    'const [changePassMsg, setChangePassMsg] = useState<{ ok: boolean; text: string } | null>(null);\n  const [newNickname, setNewNickname] = useState("");\n  const [nicknameLoading, setNicknameLoading] = useState(false);\n  const [nicknameMsg, setNicknameMsg] = useState<{ ok: boolean; text: string } | null>(null);'
)

content = content.replace(
    'label: "Настройки", color: "#a78bfa", icon: <Settings size={15}/>, action: () => { setMenuOpen(false); setShowChangePass(true); setChangePassMsg(null); setOldPass(""); setNewPass(""); setNewPass2(""); }',
    'label: "Профиль", color: "#a78bfa", icon: <Settings size={15}/>, action: () => { setMenuOpen(false); setShowChangePass(true); setChangePassMsg(null); setOldPass(""); setNewPass(""); setNewPass2(""); setNewNickname(data?.nickname || ""); setNicknameMsg(null); }'
)

modal_old = '''<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Смена пароля</h3>
              <button onClick={() => setShowChangePass(false)} style={{ background: "none", border: "none", color: "#4a6a9a", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>'''

modal_new = '''<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Профиль</h3>
              <button onClick={() => setShowChangePass(false)} style={{ background: "none", border: "none", color: "#4a6a9a", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <h4 style={{ color: "#a78bfa", fontSize: 14, margin: 0 }}>Изменить никнейм</h4>
              <div>
                <label style={{ fontSize: 11, color: "#4a6a9a", display: "block", marginBottom: 6 }}>Никнейм (3-10 символов)</label>
                <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.25)",
                    color: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              {nicknameMsg && (
                <p style={{ fontSize: 13, fontWeight: 600, color: nicknameMsg.ok ? "#22c97a" : "#ff4d4d", textAlign: "center", margin: 0 }}>
                  {nicknameMsg.text}
                </p>
              )}
              <button
                disabled={nicknameLoading || !newNickname || newNickname === data?.nickname}
                onClick={async () => {
                  setNicknameLoading(true); setNicknameMsg(null);
                  try {
                    await updateNickname(newNickname);
                    setNicknameMsg({ ok: true, text: "Никнейм изменен" });
                    const d = await getDashboard();
                    setData(d);
                  } catch (e: any) {
                    setNicknameMsg({ ok: false, text: e?.response?.data?.detail || "Ошибка" });
                  } finally {
                    setNicknameLoading(false);
                  }
                }}
                style={{ padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, border: "none",
                  background: "rgba(167,139,250,0.2)", color: "#a78bfa", cursor: "pointer",
                  opacity: (nicknameLoading || !newNickname || newNickname === data?.nickname) ? 0.5 : 1 }}>
                {nicknameLoading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h4 style={{ color: "#a78bfa", fontSize: 14, margin: 0 }}>Изменить пароль</h4>'''

content = content.replace(modal_old, modal_new)

# Greeting update
content = content.replace('{data.email}', '{data.nickname || data.email}')

with codecs.open('frontend/app/dashboard/page.tsx', 'w', 'utf-8') as f:
    f.write(content)
