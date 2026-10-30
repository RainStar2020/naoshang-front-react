import type {
  AllocationKind,
  IncomeAudit,
  IncomeCatalog,
  IncomeChannel,
  IncomeEntry,
  IncomeList,
  IncomeModule,
  IncomeMutation,
  IncomeMutationResult,
  IncomeQuery,
  SettlementStatus,
} from '../../types/income'
import { IncomeError } from '../../types/income'

const STORAGE_KEY = 'ns_hq_income_v1'
const AUDIT_KEY = 'ns_hq_income_audit_v1'
const IDEM_KEY = 'ns_hq_income_idem_v1'

const ENGINE_GAP =
  '结算引擎尚无正式 API：改分配/重算/冲正仅落地请求与关联流水；不改可提现余额；前端不推导结算结果、不重算提点公式；不在此出金。'

type IdemRecord = { fingerprint: string; result: IncomeMutationResult }
type StoreShape = { entries: IncomeEntry[]; audit: IncomeAudit[]; idem: Record<string, IdemRecord> }

function nowIso() {
  return new Date().toISOString()
}

function stamp(offsetMin = 0) {
  return new Date(Date.now() - offsetMin * 60_000).toISOString()
}

function actionsFor(e: IncomeEntry): IncomeEntry['allowedActions'] {
  const a: IncomeEntry['allowedActions'] = []
  if (e.kind !== 'ORIGINAL') return a
  if (e.settlementStatus === 'REVERSED') return a
  if (e.allocationStatus === 'PENDING') a.push('reassign-allocation')
  if (e.settlementStatus === 'SETTLED' || e.settlementStatus === 'PENDING_SETTLEMENT') {
    a.push('request-recalc', 'request-reverse')
  }
  if (e.settlementStatus === 'RECALC_PENDING') a.push('request-reverse')
  return a
}

function withActions(e: IncomeEntry): IncomeEntry {
  return { ...e, allowedActions: actionsFor(e), mockOnly: true }
}

