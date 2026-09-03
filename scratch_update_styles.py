import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace block background
c = c.replace('padding: 20, background: "rgba(30, 41, 59, 0.5)", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.05)"', '...card, padding: 20')

# Replace title color
c = c.replace('color: "#a78bfa", fontWeight: 600, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8', 'color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8')

# Replace label color
c = c.replace('color: "rgba(255,255,255,0.6)"', 'color: muted')

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Styles updated')
