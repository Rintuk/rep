import re

with open("frontend/app/admin/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

btn_target = """                            <button onClick={() => handleApproveDeposit(d.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                              <CheckCircle size={13} /> Одобрить
                            </button>"""

btn_replacement = """                            <button onClick={() => handleApproveDeposit(d.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(13,58,32,0.8)", color: "#22c97a", cursor: "pointer", border: "none" }}>
                              <CheckCircle size={13} /> Одобрить
                            </button>
                            <button onClick={() => handleApproveDepositFromPool(d.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, padding: "8px 0", borderRadius: 8, background: "rgba(34,201,122,0.6)", color: "#fff", cursor: "pointer", border: "none" }}>
                              Из пула
                            </button>"""

if "handleApproveDepositFromPool(d.id)" not in content:
    content = content.replace(btn_target, btn_replacement)
    with open("frontend/app/admin/page.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched button")
else:
    print("Already patched")
