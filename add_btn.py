import re

with open('frontend/app/admin/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

new_btn = """            <button
              onClick={async () => {
                const amt = prompt("Введите новый объем пула в позициях (USDT):", "19700");
                if (!amt) return;
                const numAmt = parseFloat(amt);
                if (isNaN(numAmt) || numAmt < 0) return alert("Неверная сумма!");
                try {
                  await api.post("/auth/admin/set-forex-positions", { amount: numAmt });
                  alert("Успешно!");
                  fetchData();
                } catch (e: any) {
                  alert("Ошибка: " + (e?.response?.data?.detail || e.message));
                }
              }}
              style={{
                padding: "9px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: "1px solid rgba(0,180,255,0.7)", background: "rgba(0,180,255,0.15)", color: "#00b4ff"
              }}
            >
              Пул в позициях
            </button>"""

# Find the location of "+ Начислить прибыль (Форекс)"
match = re.search(r'\+\s*Начислить прибыль \(Форекс\).*?</button>', text, re.DOTALL)
if match:
    old_btn = match.group(0)
    text = text.replace(old_btn, old_btn + '\n' + new_btn)
    with open('frontend/app/admin/page.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Success")
else:
    print("Not found")
