import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('const [error, setError] = useState("");', 'const [error, setError] = useState("");\n  const [notebookData, setNotebookData] = useState<any>(null);')

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