function seedEntries(): IncomeEntry[] {
  const base: Omit<IncomeEntry, 'allowedActions' | 'mockOnly'>[] = [
    {
      entryId: 'inc-wh-001',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261022001',
      title: '代理费：开通区域代理',
      category: '代理费',
      channel: 'B',
      module: 'wholesale',
      identityLabel: '联创合伙人',
      accountId: 'acc-founder-1',
      accountName: '王好梦',
      phone: '19919988991',
      storeId: null,
      storeName: null,
      regionLabel: '河南省郑州市',
      amount: 120_00,
      baseAmount: 100_00,
      rateBps: 1200,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'sales',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '王好梦',
      settlementStatus: 'SETTLED',
      pendingNote: null,
      createdAt: stamp(60 * 24 * 5),
      settledAt: stamp(60 * 24 * 4),
      version: 1,
    },
    {
      entryId: 'inc-wh-002',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261022002',
      title: '服务费：会员服务',
      category: '服务费',
      channel: 'C',
      module: 'wholesale',
      identityLabel: '天使合伙人',
      accountId: 'acc-angel-1',
      accountName: '李志远',
      phone: '19919988992',
      storeId: 'store-wutong',
      storeName: '脑商训练营梧桐街店',
      regionLabel: '河南省郑州市管城回族区',
      amount: 13_00,
      baseAmount: 100_00,
      rateBps: 1200,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'sales',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '李志远',
      settlementStatus: 'PENDING_SETTLEMENT',
      pendingNote: null,
      createdAt: stamp(60 * 24 * 3),
      settledAt: null,
      version: 1,
    },
    {
      entryId: 'inc-wh-003',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261022006',
      title: '专栏课：购买记忆基础',
      category: '专栏课',
      channel: 'C',
      module: 'wholesale',
      identityLabel: 'VIP合伙人',
      accountId: 'acc-vip-1',
      accountName: '赵敏',
      phone: '18800001111',
      storeId: 'store-wenhua',
      storeName: '脑商训练营文化路店',
      regionLabel: '河南省郑州市金水区',
      amount: 54_00,
      baseAmount: 100_00,
      rateBps: 500,
      allocationStatus: 'PENDING',
      allocationKind: 'sales',
      allocationTarget: null,
      allocationAgentId: null,
      beneficiaryName: '待分配',
      settlementStatus: 'PENDING_ALLOCATION',
      pendingNote: '本单存在待分配提成，收益暂不计入可提现金额',
      createdAt: stamp(60 * 12),
      settledAt: null,
      version: 1,
    },
    {
      entryId: 'inc-co-001',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261023011',
      title: '合店费：开通合店老板6个月',
      category: '合店费',
      channel: 'B',
      module: 'costore',
      identityLabel: '合店老板',
      accountId: 'acc-costore-1',
      accountName: '陈合店',
      phone: '13700002222',
      storeId: 'store-wutong',
      storeName: '脑商训练营梧桐街店',
      regionLabel: '河南省郑州市管城回族区',
      amount: 25_000_00,
      baseAmount: 50_000_00,
      rateBps: 5000,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'sales',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '陈合店',
      settlementStatus: 'SETTLED',
      pendingNote: null,
      createdAt: stamp(60 * 24 * 8),
      settledAt: stamp(60 * 24 * 7),
      version: 1,
    },
    {
      entryId: 'inc-ag-001',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261024021',
      title: '代理费：开通西二区单店代理',
      category: '代理费',
      channel: 'B',
      module: 'agency',
      identityLabel: '市代',
      accountId: 'acc-agency-city',
      accountName: '李志远',
      phone: '19919988991',
      storeId: 'store-wutong',
      storeName: '脑商训练营梧桐街店',
      regionLabel: '河南省郑州市二七区',
      amount: 67_500_00,
      baseAmount: 100_000_00,
      rateBps: 6750,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'inspection',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '李志远',
      settlementStatus: 'SETTLED',
      pendingNote: null,
      createdAt: stamp(60 * 24 * 10),
      settledAt: stamp(60 * 24 * 9),
      version: 1,
    },
    {
      entryId: 'inc-ag-002',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'NS20261024026',
      title: '特色品：购买特色产品',
      category: '特色品',
      channel: 'SUPPLY',
      module: 'agency',
      identityLabel: '区县代理',
      accountId: 'acc-agency-county',
      accountName: '周区县',
      phone: '13600003333',
      storeId: null,
      storeName: null,
      regionLabel: '河南省郑州市高新区',
      amount: 54_00,
      baseAmount: 100_00,
      rateBps: 500,
      allocationStatus: 'PENDING',
      allocationKind: 'inspection',
      allocationTarget: null,
      allocationAgentId: null,
      beneficiaryName: '待分配',
      settlementStatus: 'PENDING_ALLOCATION',
      pendingNote: '本单存在待分配提成，收益暂不计入可提现金额',
      createdAt: stamp(60 * 6),
      settledAt: null,
      version: 1,
    },
    {
      entryId: 'inc-aw-001',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'AWARD-G-202610',
      title: '全球联创奖励：2026年10月',
      category: '全球奖励',
      channel: 'GLOBAL_AWARD',
      module: 'wholesale',
      identityLabel: '联创合伙人',
      accountId: 'acc-founder-1',
      accountName: '王好梦',
      phone: '19919988991',
      storeId: null,
      storeName: null,
      regionLabel: null,
      amount: 88_800_00,
      baseAmount: 88_800_00,
      rateBps: 0,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'sales',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '王好梦',
      settlementStatus: 'SETTLED',
      pendingNote: null,
      createdAt: stamp(60 * 24 * 2),
      settledAt: stamp(60 * 24 * 1),
      version: 1,
    },
    {
      entryId: 'inc-aw-002',
      kind: 'ORIGINAL',
      relatedEntryId: null,
      sourceOrder: 'AWARD-F-202610',
      title: '创始人专项奖励：季度达标',
      category: '创始人奖励',
      channel: 'FOUNDER_AWARD',
      module: 'wholesale',
      identityLabel: '联创合伙人',
      accountId: 'acc-founder-2',
      accountName: '孙联创',
      phone: '13500004444',
      storeId: null,
      storeName: null,
      regionLabel: '全国',
      amount: 120_000_00,
      baseAmount: 120_000_00,
      rateBps: 0,
      allocationStatus: 'ALLOCATED',
      allocationKind: 'sales',
      allocationTarget: 'self',
      allocationAgentId: null,
      beneficiaryName: '孙联创',
      settlementStatus: 'PENDING_SETTLEMENT',
      pendingNote: null,
      createdAt: stamp(60 * 8),
      settledAt: null,
      version: 1,
    },
  ]
  return base.map((e) => withActions({ ...e, mockOnly: true, allowedActions: [] }))
}

