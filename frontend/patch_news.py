import sys

file_path = r'c:\temp\maklersite\frontend\app\dashboard\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add unreadNewsCount state
target_state = '  const [newsFeed, setNewsFeed] = useState<NewsItemType[]>([]);'
replacement_state = '''  const [newsFeed, setNewsFeed] = useState<NewsItemType[]>([]);
  const [unreadNewsCount, setUnreadNewsCount] = useState(0);'''

if target_state in content:
    content = content.replace(target_state, replacement_state)

# Replace getNews() call
target_getnews = '    getNews().then(setNewsFeed).catch(() => {});'
replacement_getnews = '''    getNews().then(news => {
      setNewsFeed(news);
      if (news.length > 0) {
        const lastReadStr = localStorage.getItem("lastReadNewsTime");
        if (!lastReadStr) {
          setUnreadNewsCount(news.length);
        } else {
          const lastDate = new Date(lastReadStr).getTime();
          setUnreadNewsCount(news.filter(n => new Date(n.created_at).getTime() > lastDate).length);
        }
      }
    }).catch(() => {});'''

if target_getnews in content:
    content = content.replace(target_getnews, replacement_getnews)

# Replace UI
target_ui = '''        {newsFeed.length > 0 && (
          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, marginBottom: 16 }}>📰 Новости и события</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>'''

replacement_ui = '''        {newsFeed.length > 0 && (
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontWeight: 600, margin: 0 }}>
                📰 Новости {unreadNewsCount > 0 && <span style={{ color: "#ff4d4d", fontSize: 13 }}>({unreadNewsCount})</span>}
              </h2>
              {unreadNewsCount > 0 && (
                <button
                  onClick={() => {
                    localStorage.setItem("lastReadNewsTime", new Date().toISOString());
                    setUnreadNewsCount(0);
                  }}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                    background: "rgba(34,201,122,0.1)", color: "#22c97a", border: "1px solid rgba(34,201,122,0.3)"
                  }}
                >
                  ✓ Прочитано
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>'''

content = content.replace(target_ui, replacement_ui)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('Done!')
