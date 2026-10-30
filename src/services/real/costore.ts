import * as api from '../../api'
import {
  CostoreError,
  type CostoreApplication,
  type CostoreApplicationStatus,
  type CostoreAudit,
  type CostoreCatalog,
  type CostoreDetail,
  type CostoreList,
  type CostoreMutation,
  type CostorePaymentStatus,
  type CostorePlan,
  type CostoreQuery,
  type CostoreRefund,
  type CostoreRefundStatus,
} from '../../types/costore'
import type { RichContent } from '../../types/cms'
import { arr, asPage, bool, cast, mapHqError, moneyToFen, mutationBody, nullableStr, num, record, str, unwrapData } from './bridge'

const APP_STATUSES = new Set<CostoreApplicationStatus>(['PENDING_PAYMENT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'])
const PAY_STATUSES = new Set<CostorePaymentStatus>(['NOT_STARTED', 'PENDING', 'PAID', 'CANCELLED'])
const REFUND_STATUSES = new Set(['PENDING', 'SUCCEEDED', 'FAILED'])
const CONTRACT_STATUSES = new Set(['NOT_SIGNED', 'PENDING_CONFIRMATION', 'SIGNED'])
const ENTITLEMENT_STATUSES = new Set(['NOT_OPEN', 'PENDING_CONFIRMATION', 'OPEN'])
const AUDIT_ACTIONS = new Set(['save-plan', 'retry-refund'])

function emptyContent(): RichContent {
  return { version: 1, format: 'nodes', nodes: [] }
}

function mapRichContent(raw: unknown): RichContent {
  if (raw == null || raw === '') return emptyContent()
  if (typeof raw === 'string') {
    return { version: 1, format: 'nodes', nodes: [{ name: 'p', attrs: {}, children: [{ type: 'text', text: raw }] }] }
  }
  if (Array.isArray(raw)) {
    return { version: 1, format: 'nodes', nodes: raw as RichContent['nodes'] }
  }
  const r = record(raw)
  if (r.format === 'nodes' && Array.isArray(r.nodes)) {
    return { version: 1, format: 'nodes', nodes: r.nodes as RichContent['nodes'] }
  }
  const text = str(r.html || r.markdown || r.text || r.content || r.body)
  if (!text) return emptyContent()
  return {
    version: 1,
    format: 'nodes',
    nodes: [{ name: 'p', attrs: {}, children: [{ type: 'text', text }] }],
  }
}

function asAppStatus(value: unknown): CostoreApplicationStatus {
  const raw = str(value, 'PENDING_PAYMENT').toUpperCase().replace(/-/g, '_')
  return APP_STATUSES.has(raw as CostoreApplicationStatus) ? (raw as CostoreApplicationStatus) : 'PENDING_PAYMENT'
}

function asPayStatus(value: unknown): CostorePaymentStatus {
  const raw = str(value, 'NOT_STARTED').toUpperCase().replace(/-/g, '_')
  if (raw === 'UNPAID' || raw === 'WAIT_PAY') return 'PENDING'
  if (raw === 'SUCCESS' || raw === 'SUCCEEDED') return 'PAID'
  return PAY_STATUSES.has(raw as CostorePaymentStatus) ? (raw as CostorePaymentStatus) : 'NOT_STARTED'
}

function asRefundStatus(value: unknown): CostoreRefundStatus {
  if (value == null || value === '') return null
  const raw = str(value).toUpperCase().replace(/-/g, '_')
  if (raw === 'SUCCESS') return 'SUCCEEDED'
  if (raw === 'FAIL' || raw === 'FAILURE') return 'FAILED'
  return REFUND_STATUSES.has(raw) ? (raw as Exclude<CostoreRefundStatus, null>) : null
}

function asContractStatus(value: unknown): CostoreApplication['contractStatus'] {
  const raw = str(value, 'NOT_SIGNED').toUpperCase().replace(/-/g, '_')
  return CONTRACT_STATUSES.has(raw) ? (raw as CostoreApplication['contractStatus']) : 'NOT_SIGNED'
}

function asEntitlementStatus(value: unknown): CostoreApplication['entitlementStatus'] {
  const raw = str(value, 'NOT_OPEN').toUpperCase().replace(/-/g, '_')
  return ENTITLEMENT_STATUSES.has(raw) ? (raw as CostoreApplication['entitlementStatus']) : 'NOT_OPEN'
}

function asAuditAction(value: unknown): CostoreAudit['action'] {
  const raw = str(value, 'save-plan').toLowerCase().replace(/_/g, '-')
  return (AUDIT_ACTIONS.has(raw) ? raw : 'save-plan') as CostoreAudit['action']
}

function moneyAmount(value: unknown): number {
  return Math.max(0, moneyToFen(value))
}

