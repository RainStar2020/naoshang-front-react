import * as api from '../../api'
import {
  PartnerError,
  partnerLevels,
  type PartnerAudit,
  type PartnerCatalog,
  type PartnerDetail,
  type PartnerLevel,
  type PartnerLevelBenefits,
  type PartnerList,
  type PartnerMutation,
  type PartnerProfile,
  type PartnerPromotionTask,
  type PartnerQuery,
  type PartnerReceipt,
} from '../../types/partners'
import type { RichContent } from '../../types/cms'
import { arr, asPage, bool, cast, mapHqError, mutationBody, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

const LEVEL_SET = new Set<string>(partnerLevels)
const PROFILE_STATUSES = new Set(['ACTIVE', 'FROZEN', 'EXPIRED', 'PENDING_ANNUAL'])
const ANNUAL_STATUSES = new Set(['ACTIVE', 'EXPIRED', 'NOT_OPEN'])
const TASK_STATUSES = new Set(['IN_PROGRESS', 'READY', 'PROCESSING', 'COMPLETED', 'EXPIRED', 'SUPERSEDED'])
const RECEIPT_STATUSES = new Set(['PROCESSING', 'SUCCEEDED', 'FAILED'])
const RECEIPT_SOURCES = new Set(['HQ_MANUAL', 'USER_TASK'])
const AUDIT_ACTIONS = new Set(['upgrade', 'save-benefits', 'save-level-names', 'task-promotion'])
const ALLOWED_ACTIONS = new Set(['manual-upgrade', 'claim-promotion'])

const LEVEL_DEFAULTS: Record<PartnerLevel, { title: string; wholesaleLabel: string; quotaOccupancy: number; nextLevel: PartnerLevel | null; taskTarget: number | null }> = {
  'DEMO-VIP': { title: 'VIP', wholesaleLabel: '小批', quotaOccupancy: 1, nextLevel: 'DEMO-ANGEL', taskTarget: 3 },
  'DEMO-ANGEL': { title: '天使', wholesaleLabel: '中批', quotaOccupancy: 3, nextLevel: 'DEMO-BOARD', taskTarget: 9 },
  'DEMO-BOARD': { title: '私董', wholesaleLabel: '大批', quotaOccupancy: 6, nextLevel: 'DEMO-FOUNDER', taskTarget: 18 },
  'DEMO-FOUNDER': { title: '联创', wholesaleLabel: '总批', quotaOccupancy: 24, nextLevel: null, taskTarget: null },
}

function emptyContent(): RichContent {
  return { version: 1, format: 'nodes', nodes: [] }
}

function asLevel(value: unknown, fallback: PartnerLevel = 'DEMO-VIP'): PartnerLevel {
  const raw = str(value, fallback).toUpperCase().replace(/_/g, '-')
  const aliases: Record<string, PartnerLevel> = {
    VIP: 'DEMO-VIP',
    'DEMO-VIP': 'DEMO-VIP',
    ANGEL: 'DEMO-ANGEL',
    'DEMO-ANGEL': 'DEMO-ANGEL',
    BOARD: 'DEMO-BOARD',
    'DEMO-BOARD': 'DEMO-BOARD',
    FOUNDER: 'DEMO-FOUNDER',
    'DEMO-FOUNDER': 'DEMO-FOUNDER',
    联创: 'DEMO-FOUNDER',
    私董: 'DEMO-BOARD',
    天使: 'DEMO-ANGEL',
  }
  return aliases[raw] ?? (LEVEL_SET.has(raw) ? (raw as PartnerLevel) : fallback)
}

function asProfileStatus(value: unknown): PartnerProfile['partnerStatus'] {
  const raw = str(value, 'ACTIVE').toUpperCase()
  return PROFILE_STATUSES.has(raw) ? (raw as PartnerProfile['partnerStatus']) : 'ACTIVE'
}

function asAnnualStatus(value: unknown): PartnerProfile['annualStatus'] {
  const raw = str(value, 'NOT_OPEN').toUpperCase()
  return ANNUAL_STATUSES.has(raw) ? (raw as PartnerProfile['annualStatus']) : 'NOT_OPEN'
}

function asTaskStatus(value: unknown): PartnerPromotionTask['status'] {
  const raw = str(value, 'IN_PROGRESS').toUpperCase()
  return TASK_STATUSES.has(raw) ? (raw as PartnerPromotionTask['status']) : 'IN_PROGRESS'
}

function asReceiptStatus(value: unknown): PartnerReceipt['status'] {
  const raw = str(value, 'SUCCEEDED').toUpperCase()
  return RECEIPT_STATUSES.has(raw) ? (raw as PartnerReceipt['status']) : 'SUCCEEDED'
}

function asReceiptSource(value: unknown): PartnerReceipt['source'] {
  const raw = str(value, 'HQ_MANUAL').toUpperCase()
  if (raw === 'USER' || raw === 'TASK' || raw === 'USER_CLAIM') return 'USER_TASK'
  return RECEIPT_SOURCES.has(raw) ? (raw as PartnerReceipt['source']) : 'HQ_MANUAL'
}

function asAuditAction(value: unknown): PartnerAudit['action'] {
  const raw = str(value, 'upgrade').toLowerCase().replace(/_/g, '-')
  return (AUDIT_ACTIONS.has(raw) ? raw : 'upgrade') as PartnerAudit['action']
}

function mapRichContent(raw: unknown): RichContent {
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

export function mapPartnerLevelBenefits(raw: unknown, index = 0): PartnerLevelBenefits {
  const r = record(raw)
  const partnerLevel = asLevel(r.partnerLevel || r.level || r.code || partnerLevels[index] || 'DEMO-VIP')
  const defaults = LEVEL_DEFAULTS[partnerLevel]
  const nextRaw = r.nextLevel ?? r.nextPartnerLevel
  const taskTargetRaw = r.taskTarget ?? r.nextTaskTarget ?? r.promotionTarget
  return {
    partnerLevel,
    title: str(r.title || r.name || r.displayName || defaults.title),
    wholesaleLabel: str(r.wholesaleLabel || r.batchLabel || r.wholesale || defaults.wholesaleLabel),
    quotaOccupancy: Math.max(0, num(r.quotaOccupancy ?? r.quotaCost ?? r.occupancy, defaults.quotaOccupancy)),
    nextLevel: nextRaw == null || nextRaw === '' ? defaults.nextLevel : asLevel(nextRaw),
    taskTarget: taskTargetRaw == null || taskTargetRaw === '' ? defaults.taskTarget : Math.max(0, num(taskTargetRaw)),
    summary: str(r.summary || r.description || r.brief),
    content: mapRichContent(r.content ?? r.benefits ?? r.body ?? r.richContent),
    version: Math.max(1, num(r.version, 1)),
  }
}

export function mapPartnerPromotionTask(raw: unknown): PartnerPromotionTask | null {
  if (raw == null) return null
  const r = record(raw)
  if (!Object.keys(r).length) return null
  const beforeLevel = asLevel(r.beforeLevel || r.fromLevel || r.currentLevel)
  const targetLevel = asLevel(r.targetLevel || r.toLevel || r.nextLevel, LEVEL_DEFAULTS[beforeLevel].nextLevel ?? beforeLevel)
  return {
    taskId: str(r.taskId || r.id),
    version: Math.max(1, num(r.version, 1)),
    beforeLevel,
    targetLevel,
    progress: Math.max(0, num(r.progress ?? r.currentProgress, 0)),
    target: Math.max(0, num(r.target ?? r.goal ?? r.taskTarget, 0)),
    canClaim: bool(r.canClaim ?? r.claimable, false),
    startedAt: str(r.startedAt || r.startAt || r.createdAt),
    validUntil: str(r.validUntil || r.endAt || r.expiresAt),
    status: asTaskStatus(r.status || r.taskStatus),
    qualificationNote: str(r.qualificationNote || r.note || r.qualification || r.message),
  }
}

function mapAllowedActions(raw: unknown): PartnerProfile['allowedActions'] {
  return arr(raw)
    .map((item) => str(item).toLowerCase().replace(/_/g, '-'))
    .filter((item): item is PartnerProfile['allowedActions'][number] => ALLOWED_ACTIONS.has(item))
}

function mapAllowedTargetLevels(raw: unknown): PartnerLevel[] {
  return arr(raw).map((item) => asLevel(item)).filter((level, index, all) => all.indexOf(level) === index)
}

export function mapPartnerProfile(raw: unknown): PartnerProfile {
  const r = record(raw)
  const superiorRaw = record(r.superior || r.introducer || r.parent || {})
  const superiorId = str(superiorRaw.accountId || superiorRaw.id || r.superiorAccountId || r.introducerAccountId)
  const partnerLevel = asLevel(r.partnerLevel || r.level || r.levelCode)
  return {
    contextId: str(r.contextId || r.id || r.businessContextId),
    accountId: str(r.accountId || r.userId || r.ownerId),
    displayId: str(r.displayId || r.userNo || r.accountNo || r.displayAccountId),
    name: str(r.name || r.nickname || r.displayName || r.accountName),
    phone: str(r.phone || r.mobile || r.loginAccount),
    partnerLevel,
    partnerStatus: asProfileStatus(r.partnerStatus || r.status),
    frozen: bool(r.frozen ?? r.isFrozen, str(r.partnerStatus || r.status).toUpperCase() === 'FROZEN'),
    annualStatus: asAnnualStatus(r.annualStatus || r.annualRightStatus),
    annualValidUntil: nullableStr(r.annualValidUntil ?? r.annualExpireAt ?? r.expireAt),
    annualFeeAmount: 20000,
    superior: superiorId
      ? {
          accountId: superiorId,
          contextId: nullableStr(superiorRaw.contextId ?? superiorRaw.businessContextId ?? r.superiorContextId),
          name: str(superiorRaw.name || superiorRaw.nickname || superiorRaw.displayName || superiorId),
        }
      : null,
    version: Math.max(1, num(r.version, 1)),
    allowedActions: mapAllowedActions(r.allowedActions || r.actions),
    allowedTargetLevels: mapAllowedTargetLevels(r.allowedTargetLevels || r.targetLevels || r.upgradeTargets),
    task: mapPartnerPromotionTask(r.task ?? r.promotionTask ?? r.currentTask),
  }
}

export function mapPartnerReceipt(raw: unknown): PartnerReceipt {
  const r = record(raw)
  return {
    receiptId: str(r.receiptId || r.id),
    requestId: str(r.requestId || r.idempotencyKey),
    contextId: str(r.contextId || r.businessContextId),
    accountId: str(r.accountId || r.userId),
    source: asReceiptSource(r.source || r.origin || r.kind),
    taskId: nullableStr(r.taskId),
    beforeLevel: asLevel(r.beforeLevel || r.fromLevel),
    targetLevel: asLevel(r.targetLevel || r.toLevel),
    status: asReceiptStatus(r.status || r.receiptStatus),
    result: str(r.result || r.message || r.detail),
    reason: str(r.reason || r.remark),
    operatorName: str(r.operatorName || r.operator || r.createdByName || r.operatorNickname),
    createdAt: str(r.createdAt || r.submittedAt),
    completedAt: nullableStr(r.completedAt ?? r.finishedAt),
    mockOnly: false,
  }
}

export function mapPartnerAudit(raw: unknown): PartnerAudit {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id || r.requestId || `op-${Date.now()}`),
    requestId: str(r.requestId || r.idempotencyKey),
    action: asAuditAction(r.action || r.type),
    contextId: nullableStr(r.contextId ?? r.businessContextId),
    targetId: str(r.targetId || r.receiptId || r.partnerLevel || r.contextId),
    operatorName: str(r.operatorName || r.operator || r.createdByName),
    reason: str(r.reason || r.remark),
    before: str(r.before || r.beforeText || r.from),
    after: str(r.after || r.afterText || r.to),
    occurredAt: str(r.occurredAt || r.createdAt || r.operatedAt),
  }
}

