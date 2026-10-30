import * as api from '../../api'
import {
  CouponError,
  type CouponAudit,
  type CouponCatalog,
  type CouponMutation,
  type CouponQuery,
  type CouponScope,
  type CouponStatus,
  type CouponTemplate,
  type UserCoupon,
} from '../../types/coupons'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, nullableStr, record, str, stringList, unwrapData } from './bridge'

const STATUSES = new Set<CouponStatus>(['available', 'not-started', 'reserved', 'used', 'expired'])
const AUDIT_ACTIONS = new Set(['save-template', 'issue', 'reserve', 'use', 'release'])

function productIdList(value: unknown): string[] {
  return arr(value).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return str(item)
    const row = record(item)
    return str(row.productId || row.id || row.skuId)
  }).filter(Boolean)
}

/** Normalize scope so productIds is always an array pages can map over. */
export function mapCouponScope(raw: unknown): CouponScope {
  const r = record(raw)
  const kindRaw = str(r.kind || r.type || r.scopeKind, '').toLowerCase()
  const productIds = productIdList(r.productIds ?? r.productIdList ?? r.products ?? r.skuIds)
  const isProducts = kindRaw === 'products' || kindRaw === 'product' || kindRaw === 'specified'
    || (kindRaw !== 'all' && productIds.length > 0)
  if (isProducts) return { kind: 'products', productIds }
  return { kind: 'all', productIds: [] }
}

function asStatus(value: unknown): CouponStatus {
  const raw = str(value, 'available').toLowerCase().replace(/_/g, '-')
  return STATUSES.has(raw as CouponStatus) ? (raw as CouponStatus) : 'available'
}

function asAuditAction(value: unknown): CouponAudit['action'] {
  const raw = str(value, 'issue').toLowerCase().replace(/_/g, '-')
  return (AUDIT_ACTIONS.has(raw) ? raw : 'issue') as CouponAudit['action']
}

export function mapCouponTemplate(raw: unknown): CouponTemplate {
  const r = record(raw)
  const scopeSource = r.scope != null && typeof r.scope === 'object' ? r.scope : {
    kind: r.scopeKind || r.kind || (r.productIds || r.products ? 'products' : 'all'),
    productIds: r.productIds ?? r.products ?? r.productIdList,
  }
  return {
    templateId: str(r.templateId || r.id),
    title: str(r.title || r.name || r.templateName),
    amount: num(r.amount ?? r.faceAmount ?? r.discountAmount, 0),
    minAmount: num(r.minAmount ?? r.thresholdAmount ?? r.minSpend, 0),
    scope: mapCouponScope(scopeSource),
    validFrom: str(r.validFrom || r.startAt || r.beginAt),
    expiresAt: str(r.expiresAt || r.endAt || r.expireAt),
    enabled: r.enabled !== false && str(r.status).toUpperCase() !== 'DISABLED' && str(r.status).toUpperCase() !== 'OFF',
    totalQuantity: Math.max(0, num(r.totalQuantity ?? r.total ?? r.quota, 0)),
    perAccountLimit: Math.max(1, num(r.perAccountLimit ?? r.limitPerAccount ?? r.accountLimit, 1)),
    version: Math.max(1, num(r.version, 1)),
    issuedQuantity: Math.max(0, num(r.issuedQuantity ?? r.issued ?? r.usedQuantity, 0)),
  }
}

export function mapUserCoupon(raw: unknown): UserCoupon {
  const r = record(raw)
  const snapshotRaw = record(r.snapshot || r.templateSnapshot || r.couponSnapshot || {})
  const scopeSource = snapshotRaw.scope != null
    ? snapshotRaw.scope
    : (r.scope != null ? r.scope : {
      kind: snapshotRaw.scopeKind || r.scopeKind || (snapshotRaw.productIds || r.productIds ? 'products' : 'all'),
      productIds: snapshotRaw.productIds ?? r.productIds ?? snapshotRaw.products ?? r.products,
    })
  const title = str(snapshotRaw.title || r.title || r.name)
  const amount = num(snapshotRaw.amount ?? r.amount ?? r.faceAmount, 0)
  const minAmount = num(snapshotRaw.minAmount ?? r.minAmount ?? r.thresholdAmount, 0)
  return {
    couponId: str(r.couponId || r.id),
    templateId: str(r.templateId || snapshotRaw.templateId),
    templateVersion: Math.max(1, num(r.templateVersion ?? snapshotRaw.templateVersion ?? r.version, 1)),
    accountId: str(r.accountId || r.userId || r.ownerId),
    snapshot: {
      title,
      amount,
      minAmount,
      scope: mapCouponScope(scopeSource),
      validFrom: str(snapshotRaw.validFrom || r.validFrom || r.startAt),
      expiresAt: str(snapshotRaw.expiresAt || r.expiresAt || r.endAt),
    },
    status: asStatus(r.status || r.couponStatus),
    version: Math.max(1, num(r.version, 1)),
    issuedAt: str(r.issuedAt || r.createdAt),
    reservedOrderId: nullableStr(r.reservedOrderId ?? r.orderIdReserved),
    usedOrderId: nullableStr(r.usedOrderId ?? r.redeemedOrderId),
    reservedAt: nullableStr(r.reservedAt),
    usedAt: nullableStr(r.usedAt || r.redeemedAt),
  }
}

