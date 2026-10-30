# -*- coding: utf-8 -*-
from pathlib import Path
ROOT = Path(r"E:\project\react-web\naoshang-front-react\src\services\real")

invitations = r'''import * as api from '../../api'
import { InvitationError, type InvitationMutation, type InvitationQuery, type InvitationTeamQuery } from '../../types/invitations'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, record, str, unwrapData } from './bridge'

function mapAccount(raw: unknown) {
  const r = record(raw)
  const accountId = str(r.accountId || r.id)
  const phone = str(r.phone || r.mobile)
  return {
    accountId,
    displayId: str(r.displayId || r.userNo || accountId),
    name: str(r.name || r.nickname || phone || accountId || '未命名'),
    phone,
    frozen: bool(r.frozen ?? r.isFrozen ?? (str(r.status).toUpperCase() === 'FROZEN')),
  }
}

function mapAccountOrNull(raw: unknown) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const id = raw.trim()
    if (!id) return null
    return { accountId: id, displayId: id, name: id, phone: '', frozen: false }
  }
  const mapped = mapAccount(raw)
  return mapped.accountId ? mapped : null
}

function mapInitialBinding(raw: unknown, superior: ReturnType<typeof mapAccountOrNull>) {
  const r = record(raw)
  const inviteCode = r.inviteCode == null || r.inviteCode === '' ? null : str(r.inviteCode)
  const source = str(r.source, inviteCode || superior ? 'REGISTRATION_INVITE' : 'NO_INVITE')
  return {
    source: (source === 'REGISTRATION_INVITE' ? 'REGISTRATION_INVITE' : 'NO_INVITE') as 'REGISTRATION_INVITE' | 'NO_INVITE',
    inviteCode,
    superior: mapAccountOrNull(r.superior) ?? superior,
    boundAt: str(r.boundAt || r.createdAt || r.effectiveAt),
    mockOnly: false,
  }
}

function mapRelation(raw: unknown) {
  const r = record(raw)
  const account = mapAccount(r.account ?? r)
  const superior = mapAccountOrNull(r.superior ?? r.parent ?? r.inviter)
  const inviteCode = str(r.inviteCode || r.code)
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'rebind' | 'unbind' => item === 'rebind' || item === 'unbind')
    : (['rebind', 'unbind'] as const)
  ) as ('rebind' | 'unbind')[]
  return {
    account,
    superior,
    inviteCode,
    initialBinding: mapInitialBinding(r.initialBinding ?? r.binding, superior),
    version: num(r.version, 1),
    graphVersion: num(r.graphVersion ?? r.relationVersion, 1),
    effectiveAt: str(r.effectiveAt || r.updatedAt || r.createdAt),
    directCount: num(r.directCount ?? r.directInviteCount),
    teamCount: num(r.teamCount ?? r.teamInviteCount),
    allowedActions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  const actionRaw = str(r.action, 'rebind')
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    account: mapAccount(r.account ?? r),
    action: (actionRaw === 'unbind' ? 'unbind' : 'rebind') as 'rebind' | 'unbind',
    before: mapAccountOrNull(r.before),
    after: mapAccountOrNull(r.after),
    reason: str(r.reason),
    operatorName: str(r.operatorName || r.operator),
    effectiveAt: str(r.effectiveAt || r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version, 1),
    graphVersion: num(r.graphVersion, 1),
  }
}

function mapDetail(raw: unknown) {
  const r = record(raw)
  const relation = mapRelation(r.relation ?? r)
  return {
    relation,
    ancestors: arr(r.ancestors ?? r.parents).map(mapAccount).filter((item) => item.accountId),
    history: arr(r.history ?? r.audit ?? r.audits).map(mapAudit),
  }
}

function mapTeam(raw: unknown, query: InvitationTeamQuery) {
  const page = asPage(raw, query.page, query.pageSize)
  const summary = record(page.summary)
  const items = page.items.map((item) => {
    const row = record(item)
    return {
      account: mapAccount(row.account ?? row),
      superior: mapAccountOrNull(row.superior),
      depth: num(row.depth, query.scope === 'DIRECT' ? 1 : 1),
    }
  })
  return {
    items,
    total: page.total,
    directCount: num(summary.directCount ?? page.raw.directCount, items.filter((i) => i.depth === 1).length),
    teamCount: num(summary.teamCount ?? page.raw.teamCount, page.total),
    graphVersion: num(summary.graphVersion ?? page.raw.graphVersion, 1),
  }
}

export async function realInvitationList(query: InvitationQuery) {
  try {
    const page = asPage(await unwrapData(await api.getInvitations({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapRelation)
    const summary = record(page.summary)
    return cast({
      items,
      total: page.total,
      summary: {
        accounts: num(summary.accounts, page.total),
        bound: num(summary.bound, items.filter((i) => !!i.superior).length),
        unbound: num(summary.unbound, items.filter((i) => !i.superior).length),
      },
    })
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationDetail(accountId: string) {
  try { return cast(mapDetail(await unwrapData(await api.getInvitationsByAccountId({ accountId })))) }
  catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationTeam(query: InvitationTeamQuery) {
  try {
    return cast(mapTeam(await unwrapData(await api.getInvitationsByAccountIdTeam({ accountId: query.accountId }, { ...query } as never)), query))
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationCandidates(accountId: string, keyword = '') {
  try {
    const page = asPage(await unwrapData(await api.getInvitations({ keyword, page: 1, pageSize: 50 } as never)))
    return cast(page.items.map(mapRelation).filter((i) => i.account.accountId !== accountId).map((i) => i.account))
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationMutate(input: InvitationMutation) {
  try {
    const body = mutationBody({ ...record(input as never), action: str((input as { action?: string }).action, 'bind'), reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    await unwrapData(await api.postInvitationsMutate(body as never))
    const accountId = str((input as { accountId?: string }).accountId)
    return accountId ? realInvitationDetail(accountId) : realInvitationList({ page: 1, pageSize: 20 } as InvitationQuery)
  } catch (error) { return mapHqError(error, InvitationError) }
}
'''

