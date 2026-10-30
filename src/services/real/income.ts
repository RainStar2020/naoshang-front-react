import * as api from '../../api'
import {
  IncomeError,
  type AllocationKind,
  type AllocationStatus,
  type IncomeAudit,
  type IncomeCatalog,
  type IncomeChannel,
  type IncomeDetail,
  type IncomeEntry,
  type IncomeEntryKind,
  type IncomeList,
  type IncomeModule,
  type IncomeMutation,
  type IncomeQuery,
  type SettlementStatus,
} from '../../types/income'
import {
  arr,
  asPage,
  cast,
  mapHqError,
  moneyToFen,
  mutationBody,
  nullableStr,
  num,
  record,
  str,
  unwrapData,
} from './bridge'

const ENGINE_GAP =
  '结算引擎尚无正式 API：改分配/重算/冲正仅落地请求与关联流水；不改可提现余额；前端不推导结算结果、不重算提点公式；不在此出金。'

const MODULES: { value: IncomeModule; label: string }[] = [
  { value: 'wholesale', label: '合伙人' },
  { value: 'costore', label: '合店' },
  { value: 'agency', label: '代理' },
]
const CHANNELS: { value: IncomeChannel; label: string }[] = [
  { value: 'B', label: 'B端' },
  { value: 'C', label: 'C端' },
  { value: 'SUPPLY', label: '供应链' },
  { value: 'GLOBAL_AWARD', label: '全球奖励' },
  { value: 'FOUNDER_AWARD', label: '创始人奖励' },
]
const ALLOCATION_TARGETS: { value: string; label: string; kind: AllocationKind | 'both' }[] = [
  { value: 'self', label: '本人', kind: 'both' },
  { value: 'store', label: '门店', kind: 'sales' },
  { value: 'hq', label: '总部', kind: 'both' },
  { value: 'other', label: '其他（填外部ID）', kind: 'both' },
]
const SETTLEMENT_STATUSES: { value: SettlementStatus; label: string }[] = [
  { value: 'PENDING_ALLOCATION', label: '待分配' },
  { value: 'PENDING_SETTLEMENT', label: '待结算' },
  { value: 'SETTLED', label: '已结算' },
  { value: 'RECALC_PENDING', label: '重算待审' },
  { value: 'REVERSED', label: '已冲正' },
]

const MODULE_SET = new Set<string>(MODULES.map((m) => m.value))
const CHANNEL_SET = new Set<string>(CHANNELS.map((c) => c.value))
const SETTLEMENT_SET = new Set<string>(SETTLEMENT_STATUSES.map((s) => s.value))
const KIND_SET = new Set<string>(['ORIGINAL', 'RECALC', 'REVERSAL'])
const ALLOC_STATUS_SET = new Set<string>(['PENDING', 'ALLOCATED'])
const ALLOC_KIND_SET = new Set<string>(['sales', 'inspection'])
const ACTION_SET = new Set(['reassign-allocation', 'request-recalc', 'request-reverse'])

function asModule(value: unknown): IncomeModule {
  const raw = str(value, 'wholesale').toLowerCase()
  return MODULE_SET.has(raw) ? (raw as IncomeModule) : 'wholesale'
}

function asChannel(value: unknown): IncomeChannel {
  const raw = str(value, 'B').toUpperCase()
  return CHANNEL_SET.has(raw) ? (raw as IncomeChannel) : 'B'
}

function asSettlement(value: unknown): SettlementStatus {
  const raw = str(value, 'PENDING_ALLOCATION').toUpperCase().replace(/-/g, '_')
  return SETTLEMENT_SET.has(raw) ? (raw as SettlementStatus) : 'PENDING_ALLOCATION'
}

function asKind(value: unknown): IncomeEntryKind {
  const raw = str(value, 'ORIGINAL').toUpperCase()
  return KIND_SET.has(raw) ? (raw as IncomeEntryKind) : 'ORIGINAL'
}

function asAllocStatus(value: unknown): AllocationStatus {
  const raw = str(value, 'PENDING').toUpperCase()
  return ALLOC_STATUS_SET.has(raw) ? (raw as AllocationStatus) : 'PENDING'
}

function asAllocKind(value: unknown): AllocationKind {
  const raw = str(value, 'sales').toLowerCase()
  return ALLOC_KIND_SET.has(raw) ? (raw as AllocationKind) : 'sales'
}

