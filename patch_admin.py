import codecs

with codecs.open('frontend/app/admin/page.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace(
    'investors: { id: string; email: string; created_at: string; investment: number; withdrawal: number; pnl: number; referrals_count: number; ref_income: number; status?: string; total_volume?: number; next_vol?: number; }[];',
    'investors: { id: string; email: string; nickname?: string | null; created_at: string; investment: number; withdrawal: number; pnl: number; referrals_count: number; ref_income: number; status?: string; total_volume?: number; next_vol?: number; }[];'
)

content = content.replace(
    'referrals: { id: string; email: string; is_active: boolean; referred_by_email: string; investment: number }[];',
    'referrals: { id: string; email: string; nickname?: string | null; is_active: boolean; referred_by_email: string; investment: number }[];'
)

content = content.replace(
    'pending_users: { id: string; email: string; created_at: string }[];',
    'pending_users: { id: string; email: string; nickname?: string | null; created_at: string }[];'
)

content = content.replace(
    '<p style={{ color: "#fff", fontWeight: 500 }}>{u.email}</p>',
    '<p style={{ color: "#fff", fontWeight: 500 }}>{u.nickname ? `${u.nickname} (${u.email})` : u.email}</p>'
)

content = content.replace(
    '<td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{u.email}</td>',
    '<td style={{ padding: "12px 16px", color: "#fff", fontWeight: 500 }}>{u.nickname ? `${u.nickname} (${u.email})` : u.email}</td>'
)

with codecs.open('frontend/app/admin/page.tsx', 'w', 'utf-8') as f:
    f.write(content)
