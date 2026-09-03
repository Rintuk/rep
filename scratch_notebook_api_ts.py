import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\lib\\api.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c += "\nexport async function getAdminNotebook() { const res = await api.get('/admin/notebook'); return res.data; }\n"

with open('C:\\temp\\MaklerSite\\frontend\\app\\lib\\api.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