function actionsFor(e: Pick<IncomeEntry, 'kind' | 'settlementStatus' | 'allocationStatus'>): IncomeEntry['allowedActions'] {
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

function mapOptionList<T extends string>(
  raw: unknown,
  fallback: { value: T; label: string }[],
  normalize: (v: unknown) => T,
): { value: T; label: string }[] {
  const items = arr(raw)
    .map((item) => {
      const r = record(item)
      const value = normalize(r.value ?? r.id ?? r.code ?? item)
      const label = str(r.label ?? r.name ?? r.title ?? value, value)
      return { value, label }
    })
    .filter((item) => item.value)
  return items.length ? items : fallback
}

function mapAudit(raw: unknown): IncomeAudit {
  const r = record(raw)
  const actionRaw = str(r.action || r.type || r.op).toLowerCase().replace(/_/g, '-')
  const action = (ACTION_SET.has(actionRaw) ? actionRaw : 'request-recalc') as IncomeAudit['action']
  return {
    operationId: str(r.operationId || r.id || r.auditId || `inc-op-${str(r.occurredAt || Date.now())}`),
    requestId: str(r.requestId || r.idempotencyKey || r.request_id || ''),
    action,
    targetId: str(r.targetId || r.entryId || r.target || ''),
    relatedEntryId: nullableStr(r.relatedEntryId || r.relatedId),
    before: str(r.before || r.beforeStatus || '-'),
    after: str(r.after || r.afterStatus || '-'),
    reason: str(r.reason || r.note || ''),
    operatorId: str(r.operatorId || r.operator || ''),
    operatorName: str(r.operatorName || r.operatorLabel || r.operator || '系统'),
    occurredAt: str(r.occurredAt || r.createdAt || r.time || ''),
    beforeVersion: num(r.beforeVersion ?? r.fromVersion, 0),
    afterVersion: num(r.afterVersion ?? r.toVersion ?? r.version, 0),
  }
}

type Looseish = Record<string, unknown>

function mapMoney(raw: Looseish, key: string, altKeys: string[] = []): number {
  for (const k of [key, ...altKeys]) {
    if (k in raw && raw[k] != null && raw[k] !== '') return moneyToFen(raw[k])
  }
  return 0
}

function mapEntry(raw: unknown): IncomeEntry {
  const r = record(raw)
  const settlementStatus = asSettlement(r.settlementStatus || r.settleStatus || r.status)
  const allocationStatus = asAllocStatus(r.allocationStatus || r.allocStatus)
  const kind = asKind(r.kind || r.entryKind || r.type)
  const fromApi = arr(r.allowedActions || r.actions)
    .map((item) => str(item).toLowerCase().replace(/_/g, '-'))
    .filter((item): item is IncomeEntry['allowedActions'][number] => ACTION_SET.has(item))
  const entryBase = {
    entryId: str(r.entryId || r.id || r.ledgerId || r.revenueId),
    kind,
    relatedEntryId: nullableStr(r.relatedEntryId || r.relatedId || r.parentEntryId),
    sourceOrder: str(r.sourceOrder || r.orderId || r.orderNo || r.sourceId),
    title: str(r.title || r.name || r.remark || '收益流水'),
    category: str(r.category || r.bizCategory || r.typeLabel || ''),
    channel: asChannel(r.channel || r.channelCode),
    module: asModule(r.module || r.bizModule || r.line),
    identityLabel: str(r.identityLabel || r.identity || r.roleLabel || ''),
    accountId: str(r.accountId || r.ownerAccountId || r.userId || r.partnerId),
    accountName: str(r.accountName || r.ownerName || r.userName || r.partnerName || ''),
    phone: str(r.phone || r.mobile || ''),
    storeId: nullableStr(r.storeId || r.shopId),
    storeName: nullableStr(r.storeName || r.shopName),
    regionLabel: nullableStr(r.regionLabel || r.regionName || r.region),
    amount: mapMoney(r, 'amount', ['payableAmount', 'incomeAmount', 'value']),
    baseAmount: mapMoney(r, 'baseAmount', ['orderAmount', 'base']),
    rateBps: num(r.rateBps ?? r.rate ?? r.bps, 0),
    allocationStatus,
    allocationKind: asAllocKind(r.allocationKind || r.allocKind || r.kindOfAllocation),
    allocationTarget: nullableStr(r.allocationTarget || r.target || r.targetId),
    allocationAgentId: nullableStr(r.allocationAgentId || r.agentId),
    beneficiaryName: str(r.beneficiaryName || r.beneficiary || r.accountName || ''),
    settlementStatus,
    pendingNote: nullableStr(r.pendingNote || r.note || r.remark),
    createdAt: str(r.createdAt || r.createTime || r.occurredAt || ''),
    settledAt: nullableStr(r.settledAt || r.settleTime),
    version: num(r.version, 1),
    mockOnly: false,
  }
  return cast({
    ...entryBase,
    allowedActions: fromApi.length ? fromApi : actionsFor(entryBase),
  })
}

function mapOptionTargets(raw: unknown) {
  const items = arr(raw)
    .map((item) => {
      const r = record(item)
      const value = str(r.value || r.id || r.code || item)
      const kindRaw = str(r.kind || r.allocationKind || 'both').toLowerCase()
      const kind = (kindRaw === 'sales' || kindRaw === 'inspection' || kindRaw === 'both'
        ? kindRaw
        : 'both') as AllocationKind | 'both'
      return { value, label: str(r.label || r.name || value, value), kind }
    })
    .filter((item) => item.value)
  return items.length ? items : ALLOCATION_TARGETS
}

function mapStores(raw: unknown): IncomeCatalog['stores'] {
  return arr(raw)
    .map((item) => {
      const r = record(item)
      return {
        storeId: str(r.storeId || r.id || r.shopId),
        name: str(r.name || r.storeName || r.title || r.storeId || r.id),
      }
    })
    .filter((item) => item.storeId)
}

function emptySummary(): IncomeList['summary'] {
  return {
    entries: 0,
    pendingAllocation: 0,
    pendingSettlement: 0,
    settled: 0,
    recalcPending: 0,
    reversed: 0,
    settledAmount: 0,
    pendingAmount: 0,
  }
}

export function mapIncomeCatalog(raw: unknown): IncomeCatalog {
  const r = record(raw)
  return {
    stores: mapStores(r.stores || r.storeList || r.storeOptions),
    modules: mapOptionList(r.modules || r.moduleOptions || r.bizModules, MODULES, asModule),
    channels: mapOptionList(r.channels || r.channelOptions, CHANNELS, asChannel),
    allocationTargets: mapOptionTargets(r.allocationTargets || r.targets || r.allocationOptions),
    settlementStatuses: mapOptionList(
      r.settlementStatuses || r.settleStatuses || r.statusOptions,
      SETTLEMENT_STATUSES,
      asSettlement,
    ),
    engineGapNote: str(r.engineGapNote || r.gapNote || r.notice || ENGINE_GAP, ENGINE_GAP),
    audit: arr(r.audit || r.audits || r.operations || r.recentOperations || r.logs).map(mapAudit),
    mockOnly: false,
  }
}

export function mapIncomeDetail(raw: unknown): IncomeDetail {
  const r = record(raw)
  const entryRaw = r.entry ?? r.ledger ?? r.item ?? raw
  const relatedSrc = arr(r.related || r.relatedEntries || r.linked || r.children)
  return {
    entry: mapEntry(entryRaw),
    related: relatedSrc.map(mapEntry),
    audit: arr(r.audit || r.audits || r.operations || r.logs || r.history).map(mapAudit),
    engineGapNote: str(r.engineGapNote || r.gapNote || r.notice || ENGINE_GAP, ENGINE_GAP),
  }
}

export async function realGetIncomeCatalog() {
  try {
    return cast(mapIncomeCatalog(await unwrapData(await api.getRevenueCatalog())))
  } catch (error) {
    return mapHqError(error, IncomeError)
  }
}

export async function realListIncome(query: IncomeQuery) {
  try {
    const page = asPage(
      await unwrapData(await api.getRevenueLedgers({ ...query } as never)),
      query.page,
      query.pageSize,
    )
    const summaryRaw = record(page.summary)
    const summary = {
      ...emptySummary(),
      ...summaryRaw,
      settledAmount: moneyToFen(summaryRaw.settledAmount ?? summaryRaw.settled),
      pendingAmount: moneyToFen(summaryRaw.pendingAmount ?? summaryRaw.pending),
      entries: num(summaryRaw.entries ?? page.total, page.total),
      pendingAllocation: num(summaryRaw.pendingAllocation),
      pendingSettlement: num(summaryRaw.pendingSettlement),
      settled: num(summaryRaw.settled),
      recalcPending: num(summaryRaw.recalcPending),
      reversed: num(summaryRaw.reversed),
    }
    return cast({
      items: arr(page.items).map(mapEntry),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary,
    })
  } catch (error) {
    return mapHqError(error, IncomeError)
  }
}

export async function realGetIncomeDetail(entryId: string) {
  try {
    try {
      const data = await unwrapData(await api.getRevenueAccountsByAccountId({ accountId: entryId }))
      return cast(mapIncomeDetail(data))
    } catch {
      const page = asPage(
        await unwrapData(await api.getRevenueLedgers({ keyword: entryId, page: 1, pageSize: 20 } as never)),
      )
      const hit =
        arr(page.items).find((i) => str(record(i).entryId || record(i).id) === entryId) || arr(page.items)[0]
      if (!hit) throw new IncomeError('NOT_FOUND', '收益记录不存在')
      return cast(mapIncomeDetail({ entry: hit, related: [], audit: [] }))
    }
  } catch (error) {
    return mapHqError(error, IncomeError)
  }
}

export async function realMutateIncome(input: IncomeMutation) {
  try {
    const actionMap: Record<string, string> = {
      'reassign-allocation': 'adjust',
      'request-recalc': 'settle',
      'request-reverse': 'adjust',
    }
    const action = actionMap[input.action] || 'adjust'
    const body = mutationBody({
      ...record(input as never),
      action,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: (input as { version?: number }).version,
    })
    await unwrapData(await api.postRevenueMutate(body as never))
    const entryId = str((input as { entryId?: string }).entryId)
    return entryId ? realGetIncomeDetail(entryId) : realGetIncomeCatalog()
  } catch (error) {
    return mapHqError(error, IncomeError)
  }
}