function load(): StoreShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const entries = seedEntries()
      const audit: IncomeAudit[] = []
      const idem: Record<string, IdemRecord> = {}
      save({ entries, audit, idem })
      return { entries, audit, idem }
    }
    const parsed = JSON.parse(raw) as { entries: IncomeEntry[] }
    const audit = JSON.parse(sessionStorage.getItem(AUDIT_KEY) || '[]') as IncomeAudit[]
    const idem = JSON.parse(sessionStorage.getItem(IDEM_KEY) || '{}') as Record<string, IdemRecord>
    return {
      entries: parsed.entries.map((e) => withActions(e)),
      audit,
      idem,
    }
  } catch {
    const entries = seedEntries()
    return { entries, audit: [], idem: {} }
  }
}

function save(state: StoreShape) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: state.entries }))
  sessionStorage.setItem(AUDIT_KEY, JSON.stringify(state.audit))
  sessionStorage.setItem(IDEM_KEY, JSON.stringify(state.idem))
}

export function __resetIncomeMockForTests() {
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(AUDIT_KEY)
  sessionStorage.removeItem(IDEM_KEY)
}

function find(entries: IncomeEntry[], id: string) {
  return entries.find((e) => e.entryId === id)
}

function targetLabel(kind: AllocationKind, targetId: string, agentId?: string) {
  if (targetId === 'self') return kind === 'inspection' ? '本人（巡查方）' : '本人（销售方）'
  if (targetId === 'store') return '门店'
  if (targetId === 'hq') return '总部'
  if (targetId === 'other') return agentId ? `外部ID ${agentId}` : '其他'
  return targetId
}

function pushAudit(
  state: StoreShape,
  partial: Omit<IncomeAudit, 'operationId' | 'occurredAt'> & { occurredAt?: string },
) {
  const row: IncomeAudit = {
    ...partial,
    operationId: `inc-op-${Date.now()}-${state.audit.length + 1}`,
    occurredAt: partial.occurredAt ?? nowIso(),
  }
  state.audit.unshift(row)
  return row
}

export function mockGetIncomeCatalog(): IncomeCatalog {
  const state = load()
  const storeMap = new Map<string, string>()
  for (const e of state.entries) {
    if (e.storeId && e.storeName) storeMap.set(e.storeId, e.storeName)
  }
  return {
    stores: [...storeMap.entries()].map(([storeId, name]) => ({ storeId, name })),
    modules: [
      { value: 'wholesale', label: '合伙人' },
      { value: 'costore', label: '合店' },
      { value: 'agency', label: '代理' },
    ],
    channels: [
      { value: 'B', label: 'B端' },
      { value: 'C', label: 'C端' },
      { value: 'SUPPLY', label: '供应链' },
      { value: 'GLOBAL_AWARD', label: '全球奖励' },
      { value: 'FOUNDER_AWARD', label: '创始人奖励' },
    ],
    allocationTargets: [
      { value: 'self', label: '本人', kind: 'both' },
      { value: 'store', label: '门店', kind: 'sales' },
      { value: 'hq', label: '总部', kind: 'both' },
      { value: 'other', label: '其他（填外部ID）', kind: 'both' },
    ],
    settlementStatuses: [
      { value: 'PENDING_ALLOCATION', label: '待分配' },
      { value: 'PENDING_SETTLEMENT', label: '待结算' },
      { value: 'SETTLED', label: '已结算' },
      { value: 'RECALC_PENDING', label: '重算待审' },
      { value: 'REVERSED', label: '已冲正' },
    ],
    engineGapNote: ENGINE_GAP,
    audit: state.audit.slice(0, 30),
    mockOnly: true,
  }
}

