import * as api from '../../api'
import {
  WithdrawalError,
  type WithdrawAccountType,
  type WithdrawModule,
  type WithdrawStatus,
  type WithdrawalAudit,
  type WithdrawalCatalog,
  type WithdrawalDetail,
  type WithdrawalMutation,
  type WithdrawalQuery,
  type PayoutReceiptStatus,
} from '../../types/withdrawals'
import { arr, asPage, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData, yuanToFen } from './bridge'

const DEFAULT_PAYOUT_GAP =
  '打款由服务端/支付通道执行：总部仅审核与登记回执，不得把前端操作当作银行已到账；最低额、费率、自动打款政策待定。'

const DEFAULT_BALANCE_NOTE = '拒绝或失败不在本页改写可用余额；余额以服务端结算口径为准。'

const DEFAULT_PENDING_POLICY_NOTE =
  '最低提现额、手续费费率、人工/自动打款层级尚待定；界面展示的费用仅为申请快照，不作为正式政策。'

const DEFAULT_MODULES: { value: WithdrawModule; label: string }[] = [
  { value: 'wholesale', label: '合伙人' },
  { value: 'costore', label: '合店' },
  { value: 'agency', label: '代理' },
]

const DEFAULT_STATUSES: { value: WithdrawStatus; label: string }[] = [
  { value: 'PENDING_REVIEW', label: '待审核' },
  { value: 'PROCESSING', label: '处理中（待打款回执）' },
  { value: 'SUCCEEDED', label: '已完成' },
  { value: 'REJECTED', label: '未通过' },
]

const MODULES = new Set<WithdrawModule>(['wholesale', 'costore', 'agency'])
const STATUSES = new Set<WithdrawStatus>(['PENDING_REVIEW', 'PROCESSING', 'SUCCEEDED', 'REJECTED'])
const ACCOUNT_TYPES = new Set<WithdrawAccountType>(['PERSONAL', 'COMPANY'])
const RECEIPTS = new Set<PayoutReceiptStatus>(['NONE', 'SUCCESS', 'FAILED'])
const ACTIONS = new Set(['approve', 'reject', 'register-receipt'])

function moneyAmount(value: unknown): number {
  if (value == null || value === '') return 0
  const n = num(value)
  if (!Number.isFinite(n)) return 0
  if (!Number.isInteger(n) || (n > 0 && n < 1000)) return Math.max(0, yuanToFen(value))
  return Math.max(0, n)
}

function asModule(value: unknown, fallback: WithdrawModule = 'wholesale'): WithdrawModule {
  const raw = str(value, fallback).toLowerCase()
  return MODULES.has(raw as WithdrawModule) ? (raw as WithdrawModule) : fallback
}

function asStatus(value: unknown, fallback: WithdrawStatus = 'PENDING_REVIEW'): WithdrawStatus {
  const raw = str(value, fallback).toUpperCase()
  return STATUSES.has(raw as WithdrawStatus) ? (raw as WithdrawStatus) : fallback
}

function asAccountType(value: unknown, fallback: WithdrawAccountType = 'PERSONAL'): WithdrawAccountType {
  const raw = str(value, fallback).toUpperCase()
  return ACCOUNT_TYPES.has(raw as WithdrawAccountType) ? (raw as WithdrawAccountType) : fallback
}

function asReceipt(value: unknown, fallback: PayoutReceiptStatus = 'NONE'): PayoutReceiptStatus {
  const raw = str(value, fallback).toUpperCase()
  return RECEIPTS.has(raw as PayoutReceiptStatus) ? (raw as PayoutReceiptStatus) : fallback
}

function mapPendingPolicy(raw: unknown): WithdrawalCatalog['pendingPolicy'] {
  const r = record(raw)
  return {
    note: str(r.note || r.message || r.remark, DEFAULT_PENDING_POLICY_NOTE),
    minAmountPending: true,
    feePolicyPending: true,
    autoPayoutPending: true,
  }
}

