import type { HqAccount } from '../../types/auth'
import {
  TransferError,
  type MigrationStatus,
  type SideApprovalStatus,
  type TransferApplication,
  type TransferAudit,
  type TransferCatalog,
  type TransferDetail,
  type TransferMutation,
  type TransferMutationResult,
  type TransferPendingPolicy,
  type TransferQuery,
  type TransferOverallStatus,
} from '../../types/transfers'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: TransferError['code'], message: string): never => {
  throw new TransferError(code, message)
}
const now = () => new Date().toISOString()
const stamp = (day: number, hour = 10) => `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+08:00`

const pendingPolicy: TransferPendingPolicy = {
  unusedLessonsNote: '未用课时是否随学员迁移、是否清零或按比例折算，口径待定（映射文档 §7）；本页仅展示申请时快照，不作迁移裁决。',
  subsequentOrdersNote: '转店后的后续订单归属门店口径待定；本 Mock 不改写订单门店。',
  historicalFeedbackNote: '历史训练反馈查阅权限（原门店/新门店/双方可见）口径待定；本 Mock 不改反馈归属。',
  unsettledRevenueNote: '未结算收益是否随转店重挂口径待定；本 Mock 不改收益流水。',
  pending: true,
}

const stores = [
  { storeId: 'shop-1', name: '脑商训练营梧桐街店' },
  { storeId: 'shop-2', name: '脑商训练营桐柏路店' },
  { storeId: 'shop-3', name: '脑商训练营合肥店' },
  { storeId: 'shop-closed', name: '脑商训练营旧门店（已停业）' },
  { storeId: 'hq-service', name: '总部服务' },
]

const storeName = (id: string) => stores.find(s => s.storeId === id)?.name ?? id

function allowedActions(app: TransferApplication): TransferApplication['allowedActions'] {
  const actions: TransferApplication['allowedActions'] = ['add-note']
  if (app.status === 'PENDING' || (app.status === 'APPROVED' && app.migrationStatus === 'AWAITING_SERVER')) {
    actions.unshift('force-reject')
  }
  if (app.exceptionFlag === 'NONE') actions.push('flag-exception')
  else actions.push('clear-exception')
  if (app.status === 'APPROVED' && app.migrationStatus === 'AWAITING_SERVER') {
    actions.push('record-migration-receipt')
  }
  return actions
}

function refresh(app: TransferApplication): TransferApplication {
  const next = { ...app, allowedActions: [] as TransferApplication['allowedActions'] }
  next.allowedActions = allowedActions(next)
  return next
}

function sample(
  n: number,
  sourceApprovalStatus: SideApprovalStatus,
  targetApprovalStatus: SideApprovalStatus,
  overrides: Partial<TransferApplication> = {},
): TransferApplication {
  const status: TransferOverallStatus =
    sourceApprovalStatus === 'REJECTED' || targetApprovalStatus === 'REJECTED'
      ? 'REJECTED'
      : sourceApprovalStatus === 'APPROVED' && targetApprovalStatus === 'APPROVED'
        ? 'APPROVED'
        : 'PENDING'
  const migrationStatus: MigrationStatus =
    status === 'APPROVED' ? (overrides.migrationStatus ?? 'AWAITING_SERVER') : 'NOT_STARTED'
  const sourceStoreId = overrides.sourceStoreId ?? (n % 2 ? 'shop-1' : 'shop-2')
  const targetStoreId = overrides.targetStoreId ?? (n % 2 ? 'shop-2' : 'shop-3')
  const resolvedSource = overrides.sourceStoreId ?? sourceStoreId
  const resolvedTarget = overrides.targetStoreId ?? targetStoreId
  const resolvedStatus = overrides.status ?? status
  const resolvedMigration = overrides.migrationStatus ?? migrationStatus
  const base: TransferApplication = {
    applicationId: overrides.applicationId ?? `transfer-app-${n}`,
    type: 'TRANSFER',
    memberId: overrides.memberId ?? `member-${n}`,
    memberName: overrides.memberName ?? (['林小禾', '林小满', '陈子安', '陈一诺', '王悦', '赵晨', '周宁', '孙可'][n - 1] ?? `学员${n}`),
    displayId: overrides.displayId ?? `XY${String(n).padStart(5, '0')}`,
    applicantName: overrides.applicantName ?? (['李家长', '王家长', '陈家长', '赵家长', '周家长', '孙家长', '吴家长', '郑家长'][n - 1] ?? `申请人${n}`),
    reason: overrides.reason ?? '住址变更，就近上课',
    sourceStoreId: resolvedSource,
    sourceStoreName: storeName(resolvedSource),
    targetStoreId: resolvedTarget,
    targetStoreName: storeName(resolvedTarget),
    sourceApprovalStatus,
    targetApprovalStatus,
    status: resolvedStatus,
    migrationStatus: resolvedMigration,
    exceptionFlag: overrides.exceptionFlag ?? 'NONE',
    hqNote: overrides.hqNote ?? null,
    unusedTrainingLessons: overrides.unusedTrainingLessons ?? 8 + n,
    unusedSpecialLessons: overrides.unusedSpecialLessons ?? n % 3,
    appliedAt: overrides.appliedAt ?? stamp(n + 2),
    sourceReviewedAt: overrides.sourceReviewedAt ?? (sourceApprovalStatus === 'PENDING' ? null : stamp(n + 4, 11)),
    targetReviewedAt: overrides.targetReviewedAt ?? (targetApprovalStatus === 'PENDING' ? null : stamp(n + 4, 14)),
    reviewedAt: overrides.reviewedAt ?? (resolvedStatus === 'PENDING' ? null : stamp(n + 5)),
    rejectionReason: overrides.rejectionReason ?? (resolvedStatus === 'REJECTED' ? '门店侧未同意转店' : null),
    migrationReceiptAt: overrides.migrationReceiptAt ?? null,
    migrationReceiptNote: overrides.migrationReceiptNote ?? null,
    version: overrides.version ?? 1,
    mockOnly: true,
    allowedActions: [],
  }
  return refresh(base)
}

