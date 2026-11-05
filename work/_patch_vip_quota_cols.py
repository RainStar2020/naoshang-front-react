from pathlib import Path
import re

root = Path(r"E:\project\react-web\naoshang-front-react")

# --- real mapper (double-newline style) ---
p = root / "src" / "services" / "real" / "quotas.ts"
text = p.read_text(encoding="utf-8")
if "spent," not in text or "const spent =" not in text:
    old_block = """  const balancesSrc = arr(r.balances ?? owner.balances)

  const balances = balancesSrc.length ? balancesSrc.map(mapBalance) : [

    mapBalance({ quotaType: 'STANDARD', total: standard, remaining: Math.max(0, available - activityTotal), reserved: frozen, used: 0, transferred: 0 }),

    mapBalance({ quotaType: 'ACTIVITY', total: activityTotal, remaining: Math.max(0, Math.min(activityTotal, available)), reserved: 0, used: 0, transferred: 0 }),

  ]

  const canAdjust = allowedActions.includes('adjust')"""
    new_block = """  const balancesSrc = arr(r.balances ?? owner.balances)

  const spentFromApi = r.spent ?? r.used ?? r.usedTotal ?? r.consumed ?? owner.spent ?? owner.used ?? owner.usedTotal

  const balances = balancesSrc.length ? balancesSrc.map(mapBalance) : [

    mapBalance({ quotaType: 'STANDARD', total: standard, remaining: Math.max(0, available - activityTotal), reserved: frozen, used: 0, transferred: 0 }),

    mapBalance({ quotaType: 'ACTIVITY', total: activityTotal, remaining: Math.max(0, Math.min(activityTotal, available)), reserved: 0, used: 0, transferred: 0 }),

  ]

  // 列表「已花费名额」：优先 API spent/used；否则汇总 balances.used；再否则用 total-available-frozen 推算（不编造接口字段）

  const spentFromBalances = balances.reduce((sum, item) => sum + item.used, 0)

  const spent = spentFromApi != null

    ? num(spentFromApi)

    : (spentFromBalances > 0 ? spentFromBalances : Math.max(0, quotaTotal - available - frozen))

  const canAdjust = allowedActions.includes('adjust')"""
    if old_block not in text:
        raise SystemExit("mapper balances block not found")
    text = text.replace(old_block, new_block, 1)
    old_ret = """    quotaTotal,

    frozen,

    available,

    quotaStatus,

    allowedActions,

  }

}"""
    new_ret = """    quotaTotal,

    frozen,

    available,

    spent,

    quotaStatus,

    allowedActions,

  }

}"""
    if old_ret not in text:
        raise SystemExit("mapper return block not found")
    text = text.replace(old_ret, new_ret, 1)
    p.write_text(text, encoding="utf-8")
    print("updated real/quotas.ts")
else:
    print("real/quotas.ts already has spent")

# --- mock ---
p = root / "src" / "services" / "mock" / "quotas.ts"
text = p.read_text(encoding="utf-8")
if "spent:" not in text:
    old = "quotaTotal: standard + activityTotal, frozen, available, quotaStatus: profile.partnerStatus, allowedActions: canRecharge ? ['adjust', 'freeze'] : ['freeze'] }"
    new = "quotaTotal: standard + activityTotal, frozen, available, spent: balances.reduce((n, item) => n + item.used, 0), quotaStatus: profile.partnerStatus, allowedActions: canRecharge ? ['adjust', 'freeze'] : ['freeze'] }"
    if old not in text:
        raise SystemExit("mock owner return not found: " + repr(text[text.find('quotaTotal'):text.find('quotaTotal')+200]))
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("updated mock/quotas.ts")
else:
    print("mock already has spent")

# --- mapper test ---
p = root / "src" / "services" / "real" / "quotas.mapper.test.ts"
text = p.read_text(encoding="utf-8")
if "spent: 12" not in text:
    old1 = """      standard: 500,
      activityTotal: 0,
      total: 500,
      frozen: 0,
      available: 500,
      status: 'ACTIVE',"""
    new1 = """      standard: 500,
      activityTotal: 0,
      total: 500,
      frozen: 0,
      available: 500,
      used: 12,
      status: 'ACTIVE',"""
    if old1 not in text:
        raise SystemExit("test1 input not found")
    text = text.replace(old1, new1, 1)
    old1e = """      quotaTotal: 500,
      frozen: 0,
      available: 500,
      quotaStatus: 'ACTIVE',"""
    new1e = """      quotaTotal: 500,
      frozen: 0,
      available: 500,
      spent: 12,
      quotaStatus: 'ACTIVE',"""
    if old1e not in text:
        raise SystemExit("test1 expect not found")
    text = text.replace(old1e, new1e, 1)
    old2 = "expect(row).toMatchObject({ standard: 97, activityTotal: 4, quotaTotal: 101, available: 101 })"
    new2 = "expect(row).toMatchObject({ standard: 97, activityTotal: 4, quotaTotal: 101, available: 101, spent: 0 })"
    if old2 not in text:
        raise SystemExit("test2 expect not found")
    text = text.replace(old2, new2, 1)
    p.write_text(text, encoding="utf-8")
    print("updated quotas.mapper.test.ts")
else:
    print("mapper test already updated")

# --- Quotas.tsx ---
p = root / "src" / "pages" / "Quotas.tsx"
text = p.read_text(encoding="utf-8")
if "VIP明细" not in text:
    # replace columns via regex from first column to closing of columns array
    pattern = r"columns=\{\[\n(?:      \{ title: .*?\},\n)+    \]\}"
    m = re.search(pattern, text, re.S)
    if not m:
        raise SystemExit("columns pattern not found")
    new_cols = """columns={[
      { title: '账户姓名手机号', key: 'account', width: 160, render: (_, row) => <><div>{row.name || '—'}</div><Typography.Text type="secondary">{row.phone || '—'}</Typography.Text></> },
      { title: '用户ID', dataIndex: 'displayId', width: 140, render: (value: string) => value || '—' },
      { title: '总名额', dataIndex: 'quotaTotal', width: 100 },
      { title: 'VIP名额', dataIndex: 'standard', width: 100 },
      { title: '活动名额', dataIndex: 'activityTotal', width: 100 },
      { title: '已花费名额', dataIndex: 'spent', width: 110 },
      { title: '剩余有效名额', dataIndex: 'available', width: 120 },
      { title: '操作', key: 'action', fixed: 'right', width: 140, render: (_, row) => <Space direction="vertical"><Button size="small" onClick={() => openDetail(row.ownerAccountId || row.quotaId)}>VIP明细</Button>{canRecharge && (row.allowedActions?.includes('adjust') || row.eligibility.canRecharge) && <Button size="small" type="primary" onClick={() => openRecharge(row)}>充值</Button>}</Space> },
    ]}"""
    text = text[:m.start()] + new_cols + text[m.end():]
    text = text.replace("scroll={{ x: 1400 }}", "scroll={{ x: 1200 }}", 1)
    # remove unused statusLabels
    text2, n = re.subn(r"const statusLabels = \{ ACTIVE: '经营正常', FROZEN: '已冻结', EXPIRED: '年度到期', PENDING_ANNUAL: '年度未开通' \}\n", "", text, count=1)
    text = text2
    print("removed statusLabels" if n else "statusLabels not removed")
    p.write_text(text, encoding="utf-8")
    print("updated Quotas.tsx")
else:
    print("Quotas.tsx already updated")

print("OK")
