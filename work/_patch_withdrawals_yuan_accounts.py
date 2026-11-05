# -*- coding: utf-8 -*-
"""Patch HQ withdrawals: AccountsContext + yuan amounts + apply-time format."""
from pathlib import Path
import re

root = Path(r"E:\project\react-web\naoshang-front-react")
src = root / "src"

# ---------- 1) accounts context leaf ----------
accounts_dir = src / "accounts"
accounts_dir.mkdir(exist_ok=True)

(accounts_dir / "accountsContext.ts").write_text(
    """import { createContext } from 'react'
import type { UserAccount } from '../types/users'

export type AccountsContextValue = {
  accounts: UserAccount[]
  byId: Map<string, UserAccount>
  loading: boolean
  error: string | null
  getAccount: (id: string | null | undefined) => UserAccount | undefined
  refresh: () => Promise<void>
}

/** Keep createContext in this leaf module so HMR of provider/pages cannot duplicate the context object. */
export const AccountsContext = createContext<AccountsContextValue | null>(null)
""",
    encoding="utf-8",
)

(accounts_dir / "AccountsProvider.tsx").write_text(
    """import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { usersService } from '../services/users'
import type { UserAccount } from '../types/users'
import { AccountsContext, type AccountsContextValue } from './accountsContext'

const PAGE_SIZE = 200

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.token
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setAccounts([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const all: UserAccount[] = []
      let page = 1
      let total = Number.POSITIVE_INFINITY
      while (all.length < total) {
        const result = await usersService.list(token, { page, pageSize: PAGE_SIZE })
        all.push(...result.items)
        total = result.total
        if (!result.items.length) break
        page += 1
        if (page > 50) break
      }
      setAccounts(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账号列表失败')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byId = useMemo(() => {
    const map = new Map<string, UserAccount>()
    for (const account of accounts) {
      if (account.accountId) map.set(account.accountId, account)
    }
    return map
  }, [accounts])

  const getAccount = useCallback(
    (id: string | null | undefined) => {
      if (!id) return undefined
      return byId.get(id)
    },
    [byId],
  )

  const value = useMemo<AccountsContextValue>(
    () => ({ accounts, byId, loading, error, getAccount, refresh }),
    [accounts, byId, loading, error, getAccount, refresh],
  )

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
}

export function useAccounts() {
  const value = useContext(AccountsContext)
  if (!value) throw new Error('useAccounts 必须在 AccountsProvider 内使用')
  return value
}
""",
    encoding="utf-8",
)
print("wrote accounts context")

# ---------- 2) AdminLayout: wrap Outlet with AccountsProvider ----------
layout = src / "layouts" / "AdminLayout.tsx"
lt = layout.read_text(encoding="utf-8")
if "AccountsProvider" not in lt:
    lt = lt.replace(
        "import { useAuth } from '../auth/AuthProvider'\n",
        "import { useAuth } from '../auth/AuthProvider'\nimport { AccountsProvider } from '../accounts/AccountsProvider'\n",
    )
    old = """          <Outlet />
        </main>"""
    new = """          <AccountsProvider>
            <Outlet />
          </AccountsProvider>
        </main>"""
    if old not in lt:
        raise SystemExit("AdminLayout Outlet block not found")
    lt = lt.replace(old, new, 1)
    layout.write_text(lt, encoding="utf-8")
    print("updated AdminLayout.tsx")
else:
    print("AdminLayout already has AccountsProvider")

# ---------- 3) types/withdrawals: 分 -> 元 ----------
types_wd = src / "types" / "withdrawals.ts"
tt = types_wd.read_text(encoding="utf-8")
tt2 = tt.replace(
    "/** HQ-23 提现审核、打款回执与凭证。字段对齐小程序 wallet/withdraw-* 与 BusinessWithdrawals；金额整数分；不伪造银行打款终态——仅登记回执。最低额/费率/自动打款待定。 */",
    "/** HQ-23 提现审核、打款回执与凭证。字段对齐小程序 wallet/withdraw-* 与 BusinessWithdrawals；金额单位为元（非分）；不伪造银行打款终态——仅登记回执。最低额/费率/自动打款待定。 */",
)
tt2 = tt2.replace("  /** 申请金额（分） */", "  /** 申请金额（元） */")
tt2 = tt2.replace("  /** 手续费快照（分）；费率政策待定，仅展示申请时快照 */", "  /** 手续费快照（元）；费率政策待定，仅展示申请时快照 */")
tt2 = tt2.replace("  /** 预计到账（分） */", "  /** 预计到账（元） */")
if tt2 != tt:
    types_wd.write_text(tt2, encoding="utf-8")
    print("updated types/withdrawals.ts")
