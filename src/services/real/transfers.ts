import * as api from '../../api'
import { TransferError, type TransferMutation, type TransferQuery } from '../../types/transfers'
import { arr, asPage, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData } from './bridge'

const DEFAULT_POLICY = {
  unusedLessonsNote: '未用课时迁移口径待服务端确认',
  subsequentOrdersNote: '后续订单归属口径待服务端确认',
  historicalFeedbackNote: '历史反馈查阅口径待服务端确认',
  unsettledRevenueNote: '未结算收益迁移口径待服务端确认',
  pending: true as const,
}

function mapPolicy(raw: unknown) {
  const r = record(raw)
  return {
    unusedLessonsNote: str(r.unusedLessonsNote, DEFAULT_POLICY.unusedLessonsNote),
    subsequentOrdersNote: str(r.subsequentOrdersNote, DEFAULT_POLICY.subsequentOrdersNote),
    historicalFeedbackNote: str(r.historicalFeedbackNote, DEFAULT_POLICY.historicalFeedbackNote),
    unsettledRevenueNote: str(r.unsettledRevenueNote, DEFAULT_POLICY.unsettledRevenueNote),
    pending: true as const,
  }
}

function mapApplication(raw: unknown) {
  const r = record(raw)
  const statusRaw = str(r.status || r.overallStatus, 'PENDING').toUpperCase()
  const status = (statusRaw === 'APPROVED' || statusRaw === 'REJECTED' ? statusRaw : 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED'
  const sourceApproval = str(r.sourceApprovalStatus || r.fromApprovalStatus, status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING').toUpperCase()
  const targetApproval = str(r.targetApprovalStatus || r.toApprovalStatus, status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING').toUpperCase()
  const migrationRaw = str(r.migrationStatus, 'NOT_STARTED').toUpperCase()
  const migrationStatus = (['NOT_STARTED', 'AWAITING_SERVER', 'RECEIPTED_SUCCESS', 'RECEIPTED_FAILED'].includes(migrationRaw)
    ? migrationRaw
    : 'NOT_STARTED') as 'NOT_STARTED' | 'AWAITING_SERVER' | 'RECEIPTED_SUCCESS' | 'RECEIPTED_FAILED'
  const exceptionRaw = str(r.exceptionFlag || r.exception, 'NONE').toUpperCase()
  const exceptionFlag = (exceptionRaw === 'FLAGGED' ? 'FLAGGED' : 'NONE') as 'NONE' | 'FLAGGED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw
    : (status === 'PENDING'
      ? ['force-reject', 'flag-exception', 'add-note']
      : exceptionFlag === 'FLAGGED'
        ? ['clear-exception', 'add-note', 'record-migration-receipt']
        : ['flag-exception', 'add-note', 'record-migration-receipt'])) as never
  return {
    applicationId: str(r.applicationId || r.id),
    type: 'TRANSFER' as const,
    memberId: str(r.memberId || r.accountId),
    memberName: str(r.memberName || r.accountName || r.name),
    displayId: str(r.displayId || r.memberDisplayId || r.memberId || r.accountId),
    applicantName: str(r.applicantName || r.memberName || r.accountName),
    reason: str(r.reason),
    sourceStoreId: str(r.sourceStoreId || r.fromStoreId),
    sourceStoreName: str(r.sourceStoreName || r.fromStoreName),
    targetStoreId: str(r.targetStoreId || r.toStoreId),
    targetStoreName: str(r.targetStoreName || r.toStoreName),
    sourceApprovalStatus: (['PENDING', 'APPROVED', 'REJECTED'].includes(sourceApproval) ? sourceApproval : 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
    targetApprovalStatus: (['PENDING', 'APPROVED', 'REJECTED'].includes(targetApproval) ? targetApproval : 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
    status,
    migrationStatus,
    exceptionFlag,
    hqNote: nullableStr(r.hqNote ?? r.note),
    unusedTrainingLessons: num(r.unusedTrainingLessons ?? r.unusedLessons),
    unusedSpecialLessons: num(r.unusedSpecialLessons),
    appliedAt: str(r.appliedAt || r.createdAt),
    sourceReviewedAt: nullableStr(r.sourceReviewedAt),
    targetReviewedAt: nullableStr(r.targetReviewedAt),
    reviewedAt: nullableStr(r.reviewedAt),
    rejectionReason: nullableStr(r.rejectionReason),
    migrationReceiptAt: nullableStr(r.migrationReceiptAt),
    migrationReceiptNote: nullableStr(r.migrationReceiptNote),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action: str(r.action, 'add-note') as never,
    targetId: str(r.targetId || r.applicationId),
    before: str(r.before),
    after: str(r.after),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    occurredAt: str(r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version, 1),
  }
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  return {
    stores: arr(r.stores).map((item) => {
      const row = record(item)
      return { storeId: str(row.storeId || row.id), name: str(row.name) }
    }),
    statuses: arr(r.statuses).length ? arr(r.statuses).map((item) => {
      const row = record(item)
      return { value: str(row.value || row.id) as never, label: str(row.label || row.name) }
    }) : [
      { value: 'PENDING' as const, label: '待双方审核' },
      { value: 'APPROVED' as const, label: '双方已同意' },
      { value: 'REJECTED' as const, label: '已拒绝' },
    ],
    migrationStatuses: arr(r.migrationStatuses).length ? arr(r.migrationStatuses).map((item) => {
      const row = record(item)
      return { value: str(row.value || row.id) as never, label: str(row.label || row.name) }
    }) : [
      { value: 'NOT_STARTED' as const, label: '未开始迁移' },
      { value: 'AWAITING_SERVER' as const, label: '等待服务端执行' },
      { value: 'RECEIPTED_SUCCESS' as const, label: '迁移成功回执' },
      { value: 'RECEIPTED_FAILED' as const, label: '迁移失败回执' },
    ],
    pendingPolicy: mapPolicy(r.pendingPolicy ?? r.policy),
    audit: arr(r.audit ?? r.audits).map(mapAudit),
    mockOnly: false,
  }
}

function mapDetail(raw: unknown) {
  const r = record(raw)
  return {
    application: mapApplication(r.application ?? r),
    audit: arr(r.audit ?? r.audits).map(mapAudit),
    pendingPolicy: mapPolicy(r.pendingPolicy ?? r.policy),
    migrationHint: str(r.migrationHint, '双方同意不等于已迁移；须等待服务端迁移回执。'),
  }
}

export async function realTransferCatalog() {
  try { return cast(mapCatalog(await unwrapData(await api.getTransfersCatalog()))) }
  catch (error) { return mapHqError(error, TransferError) }
}

export async function realTransferList(query: TransferQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTransfers({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapApplication)
    const summary = record(page.summary)
    return cast({
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        applications: num(summary.applications, page.total),
        pending: num(summary.pending, items.filter((i) => i.status === 'PENDING').length),
        bilateralApproved: num(summary.bilateralApproved, items.filter((i) => i.status === 'APPROVED').length),
        rejected: num(summary.rejected, items.filter((i) => i.status === 'REJECTED').length),
        awaitingMigration: num(summary.awaitingMigration, items.filter((i) => i.migrationStatus === 'AWAITING_SERVER').length),
        exceptions: num(summary.exceptions, items.filter((i) => i.exceptionFlag === 'FLAGGED').length),
      },
    })
  } catch (error) { return mapHqError(error, TransferError) }
}

export async function realTransferDetail(applicationId: string) {
  try { return cast(mapDetail(await unwrapData(await api.getTransfersByApplicationId({ applicationId })))) }
  catch (error) { return mapHqError(error, TransferError) }
}

export async function realTransferMutate(input: TransferMutation) {
  try {
    const actionMap: Record<string, string> = {
      'force-reject': 'reject',
      'flag-exception': 'reject',
      'clear-exception': 'approve',
      'add-note': 'approve',
      'record-migration-receipt': 'complete',
      approve: 'approve',
      reject: 'reject',
      complete: 'complete',
      cancel: 'cancel',
    }
    const uiAction = str((input as { action?: string }).action, 'approve')
    const action = actionMap[uiAction] || 'approve'
    const applicationId = str((input as { applicationId?: string }).applicationId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    await unwrapData(await api.postTransfersByApplicationIdMutate({ applicationId }, body as never))
    return realTransferDetail(applicationId)
  } catch (error) { return mapHqError(error, TransferError) }
}
