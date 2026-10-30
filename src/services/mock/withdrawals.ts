import type {
  PayoutReceiptStatus,
  WithdrawAccountType,
  WithdrawStatus,
  WithdrawModule,
  WithdrawalApplication,
  WithdrawalAudit,
  WithdrawalCatalog,
  WithdrawalDetail,
  WithdrawalList,
  WithdrawalMutation,
  WithdrawalMutationResult,
  WithdrawalQuery,
} from '../../types/withdrawals'
import { WithdrawalError } from '../../types/withdrawals'

const STORAGE_KEY = 'ns_hq_withdrawals_v1'
const AUDIT_KEY = 'ns_hq_withdrawals_audit_v1'
const IDEM_KEY = 'ns_hq_withdrawals_idem_v1'

const PAYOUT_GAP =
  '打款由服务端/支付通道执行：总部仅审核与登记回执，不得把前端操作当作银行已到账；最低额、费率、自动打款政策待定，勿照搬本 Mock 数值。'

const BALANCE_NOTE =
  '可提现余额冻结/退回由结算与钱包服务处理；本模块不改写可用余额，也不联动 HQ-22 流水金额。'

type IdemRecord = { fingerprint: string; result: WithdrawalMutationResult }
type StoreShape = {
  items: WithdrawalApplication[]
  audit: WithdrawalAudit[]
  idem: Record<string, IdemRecord>
}

function nowIso() {
  return new Date().toISOString()
}

function stamp(offsetMin = 0) {
  return new Date(Date.now() - offsetMin * 60_000).toISOString()
}

function actionsFor(row: WithdrawalApplication): WithdrawalApplication['allowedActions'] {
  const a: WithdrawalApplication['allowedActions'] = []
  if (row.status === 'PENDING_REVIEW') a.push('approve', 'reject')
  if (row.status === 'PROCESSING') a.push('register-receipt')
  return a
}

function withActions(row: WithdrawalApplication): WithdrawalApplication {
  return { ...row, allowedActions: actionsFor(row), mockOnly: true }
}