export function mockListIncome(query: IncomeQuery): IncomeList {
  const state = load()
  let items = [...state.entries]
  const kw = (query.keyword || '').trim().toLowerCase()
  if (kw) {
    items = items.filter(
      (e) =>
        e.entryId.toLowerCase().includes(kw) ||
        e.sourceOrder.toLowerCase().includes(kw) ||
        e.title.toLowerCase().includes(kw) ||
        e.accountName.toLowerCase().includes(kw) ||
        e.phone.includes(kw) ||
        (e.storeName || '').toLowerCase().includes(kw) ||
        (e.beneficiaryName || '').toLowerCase().includes(kw),
    )
  }
  if (query.module) items = items.filter((e) => e.module === query.module)
  if (query.channel) items = items.filter((e) => e.channel === query.channel)
  if (query.allocationStatus) items = items.filter((e) => e.allocationStatus === query.allocationStatus)
  if (query.settlementStatus) items = items.filter((e) => e.settlementStatus === query.settlementStatus)
  if (query.storeId) items = items.filter((e) => e.storeId === query.storeId)
  if (query.accountId) items = items.filter((e) => e.accountId === query.accountId)

  const originals = state.entries.filter((e) => e.kind === 'ORIGINAL')
  const summary = {
    entries: originals.length,
    pendingAllocation: originals.filter((e) => e.settlementStatus === 'PENDING_ALLOCATION').length,
    pendingSettlement: originals.filter((e) => e.settlementStatus === 'PENDING_SETTLEMENT').length,
    settled: originals.filter((e) => e.settlementStatus === 'SETTLED').length,
    recalcPending: originals.filter((e) => e.settlementStatus === 'RECALC_PENDING').length,
    reversed: originals.filter((e) => e.settlementStatus === 'REVERSED').length,
    settledAmount: originals
      .filter((e) => e.settlementStatus === 'SETTLED')
      .reduce((s, e) => s + e.amount, 0),
    pendingAmount: originals
      .filter((e) => e.settlementStatus === 'PENDING_ALLOCATION' || e.settlementStatus === 'PENDING_SETTLEMENT')
      .reduce((s, e) => s + e.amount, 0),
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const total = items.length
  const start = (query.page - 1) * query.pageSize
  const pageItems = items.slice(start, start + query.pageSize).map(withActions)
  return { items: pageItems, total, page: query.page, pageSize: query.pageSize, summary }
}

export function mockGetIncomeDetail(entryId: string) {
  const state = load()
  const entry = find(state.entries, entryId)
  if (!entry) throw new IncomeError('NOT_FOUND', '收益流水不存在')
  const related = state.entries
    .filter(
      (e) =>
        e.entryId !== entry.entryId &&
        (e.relatedEntryId === entry.entryId ||
          entry.relatedEntryId === e.entryId ||
          (entry.relatedEntryId && e.relatedEntryId === entry.relatedEntryId) ||
          (e.kind !== 'ORIGINAL' && e.relatedEntryId === (entry.relatedEntryId || entry.entryId))),
    )
    .map(withActions)
  // also include original when viewing linked
  if (entry.relatedEntryId) {
    const origin = find(state.entries, entry.relatedEntryId)
    if (origin && !related.some((r) => r.entryId === origin.entryId)) related.unshift(withActions(origin))
  }
  const audit = state.audit.filter((a) => a.targetId === entryId || a.relatedEntryId === entryId)
  return {
    entry: withActions(entry),
    related,
    audit,
    engineGapNote: ENGINE_GAP,
  }
}

export function mockMutateIncome(
  mutation: IncomeMutation,
  operator: { operatorId: string; operatorName: string },
): IncomeMutationResult {
  const state = load()
  const fingerprint = JSON.stringify(mutation)
  const prev = state.idem[mutation.idempotencyKey]
  if (prev) {
    if (prev.fingerprint === fingerprint) return prev.result
    throw new IncomeError('IDEMPOTENCY_CONFLICT', '幂等键已用于其他操作')
  }

  const entry = find(state.entries, mutation.entryId)
  if (!entry) throw new IncomeError('NOT_FOUND', '收益流水不存在')
  if (entry.version !== mutation.version) throw new IncomeError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
  if (entry.kind !== 'ORIGINAL') throw new IncomeError('INVALID_STATE', '仅可对原流水发起操作')
  if (!mutation.reason.trim()) throw new IncomeError('INVALID_INPUT', '请填写原因')

  let result: IncomeMutationResult

  if (mutation.action === 'reassign-allocation') {
    if (entry.allocationStatus !== 'PENDING' || entry.settlementStatus !== 'PENDING_ALLOCATION') {
      throw new IncomeError('INVALID_STATE', '仅待分配流水可改分配')
    }
    if (!mutation.targetId) throw new IncomeError('INVALID_INPUT', '请选择受益人')
    if (mutation.targetId === 'other' && !/^[A-Za-z0-9_-]{2,32}$/.test(String(mutation.agentId || ''))) {
      throw new IncomeError('INVALID_INPUT', entry.allocationKind === 'inspection' ? '请输入巡查方ID' : '请输入销售方ID')
    }
    const beforeV = entry.version
    const before = `${entry.allocationStatus}/${entry.beneficiaryName}`
    entry.allocationStatus = 'ALLOCATED'
    entry.settlementStatus = 'PENDING_SETTLEMENT'
    entry.allocationTarget = mutation.targetId
    entry.allocationAgentId = mutation.targetId === 'other' ? mutation.agentId || null : null
    entry.beneficiaryName = targetLabel(entry.allocationKind, mutation.targetId, mutation.agentId)
    entry.pendingNote = null
    entry.version += 1
    const updated = withActions(entry)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'reassign-allocation',
      targetId: entry.entryId,
      relatedEntryId: null,
      before,
      after: `${updated.allocationStatus}/${updated.beneficiaryName}/${updated.settlementStatus}`,
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'reassign-allocation', entry: updated, mockOnly: true }
  } else if (mutation.action === 'request-recalc') {
    if (entry.settlementStatus !== 'SETTLED' && entry.settlementStatus !== 'PENDING_SETTLEMENT') {
      throw new IncomeError('INVALID_STATE', '当前状态不可申请重算（已冲正/待分配/重算中不可）')
    }
    const beforeV = entry.version
    const before = entry.settlementStatus
    entry.settlementStatus = 'RECALC_PENDING'
    entry.version += 1
    const linkedId = `inc-recalc-${entry.entryId}-${Date.now()}`
    const linked: IncomeEntry = withActions({
      ...entry,
      entryId: linkedId,
      kind: 'RECALC',
      relatedEntryId: entry.entryId,
      title: `重算申请：${entry.title}`,
      amount: entry.amount,
      settlementStatus: 'RECALC_PENDING',
      allocationStatus: 'ALLOCATED',
      pendingNote: '重算请求已登记，等待结算引擎处理；原流水金额未改写',
      createdAt: nowIso(),
      settledAt: null,
      version: 1,
      allowedActions: [],
      mockOnly: true,
    })
    state.entries.unshift(linked)
    const updated = withActions(entry)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'request-recalc',
      targetId: entry.entryId,
      relatedEntryId: linkedId,
      before,
      after: `RECALC_PENDING + linked ${linkedId}`,
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'request-recalc', entry: updated, linked, mockOnly: true }
  } else {
    // request-reverse
    if (entry.settlementStatus === 'REVERSED') throw new IncomeError('INVALID_STATE', '已冲正')
    if (entry.settlementStatus === 'PENDING_ALLOCATION') {
      throw new IncomeError('INVALID_STATE', '待分配流水请先完成分配或勿冲正')
    }
    const beforeV = entry.version
    const before = `${entry.settlementStatus}/${entry.amount}`
    entry.settlementStatus = 'REVERSED'
    entry.version += 1
    const linkedId = `inc-rev-${entry.entryId}-${Date.now()}`
    const linked: IncomeEntry = withActions({
      ...entry,
      entryId: linkedId,
      kind: 'REVERSAL',
      relatedEntryId: entry.entryId,
      title: `冲正：${entry.title}`,
      amount: -Math.abs(entry.amount),
      settlementStatus: 'REVERSED',
      allocationStatus: 'ALLOCATED',
      pendingNote: '冲正流水已关联原单；原单金额保留只读，结算引擎缺口下不回写可提现',
      createdAt: nowIso(),
      settledAt: null,
      version: 1,
      allowedActions: [],
      mockOnly: true,
    })
    state.entries.unshift(linked)
    const updated = withActions(entry)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'request-reverse',
      targetId: entry.entryId,
      relatedEntryId: linkedId,
      before,
      after: `REVERSED + linked ${linkedId} amount=${linked.amount}`,
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'request-reverse', entry: updated, linked, mockOnly: true }
  }

  state.idem[mutation.idempotencyKey] = { fingerprint, result }
  // refresh entries in place
  state.entries = state.entries.map((e) => withActions(e))
  save(state)
  return result
}

export type { IncomeChannel, IncomeModule, SettlementStatus }
