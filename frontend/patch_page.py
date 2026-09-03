import re

with open("frontend/app/admin/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "approveDepositFromPool," not in content:
    content = content.replace(
        "getAdminDeposits, approveDeposit, rejectDeposit, getAdminPoolHistory,",
        "getAdminDeposits, approveDeposit, approveDepositFromPool, rejectDeposit, getAdminPoolHistory,"
    )

if "approveForexDepositFromPool," not in content:
    content = content.replace(
        "getAdminForexDeposits, approveForexDeposit, rejectForexDeposit, getAdminForexPoolHistory,",
        "getAdminForexDeposits, approveForexDeposit, approveForexDepositFromPool, rejectForexDeposit, getAdminForexPoolHistory,"
    )

handler_func = """
  async function handleApproveDeposit(id: string) {
    const amount = parseFloat(actualAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    if (activePool === "forex") await approveForexDeposit(id, amount);
    else await approveDeposit(id, amount);
    setConfirmingDeposit(null);
    fetchData();
  }

  async function handleApproveDepositFromPool(id: string) {
    const amount = parseFloat(actualAmounts[id] || "0");
    if (!amount || amount <= 0) return;
    if (!confirm(`Пополнить депозит на ${amount} USDT из пула админа?`)) return;
    if (activePool === "forex") await approveForexDepositFromPool(id, amount);
    else await approveDepositFromPool(id, amount);
    setConfirmingDeposit(null);
    fetchData();
  }
"""

if "handleApproveDepositFromPool" not in content:
    content = re.sub(
        r"  async function handleApproveDeposit\(id: string\) \{.*?fetchData\(\);\n  \}",
        handler_func.strip(),
        content,
        flags=re.DOTALL
    )

buttons_html = """
                        <>
                          <div>
                            <label style={{ fontSize: 11, color: muted, display: "block", marginBottom: 4 }}>Фактическое пополнение (USDT)</label>
                            <input type="number" step="0.01" min="0"
                              value={actualAmounts[d.id] ?? String(d.amount)}
                              onChange={e => setActualAmounts(prev => ({ ...prev, [d.id]: e.target.value }))}
                              style={{ ...inputStyle, border: "1px solid rgba(34,201,122,0.3)" }} autoFocus />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleApproveDeposit(d.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                              <CheckCircle size={13} /> Одобрить
                            </button>
                            <button onClick={() => handleApproveDepositFromPool(d.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(34,201,122,0.6)", color: "#fff", cursor: "pointer", border: "none" }}>
                              Из пула
                            </button>
                            <button onClick={() => setConfirmingDeposit(null)}
                              style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "rgba(20,20,40,0.8)", color: muted, cursor: "pointer", border: "none" }}>
                              Отмена
                            </button>
                          </div>
                        </>
"""

if "handleApproveDepositFromPool(d.id)" not in content:
    content = re.sub(
        r"                        <>\n                          <div>\n                            <label style=\{\{ fontSize: 11, color: muted, display: \"block\", marginBottom: 4 \}\}>Фактическое пополнение \(USDT\)</label>\n                            <input type=\"number\" step=\"0.01\" min=\"0\"\n                              value=\{actualAmounts\[d.id\] \?\? String\(d.amount\)\}\n                              onChange=\{e => setActualAmounts\(prev => \(\{ ...prev, \[d.id\]: e.target.value \}\)\)\}\n                              style=\{\{ ...inputStyle, border: \"1px solid rgba\(34,201,122,0.3\)\" \}\} autoFocus />\n                          </div>\n                          <div style=\{\{ display: \"flex\", gap: 8 \}\}>\n                            <button onClick=\{\(\) => handleApproveDeposit\(d.id\)\}\n                              style=\{\{ flex: 1, display: \"flex\", alignItems: \"center\", justifyContent: \"center\", gap: 6, fontSize: 13, padding: \"8px 0\", borderRadius: 8, background: \"rgba\(13,58,32,0.8\)\", color: \"#22c97a\", cursor: \"pointer\", border: \"none\" \}\}>\n                              <CheckCircle size=\{13\} /> Одобрить\n                            </button>\n                            <button onClick=\{\(\) => setConfirmingDeposit\(null\)\}\n                              style=\{\{ fontSize: 13, padding: \"8px 12px\", borderRadius: 8, background: \"rgba\(20,20,40,0.8\)\", color: muted, cursor: \"pointer\", border: \"none\" \}\}>\n                              Отмена\n                            </button>\n                          </div>\n                        </>",
        buttons_html.strip(),
        content,
        flags=re.DOTALL
    )

with open("frontend/app/admin/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Patched admin/page.tsx")