transfers = r'''import * as api from '../../api'
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
'''

support = r'''import * as api from '../../api'
import { SupportError, type SupportFeedbackQuery, type SupportMutation } from '../../types/support'
import { arr, asPage, bool, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData } from './bridge'

function mapRichContent(raw: unknown, bodyText: string) {
  const r = record(raw)
  const blocks = arr(r.blocks)
  if (blocks.length) {
    return {
      blocks: blocks.map((item, index) => {
        const row = record(item)
        return {
          id: str(row.id, `b${index + 1}`),
          type: str(row.type, 'paragraph') as never,
          text: str(row.text ?? row.content ?? (typeof item === 'string' ? item : '')),
          ...row,
        }
      }),
    }
  }
  return {
    blocks: bodyText
      ? [{ id: 'p1', type: 'paragraph' as const, text: bodyText }]
      : [],
  }
}

function mapAgreement(raw: unknown) {
  const r = record(raw)
  const typeRaw = str(r.type, 'user').toLowerCase()
  const type = (typeRaw.includes('privacy') ? 'privacy' : 'user') as 'user' | 'privacy'
  const statusRaw = str(r.status, 'DRAFT').toUpperCase()
  const status = (statusRaw === 'PUBLISHED' || statusRaw === 'OFFLINE' ? statusRaw : 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  const bodyText = str(r.bodyText || r.body || r.contentText)
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw
    : status === 'PUBLISHED'
      ? ['save-agreement', 'offline-agreement']
      : ['save-agreement', 'publish-agreement']) as never
  return {
    agreementId: str(r.agreementId || r.id),
    type,
    title: str(r.title, type === 'privacy' ? '隐私政策' : '用户协议'),
    docVersion: str(r.docVersion || r.versionLabel || r.docVer),
    bodyText,
    content: mapRichContent(r.content, bodyText),
    status,
    version: num(r.version, 1),
    publishedAt: nullableStr(r.publishedAt),
    updatedAt: str(r.updatedAt || r.modifiedAt || r.createdAt),
    mockOnly: false,
    allowedActions,
  }
}

function mapSupportConfig(raw: unknown) {
  const r = record(raw)
  return {
    phone: str(r.phone || r.hotline || r.contactPhone),
    description: str(r.description || r.desc || r.tip),
    feedbackMaxImages: num(r.feedbackMaxImages ?? r.maxImages, 3),
    fullCustomerServicePending: true as const,
    version: num(r.version, 1),
    updatedAt: str(r.updatedAt || r.modifiedAt),
    mockOnly: false,
  }
}

function mapFeedback(raw: unknown) {
  const r = record(raw)
  const statusRaw = str(r.status, 'OPEN').toUpperCase()
  const status = (statusRaw === 'HANDLED' || statusRaw === 'CLOSED' || statusRaw === 'DONE' ? 'HANDLED' : 'OPEN') as 'OPEN' | 'HANDLED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item) => item === 'mark-feedback-handled')
    : status === 'OPEN' ? ['mark-feedback-handled'] : []) as ('mark-feedback-handled')[]
  return {
    feedbackId: str(r.feedbackId || r.ticketId || r.id),
    accountId: str(r.accountId || r.userId),
    accountName: str(r.accountName || r.userName || r.nickname || r.name),
    phone: str(r.phone || r.mobile),
    content: str(r.content || r.body || r.message),
    imageCount: num(r.imageCount ?? arr(r.images).length),
    status,
    createdAt: str(r.createdAt),
    handledAt: nullableStr(r.handledAt),
    handleNote: nullableStr(r.handleNote || r.note),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  const agreements = arr(r.agreements).map(mapAgreement)
  const feedbackSummary = record(r.feedbackSummary)
  return {
    agreements,
    supportConfig: mapSupportConfig(r.supportConfig ?? r.config ?? r.contact),
    feedbackSummary: {
      total: num(feedbackSummary.total),
      open: num(feedbackSummary.open),
      handled: num(feedbackSummary.handled),
    },
    fullCsGapNote: str(r.fullCsGapNote, '完整在线客服/工单流转尚未实现，本页仅协议发布与反馈查阅预留。'),
    agreementNote: str(r.agreementNote, '协议发布后供小程序阅读；草稿不影响线上版本。'),
    mockOnly: false,
  }
}

export async function realSupportCatalog() {
  try { return cast(mapCatalog(await unwrapData(await api.getSupportCatalog()))) }
  catch (error) { return mapHqError(error, SupportError) }
}

export async function realSupportFeedbackList(query: SupportFeedbackQuery) {
  try {
    const page = asPage(await unwrapData(await api.getSupportTickets({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapFeedback),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, SupportError) }
}

export async function realSupportMutate(input: SupportMutation) {
  try {
    const action = str((input as { action?: string }).action, 'reply')
    const ticketId = str((input as { ticketId?: string }).ticketId || (input as { feedbackId?: string }).feedbackId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    if (!ticketId) {
      await unwrapData(await api.postSupportTickets(body as never))
      return cast({ action: action as never, mockOnly: false, message: '已提交', catalog: await realSupportCatalog() })
    }
    await unwrapData(await api.postSupportTicketsByTicketIdMutate({ ticketId }, body as never))
    return cast({ action: action as never, mockOnly: false, message: '已提交', catalog: await realSupportCatalog() })
  } catch (error) { return mapHqError(error, SupportError) }
}
'''