function seed(): WithdrawalApplication[] {
  const base: Omit<WithdrawalApplication, 'allowedActions' | 'mockOnly'>[] = [
    {
      withdrawalId: 'wd-pending-001',
      title: '提现申请',
      module: 'wholesale',
      identityLabel: '联创合伙人',
      accountId: 'acc-founder-1',
      accountName: '王好梦',
      phone: '19919988991',
      amount: 567_00,
      fee: 1_00,
      netAmount: 566_00,
      accountType: 'COMPANY',
      payeeName: '示例科技有限公司',
      bankName: '中国银行',
      maskedBankNumber: '****1452',
      status: 'PENDING_REVIEW',
      payoutReceiptStatus: 'NONE',
      payoutFailureReason: null,
      voucherUrl: null,
      rejectionReason: null,
      relatedIncomeEntryIds: ['inc-wh-001', 'inc-aw-001'],
      createdAt: stamp(60 * 5),
      reviewedAt: null,
      receiptAt: null,
      version: 1,
    },
    {
      withdrawalId: 'wd-pending-002',
      title: '提现申请',
      module: 'agency',
      identityLabel: '市代',
      accountId: 'acc-agency-city',
      accountName: '李志远',
      phone: '19919988991',
      amount: 1_200_00,
      fee: 1_00,
      netAmount: 1_199_00,
      accountType: 'PERSONAL',
      payeeName: '李志远',
      bankName: '工商银行',
      maskedBankNumber: '****8891',
      status: 'PENDING_REVIEW',
      payoutReceiptStatus: 'NONE',
      payoutFailureReason: null,
      voucherUrl: null,
      rejectionReason: null,
      relatedIncomeEntryIds: ['inc-ag-001'],
      createdAt: stamp(60 * 12),
      reviewedAt: null,
      receiptAt: null,
      version: 1,
    },
    {
      withdrawalId: 'wd-processing-001',
      title: '提现申请',
      module: 'costore',
      identityLabel: '合店老板',
      accountId: 'acc-costore-1',
      accountName: '陈合店',
      phone: '13700002222',
      amount: 3_000_00,
      fee: 1_00,
      netAmount: 2_999_00,
      accountType: 'PERSONAL',
      payeeName: '陈合店',
      bankName: '建设银行',
      maskedBankNumber: '****2233',
      status: 'PROCESSING',
      payoutReceiptStatus: 'NONE',
      payoutFailureReason: null,
      voucherUrl: null,
      rejectionReason: null,
      relatedIncomeEntryIds: ['inc-co-001'],
      createdAt: stamp(60 * 24 * 2),
      reviewedAt: stamp(60 * 24),
      receiptAt: null,
      version: 2,
    },
    {
      withdrawalId: 'wd-processing-fail-001',
      title: '提现申请',
      module: 'wholesale',
      identityLabel: '天使合伙人',
      accountId: 'acc-angel-1',
      accountName: '李志远',
      phone: '19919988992',
      amount: 800_00,
      fee: 1_00,
      netAmount: 799_00,
      accountType: 'PERSONAL',
      payeeName: '李志远',
      bankName: '中国银行',
      maskedBankNumber: '****1452',
      status: 'PROCESSING',
      payoutReceiptStatus: 'FAILED',
      payoutFailureReason: '收款账户信息校验失败（Mock 回执失败，可重新登记）',
      voucherUrl: null,
      rejectionReason: null,
      relatedIncomeEntryIds: ['inc-wh-002'],
      createdAt: stamp(60 * 24 * 3),
      reviewedAt: stamp(60 * 24 * 2),
      receiptAt: stamp(60 * 20),
      version: 3,
    },
    {
      withdrawalId: 'wd-ok-001',
      title: '提现申请',
      module: 'wholesale',
      identityLabel: '联创合伙人',
      accountId: 'acc-founder-1',
      accountName: '王好梦',
      phone: '19919988991',
      amount: 567_00,
      fee: 1_00,
      netAmount: 566_00,
      accountType: 'PERSONAL',
      payeeName: '王好梦',
      bankName: '中国银行',
      maskedBankNumber: '****1452',
      status: 'SUCCEEDED',
      payoutReceiptStatus: 'SUCCESS',
      payoutFailureReason: null,
      voucherUrl: 'https://mock-assets.invalid/vouchers/wd-ok-001.png',
      rejectionReason: null,
      relatedIncomeEntryIds: ['inc-wh-001'],
      createdAt: stamp(60 * 24 * 10),
      reviewedAt: stamp(60 * 24 * 9),
      receiptAt: stamp(60 * 24 * 8),
      version: 3,
    },
    {
      withdrawalId: 'wd-rejected-001',
      title: '提现申请',
      module: 'agency',
      identityLabel: '区县代理',
      accountId: 'acc-agency-county',
      accountName: '周区县',
      phone: '13600003333',
      amount: 567_00,
      fee: 1_00,
      netAmount: 566_00,
      accountType: 'PERSONAL',
      payeeName: '周区县',
      bankName: '中国银行',
      maskedBankNumber: '****1452',
      status: 'REJECTED',
      payoutReceiptStatus: 'NONE',
      payoutFailureReason: null,
      voucherUrl: null,
      rejectionReason: '资料未通过审核',
      relatedIncomeEntryIds: [],
      createdAt: stamp(60 * 24 * 7),
      reviewedAt: stamp(60 * 24 * 6),
      receiptAt: null,
      version: 2,
    },
    {
      withdrawalId: 'wd-pending-003',
      title: '提现申请',
      module: 'wholesale',
      identityLabel: 'VIP合伙人',
      accountId: 'acc-vip-1',
      accountName: '赵敏',
      phone: '18800001111',
      amount: 200_00,
      fee: 1_00,
      netAmount: 199_00,
      accountType: 'COMPANY',
      payeeName: '赵敏商贸有限公司',
      bankName: '招商银行',
      maskedBankNumber: '****7788',
      status: 'PENDING_REVIEW',
      payoutReceiptStatus: 'NONE',
      payoutFailureReason: null,
      voucherUrl: null,
      rejectionReason: null,
      relatedIncomeEntryIds: [],
      createdAt: stamp(60 * 2),
      reviewedAt: null,
      receiptAt: null,
      version: 1,
    },
  ]
  return base.map((row) => withActions({ ...row, mockOnly: true, allowedActions: [] }))
}