/** Normalize HQ catalog so Partners page always has safe levels/receipts/audit arrays. */
export function mapPartnerCatalog(raw: unknown): PartnerCatalog {
  const r = record(raw)
  const levels = arr(r.levels || r.levelBenefits || r.partnerLevels || r.benefits)
    .map((item, index) => mapPartnerLevelBenefits(item, index))
  const receipts = arr(r.receipts || r.recentReceipts || r.promotionReceipts || r.receiptList)
    .map(mapPartnerReceipt)
  const audit = arr(r.audit || r.operations || r.logs || r.recentOperations)
    .map(mapPartnerAudit)
  return { levels, receipts, audit }
}

export function mapPartnerList(raw: unknown, page: number, pageSize: number): PartnerList {
  const paged = asPage(raw, page, pageSize)
  const items = paged.items.map(mapPartnerProfile)
  const summaryRaw = record(record(raw).summary || record(raw).stats || {})
  return {
    items,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    summary: {
      total: Math.max(0, num(summaryRaw.total ?? paged.total, paged.total)),
      active: Math.max(0, num(summaryRaw.active ?? summaryRaw.activeCount, 0)),
      frozen: Math.max(0, num(summaryRaw.frozen ?? summaryRaw.frozenCount, 0)),
      annualExpired: Math.max(0, num(summaryRaw.annualExpired ?? summaryRaw.expired ?? summaryRaw.expiredCount, 0)),
    },
  }
}

