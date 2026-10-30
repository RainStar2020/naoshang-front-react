import * as api from '../../api'
import {
  PaymentError,
  type ChannelVerification,
  type PaymentAudit,
  type PaymentAttempt,
  type PaymentBusiness,
  type PaymentCatalog,
  type PaymentChannel,
  type PaymentChannelConfig,
  type PaymentJob,
  type PaymentMutation,
  type PaymentPlatform,
  type PaymentRecord,
  type ReconciliationDifference,
} from '../../types/payments'
import { arr, cast, mapHqError, mutationBody, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

const CHANNELS = new Set<PaymentChannel>(['WECHAT', 'ALIPAY'])
const PLATFORMS = new Set<PaymentPlatform>(['MINI_PROGRAM', 'H5'])
const BUSINESSES = new Set<PaymentBusiness>(['MALL', 'MEMBERSHIP', 'BUSINESS'])
const LOCAL_STATUSES = new Set(['WAITING', 'SUCCESS', 'CLOSED'])
const VERIFY_STATUSES = new Set(['SUCCESS', 'PENDING', 'CLOSED', 'MISMATCH', 'UNAVAILABLE'])
const JOB_KINDS = new Set(['query', 'compensate', 'reconcile'])
const JOB_STATUSES = new Set(['PROCESSING', 'SUCCEEDED', 'FAILED'])
const DIFF_REASONS = new Set(['CHANNEL_ONLY', 'LOCAL_ONLY', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'TRADE_NO_MISMATCH'])
const AUDIT_ACTIONS = new Set(['save-channel', 'query', 'compensate', 'reconcile', 'download'])

function asChannel(value: unknown, fallback: PaymentChannel = 'WECHAT'): PaymentChannel {
  const raw = str(value, fallback).toUpperCase()
  return CHANNELS.has(raw as PaymentChannel) ? (raw as PaymentChannel) : fallback
}

function asPlatform(value: unknown, fallback: PaymentPlatform = 'MINI_PROGRAM'): PaymentPlatform {
  const raw = str(value, fallback).toUpperCase()
  return PLATFORMS.has(raw as PaymentPlatform) ? (raw as PaymentPlatform) : fallback
}

function asBusiness(value: unknown, fallback: PaymentBusiness = 'MALL'): PaymentBusiness {
  const raw = str(value, fallback).toUpperCase()
  return BUSINESSES.has(raw as PaymentBusiness) ? (raw as PaymentBusiness) : fallback
}

function asLocalStatus(value: unknown): PaymentRecord['status'] {
  const raw = str(value, 'WAITING').toUpperCase()
  return LOCAL_STATUSES.has(raw) ? (raw as PaymentRecord['status']) : 'WAITING'
}

function asVerifyStatus(value: unknown): ChannelVerification['status'] {
  const raw = str(value, 'UNAVAILABLE').toUpperCase()
  return VERIFY_STATUSES.has(raw) ? (raw as ChannelVerification['status']) : 'UNAVAILABLE'
}

function asJobKind(value: unknown): PaymentJob['kind'] {
  const raw = str(value, 'query').toLowerCase()
  return JOB_KINDS.has(raw) ? (raw as PaymentJob['kind']) : 'query'
}

function asJobStatus(value: unknown): PaymentJob['status'] {
  const raw = str(value, 'PROCESSING').toUpperCase()
  return JOB_STATUSES.has(raw) ? (raw as PaymentJob['status']) : 'PROCESSING'
}

function asDiffReason(value: unknown): ReconciliationDifference['reason'] {
  const raw = str(value, 'LOCAL_ONLY').toUpperCase()
  return DIFF_REASONS.has(raw) ? (raw as ReconciliationDifference['reason']) : 'LOCAL_ONLY'
}

function asAuditAction(value: unknown): PaymentAudit['action'] {
  const raw = str(value, 'query').toLowerCase().replace(/_/g, '-')
  return (AUDIT_ACTIONS.has(raw) ? raw : 'query') as PaymentAudit['action']
}

function moneyAmount(value: unknown): number {
  if (value == null || value === '') return 0
  const n = num(value)
  if (!Number.isFinite(n)) return 0
  if (Number.isInteger(n)) return Math.max(0, n)
  return Math.max(0, Math.round(n * 100))
}

function nullableMoney(value: unknown): number | null {
  if (value == null || value === '') return null
  return moneyAmount(value)
}

export function mapPaymentVerification(raw: unknown): ChannelVerification | null {
  if (raw == null) return null
  const r = record(raw)
  if (!Object.keys(r).length) return null
  return {
    status: asVerifyStatus(r.status || r.verifyStatus),
    amount: nullableMoney(r.amount ?? r.verifiedAmount),
    channelTradeNo: nullableStr(r.channelTradeNo ?? r.tradeNo ?? r.thirdPartyTradeNo),
    checkedAt: str(r.checkedAt || r.verifiedAt || r.updatedAt),
    detail: str(r.detail || r.message || r.remark),
  }
}

export function mapPaymentConfig(raw: unknown): PaymentChannelConfig {
  const r = record(raw)
  const platform = asPlatform(r.platform)
  const business = asBusiness(r.business)
  const channel = asChannel(r.channel)
  return {
    configId: str(r.configId || r.id || `${platform}-${business}-${channel}`),
    platform,
    business,
    channel,
    enabled: r.enabled !== false && str(r.status).toUpperCase() !== 'DISABLED' && str(r.status).toUpperCase() !== 'OFF',
    version: Math.max(1, num(r.version, 1)),
  }
}

export function mapPaymentRecord(raw: unknown): PaymentRecord {
  const r = record(raw)
  const paymentId = str(r.paymentId || r.id)
  return {
    paymentId,
    orderId: str(r.orderId || r.order_id),
    orderNo: str(r.orderNo || r.orderNumber || r.order_no || r.orderId),
    accountId: str(r.accountId || r.userId || r.ownerId),
    channel: asChannel(r.channel),
    platform: asPlatform(r.platform),
    business: asBusiness(r.business || r.bizType || r.sourceKind),
    status: asLocalStatus(r.status || r.localStatus || r.paymentStatus),
    amount: moneyAmount(r.amount ?? r.payableAmount ?? r.paidAmount),
    paidAt: nullableStr(r.paidAt ?? r.successAt),
    channelTradeNo: nullableStr(r.channelTradeNo ?? r.tradeNo ?? r.thirdPartyTradeNo),
    statementDate: str(r.statementDate || (str(r.paidAt || r.createdAt).slice(0, 10))),
    createdAt: str(r.createdAt || r.created_at),
    verification: mapPaymentVerification(r.verification ?? r.channelVerification ?? r.latestVerification),
  }
}

export function mapPaymentAttempt(raw: unknown): PaymentAttempt {
  const r = record(raw)
  return {
    attemptId: str(r.attemptId || r.id),
    paymentId: str(r.paymentId),
    orderId: str(r.orderId),
    channel: asChannel(r.channel),
    platform: asPlatform(r.platform),
    status: asLocalStatus(r.status),
    createdAt: str(r.createdAt),
    requestId: str(r.requestId || r.idempotencyKey),
  }
}

export function mapReconciliationDifference(raw: unknown, index = 0): ReconciliationDifference {
  const r = record(raw)
  return {
    id: str(r.id || r.diffId || `diff-${index}`),
    paymentId: str(r.paymentId || r.localPaymentId || r.channelPaymentId),
    reason: asDiffReason(r.reason || r.type || r.diffType),
    localAmount: nullableMoney(r.localAmount ?? r.hqAmount),
    channelAmount: nullableMoney(r.channelAmount ?? r.statementAmount),
    detail: str(r.detail || r.message || r.remark),
  }
}

export function mapPaymentJob(raw: unknown): PaymentJob {
  const r = record(raw)
  const differences = arr(r.differences || r.diffList || r.items).map((item, index) => mapReconciliationDifference(item, index))
  const channelRaw = r.channel
  return {
    jobId: str(r.jobId || r.id || r.reconciliationJobId),
    reconciliationJobId: nullableStr(r.reconciliationJobId ?? r.reconcileJobId ?? (asJobKind(r.kind || r.type) === 'reconcile' ? (r.jobId || r.id) : null)),
    kind: asJobKind(r.kind || r.type || r.jobKind),
    paymentId: nullableStr(r.paymentId),
    status: asJobStatus(r.status || r.jobStatus),
    requestId: str(r.requestId || r.idempotencyKey),
    operatorName: str(r.operatorName || r.operator || r.createdByName),
    reason: str(r.reason || r.remark),
    createdAt: str(r.createdAt || r.submittedAt),
    completedAt: nullableStr(r.completedAt ?? r.finishedAt),
    result: str(r.result || r.message || r.detail),
    receiptId: nullableStr(r.receiptId ?? r.mockReceiptId),
    fileName: nullableStr(r.fileName ?? r.sourceFileName),
    channel: channelRaw == null || channelRaw === '' ? null : asChannel(channelRaw),
    statementDate: nullableStr(r.statementDate ?? r.billDate),
    differences,
    mockOnly: false,
  }
}

export function mapPaymentAudit(raw: unknown): PaymentAudit {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id || r.requestId || `op-${Date.now()}`),
    requestId: str(r.requestId || r.idempotencyKey),
    action: asAuditAction(r.action || r.type),
    targetId: str(r.targetId || r.paymentId || r.configId || r.jobId),
    operatorName: str(r.operatorName || r.operator || r.createdByName),
    reason: str(r.reason || r.remark),
    detail: str(r.detail || r.message || r.result),
    occurredAt: str(r.occurredAt || r.createdAt || r.operatedAt),
  }
}