else:
    print("types/withdrawals.ts unchanged or already yuan")

# ---------- 4) real/withdrawals moneyAmount: treat as yuan ----------
real_wd = src / "services" / "real" / "withdrawals.ts"
rt = real_wd.read_text(encoding="utf-8")
rt2 = rt.replace(
    "import { arr, asPage, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData, yuanToFen } from './bridge'",
    "import { arr, asPage, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData } from './bridge'",
)
old_money = """function moneyAmount(value: unknown): number {
  if (value == null || value === '') return 0
  const n = num(value)
  if (!Number.isFinite(n)) return 0
  if (!Number.isInteger(n) || (n > 0 && n < 1000)) return Math.max(0, yuanToFen(value))
  return Math.max(0, n)
}"""
new_money = """/** HQ 提现接口金额单位为元（非分）；原样解析，不做分↔元换算。 */
function moneyAmount(value: unknown): number {
  if (value == null || value === '') return 0
  const n = num(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}"""
if old_money not in rt2:
    raise SystemExit("moneyAmount block not found")
rt2 = rt2.replace(old_money, new_money, 1)
real_wd.write_text(rt2, encoding="utf-8")
print("updated real/withdrawals.ts moneyAmount")

# ---------- 5) mock amounts: fen literals -> yuan ----------
mock_wd = src / "services" / "mock" / "withdrawals.ts"
mt = mock_wd.read_text(encoding="utf-8")

def fen_literal_to_yuan(match: re.Match) -> str:
    key = match.group(1)
    raw = match.group(2).replace("_", "")
    n = int(raw)
    # historical mock stored fen (…_00); convert to yuan
    if n % 100 == 0:
        n = n // 100
    return f"{key}: {n}"

mt2 = re.sub(
    r"\b(amount|fee|netAmount):\s*([0-9_]+)",
    fen_literal_to_yuan,
    mt,
)
if mt2 == mt:
    print("WARN: mock amounts pattern unchanged")
else:
    mock_wd.write_text(mt2, encoding="utf-8")
    print("updated mock/withdrawals.ts amounts to yuan")

# ---------- 6) Withdrawals.tsx: context lookup, yuan display, time format ----------
page = src / "pages" / "Withdrawals.tsx"
pt = page.read_text(encoding="utf-8")

if "useAccounts" not in pt:
    pt = pt.replace(
        "import { useAuth } from '../auth/AuthProvider'\n",
        "import { useAuth } from '../auth/AuthProvider'\nimport { useAccounts } from '../accounts/AccountsProvider'\n",
    )

old_fen = """function fen(n: number) {
  return `${(n / 100).toFixed(2)} 元`
}"""
new_helpers = """/** 提现金额单位为元（非分），原样展示。 */
function yuan(n: number) {
  return `${Number(n || 0).toFixed(2)} 元`
}

/** 申请时间：YYYY-MM-DD HH:mm（Asia/Shanghai） */
function formatApplyTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const s = d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
  return s.slice(0, 16)
}

function applicantText(
  row: Pick<WithdrawalApplication, 'accountId' | 'accountName' | 'phone'>,
  getAccount: (id: string | null | undefined) => { nickname: string; phone: string } | undefined,
) {
  const acc = getAccount(row.accountId)
  const name = (acc?.nickname || row.accountName || '').trim()
  const phone = (acc?.phone || row.phone || '').trim()
  if (name && phone) return `${name} / ${phone}`
  if (name || phone) return name || phone
  return row.accountId || '—'
}"""
if old_fen not in pt:
    raise SystemExit("fen helper not found in Withdrawals.tsx")
pt = pt.replace(old_fen, new_helpers, 1)
pt = pt.replace("fen(", "yuan(")

# inject useAccounts in component
if "const { getAccount } = useAccounts()" not in pt:
    pt = pt.replace(
        "  const { session } = useAuth()\n  const token = session!.token\n",
        "  const { session } = useAuth()\n  const { getAccount } = useAccounts()\n  const token = session!.token\n",
    )

# applicant column
old_applicant = """      {
        title: '申请人',
        width: 160,
        render: (_: unknown, row: WithdrawalApplication) => (
          <span>
            {row.accountName} / {row.phone}
          </span>
        ),
      },"""
new_applicant = """      {
        title: '申请人',
        width: 160,
        render: (_: unknown, row: WithdrawalApplication) => (
          <span>{applicantText(row, getAccount)}</span>
        ),
      },"""
if old_applicant not in pt:
    raise SystemExit("applicant column not found")
pt = pt.replace(old_applicant, new_applicant, 1)

# createdAt column
old_created = """      {
        title: '申请时间',
        dataIndex: 'createdAt',
        width: 180,
      },"""
