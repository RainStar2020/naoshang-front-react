import type { HqAccount } from '../../types/auth'
import {
  CostoreError,
  type CostoreApplication,
  type CostoreAudit,
  type CostoreCatalog,
  type CostoreDetail,
  type CostoreMutation,
  type CostorePlan,
  type CostoreQuery,
  type CostoreRefund,
} from '../../types/costore'
import { hasContent, normalizeContent } from '../../utils/richContent'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: CostoreError['code'], message: string): never => {
  throw new CostoreError(code, message)
}
const rich = (text: string) => normalizeContent({
  version: 1,
  format: 'nodes',
  nodes: [{ name: 'p', children: [{ type: 'text', text }] }],
})

const plans: CostorePlan[] = [
  {
    planId: 'costore-6',
    title: '合店老板6个月方案',
    durationId: 'six-months',
    months: 6,
    priceBoundary: { referenceMonthlyFee: 69800, note: '698元/月起为附件参考；城市实际报价、税费与可售方案由服务端返回。' },
    benefits: rich('合店权益由服务端判定；按月赠软件卡、分红资格等不在后台自行授予。'),
    agreementVersion: 1,
    agreement: rich('合店协议演示版本。实际签署方式及协议效力待后端确认。'),
    version: 1,
  },
  {
    planId: 'costore-12',
    title: '合店老板12个月方案',
    durationId: 'twelve-months',
    months: 12,
    priceBoundary: { referenceMonthlyFee: 69800, note: '698元/月起为附件参考；城市实际报价、税费与可售方案由服务端返回。' },
    benefits: rich('合店权益由服务端判定；按月赠软件卡、分红资格等不在后台自行授予。'),
    agreementVersion: 1,
    agreement: rich('合店协议演示版本。实际签署方式及协议效力待后端确认。'),
    version: 1,
  },
]

const stores = [
  { storeId: 'demo-store-1', name: '脑商训练营梧桐街店', managerName: '李志远', ownerCount: 8, active: true },
  { storeId: 'demo-store-2', name: '脑商训练营文化路店', managerName: '王老师', ownerCount: 3, active: true },
  { storeId: 'demo-store-3', name: '脑商训练营合肥店', managerName: '赵教练', ownerCount: 2, active: true },
]

const sample = (
  n: number,
  applicationStatus: CostoreApplication['applicationStatus'],
  paymentStatus: CostoreApplication['paymentStatus'],
  refundStatus: CostoreApplication['refundStatus'],
  overrides: Partial<CostoreApplication> = {},
): CostoreApplication => ({
  applicationId: `costore-app-${n}`,
  accountId: `account-${n + 2}`,
  applicantName: ['王思雨', '刘洋', '陈明9', '赵悦12', '林晓雅15', '李晨18'][n - 1] ?? `申请人${n}`,
  applicantPhone: `138000000${String(n + 2).padStart(2, '0')}`,
  storeId: n % 2 ? 'demo-store-1' : 'demo-store-2',
  storeName: n % 2 ? '脑商训练营梧桐街店' : '脑商训练营文化路店',
  durationId: n % 2 ? 'six-months' : 'twelve-months',
  durationLabel: n % 2 ? '6个月' : '12个月',
  monthlyFee: 69800,
  payableAmount: (n % 2 ? 6 : 12) * 69800,
  orderId: paymentStatus === 'NOT_STARTED' ? null : `costore-order-${n}`,
  applicationStatus,
  paymentStatus,
  refundStatus,
  refundId: refundStatus ? `costore-refund-${n}` : null,
  contractStatus: applicationStatus === 'APPROVED' ? 'SIGNED' : 'NOT_SIGNED',
  entitlementStatus: applicationStatus === 'APPROVED' ? 'OPEN' : 'NOT_OPEN',
  agreementVersion: 1,
  createdAt: `2026-10-${String(n + 1).padStart(2, '0')}T10:00:00+08:00`,
  paidAt: paymentStatus === 'PAID' ? '2026-10-10T10:00:00+08:00' : null,
  reviewedAt: ['APPROVED', 'REJECTED'].includes(applicationStatus) ? '2026-10-12T10:00:00+08:00' : null,
  rejectionReason: applicationStatus === 'REJECTED' ? '门店审核未通过；退款状态以支付服务回执为准。' : null,
  version: 1,
  allowedActions: refundStatus === 'FAILED' ? ['retry-refund'] : [],
  ...overrides,
})

const applications: CostoreApplication[] = [
  sample(1, 'PENDING_PAYMENT', 'PENDING', null),
  sample(2, 'PENDING_REVIEW', 'PAID', null),
  sample(3, 'APPROVED', 'PAID', null),
  sample(4, 'REJECTED', 'PAID', 'PENDING'),
  sample(5, 'REJECTED', 'PAID', 'SUCCEEDED'),
  sample(6, 'REJECTED', 'PAID', 'FAILED'),
]

const refunds: CostoreRefund[] = applications
  .filter((application) => application.refundStatus)
  .map((application) => ({
    refundId: application.refundId!,
    applicationId: application.applicationId,
    orderId: application.orderId!,
    amount: application.payableAmount,
    status: application.refundStatus!,
    paymentReceiptId: `payment-${application.applicationId}`,
    reason: '门店拒审后发起退款，最终结果以支付服务回执为准。',
    createdAt: '2026-10-12T10:01:00+08:00',
    completedAt: application.refundStatus === 'PENDING' ? null : '2026-10-13T10:01:00+08:00',
    failureReason: application.refundStatus === 'FAILED' ? '支付渠道返回失败，是否可重试由服务端返回。' : null,
    mockOnly: true,
  }))