/** Normalize HQ catalog so Payments page always has safe arrays (jobs/configs/payments/attempts/audit). */
export function mapPaymentCatalog(raw: unknown): PaymentCatalog {
  const r = record(raw)
  const configs = arr(r.configs || r.channels || r.channelConfigs || r.platformChannels).map(mapPaymentConfig)
  const payments = arr(r.payments || r.paymentList || r.records || r.items).map(mapPaymentRecord)
  const attempts = arr(r.attempts || r.paymentAttempts || r.tryList).map(mapPaymentAttempt)
  const jobs = arr(r.jobs || r.recentJobs || r.jobList || r.tasks).map(mapPaymentJob)
  const audit = arr(r.audit || r.operations || r.logs || r.recentOperations).map(mapPaymentAudit)
  return { configs, payments, attempts, jobs, audit }
}

export async function realPaymentCatalog() {
  try {
    const mapped = mapPaymentCatalog(await unwrapData(await api.getPaymentsCatalog()))
    if (!mapped.payments.length) {
      try {
        const listRaw = record(await unwrapData(await api.getPayments({ page: 1, pageSize: 100 } as never)))
        const items = arr(listRaw.items || listRaw.list || listRaw.records || (Array.isArray(listRaw) ? listRaw : []))
        if (items.length) mapped.payments = items.map(mapPaymentRecord)
      } catch {
        // keep empty payments when list endpoint is unavailable
      }
    }
    return cast(mapped)
  } catch (error) { return mapHqError(error, PaymentError) }
}