new_created = """      {
        title: '申请时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (value: string) => formatApplyTime(value),
      },"""
if old_created not in pt:
    raise SystemExit("createdAt column not found")
pt = pt.replace(old_created, new_created, 1)

# columns deps
pt = pt.replace("    [canReview],\n  )", "    [canReview, getAccount],\n  )")

# detail applicant + times
pt = pt.replace(
    """              <Descriptions.Item label="申请人">
                {detail.application.accountName} / {detail.application.phone}
              </Descriptions.Item>""",
    """              <Descriptions.Item label="申请人">
                {applicantText(detail.application, getAccount)}
              </Descriptions.Item>""",
)
pt = pt.replace(
    '<Descriptions.Item label="申请时间">{detail.application.createdAt}</Descriptions.Item>',
    '<Descriptions.Item label="申请时间">{formatApplyTime(detail.application.createdAt)}</Descriptions.Item>',
)
pt = pt.replace(
    '<Descriptions.Item label="审核时间">{detail.application.reviewedAt || \'-\'}</Descriptions.Item>',
    '<Descriptions.Item label="审核时间">{formatApplyTime(detail.application.reviewedAt)}</Descriptions.Item>',
)
pt = pt.replace(
    '<Descriptions.Item label="回执时间">{detail.application.receiptAt || \'-\'}</Descriptions.Item>',
    '<Descriptions.Item label="回执时间">{formatApplyTime(detail.application.receiptAt)}</Descriptions.Item>',
)

pt = pt.replace(
    "返回 <Link to=\"/\">首页</Link> · 收益联查见 <Link to=\"/revenue/settlement\">结算重算与冲正</Link>。金额界面按元展示（存分）；写操作须原因/版本/幂等/确认；费用快照非正式政策。",
    "返回 <Link to=\"/\">首页</Link> · 收益联查见 <Link to=\"/revenue/settlement\">结算重算与冲正</Link>。金额单位为元（接口原样，不做分换算）；写操作须原因/版本/幂等/确认；费用快照非正式政策。",
)

page.write_text(pt, encoding="utf-8")
print("updated pages/Withdrawals.tsx")

# ---------- 7) tests ----------
norm = src / "services" / "real" / "withdrawalsNormalize.test.ts"
nt = norm.read_text(encoding="utf-8")
nt2 = nt.replace(
    '  const detail = mapWithdrawalDetail({ id: "wd-1", amount: 100.5, status: "PENDING_REVIEW" })\n  expect(detail.application.withdrawalId).toBe("wd-1")\n  expect(detail.application.amount).toBe(10050)',
    '  const detail = mapWithdrawalDetail({ id: "wd-1", amount: 100.5, status: "PENDING_REVIEW" })\n  expect(detail.application.withdrawalId).toBe("wd-1")\n  expect(detail.application.amount).toBe(100.5)',
)
# append yuan as-is case if missing
if "amount 1000 stays yuan" not in nt2 and "amount: 1000" not in nt2:
    nt2 += """
it("mapWithdrawalApplication keeps API yuan amounts as-is (no /100 or *100)", async () => {
  const { mapWithdrawalApplication } = await import("./withdrawals")
  const row = mapWithdrawalApplication({
    id: "wd-api-1",
    accountId: "p1",
    amount: 1000,
    netAmount: 1000,
    fee: 0,
    status: "PENDING_REVIEW",
    createdAt: "2024-11-05T01:45:19.129Z",
  })
  expect(row.amount).toBe(1000)
  expect(row.netAmount).toBe(1000)
  expect(row.fee).toBe(0)
  expect(row.accountId).toBe("p1")
})
"""
norm.write_text(nt2, encoding="utf-8")
print("updated withdrawalsNormalize.test.ts")

svc_test = src / "services" / "withdrawals.test.ts"
st = svc_test.read_text(encoding="utf-8")
st2 = st.replace("金额为分", "金额为元")
# strengthen assertion that mock amounts are yuan-scale (e.g. 567 not 56700)
st2 = st2.replace(
    "  expect(list.items.every((row) => row.mockOnly && Number.isInteger(row.amount))).toBe(true)\n})",
    "  expect(list.items.every((row) => row.mockOnly && Number.isInteger(row.amount))).toBe(true)\n"
    "  // 金额单位为元：示例申请约数百～数千元，不应再是「分」量级的五位数假数据\n"
    "  const sample = list.items.find((row) => row.withdrawalId === 'wd-pending-001')\n"
    "  expect(sample?.amount).toBe(567)\n})",
)
svc_test.write_text(st2, encoding="utf-8")
print("updated withdrawals.test.ts")

print("ALL PATCHES DONE")