function mapAllowedActions(raw: unknown, refundStatus: CostoreRefundStatus): CostoreApplication['allowedActions'] {
  const fromApi = arr(raw).map((item) => str(item).toLowerCase().replace(/_/g, '-')).filter((item) => item === 'retry-refund') as CostoreApplication['allowedActions']
  if (fromApi.length) return fromApi
  return refundStatus === 'FAILED' ? ['retry-refund'] : []
}

export function mapCostorePlan(raw: unknown, index = 0): CostorePlan {
  const r = record(raw)
  const months = Math.max(1, num(r.months ?? r.durationMonths ?? r.monthCount, index % 2 ? 6 : 12))
  const boundaryRaw = record(r.priceBoundary || r.price || r.pricing || {})
  return {
    planId: str(r.planId || r.id, 'costore-plan-' + String(index + 1)),
    title: str(r.title || r.name || r.planName, '合店方案' + String(months) + '个月'),
    durationId: str(r.durationId || r.duration || (months === 12 ? 'twelve-months' : 'six-months')),
    months,
    priceBoundary: {
      referenceMonthlyFee: moneyAmount(boundaryRaw.referenceMonthlyFee ?? boundaryRaw.monthlyFee ?? r.referenceMonthlyFee ?? r.monthlyFee),
      note: str(boundaryRaw.note || r.priceNote || r.note, '城市实际报价、税费与可售方案由服务端返回。'),
    },
    benefits: mapRichContent(r.benefits ?? r.benefitContent ?? r.rights),
    agreementVersion: r.agreementVersion == null && r.agreementVer == null ? null : Math.max(0, num(r.agreementVersion ?? r.agreementVer, 0)) || null,
    agreement: mapRichContent(r.agreement ?? r.agreementContent ?? r.contract),
    version: Math.max(1, num(r.version, 1)),
  }
}

export function mapCostoreStore(raw: unknown, index = 0) {
  const r = record(raw)
  return {
    storeId: str(r.storeId || r.id, 'store-' + String(index + 1)),
    name: str(r.name || r.storeName, '门店' + String(index + 1)),
    managerName: str(r.managerName || r.manager || r.ownerName),
    ownerCount: Math.max(0, num(r.ownerCount ?? r.owners ?? r.ownerTotal, 0)),
    active: r.active !== false && str(r.status).toUpperCase() !== 'DISABLED' && str(r.status).toUpperCase() !== 'INACTIVE',
  }
}

export function mapCostoreApplication(raw: unknown, index = 0): CostoreApplication {
  const r = record(raw)
  const applicationStatus = asAppStatus(r.applicationStatus || r.status || r.appStatus)
  const paymentStatus = asPayStatus(r.paymentStatus || r.payStatus)
  const refundStatus = asRefundStatus(r.refundStatus)
  const monthsFallback = r.months != null ? String(num(r.months)) + '个月' : ''
  return {
    applicationId: str(r.applicationId || r.id, 'costore-app-' + String(index + 1)),
    accountId: str(r.accountId || r.userId || r.applicantId),
    applicantName: str(r.applicantName || r.name || r.userName || r.nickname),
    applicantPhone: str(r.applicantPhone || r.phone || r.mobile),
    storeId: str(r.storeId),
    storeName: str(r.storeName || r.store),
    durationId: str(r.durationId || r.planDurationId || r.duration),
    durationLabel: str(r.durationLabel || r.durationName || r.planTitle || monthsFallback),
    monthlyFee: moneyAmount(r.monthlyFee ?? r.monthFee ?? r.price),
    payableAmount: moneyAmount(r.payableAmount ?? r.amount ?? r.totalAmount ?? r.paidAmount),
    orderId: nullableStr(r.orderId || r.orderNo),
    applicationStatus,
    paymentStatus,
    refundStatus,
    refundId: nullableStr(r.refundId),
    contractStatus: asContractStatus(r.contractStatus),
    entitlementStatus: asEntitlementStatus(r.entitlementStatus || r.benefitStatus),
    agreementVersion: r.agreementVersion == null ? null : Math.max(0, num(r.agreementVersion, 0)) || null,
    createdAt: str(r.createdAt || r.createTime),
    paidAt: nullableStr(r.paidAt || r.payTime),
    reviewedAt: nullableStr(r.reviewedAt || r.reviewTime),
    rejectionReason: nullableStr(r.rejectionReason || r.rejectReason || r.reason),
    version: Math.max(1, num(r.version, 1)),
    allowedActions: mapAllowedActions(r.allowedActions || r.actions, refundStatus),
  }
}