const audit: CostoreAudit[] = []
const operations = new Map<string, { payload: string; result: CostoreCatalog | CostoreDetail }>()

function validateQuery(query: CostoreQuery) {
  if (!Number.isInteger(query.page) || query.page < 1 || ![5, 10, 20].includes(query.pageSize)) {
    fail('INVALID_INPUT', '分页参数无效')
  }
}

function validateRequest(reason: string, idempotencyKey: string) {
  if (!reason.trim() || reason.trim().length > 200 || !idempotencyKey) {
    fail('INVALID_INPUT', '请填写1至200字操作原因和请求号')
  }
}

export function mockCostoreCatalog(): CostoreCatalog {
  return copy({ plans, stores, refundRetryAllowed: true, mockOnly: true })
}

export function mockCostoreList(query: CostoreQuery) {
  validateQuery(query)
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const rows = applications.filter((row) => (
    (!keyword || `${row.applicationId} ${row.orderId} ${row.applicantName} ${row.applicantPhone} ${row.storeName}`.toLowerCase().includes(keyword))
    && (!query.applicationStatus || row.applicationStatus === query.applicationStatus)
    && (!query.paymentStatus || row.paymentStatus === query.paymentStatus)
    && (!query.refundStatus || row.refundStatus === query.refundStatus)
  ))
  return copy({
    items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
    total: rows.length,
    summary: {
      applications: rows.length,
      paid: rows.filter((row) => row.paymentStatus === 'PAID').length,
      pendingReview: rows.filter((row) => row.applicationStatus === 'PENDING_REVIEW').length,
      rejected: rows.filter((row) => row.applicationStatus === 'REJECTED').length,
      refundPending: rows.filter((row) => row.refundStatus === 'PENDING').length,
      refundFailed: rows.filter((row) => row.refundStatus === 'FAILED').length,
    },
  })
}

export function mockCostoreDetail(applicationId: string): CostoreDetail {
  const application = applications.find((row) => row.applicationId === applicationId) ?? fail('NOT_FOUND', '合店申请不存在')
  return copy({
    application,
    refunds: refunds.filter((row) => row.applicationId === applicationId).reverse(),
    audit: audit.filter((row) => row.targetId === applicationId).reverse(),
  })
}

export function mockCostoreMutate(input: CostoreMutation, operator: HqAccount): CostoreCatalog | CostoreDetail {
  if (!['save-plan', 'retry-refund'].includes(input.action)) {
    fail('INVALID_INPUT', '未知合店监管操作')
  }
  validateRequest(input.reason, input.idempotencyKey)

  const key = `${operator.accountId}:${input.idempotencyKey}`
  const payload = JSON.stringify(input)
  const previous = operations.get(key)
  if (previous) {
    if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变')
    return copy(previous.result)
  }

  let result: CostoreCatalog | CostoreDetail
  if (input.action === 'save-plan') {
    const plan = plans.find((row) => row.planId === input.planId) ?? fail('NOT_FOUND', '合店方案不存在')
    if (plan.version !== input.version) fail('VERSION_CONFLICT', '方案已更新，请刷新')

    const benefits = normalizeContent(input.benefits)
    const agreement = normalizeContent(input.agreement)
    if (!input.title.trim() || input.title.length > 60 || !hasContent(benefits) || !hasContent(agreement)) {
      fail('INVALID_INPUT', '请填写方案标题、权益和协议说明')
    }

    const before = `V${plan.version} ${plan.title}`
    plan.title = input.title.trim()
    plan.benefits = benefits
    plan.agreement = agreement
    plan.version += 1
    audit.push({
      operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action: input.action,
      targetId: plan.planId, operatorName: operator.nickname, reason: input.reason.trim(),
      before, after: `V${plan.version} ${plan.title}`, occurredAt: new Date().toISOString(),
      beforeVersion: input.version, afterVersion: plan.version,
    })
    result = mockCostoreCatalog()
  } else {
    const application = applications.find((row) => row.applicationId === input.applicationId) ?? fail('NOT_FOUND', '合店申请不存在')
    if (application.version !== input.version) fail('VERSION_CONFLICT', '申请已更新，请刷新')
    if (application.refundStatus !== 'FAILED' || !application.refundId || !application.allowedActions.includes('retry-refund')) {
      fail('INVALID_STATE', '服务端未允许重试此退款')
    }

    const refund = refunds.find((row) => row.refundId === application.refundId)!
    const before = `退款${refund.status}；申请V${application.version}`
    refund.status = 'PENDING'
    refund.failureReason = null
    refund.completedAt = null
    refund.createdAt = new Date().toISOString()
    application.refundStatus = 'PENDING'
    application.version += 1
    application.allowedActions = []
    audit.push({
      operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action: input.action,
      targetId: application.applicationId, operatorName: operator.nickname, reason: input.reason.trim(),
      before, after: `退款PENDING；申请V${application.version}`, occurredAt: new Date().toISOString(),
      beforeVersion: input.version, afterVersion: application.version,
    })
    result = mockCostoreDetail(application.applicationId)
  }

  operations.set(key, { payload, result: copy(result) })
  return copy(result)
}
