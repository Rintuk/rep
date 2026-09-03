import re

with open("frontend/lib/api.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_api_funcs = """
export async function approveDeposit(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/deposits/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function approveDepositFromPool(id: string, actual_amount: number) {
  const res = await api.post(`/auth/admin/deposits/${id}/approve-from-pool`, null, { params: { actual_amount } });
  return res.data;
}
"""

new_forex_api_funcs = """
export async function approveForexDeposit(id: string, actual_amount: number) {
  const res = await api.post(`/forex/admin/deposits/${id}/approve`, null, { params: { actual_amount } });
  return res.data;
}

export async function approveForexDepositFromPool(id: string, actual_amount: number) {
  const res = await api.post(`/forex/admin/deposits/${id}/forex-approve-from-pool`, null, { params: { actual_amount } });
  return res.data;
}
"""

if "approveDepositFromPool" not in content:
    content = content.replace(
        "export async function approveDeposit(id: string, actual_amount: number) {\n  const res = await api.post(`/auth/admin/deposits/${id}/approve`, null, { params: { actual_amount } });\n  return res.data;\n}",
        new_api_funcs
    )

if "approveForexDepositFromPool" not in content:
    content = content.replace(
        "export async function approveForexDeposit(id: string, actual_amount: number) {\n  const res = await api.post(`/forex/admin/deposits/${id}/approve`, null, { params: { actual_amount } });\n  return res.data;\n}",
        new_forex_api_funcs
    )

with open("frontend/lib/api.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched api.ts")
