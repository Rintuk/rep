import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

render_code = """
          {/* NOTEBOOK BLOCK */}
          {notebookData && (
            <div style={{ marginTop: 24, padding: 20, background: "rgba(167, 139, 250, 0.05)", borderRadius: 12, border: "1px solid rgba(167, 139, 250, 0.2)" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 16, color: "#a78bfa", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📓</span> Записная книжка дохода
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
                *Статистика растет только от прибыли сделок. Не уменьшается при выводах.
              </p>
            </div>
          )}
"""

# Find where to inject
idx = c.find('admin_total_income')
if idx != -1:
    end_map_idx = c.find('</div>\n          </div>', idx)
    if end_map_idx != -1:
        # insert after end_map_idx
        inject_pos = end_map_idx + len('</div>\n          </div>')
        c = c[:inject_pos] + "\n" + render_code + c[inject_pos:]
        with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
            f.write(c)
        print('Injected successfully')
else:
    print('Target not found')