export async function realPaymentMutate(input: PaymentMutation) {
  try {
    const actionMap: Record<string, string> = { 'save-channel': 'save-channel', query: 'query', compensate: 'compensate', reconcile: 'reconcile' }
    const action = actionMap[input.action]
    if (!action) unsupported(PaymentError, input.action, '支付操作与 HQ payments actions 无法映射')
    let channelFields = {}
    if (input.action === 'save-channel') {
      const catalog = mapPaymentCatalog(await unwrapData(await api.getPaymentsCatalog()))
      const config = catalog.configs.find((row) => row.configId === input.configId)
      if (!config) throw new PaymentError('NOT_FOUND', '渠道配置不存在')
      channelFields = { platform: config.platform, business: config.business, channel: config.channel }
    }
    const body = mutationBody({ ...record(input as never), ...channelFields, action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    const result = record(await unwrapData(await api.postPaymentsMutate(body as never)))
    return cast({
      jobId: nullableStr(result.jobId ?? result.id),
      configId: nullableStr(result.configId ?? (input.action === 'save-channel' ? input.configId : null)),
    })
  } catch (error) { return mapHqError(error, PaymentError) }
}

export async function realPaymentDownload(_jobId: string, _kind: 'source' | 'differences', _reason: string, _key: string) {
  return unsupported(PaymentError, 'download', 'HQ payments API 未暴露对账单下载')
}

export async function realPaymentSample(_channel: PaymentChannel, _date: string) {
  return unsupported(PaymentError, 'sample', 'HQ payments API 未暴露样例下载')
}