const applications: TransferApplication[] = [
  sample(1, 'PENDING', 'PENDING'),
  sample(2, 'APPROVED', 'PENDING', { reason: '工作调动，需转至桐柏路店' }),
  sample(3, 'PENDING', 'APPROVED', { reason: '孩子就读学校变更' }),
  sample(4, 'APPROVED', 'APPROVED', { reason: '双方已同意，待服务端迁移' }),
  sample(5, 'REJECTED', 'PENDING', { rejectionReason: '转出门店拒绝：本店课程尚未结清说明' }),
  sample(6, 'APPROVED', 'REJECTED', { rejectionReason: '转入门店拒绝：当前班额已满' }),
  sample(7, 'PENDING', 'PENDING', {
    sourceStoreId: 'shop-1',
    targetStoreId: 'hq-service',
    reason: '目标地区无可服务门店，申请总部服务',
    exceptionFlag: 'FLAGGED',
    hqNote: '异常：目标为总部服务，需人工确认是否允许',
  }),
  sample(8, 'APPROVED', 'APPROVED', {
    migrationStatus: 'RECEIPTED_SUCCESS',
    migrationReceiptAt: stamp(20, 16),
    migrationReceiptNote: '服务端回执：归属已迁移（演示登记，非前端执行）',
    reason: '已登记服务端迁移成功回执',
  }),
].map(refresh)

const audits: TransferAudit[] = []
const idempotency = new Map<string, { fingerprint: string; result: TransferMutationResult }>()

function matchQuery(app: TransferApplication, q: TransferQuery) {
  if (q.status && app.status !== q.status) return false
  if (q.migrationStatus && app.migrationStatus !== q.migrationStatus) return false
  if (q.exceptionFlag && app.exceptionFlag !== q.exceptionFlag) return false
  if (q.sourceStoreId && app.sourceStoreId !== q.sourceStoreId) return false
  if (q.targetStoreId && app.targetStoreId !== q.targetStoreId) return false
  if (q.keyword) {
    const k = q.keyword.trim().toLowerCase()
    const blob = `${app.applicationId} ${app.memberName} ${app.displayId} ${app.applicantName} ${app.sourceStoreName} ${app.targetStoreName} ${app.reason}`.toLowerCase()
    if (!blob.includes(k)) return false
  }
  return true
}

export function mockTransferCatalog(): TransferCatalog {
  return copy({
    stores: stores.map(s => ({ ...s })),
    statuses: [
      { value: 'PENDING', label: '待双边审核' },
      { value: 'APPROVED', label: '双方已同意' },
      { value: 'REJECTED', label: '已拒绝' },
    ],
    migrationStatuses: [
      { value: 'NOT_STARTED', label: '未进入迁移' },
      { value: 'AWAITING_SERVER', label: '待服务端迁移' },
      { value: 'RECEIPTED_SUCCESS', label: '已登记迁移成功回执' },
      { value: 'RECEIPTED_FAILED', label: '已登记迁移失败回执' },
    ],
    pendingPolicy,
    audit: audits.slice(0, 50),
    mockOnly: true,
  })
}

export function mockTransferList(q: TransferQuery) {
  const filtered = applications.filter(app => matchQuery(app, q))
  const page = Math.max(1, q.page || 1)
  const pageSize = Math.min(50, Math.max(1, q.pageSize || 10))
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize).map(refresh)
  return copy({
    items,
    total: filtered.length,
    page,
    pageSize,
    summary: {
      applications: applications.length,
      pending: applications.filter(a => a.status === 'PENDING').length,
      bilateralApproved: applications.filter(a => a.status === 'APPROVED').length,
      rejected: applications.filter(a => a.status === 'REJECTED').length,
      awaitingMigration: applications.filter(a => a.migrationStatus === 'AWAITING_SERVER').length,
      exceptions: applications.filter(a => a.exceptionFlag === 'FLAGGED').length,
    },
  })
}