function mapAudit(raw: unknown, index = 0): WithdrawalAudit {
  const r = record(raw)
  const actionRaw = str(r.action || r.type, 'approve').toLowerCase().replace(/_/g, '-')
  const action = (ACTIONS.has(actionRaw) ? actionRaw : 'approve') as WithdrawalAudit['action']
  return {
    operationId: str(r.operationId || r.id || r.auditId, `wd-op-${index + 1}`),
    requestId: str(r.requestId || r.idempotencyKey),
    action,
    targetId: str(r.targetId || r.withdrawalId || r.applicationId),
    before: str(r.before || r.beforeState),
    after: str(r.after || r.afterState),
    reason: str(r.reason || r.remark),
    operatorId: str(r.operatorId || r.operatorAccountId),
    operatorName: str(r.operatorName || r.operator || r.createdByName),
    occurredAt: str(r.occurredAt || r.createdAt || r.operatedAt),
    beforeVersion: Math.max(0, num(r.beforeVersion, 0)),
    afterVersion: Math.max(0, num(r.afterVersion ?? r.version, 0)),
  }
}

type WithdrawalApplicationAllowed = ('approve' | 'reject' | 'register-receipt')[]

function mapAllowedActions(raw: unknown, status: WithdrawStatus, receipt: PayoutReceiptStatus): WithdrawalApplicationAllowed {
  const fromApi = arr(raw)
    .map((item) => str(item).toLowerCase().replace(/_/g, '-'))
    .filter((item) => ACTIONS.has(item)) as WithdrawalApplicationAllowed
  if (fromApi.length) return fromApi
  if (status === 'PENDING_REVIEW') return ['approve', 'reject']
  if (status === 'PROCESSING' || receipt === 'FAILED') return ['register-receipt']
  return []
}

export function mapWithdrawalApplication(raw: unknown) {
  const r = record(raw)
  const status = asStatus(r.status || r.withdrawStatus)
  const receipt = asReceipt(r.payoutReceiptStatus || r.receiptStatus)
  const amount = moneyAmount(r.amount ?? r.applyAmount)
  const fee = moneyAmount(r.fee ?? r.feeAmount ?? r.serviceFee)
  const netAmount = 'netAmount' in r || 'actualAmount' in r
    ? moneyAmount(r.netAmount ?? r.actualAmount)
    : Math.max(0, amount - fee)
  return {
    withdrawalId: str(r.withdrawalId || r.id || r.applicationId),
    title: str(r.title || r.subject || '提现申请'),
    module: asModule(r.module || r.bizModule || r.businessLine),
    identityLabel: str(r.identityLabel || r.identity || r.roleLabel || r.partnerLevelLabel),
    accountId: str(r.accountId || r.userId || r.ownerId),
    accountName: str(r.accountName || r.userName || r.name),
    phone: str(r.phone || r.mobile),
    amount,
    fee,
    netAmount,
    accountType: asAccountType(r.accountType || r.payeeType),
    payeeName: str(r.payeeName || r.receiverName || r.accountName),
    bankName: str(r.bankName || r.bank),
    maskedBankNumber: str(r.maskedBankNumber || r.bankCardMasked || r.cardNoMasked || r.bankAccount),
    status,
    payoutReceiptStatus: receipt,
    payoutFailureReason: nullableStr(r.payoutFailureReason ?? r.failureReason ?? r.receiptFailureReason),
    voucherUrl: nullableStr(r.voucherUrl ?? r.receiptUrl ?? r.proofUrl),
    rejectionReason: nullableStr(r.rejectionReason ?? r.rejectReason),
    relatedIncomeEntryIds: arr(r.relatedIncomeEntryIds || r.incomeEntryIds || r.relatedEntries).map((item) => str(item)).filter(Boolean),
    createdAt: str(r.createdAt || r.appliedAt),
    reviewedAt: nullableStr(r.reviewedAt ?? r.auditAt),
    receiptAt: nullableStr(r.receiptAt ?? r.payoutAt),
    version: Math.max(1, num(r.version, 1)),
    mockOnly: false,
    allowedActions: mapAllowedActions(r.allowedActions, status, receipt),
  }
}