export function mapPartnerDetail(raw: unknown): PartnerDetail {
  const r = record(raw)
  const profileSource = r.profile != null ? r.profile : raw
  return {
    profile: mapPartnerProfile(profileSource),
    taskHistory: arr(r.taskHistory || r.tasks || r.historyTasks).map((item) => mapPartnerPromotionTask(item)).filter((item): item is PartnerPromotionTask => !!item),
    receipts: arr(r.receipts || r.receiptList || r.promotionReceipts).map(mapPartnerReceipt),
    audit: arr(r.audit || r.operations || r.logs).map(mapPartnerAudit),
  }
}

export async function realPartnerCatalog() {
  try {
    return cast(mapPartnerCatalog(await unwrapData(await api.getPartnersCatalog())))
  } catch (error) {
    return mapHqError(error, PartnerError)
  }
}

export async function realPartnerList(query: PartnerQuery) {
  try {
    return cast(mapPartnerList(await unwrapData(await api.getPartners({ ...query } as never)), query.page, query.pageSize))
  } catch (error) {
    return mapHqError(error, PartnerError)
  }
}

export async function realPartnerDetail(contextId: string) {
  try {
    return cast(mapPartnerDetail(await unwrapData(await api.getPartnersByContextId({ contextId }))))
  } catch (error) {
    return mapHqError(error, PartnerError)
  }
}

export async function realPartnerMutate(input: PartnerMutation) {
  try {
    const actionMap: Record<string, string> = { upgrade: 'promote', 'save-benefits': 'save-benefits', 'save-level-names': 'save-context' }
    const action = actionMap[input.action] || input.action
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    await unwrapData(await api.postPartnersMutate(body as never))
    const contextId = str((input as { contextId?: string }).contextId)
    return contextId ? realPartnerDetail(contextId) : realPartnerCatalog()
  } catch (error) {
    return mapHqError(error, PartnerError)
  }
}

export async function realPartnerUpload(_file: File) {
  return unsupported(PartnerError, 'upload', '合伙人素材上传未由 HQ partners API 暴露')
}

export function realPartnerAssetUrl(url: string) { return url }