export function mapCostoreRefund(raw: unknown, index = 0): CostoreRefund {
  const r = record(raw)
  const status = asRefundStatus(r.status || r.refundStatus) ?? 'PENDING'
  return {
    refundId: str(r.refundId || r.id, 'costore-refund-' + String(index + 1)),
    applicationId: str(r.applicationId || r.appId),
    orderId: str(r.orderId || r.orderNo),
    amount: moneyAmount(r.amount ?? r.refundAmount),
    status,
    paymentReceiptId: str(r.paymentReceiptId || r.receiptId || r.paymentId || r.channelTradeNo),
    reason: str(r.reason || r.refundReason),
    createdAt: str(r.createdAt || r.createTime),
    completedAt: nullableStr(r.completedAt || r.finishTime || r.successAt),
    failureReason: nullableStr(r.failureReason || r.failReason || r.errorMessage),
    mockOnly: bool(r.mockOnly, false),
  }
}

export function mapCostoreAudit(raw: unknown, index = 0): CostoreAudit {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id || r.auditId, 'costore-op-' + String(index + 1)),
    requestId: str(r.requestId || r.idempotencyKey),
    action: asAuditAction(r.action),
    targetId: str(r.targetId || r.applicationId || r.planId),
    operatorName: str(r.operatorName || r.operator || r.operatorNickname),
    reason: str(r.reason),
    before: str(r.before || r.beforeState),
    after: str(r.after || r.afterState),
    occurredAt: str(r.occurredAt || r.createdAt || r.operateTime),
    beforeVersion: Math.max(0, num(r.beforeVersion, 0)),
    afterVersion: Math.max(0, num(r.afterVersion, 0)),
  }
}

function mapListSummary(raw: unknown, items: CostoreApplication[], total: number) {
  const r = record(raw)
  return {
    applications: Math.max(0, num(r.applications ?? r.total ?? r.count, total)),
    paid: Math.max(0, num(r.paid ?? r.paidCount, items.filter((item) => item.paymentStatus === 'PAID').length)),
    pendingReview: Math.max(0, num(r.pendingReview ?? r.pendingReviewCount, items.filter((item) => item.applicationStatus === 'PENDING_REVIEW').length)),
    rejected: Math.max(0, num(r.rejected ?? r.rejectedCount, items.filter((item) => item.applicationStatus === 'REJECTED').length)),
    refundPending: Math.max(0, num(r.refundPending ?? r.refundPendingCount, items.filter((item) => item.refundStatus === 'PENDING').length)),
    refundFailed: Math.max(0, num(r.refundFailed ?? r.refundFailedCount, items.filter((item) => item.refundStatus === 'FAILED').length)),
  }
}

export function mapCostoreCatalog(raw: unknown): CostoreCatalog {
  const r = record(raw)
  const plansSource = arr(r.plans || r.planList || r.items)
  const storesSource = arr(r.stores || r.storeList || r.storeOptions)
  return {
    plans: plansSource.map(mapCostorePlan),
    stores: storesSource.map(mapCostoreStore),
    refundRetryAllowed: r.refundRetryAllowed !== false,
    mockOnly: false,
  }
}

export function mapCostoreList(raw: unknown, query: CostoreQuery): CostoreList {
  const page = asPage(raw, query.page, query.pageSize)
  const items = page.items.map((item, index) => mapCostoreApplication(item, index))
  const summarySource = page.summary ?? page.raw.summary ?? page.raw.stats ?? page.raw
  return {
    items,
    total: page.total,
    summary: mapListSummary(summarySource, items, page.total),
  }
}

export function mapCostoreDetail(raw: unknown): CostoreDetail {
  const r = record(raw)
  const applicationRaw = r.application ?? r.detail ?? r
  const application = mapCostoreApplication(applicationRaw)
  const refunds = arr(r.refunds || r.refundList || record(applicationRaw).refunds).map(mapCostoreRefund)
  const audit = arr(r.audit || r.audits || r.operations || r.history).map(mapCostoreAudit)
  return { application, refunds, audit }
}

export async function realCostoreCatalog() {
  try { return cast(mapCostoreCatalog((await unwrapData(await api.getCostoreCatalog())) ?? {})) }
  catch (error) { return mapHqError(error, CostoreError) }
}

export async function realCostoreList(query: CostoreQuery) {
  try { return cast(mapCostoreList((await unwrapData(await api.getCostoreApplications({ ...query } as never))) ?? {}, query)) }
  catch (error) { return mapHqError(error, CostoreError) }
}

export async function realCostoreDetail(id: string) {
  try { return cast(mapCostoreDetail((await unwrapData(await api.getCostoreApplicationsByApplicationId({ applicationId: id }))) ?? {})) }
  catch (error) { return mapHqError(error, CostoreError) }
}

export async function realCostoreMutate(input: CostoreMutation) {
  try {
    const body = mutationBody({
      ...record(input as never),
      action: str((input as { action?: string }).action, 'approve'),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: (input as { version?: number }).version,
    })
    await unwrapData(await api.postCostoreMutate(body as never))
    const id = str((input as { applicationId?: string }).applicationId)
    return id ? realCostoreDetail(id) : realCostoreCatalog()
  } catch (error) { return mapHqError(error, CostoreError) }
}