function couponIdsOf(r: Record<string, unknown>): string[] {
  const fromList = arr(r.couponIds ?? r.codes).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return str(item)
    return str(record(item).couponId || record(item).id)
  }).filter(Boolean)
  if (fromList.length) return fromList
  const single = str(r.couponId)
  return single ? [single] : []
}

export function mapCouponAudit(raw: unknown): CouponAudit {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id || r.requestId || ('op-' + String(Date.now()))),
    requestId: str(r.requestId || r.idempotencyKey),
    action: asAuditAction(r.action || r.type),
    templateId: nullableStr(r.templateId),
    couponIds: couponIdsOf(r),
    operatorName: str(r.operatorName || r.operator || r.operatorNickname || r.createdBy),
    reason: str(r.reason),
    detail: str(r.detail || r.message || r.result),
    occurredAt: str(r.occurredAt || r.createdAt || r.operatedAt),
  }
}

function mapAccountOption(raw: unknown) {
  const r = record(raw)
  const accountId = str(r.accountId || r.id || r.userId)
  if (!accountId) return null
  return {
    accountId,
    nickname: str(r.nickname || r.name || r.displayName || accountId),
    phone: str(r.phone || r.mobile || r.loginAccount),
    frozen: bool(r.frozen ?? r.isFrozen, str(r.status).toUpperCase() === 'FROZEN'),
  }
}

function mapProductOption(raw: unknown) {
  const r = record(raw)
  const productId = str(r.productId || r.id)
  if (!productId) return null
  return {
    productId,
    title: str(r.title || r.name || productId),
  }
}

/** Normalize catalog so templates/audit/accounts/products are always arrays. */
export function mapCouponCatalog(raw: unknown): CouponCatalog {
  const r = record(raw)
  const templates = arr(r.templates || r.templateList || r.items).map(mapCouponTemplate)
  const audit = arr(r.audit || r.operations || r.logs || r.recentOperations).map(mapCouponAudit)
  const accounts = arr(r.accounts || r.accountOptions || r.users || r.parents)
    .map(mapAccountOption)
    .filter((item): item is NonNullable<typeof item> => !!item)
  const products = arr(r.products || r.productOptions || r.skus)
    .map(mapProductOption)
    .filter((item): item is NonNullable<typeof item> => !!item)
  const limitsRaw = record(r.limits || {})
  return {
    templates,
    audit,
    accounts,
    products,
    limits: {
      maxBatchSize: Math.max(1, num(limitsRaw.maxBatchSize ?? r.maxBatchSize ?? r.batchLimit, 50)),
      maxAmount: Math.max(1, num(limitsRaw.maxAmount ?? r.maxAmount, 100000000)),
    },
  }
}

export function mapCouponDetail(raw: unknown): { coupon: UserCoupon; audit: CouponAudit[] } {
  const r = record(raw)
  const couponSource = r.coupon != null ? r.coupon : raw
  return {
    coupon: mapUserCoupon(couponSource),
    audit: arr(r.audit || r.operations || r.logs).map(mapCouponAudit),
  }
}

export async function realCouponCatalog() {
  try {
    const mapped = mapCouponCatalog(await unwrapData(await api.getCouponsCatalog()))
    if (!mapped.templates.length) {
      try {
        const page = asPage(await unwrapData(await api.getCouponsTemplates({ page: 1, pageSize: 100 } as never)), 1, 100)
        mapped.templates = page.items.map(mapCouponTemplate)
      } catch {
        // keep empty templates when templates endpoint is unavailable
      }
    }
    return cast(mapped)
  } catch (error) { return mapHqError(error, CouponError) }
}

export async function realCouponList(query: CouponQuery) {
  try {
    const page = asPage(await unwrapData(await api.getCoupons({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapUserCoupon),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, CouponError) }
}

export async function realCouponDetail(id: string) {
  try {
    const page = asPage(await unwrapData(await api.getCoupons({ keyword: id, page: 1, pageSize: 20 } as never)))
    const hit = page.items.find((i) => {
      const row = record(i)
      const coupon = record(row.coupon)
      return str(row.couponId || coupon.couponId || row.id) === id
        || str(row.templateId || coupon.templateId) === id
    }) || page.items[0]
    if (!hit) throw new CouponError('NOT_FOUND', '优惠券不存在')
    return cast(mapCouponDetail(hit))
  } catch (error) { return mapHqError(error, CouponError) }
}

export async function realCouponMutate(input: CouponMutation) {
  try {
    const raw = record(input as never)
    const value = record(raw.value)
    let finalAction: string
    if (input.action === 'issue') finalAction = 'issue'
    else finalAction = (raw.templateId || value.templateId) ? 'update-template' : 'create-template'
    const body = mutationBody({
      ...raw,
      action: finalAction,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: (input as { version?: number }).version,
    })
    const response = await unwrapData(await api.postCouponsMutate(body as never))
    const result = record(response)
    return cast({
      templateId: str(result.templateId || raw.templateId || value.templateId),
      couponIds: couponIdsOf(result).length ? couponIdsOf(result) : couponIdsOf(raw),
      operationId: str(result.operationId || result.id || input.idempotencyKey),
    })
  } catch (error) { return mapHqError(error, CouponError) }
}
