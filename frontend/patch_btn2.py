import re

with open("frontend/app/admin/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

handler_func = """
  async function handleApproveDepositFromPoolDirect(id: string, amount: number) {
    if (!amount || amount <= 0) return;
    if (!confirm(`Пополнить депозит на ${amount} USDT из пула админа?`)) return;
    if (activePool === "forex") await approveForexDepositFromPool(id, amount);
    else await approveDepositFromPool(id, amount);
    setConfirmingDeposit(null);
    fetchData();
  }
"""

if "handleApproveDepositFromPoolDirect" not in content:
    content = content.replace(
        "async function handleRejectDeposit(id: string) {",
        handler_func + "\n  async function handleRejectDeposit(id: string) {"
    )

buttons_html = """                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => { setConfirmingDeposit(d.id); setActualAmounts(prev => ({ ...prev, [d.id]: String(d.amount) })); }}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                            <CheckCircle size={14} /> Подтвердить
                          </button>
                          <button onClick={() => handleApproveDepositFromPoolDirect(d.id, d.amount)}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(34,201,122,0.6)", color: "#fff", cursor: "pointer", border: "none" }}>
                            Из пула
                          </button>
                          <button onClick={() => handleRejectDeposit(d.id)}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(58,13,13,0.8)", color: "#ff4d4d", cursor: "pointer", border: "none" }}>
                            <XCircle size={14} /> Отклонить
                          </button>
                        </div>"""

# Replace the specific block of buttons
# We need to find the correct block because there are two <XCircle size={14} /> Отклонить (one for deposit, one for withdrawal)
# The first one is for deposit
content = re.sub(
    r"                        <div style=\{\{ display: \"flex\", gap: 8 \}\}>\n                          <button onClick=\{\(\) => \{ setConfirmingDeposit\(d.id\); setActualAmounts\(prev => \(\{ ...prev, \[d.id\]: String\(d.amount\) \}\)\); \}\}\n                            style=\{\{ display: \"flex\", alignItems: \"center\", gap: 6, fontSize: 13, padding: \"8px 14px\", borderRadius: 8, background: \"rgba\(13,58,32,0.8\)\", color: \"#22c97a\", cursor: \"pointer\", border: \"none\" \}\}>\n                            <CheckCircle size=\{14\} /> Подтвердить\n                          </button>\n                          <button onClick=\{\(\) => handleRejectDeposit\(d.id\)\}\n                            style=\{\{ display: \"flex\", alignItems: \"center\", gap: 6, fontSize: 13, padding: \"8px 14px\", borderRadius: 8, background: \"rgba\(58,13,13,0.8\)\", color: \"#ff4d4d\", cursor: \"pointer\", border: \"none\" \}\}>\n                            <XCircle size=\{14\} /> Отклонить\n                          </button>\n                        </div>",
    buttons_html.strip(),
    content,
    flags=re.DOTALL
)

with open("frontend/app/admin/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Patched admin/page.tsx with direct pool button")