function load(): StoreShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const items = seed()
      const state: StoreShape = { items, audit: [], idem: {} }
      save(state)
      return state
    }
    const parsed = JSON.parse(raw) as { items: WithdrawalApplication[] }
    const audit = JSON.parse(sessionStorage.getItem(AUDIT_KEY) || '[]') as WithdrawalAudit[]
    const idem = JSON.parse(sessionStorage.getItem(IDEM_KEY) || '{}') as Record<string, IdemRecord>
    return { items: parsed.items.map(withActions), audit, idem }
  } catch {
    return { items: seed(), audit: [], idem: {} }
  }
}

function save(state: StoreShape) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }))
  sessionStorage.setItem(AUDIT_KEY, JSON.stringify(state.audit))
  sessionStorage.setItem(IDEM_KEY, JSON.stringify(state.idem))
}

export function __resetWithdrawalsMockForTests() {
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(AUDIT_KEY)
  sessionStorage.removeItem(IDEM_KEY)
}

function find(items: WithdrawalApplication[], id: string) {
  return items.find((row) => row.withdrawalId === id)
}

function pushAudit(
  state: StoreShape,
  partial: Omit<WithdrawalAudit, 'operationId' | 'occurredAt'> & { occurredAt?: string },
) {
  state.audit.unshift({
    ...partial,
    operationId: `wd-op-${Date.now()}-${state.audit.length + 1}`,
    occurredAt: partial.occurredAt ?? nowIso(),
  })
}

export function mockWithdrawalCatalog(): WithdrawalCatalog {
  const state = load()
  return {
    modules: [
      { value: 'wholesale', label: '合伙人' },
      { value: 'costore', label: '合店' },
      { value: 'agency', label: '代理' },
    ],
    statuses: [
      { value: 'PENDING_REVIEW', label: '待审核' },
      { value: 'PROCESSING', label: '处理中（待打款回执）' },
      { value: 'SUCCEEDED', label: '已完成' },
      { value: 'REJECTED', label: '未通过' },
    ],
    pendingPolicy: {
      note: '最低提现额、手续费费率、人工/自动打款层级尚待定；界面展示的费用仅为申请快照，不作为正式政策。',
      minAmountPending: true,
      feePolicyPending: true,
      autoPayoutPending: true,
    },
    payoutGapNote: PAYOUT_GAP,
    audit: state.audit.slice(0, 30),
    mockOnly: true,
  }
}

