import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add getAdminNotebook to imports
if 'getAdminNotebook' not in c:
    c = c.replace('getAdminOverview, getAdminForexOverview,', 'getAdminOverview, getAdminForexOverview, getAdminNotebook,')

# 2. Add state
if 'const [notebookData, setNotebookData]' not in c:
    c = c.replace('const [activeTab, setActiveTab] = useState("overview");', 'const [activeTab, setActiveTab] = useState("overview");\n  const [notebookData, setNotebookData] = useState<any>(null);')

# 3. Fetch data
if 'getAdminNotebook()' not in c:
    fetch_old = '''const [d, dep, wdr] = await Promise.all([
        isForex ? getAdminForexOverview() : getAdminOverview(),
        isForex ? getAdminForexDeposits() : getAdminDeposits(),
        isForex ? getAdminForexWithdrawals() : getAdminWithdrawals(),
      ]);'''
    fetch_new = '''const [d, dep, wdr, nb] = await Promise.all([
        isForex ? getAdminForexOverview() : getAdminOverview(),
        isForex ? getAdminForexDeposits() : getAdminDeposits(),
        isForex ? getAdminForexWithdrawals() : getAdminWithdrawals(),
        getAdminNotebook(),
      ]);'''
    c = c.replace(fetch_old, fetch_new)
    c = c.replace('setWithdrawals(wdr);', 'setWithdrawals(wdr);\n        setNotebookData(nb);')

# 4. Render block
render_code = """
              {/* NOTEBOOK BLOCK */}
              {notebookData && (
                <div style={{ marginTop: 24, padding: 20, background: "rgba(167, 139, 250, 0.05)", borderRadius: 12, border: "1px solid rgba(167, 139, 250, 0.2)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#a78bfa", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📓</span> Калькулятор-статистика (Записная книжка)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "Заработано сегодня", value: notebookData[activePool]?.today || 0 },
                      { label: "Заработано вчера", value: notebookData[activePool]?.yesterday || 0 },
                      { label: "За неделю", value: notebookData[activePool]?.week || 0 },
                      { label: "За месяц", value: notebookData[activePool]?.month || 0 },
                      { label: "Всего", value: notebookData[activePool]?.total || 0 },
                    ].map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: muted }}>{r.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: r.value >= 0 ? "#22c97a" : "#ff4d4d" }}>
                          {r.value >= 0 ? "+" : ""}{r.value.toFixed(2)} $
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 12, textAlign: "center", fontStyle: "italic" }}>
                    *Эта статистика растет только от прибыли сделок и не уменьшается при ваших выводах.
                  </p>
                </div>
              )}
"""

target = '{ label: "Итого мой доход", value: `${data.admin_total_income >= 0 ? "+" : ""}${data.admin_total_income.toFixed(2)} $`, color: data.admin_total_income >= 0 ? "#22c97a" : "#ff4d4d" },\n              ].map((r, i) => (\n                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>\n                  <span style={{ fontSize: 13, color: muted }}>{r.label}</span>\n                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color || "#fff" }}>{r.value}</span>\n                </div>\n              ))}\n            </div>\n          </div>'

c = c.replace(target, target + render_code)

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Done")
