import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''                  </div>
                ))}
              </div>
            </div>'''

render_code = '''                  </div>
                ))}
              </div>
            </div>

            {/* NOTEBOOK BLOCK */}
            {notebookData && (
              <div style={{ padding: 20, background: "rgba(30, 41, 59, 0.5)", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <h2 style={{ color: "#a78bfa", fontWeight: 600, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📓</span> Записная книжка дохода
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Заработано сегодня", value: notebookData[activePool]?.today || 0 },
                    { label: "Заработано вчера", value: notebookData[activePool]?.yesterday || 0 },
                    { label: "За неделю", value: notebookData[activePool]?.week || 0 },
                    { label: "За месяц", value: notebookData[activePool]?.month || 0 },
                    { label: "Всего", value: notebookData[activePool]?.total || 0 },
                  ].map((r, i) => (
                    <div key={`nb-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: r.value >= 0 ? "#22c97a" : "#ff4d4d" }}>
                        {r.value >= 0 ? "+" : ""}{Number(r.value).toFixed(2)} $
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 12, textAlign: "center", fontStyle: "italic" }}>
                  *Растет от закрытых сделок. Не уменьшается при выводах.
                </p>
              </div>
            )}'''

# Inject getAdminNotebook and setNotebookData if they don't exist
if 'getAdminNotebook' not in c:
    c = c.replace('getAdminOverview, getAdminForexOverview,', 'getAdminOverview, getAdminForexOverview, getAdminNotebook,')

if 'setNotebookData' not in c:
    c = c.replace('const [error, setError] = useState("");', 'const [error, setError] = useState("");\n  const [notebookData, setNotebookData] = useState<any>(null);')

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


if target in c:
    # replace only the first occurrence after 'Статистика пула'
    stat_idx = c.find('Статистика пула')
    if stat_idx != -1:
        rep_idx = c.find(target, stat_idx)
        if rep_idx != -1:
            c = c[:rep_idx] + render_code + c[rep_idx + len(target):]
            with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
                f.write(c)
            print('Replaced successfully')
        else:
            print('Target not found after stat_idx')
else:
    print('Target not found at all')