function mapOptionList<T extends string>(
  raw: unknown,
  fallback: { value: T; label: string }[],
  normalize: (value: unknown) => T,
): { value: T; label: string }[] {
  const items = arr(raw)
    .map((item) => {
      const row = record(item)
      const value = normalize(row.value ?? row.id ?? row.code ?? item)
      const label = str(row.label || row.name || value)
      return { value, label }
    })
    .filter((item) => Boolean(item.value))
  return items.length ? items : fallback
}

/** Normalize HQ catalog so Withdrawals page always has pendingPolicy/modules/statuses/audit. */
export function mapWithdrawalCatalog(raw: unknown): WithdrawalCatalog {
  const r = record(raw)
  return {
    modules: mapOptionList(r.modules || r.bizModules || r.businessLines, DEFAULT_MODULES, (v) => asModule(v)),
    statuses: mapOptionList(r.statuses || r.statusList, DEFAULT_STATUSES, (v) => asStatus(v)),
    pendingPolicy: mapPendingPolicy(r.pendingPolicy ?? r.policy ?? r.feePolicy),
    payoutGapNote: str(r.payoutGapNote || r.gapNote || r.payoutNote, DEFAULT_PAYOUT_GAP),
    audit: arr(r.audit || r.audits || r.operations || r.logs || r.recentOperations).map(mapAudit),
    mockOnly: false,
  }
}

export function mapWithdrawalDetail(raw: unknown): WithdrawalDetail {
  const r = record(raw)
  const application = mapWithdrawalApplication(r.application ?? r.item ?? r)
  return {
    application,
    audit: arr(r.audit || r.audits || r.operations || r.history).map(mapAudit),
    payoutGapNote: str(r.payoutGapNote || r.gapNote || r.payoutNote, DEFAULT_PAYOUT_GAP),
    balanceNote: str(r.balanceNote || r.balanceHint, DEFAULT_BALANCE_NOTE),
  }
}

export async function realWithdrawalCatalog() {
  try {
    return cast(mapWithdrawalCatalog(await unwrapData(await api.getWithdrawalsCatalog())))
  } catch (error) {
    return mapHqError(error, WithdrawalError)
  }
}

export async function realWithdrawalList(query: WithdrawalQuery) {
  try {
    const page = asPage(await unwrapData(await api.getWithdrawals({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapWithdrawalApplication)
    const summary = record(page.summary)
    return cast({
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        applications: num(summary.applications ?? summary.total ?? page.total),
        pendingReview: num(summary.pendingReview ?? summary.pending),
        processing: num(summary.processing),
        succeeded: num(summary.succeeded ?? summary.success),
        rejected: num(summary.rejected),
        receiptFailed: num(summary.receiptFailed ?? summary.failedReceipt),
        pendingAmount: moneyAmount(summary.pendingAmount),
        succeededAmount: moneyAmount(summary.succeededAmount ?? summary.successAmount),
      },
    })
  } catch (error) {
    return mapHqError(error, WithdrawalError)
  }
}

export async function realWithdrawalDetail(withdrawalId: string) {
  try {
    return cast(mapWithdrawalDetail(await unwrapData(await api.getWithdrawalsByWithdrawalId({ withdrawalId }))))
  } catch (error) {
    return mapHqError(error, WithdrawalError)
  }
}

export async function realWithdrawalMutate(input: WithdrawalMutation) {
  try {
    const action = str((input as { action?: string }).action, 'approve')
    const withdrawalId = str(
      (input as { withdrawalId?: string }).withdrawalId ||
        (input as { applicationId?: string }).applicationId,
    )
    const body = mutationBody({
      ...record(input as never),
      action,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: (input as { version?: number }).version,
    })
    await unwrapData(await api.postWithdrawalsByWithdrawalIdMutate({ withdrawalId }, body as never))
    return realWithdrawalDetail(withdrawalId)
  } catch (error) {
    return mapHqError(error, WithdrawalError)
  }
}