trace = r'''import * as api from '../../api'
import { TraceError, type TraceAuditQuery, type TraceMutation, type TraceResourceQuery, type TraceTaskQuery } from '../../types/trace'
import { arr, asPage, cast, mapHqError, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

function mapResource(raw: unknown) {
  const r = record(raw)
  const assetId = str(r.assetId || r.fileId || r.id)
  const statusRaw = str(r.status, 'PENDING').toUpperCase()
  const status = (['PENDING', 'READY', 'FAILED', 'QUARANTINED'].includes(statusRaw) ? statusRaw : 'PENDING') as 'PENDING' | 'READY' | 'FAILED' | 'QUARANTINED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'quarantine-resource' | 'restore-resource' => item === 'quarantine-resource' || item === 'restore-resource')
    : status === 'QUARANTINED' ? ['restore-resource'] : ['quarantine-resource']) as ('quarantine-resource' | 'restore-resource')[]
  return {
    assetId,
    fileId: str(r.fileId || assetId),
    purpose: str(r.purpose || r.bizType || r.scene),
    mimeType: str(r.mimeType || r.contentType || r.mime),
    fileName: str(r.fileName || r.name || r.originalName),
    sizeBytes: num(r.sizeBytes ?? r.size ?? r.fileSize),
    status,
    ownerAccountId: str(r.ownerAccountId || r.accountId || r.uploaderId),
    ownerName: str(r.ownerName || r.accountName || r.uploaderName),
    previewUrl: nullableStr(r.previewUrl ?? r.url ?? r.cdnUrl),
    boundHint: nullableStr(r.boundHint ?? r.bindHint ?? r.boundTo),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt || r.modifiedAt || r.createdAt),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapTask(raw: unknown) {
  const r = record(raw)
  const kindRaw = str(r.kind || r.type, 'OTHER').toUpperCase()
  const kind = (['UPLOAD_PROCESS', 'MATERIAL_COMPOSE', 'EXPORT', 'OTHER'].includes(kindRaw) ? kindRaw : 'OTHER') as 'UPLOAD_PROCESS' | 'MATERIAL_COMPOSE' | 'EXPORT' | 'OTHER'
  const statusRaw = str(r.status, 'PROCESSING').toUpperCase()
  const status = (statusRaw === 'SUCCEEDED' || statusRaw === 'SUCCESS' ? 'SUCCEEDED' : statusRaw === 'FAILED' || statusRaw === 'ERROR' ? 'FAILED' : 'PROCESSING') as 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'retry-task' => item === 'retry-task')
    : status === 'FAILED' ? ['retry-task'] : []) as ('retry-task')[]
  const moduleRaw = str(r.relatedModule || r.module, 'other').toLowerCase()
  const relatedModule = ([
    'users', 'members', 'materials', 'support', 'withdrawals', 'payments', 'orders', 'training', 'assets', 'other',
  ].includes(moduleRaw) ? moduleRaw : 'other') as never
  return {
    jobId: str(r.jobId || r.id || r.taskId),
    kind,
    title: str(r.title || r.name || kind),
    relatedAssetId: nullableStr(r.relatedAssetId ?? r.assetId),
    relatedModule,
    status,
    resultSummary: str(r.resultSummary || r.summary || r.result || r.message),
    createdAt: str(r.createdAt),
    completedAt: nullableStr(r.completedAt ?? r.finishedAt),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  const moduleRaw = str(r.module, 'other').toLowerCase()
  const module = ([
    'users', 'members', 'materials', 'support', 'withdrawals', 'payments', 'orders', 'training', 'assets', 'other',
  ].includes(moduleRaw) ? moduleRaw : 'other') as never
  return {
    entryId: str(r.entryId || r.id || r.operationId),
    module,
    action: str(r.action),
    targetId: str(r.targetId || r.resourceId || r.assetId),
    summary: str(r.summary || r.title || r.message),
    before: str(r.before),
    after: str(r.after),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    requestId: str(r.requestId),
    occurredAt: str(r.occurredAt || r.createdAt),
    source: 'AGGREGATED_MOCK' as const,
    mockOnly: boolish(r.mockOnly, true),
  }
}

function boolish(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return fallback
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  const resourceSummary = record(r.resourceSummary)
  const taskSummary = record(r.taskSummary)
  const auditSummary = record(r.auditSummary)
  return {
    resourceSummary: {
      total: num(resourceSummary.total),
      pending: num(resourceSummary.pending),
      ready: num(resourceSummary.ready),
      failed: num(resourceSummary.failed),
      quarantined: num(resourceSummary.quarantined),
    },
    taskSummary: {
      total: num(taskSummary.total),
      processing: num(taskSummary.processing),
      succeeded: num(taskSummary.succeeded),
      failed: num(taskSummary.failed),
    },
    auditSummary: { total: num(auditSummary.total) },
    uploadContractNote: str(r.uploadContractNote, '上传三步契约：申请上传 → 直传 → 确认；本台仅展示资源与任务状态。'),
    unifiedAuditGapNote: str(r.unifiedAuditGapNote, '统一审计为聚合只读台；不改写各业务模块存储。'),
    noTicketNote: str(r.noTicketNote, '本模块不做业务工单系统。'),
    mockOnly: false,
  }
}

export async function realTraceCatalog() {
  try { return cast(mapCatalog(await unwrapData(await api.getTraceCatalog()))) }
  catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceResourceList(query: TraceResourceQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query, kind: 'resource' } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapResource),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceTaskList(query: TraceTaskQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query, kind: 'task' } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapTask),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceAuditList(query: TraceAuditQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapAudit),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceMutate(_input: TraceMutation) {
  return unsupported(TraceError, 'mutate', 'HQ trace API 为只读审计，不支持写操作')
}
'''

for name, content in [
    ('invitations.ts', invitations),
    ('transfers.ts', transfers),
    ('support.ts', support),
    ('trace.ts', trace),
]:
    path = ROOT / name
    path.write_text(content, encoding='utf-8')
    print(f'wrote {name} ({len(content)} bytes)')