export function mockTransferDetail(applicationId: string): TransferDetail {
  const application = applications.find(a => a.applicationId === applicationId) ?? fail('NOT_FOUND', '转店申请不存在')
  return copy({
    application: refresh(application),
    audit: audits.filter(a => a.targetId === applicationId),
    pendingPolicy,
    migrationHint: '转店须转出和转入双方同意；实际归属迁移由服务端执行。前端只反映审批与回执状态，不伪造已迁移。',
  })
}

function pushAudit(
  account: HqAccount,
  action: TransferMutation['action'],
  targetId: string,
  requestId: string,
  beforeVersion: number,
  afterVersion: number,
  reason: string,
  before: string,
  after: string,
) {
  audits.unshift({
    operationId: `transfer-audit-${audits.length + 1}`,
    requestId,
    action,
    targetId,
    before,
    after,
    reason,
    operatorId: account.accountId,
    operatorName: account.nickname,
    occurredAt: now(),
    beforeVersion,
    afterVersion,
  })
}

export function mockTransferMutate(input: TransferMutation, account: HqAccount): TransferMutationResult {
  const reason = String(input.reason || '').trim()
  if (!reason || Array.from(reason).length > 200) fail('INVALID_INPUT', '操作原因须填写 1—200 字')
  if (!input.idempotencyKey) fail('INVALID_INPUT', '缺少幂等请求号')

  const fingerprint = JSON.stringify(input)
  const previous = idempotency.get(input.idempotencyKey)
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', '相同请求号参数不一致')
    return copy(previous.result)
  }

  const app = applications.find(a => a.applicationId === input.applicationId) ?? fail('NOT_FOUND', '转店申请不存在')
  if (app.version !== input.version) fail('VERSION_CONFLICT', '申请状态已变化，请刷新后重试')

  const beforeVersion = app.version
  const beforeSnap = JSON.stringify({
    status: app.status,
    sourceApprovalStatus: app.sourceApprovalStatus,
    targetApprovalStatus: app.targetApprovalStatus,
    migrationStatus: app.migrationStatus,
    exceptionFlag: app.exceptionFlag,
    hqNote: app.hqNote,
  })

  let result: TransferMutationResult

  if (input.action === 'force-reject') {
    if (app.status === 'REJECTED') fail('INVALID_STATE', '申请已拒绝，无需再次仲裁拒绝')
    if (app.migrationStatus === 'RECEIPTED_SUCCESS') fail('INVALID_STATE', '已登记迁移成功回执，不能再仲裁拒绝；请走服务端冲正流程')
    app.status = 'REJECTED'
    app.rejectionReason = reason
    app.reviewedAt = now()
    app.migrationStatus = 'NOT_STARTED'
    app.version += 1
    result = { action: 'force-reject', application: refresh(app), mockOnly: true }
  } else if (input.action === 'flag-exception') {
    if (app.exceptionFlag === 'FLAGGED') fail('INVALID_STATE', '已标记异常')
    app.exceptionFlag = 'FLAGGED'
    app.hqNote = reason
    app.version += 1
    result = { action: 'flag-exception', application: refresh(app), mockOnly: true }
  } else if (input.action === 'clear-exception') {
    if (app.exceptionFlag !== 'FLAGGED') fail('INVALID_STATE', '当前未标记异常')
    app.exceptionFlag = 'NONE'
    app.version += 1
    result = { action: 'clear-exception', application: refresh(app), mockOnly: true }
  } else if (input.action === 'add-note') {
    const note = String(input.note || '').trim()
    if (!note || Array.from(note).length > 200) fail('INVALID_INPUT', '监管备注须填写 1—200 字')
    app.hqNote = note
    app.version += 1
    result = { action: 'add-note', application: refresh(app), mockOnly: true }
  } else if (input.action === 'record-migration-receipt') {
    if (app.status !== 'APPROVED') fail('INVALID_STATE', '仅双方已同意的申请可登记迁移回执')
    if (app.migrationStatus !== 'AWAITING_SERVER') fail('INVALID_STATE', '当前不处于待服务端迁移状态')
    const receiptNote = String(input.receiptNote || '').trim()
    if (!receiptNote || Array.from(receiptNote).length > 200) fail('INVALID_INPUT', '回执说明须填写 1—200 字')
    app.migrationStatus = input.receipt === 'SUCCESS' ? 'RECEIPTED_SUCCESS' : 'RECEIPTED_FAILED'
    app.migrationReceiptAt = now()
    app.migrationReceiptNote = receiptNote
    app.version += 1
    result = { action: 'record-migration-receipt', application: refresh(app), mockOnly: true }
  } else {
    return fail('INVALID_INPUT', '未知操作')
  }

  pushAudit(
    account,
    input.action,
    app.applicationId,
    input.idempotencyKey,
    beforeVersion,
    app.version,
    reason,
    beforeSnap,
    JSON.stringify({
      status: app.status,
      sourceApprovalStatus: app.sourceApprovalStatus,
      targetApprovalStatus: app.targetApprovalStatus,
      migrationStatus: app.migrationStatus,
      exceptionFlag: app.exceptionFlag,
      hqNote: app.hqNote,
    }),
  )

  idempotency.set(input.idempotencyKey, { fingerprint, result: copy(result) })
  return copy(result)
}