export function mockWithdrawalList(query: WithdrawalQuery): WithdrawalList {
  const state = load()
  let items = [...state.items]
  const kw = (query.keyword || '').trim().toLowerCase()
  if (kw) {
    items = items.filter(
      (row) =>
        row.withdrawalId.toLowerCase().includes(kw) ||
        row.accountName.toLowerCase().includes(kw) ||
        row.phone.includes(kw) ||
        row.payeeName.toLowerCase().includes(kw) ||
        row.maskedBankNumber.includes(kw) ||
        row.bankName.toLowerCase().includes(kw),
    )
  }
  if (query.status) items = items.filter((row) => row.status === query.status)
  if (query.module) items = items.filter((row) => row.module === query.module)
  if (query.accountType) items = items.filter((row) => row.accountType === query.accountType)
  if (query.accountId) items = items.filter((row) => row.accountId === query.accountId)

  const all = state.items
  const summary = {
    applications: all.length,
    pendingReview: all.filter((r) => r.status === 'PENDING_REVIEW').length,
    processing: all.filter((r) => r.status === 'PROCESSING').length,
    succeeded: all.filter((r) => r.status === 'SUCCEEDED').length,
    rejected: all.filter((r) => r.status === 'REJECTED').length,
    receiptFailed: all.filter((r) => r.payoutReceiptStatus === 'FAILED').length,
    pendingAmount: all
      .filter((r) => r.status === 'PENDING_REVIEW' || r.status === 'PROCESSING')
      .reduce((s, r) => s + r.amount, 0),
    succeededAmount: all.filter((r) => r.status === 'SUCCEEDED').reduce((s, r) => s + r.amount, 0),
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const total = items.length
  const start = (query.page - 1) * query.pageSize
  return {
    items: items.slice(start, start + query.pageSize).map(withActions),
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary,
  }
}

export function mockWithdrawalDetail(withdrawalId: string): WithdrawalDetail {
  const state = load()
  const application = find(state.items, withdrawalId)
  if (!application) throw new WithdrawalError('NOT_FOUND', '提现申请不存在')
  return {
    application: withActions(application),
    audit: state.audit.filter((a) => a.targetId === withdrawalId),
    payoutGapNote: PAYOUT_GAP,
    balanceNote: BALANCE_NOTE,
  }
}

export function mockWithdrawalMutate(
  mutation: WithdrawalMutation,
  operator: { operatorId: string; operatorName: string },
): WithdrawalMutationResult {
  const state = load()
  const fingerprint = JSON.stringify(mutation)
  const prev = state.idem[mutation.idempotencyKey]
  if (prev) {
    if (prev.fingerprint === fingerprint) return prev.result
    throw new WithdrawalError('IDEMPOTENCY_CONFLICT', '幂等键已用于其他操作')
  }

  const row = find(state.items, mutation.withdrawalId)
  if (!row) throw new WithdrawalError('NOT_FOUND', '提现申请不存在')
  if (row.version !== mutation.version) {
    throw new WithdrawalError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
  }
  if (!mutation.reason.trim()) throw new WithdrawalError('INVALID_INPUT', '请填写原因')

  let result: WithdrawalMutationResult
  const beforeV = row.version

  if (mutation.action === 'approve') {
    if (row.status !== 'PENDING_REVIEW') throw new WithdrawalError('INVALID_STATE', '仅待审核可同意')
    const before = row.status
    row.status = 'PROCESSING'
    row.payoutReceiptStatus = 'NONE'
    row.reviewedAt = nowIso()
    row.version += 1
    const updated = withActions(row)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'approve',
      targetId: row.withdrawalId,
      before,
      after: 'PROCESSING（待服务端打款回执，非已到账）',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'approve', application: updated, mockOnly: true }
  } else if (mutation.action === 'reject') {
    if (row.status !== 'PENDING_REVIEW') throw new WithdrawalError('INVALID_STATE', '仅待审核可拒绝')
    const before = row.status
    row.status = 'REJECTED'
    row.rejectionReason = mutation.reason.trim()
    row.reviewedAt = nowIso()
    row.version += 1
    const updated = withActions(row)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'reject',
      targetId: row.withdrawalId,
      before,
      after: 'REJECTED（余额退回由钱包服务处理，本模块未改余额）',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'reject', application: updated, mockOnly: true }
  } else {
    if (row.status !== 'PROCESSING') {
      throw new WithdrawalError('INVALID_STATE', '仅处理中的申请可登记打款回执')
    }
    if (mutation.receipt !== 'SUCCESS' && mutation.receipt !== 'FAILED') {
      throw new WithdrawalError('INVALID_INPUT', '回执结果无效')
    }
    const before = `${row.status}/${row.payoutReceiptStatus}`
    row.receiptAt = nowIso()
    if (mutation.receipt === 'SUCCESS') {
      row.status = 'SUCCEEDED'
      row.payoutReceiptStatus = 'SUCCESS'
      row.payoutFailureReason = null
      row.voucherUrl =
        (mutation.voucherUrl || '').trim() ||
        `https://mock-assets.invalid/vouchers/${row.withdrawalId}.png`
    } else {
      row.status = 'PROCESSING'
      row.payoutReceiptStatus = 'FAILED'
      row.payoutFailureReason = mutation.reason.trim()
      row.voucherUrl = null
    }
    row.version += 1
    const updated = withActions(row)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'register-receipt',
      targetId: row.withdrawalId,
      before,
      after:
        mutation.receipt === 'SUCCESS'
          ? 'SUCCEEDED（已登记成功回执，非前端执行打款）'
          : 'PROCESSING + FAILED 回执（可再次登记）',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'register-receipt', application: updated, mockOnly: true }
  }

  state.idem[mutation.idempotencyKey] = { fingerprint, result }
  state.items = state.items.map(withActions)
  save(state)
  return result
}

export type { WithdrawStatus, WithdrawModule, WithdrawAccountType, PayoutReceiptStatus }
