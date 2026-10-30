import * as api from '../../api'
import { QuotaError, type QuotaBalance, type QuotaDetail, type QuotaEligibility, type QuotaList, type QuotaOwner, type QuotaQuery, type QuotaRechargeInput, type QuotaType } from '../../types/quotas'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unwrapData } from './bridge'

function quotaTypeOf(raw: unknown): QuotaType {
  const value = str(raw, 'STANDARD').toUpperCase()
  return value === 'ACTIVITY' ? 'ACTIVITY' : 'STANDARD'
}

function mapBalance(raw: unknown): QuotaBalance {
  const r = record(raw)
  return {
    quotaType: quotaTypeOf(r.quotaType || r.type),
    total: num(r.total),
    remaining: num(r.remaining ?? r.available),
    reserved: num(r.reserved),
    used: num(r.used),
    transferred: num(r.transferred),
  }
}

function mapEligibility(raw: unknown): QuotaEligibility {
  const r = record(raw)
  const allowed = stringList(r.allowedTypes).map(quotaTypeOf)
  return {
    qualified: bool(r.qualified),
    canRecharge: bool(r.canRecharge ?? r.allowed),
    reason: str(r.reason || r.message),
    allowedTypes: allowed.length ? allowed : [],
    perOperationLimit: num(r.perOperationLimit ?? r.limit, 0),
    remainingLimit: num(r.remainingLimit ?? r.remainLimit, 0),
    limitLabel: str(r.limitLabel),
  }
}

export function mapQuotaOwner(raw: unknown): QuotaOwner {
  const r = record(raw)
  const owner = record(r.owner)
  const balancesSrc = arr(r.balances ?? owner.balances)
  const balances = balancesSrc.length ? balancesSrc.map(mapBalance) : [
    mapBalance({ quotaType: 'STANDARD' }),
    mapBalance({ quotaType: 'ACTIVITY' }),
  ]
  const eligibility = mapEligibility(r.eligibility ?? owner.eligibility ?? {})
  const partnerLevel = str(r.partnerLevel || owner.partnerLevel || r.level, 'VIP') as QuotaOwner['partnerLevel']
  const partnerStatus = str(r.partnerStatus || owner.partnerStatus || r.status, 'ACTIVE') as QuotaOwner['partnerStatus']
  return {
    ownerAccountId: str(r.ownerAccountId || owner.ownerAccountId || r.accountId || r.id),
    contextId: str(r.contextId || owner.contextId),
    name: str(r.name || owner.name || r.nickname, '未命名'),
    phone: str(r.phone || owner.phone || r.mobile),
    displayId: str(r.displayId || owner.displayId || r.userNo),
    partnerLevel,
    partnerStatus,
    version: num(r.version ?? owner.version, 1),
    balances,
    eligibility,
  }
}

function mapListSummary(raw: unknown, items: QuotaOwner[]) {
  const r = record(raw)
  const standardRemaining = items.reduce((sum, item) => sum + (item.balances.find((b) => b.quotaType === 'STANDARD')?.remaining ?? 0), 0)
  const activityRemaining = items.reduce((sum, item) => sum + (item.balances.find((b) => b.quotaType === 'ACTIVITY')?.remaining ?? 0), 0)
  const reserved = items.reduce((sum, item) => sum + item.balances.reduce((s, b) => s + b.reserved, 0), 0)
  return {
    owners: num(r.owners, items.length),
    rechargeable: num(r.rechargeable, items.filter((i) => i.eligibility.canRecharge).length),
    standardRemaining: num(r.standardRemaining, standardRemaining),
    activityRemaining: num(r.activityRemaining, activityRemaining),
    reserved: num(r.reserved, reserved),
  }
}

function mapBalancePair(raw: unknown): QuotaBalance {
  return mapBalance(raw)
}

export function mapQuotaDetail(raw: unknown): QuotaDetail {
  const r = record(raw)
  const owner = mapQuotaOwner(r.owner ?? r)
  return {
    owner,
    batches: arr(r.batches).map((item) => {
      const row = record(item)
      return {
        ...mapBalance(row),
        batchId: str(row.batchId || row.id),
        ownerAccountId: str(row.ownerAccountId || owner.ownerAccountId),
        source: str(row.source, 'HQ_RECHARGE') as never,
        sourceOrderId: nullableStr(row.sourceOrderId),
        operationId: str(row.operationId),
        title: str(row.title || row.name),
        createdAt: str(row.createdAt),
        expiresAt: null,
        transferable: bool(row.transferable),
        refundable: false as const,
      }
    }),
    ledger: arr(r.ledger).map((item) => {
      const row = record(item)
      return {
        ledgerId: str(row.ledgerId || row.id),
        operationId: str(row.operationId),
        requestId: str(row.requestId),
        ownerAccountId: str(row.ownerAccountId || owner.ownerAccountId),
        targetAccountId: nullableStr(row.targetAccountId),
        batchId: str(row.batchId),
        quotaType: quotaTypeOf(row.quotaType),
        kind: str(row.kind, 'HQ_RECHARGE') as never,
        quantity: num(row.quantity),
        sourceOrderId: nullableStr(row.sourceOrderId),
        reason: str(row.reason),
        operatorName: str(row.operatorName),
        createdAt: str(row.createdAt),
        before: mapBalancePair(row.before),
        after: mapBalancePair(row.after),
      }
    }),
    orders: arr(r.orders).map((item) => {
      const row = record(item)
      return {
        orderId: str(row.orderId || row.id),
        ownerAccountId: str(row.ownerAccountId || owner.ownerAccountId),
        targetAccountId: nullableStr(row.targetAccountId),
        kind: str(row.kind, 'PURCHASE') as never,
        quotaType: quotaTypeOf(row.quotaType),
        quantity: num(row.quantity),
        batchId: nullableStr(row.batchId),
        status: str(row.status, 'PAID') as never,
        unitAmount: num(row.unitAmount),
        payableAmount: num(row.payableAmount),
        paymentReceiptId: nullableStr(row.paymentReceiptId),
        createdAt: str(row.createdAt),
        updatedAt: str(row.updatedAt || row.createdAt),
        note: str(row.note),
      }
    }),
    recharges: arr(r.recharges).map((item) => {
      const row = record(item)
      return {
        operationId: str(row.operationId || row.id),
        requestId: str(row.requestId),
        ownerAccountId: str(row.ownerAccountId || owner.ownerAccountId),
        targetAccountId: str(row.targetAccountId || owner.ownerAccountId),
        batchId: str(row.batchId),
        quotaType: quotaTypeOf(row.quotaType),
        quantity: num(row.quantity),
        reason: str(row.reason),
        operatorName: str(row.operatorName),
        createdAt: str(row.createdAt),
        before: mapBalancePair(row.before),
        after: mapBalancePair(row.after),
        beforeVersion: num(row.beforeVersion),
        afterVersion: num(row.afterVersion ?? row.version),
      }
    }),
    activityServiceFeePerQuota: 200000,
  }
}

export async function realQuotaList(query: QuotaQuery): Promise<QuotaList> {
  try {
    const page = asPage(await unwrapData(await api.getQuotas({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapQuotaOwner)
    return { items, total: page.total, summary: mapListSummary(page.summary, items) }
  } catch (error) { return mapHqError(error, QuotaError) }
}

export async function realQuotaDetail(ownerAccountId: string): Promise<QuotaDetail> {
  try {
    try {
      return mapQuotaDetail(await unwrapData(await api.getQuotasByQuotaId({ quotaId: ownerAccountId })))
    } catch {
      const page = asPage(await unwrapData(await api.getQuotas({ keyword: ownerAccountId, page: 1, pageSize: 20 } as never)))
      const hit = page.items.find((i) => {
        const r = record(i)
        return str(r.ownerAccountId) === ownerAccountId || str(r.quotaId || r.id) === ownerAccountId
      }) || page.items[0]
      if (!hit) throw new QuotaError('NOT_FOUND', '名额账户不存在')
      return mapQuotaDetail(hit)
    }
  } catch (error) { return mapHqError(error, QuotaError) }
}

export async function realQuotaRecharge(input: QuotaRechargeInput) {
  try {
    const quotaId = str((input as { quotaId?: string }).quotaId || input.targetAccountId)
    const beforeDetail = await realQuotaDetail(input.targetAccountId).catch(() => null)
    const beforeBal = beforeDetail?.owner.balances.find((b) => b.quotaType === input.quotaType) || {
      quotaType: input.quotaType,
      total: 0,
      remaining: 0,
      reserved: 0,
      used: 0,
      transferred: 0,
    }
    const body = mutationBody({ ...record(input as never), action: 'adjust', reason: input.reason, idempotencyKey: input.idempotencyKey, version: input.version })
    await unwrapData(await api.postQuotasByQuotaIdMutate({ quotaId }, body as never))
    const afterDetail = await realQuotaDetail(input.targetAccountId)
    const afterBal = afterDetail.owner.balances.find((b) => b.quotaType === input.quotaType) || beforeBal
    return {
      operationId: '',
      requestId: input.idempotencyKey,
      ownerAccountId: input.targetAccountId,
      targetAccountId: input.targetAccountId,
      batchId: afterDetail.batches[0]?.batchId || '',
      quotaType: input.quotaType,
      quantity: input.quantity,
      reason: input.reason,
      operatorName: '',
      createdAt: new Date().toISOString(),
      before: beforeBal,
      after: afterBal,
      beforeVersion: input.version,
      afterVersion: afterDetail.owner.version,
    }
  } catch (error) { return mapHqError(error, QuotaError) }
}
