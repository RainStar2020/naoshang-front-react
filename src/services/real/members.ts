import * as api from '../../api'
import {
  MemberServiceError,
  type EntitlementMutation,
  type EntitlementResult,
  type LearningAuthorization,
  type MemberDetail,
  type MemberEntitlement,
  type MemberListResult,
  type MemberOptions,
  type MemberProfile,
  type MemberProfileMutation,
  type MemberProfileResult,
  type MemberQuery,
  type MembershipTier,
} from '../../types/members'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, record, str, unwrapData } from './bridge'

const GENDER_LABEL: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '未披露',
}

function mapEntitlement(raw: unknown, index: number): MemberEntitlement {
  const r = record(raw)
  const statusRaw = str(r.status, 'active').toLowerCase()
  const status: MemberEntitlement['status'] = statusRaw === 'revoked' || statusRaw === 'inactive' || statusRaw === 'cancelled' ? 'revoked' : 'active'
  const sourceRaw = str(r.source, 'hq-manual').toLowerCase()
  const source: MemberEntitlement['source'] = sourceRaw.includes('activation') || sourceRaw.includes('code') ? 'activation-code' : 'hq-manual'
  return {
    grantId: str(r.grantId || r.id || r.entitlementId, `grant-${index}`),
    membershipTierId: str(r.membershipTierId || r.tierId || r.targetId || r.productId),
    status,
    source,
    grantedAt: str(r.grantedAt || r.createdAt || r.startAt),
    lastChangedAt: str(r.lastChangedAt || r.updatedAt || r.grantedAt || r.createdAt),
    expiresAt: null,
    ...(r.sourceCodeId || r.codeId ? { sourceCodeId: str(r.sourceCodeId || r.codeId) } : {}),
  }
}

function entitlementsOf(r: Record<string, unknown>): MemberEntitlement[] {
  const sources = [
    ...arr(r.entitlements),
    ...arr(r.grants),
    ...arr(r.memberships),
    ...arr(r.memberEntitlements),
  ]
  return sources.map(mapEntitlement)
}

function mapGender(raw: unknown): { genderCode: MemberProfile['genderCode']; genderLabel: string } {
  const value = str(raw, 'UNDISCLOSED').toUpperCase()
  const genderCode: MemberProfile['genderCode'] =
    value === 'MALE' || value === 'M' || value === '男' ? 'MALE'
      : value === 'FEMALE' || value === 'F' || value === '女' ? 'FEMALE'
        : 'UNDISCLOSED'
  return { genderCode, genderLabel: GENDER_LABEL[genderCode] }
}

/** Normalize HQ members payload into dedicated UI MemberProfile shape. */
export function mapMemberProfile(raw: unknown): MemberProfile {
  const r = record(raw)
  const profile = record(r.profile)
  const parent = record(r.parent ?? r.account ?? profile.parent)
  const memberId = str(r.memberId || r.id || profile.memberId || profile.id)
  const accountId = str(r.accountId || parent.accountId || profile.accountId || r.userId)
  const name = str(r.name || r.nickname || profile.name || profile.nickname || memberId || '未命名学员')
  const gradeCode = str(r.gradeCode || r.grade || profile.gradeCode || profile.grade)
  const gradeLabel = str(r.gradeLabel || r.gradeName || profile.gradeLabel || gradeCode || '未设置')
  const gender = mapGender(r.genderCode ?? r.gender ?? profile.genderCode ?? profile.gender)
  const storeIdRaw = r.storeId ?? profile.storeId ?? r.shopId
  const storeNameRaw = r.storeName ?? profile.storeName ?? r.shopName
  const avatarRaw = r.avatar ?? r.avatarUrl ?? profile.avatar ?? profile.avatarUrl
  return {
    memberId,
    accountId,
    contextId: str(r.contextId || profile.contextId || (accountId && memberId ? `child:${accountId}:${memberId}` : memberId)),
    displayId: str(r.displayId || r.memberNo || r.userNo || profile.displayId || memberId),
    name,
    gradeCode,
    gradeLabel,
    genderCode: gender.genderCode,
    genderLabel: str(r.genderLabel || profile.genderLabel || gender.genderLabel),
    birthday: (() => {
      const b = r.birthday ?? profile.birthday ?? r.birthDate
      return b == null || b === '' ? null : str(b)
    })(),
    avatar: avatarRaw == null || avatarRaw === '' ? null : str(avatarRaw),
    parentName: str(r.parentName || parent.nickname || parent.name || parent.parentName || profile.parentName),
    parentPhone: str(r.parentPhone || parent.phone || parent.mobile || profile.parentPhone),
    storeId: storeIdRaw == null || storeIdRaw === '' ? null : str(storeIdRaw),
    storeName: storeNameRaw == null || storeNameRaw === '' ? null : str(storeNameRaw),
    status: (() => {
      const s = str(r.status ?? profile.status ?? r.memberStatus, 'ACTIVE').toUpperCase()
      return s === 'INACTIVE' || s === 'DISABLED' || s === 'FROZEN' ? 'INACTIVE' : 'ACTIVE'
    })(),
    version: num(r.version ?? profile.version, 1),
    entitlements: entitlementsOf({ ...profile, ...r }),
  }
}

function mapTier(raw: unknown): MembershipTier {
  const r = record(raw)
  const levels = arr(r.levels || r.courses || r.items).map((item, index) => {
    const row = record(item)
    return {
      levelId: str(row.levelId || row.courseId || row.id, `level-${index}`),
      name: str(row.name || row.title, `课程${index + 1}`),
    }
  })
  return {
    membershipTierId: str(r.membershipTierId || r.tierId || r.id),
    name: str(r.name || r.title, '未命名等级'),
    levels,
  }
}

function mapParentOption(raw: unknown) {
  const r = record(raw)
  const accountId = str(r.accountId || r.id || r.userId)
  return {
    accountId,
    nickname: str(r.nickname || r.name || r.parentName || accountId),
    phone: str(r.phone || r.mobile),
  }
}

function mapGradeOption(raw: unknown) {
  if (typeof raw === 'string') {
    const code = raw.trim()
    return code ? { code, label: code } : null
  }
  const r = record(raw)
  const code = str(r.code || r.value || r.gradeCode || r.id)
  if (!code) return null
  return { code, label: str(r.label || r.name || r.gradeLabel || code) }
}

function mapStoreOption(raw: unknown) {
  const r = record(raw)
  return {
    storeId: str(r.storeId || r.id || r.shopId),
    name: str(r.name || r.storeName || r.title),
    number: str(r.number || r.code || r.storeNo),
    active: r.active !== false && str(r.status).toUpperCase() !== 'INACTIVE',
  }
}

/** Normalize members catalog into dedicated filter options with safe arrays. */
export function mapMemberOptions(raw: unknown): MemberOptions {
  const r = record(raw)
  const parents = arr(r.parents || r.accounts || r.users || r.parentOptions).map(mapParentOption).filter((item) => !!item.accountId)
  const grades = arr(r.grades || r.gradeOptions || r.gradeList)
    .map(mapGradeOption)
    .filter((item): item is { code: string; label: string } => !!item)
  const stores = arr(r.stores || r.storeOptions || r.shops).map(mapStoreOption).filter((item) => !!item.storeId)
  const tiers = arr(r.tiers || r.membershipTiers || r.products || r.entitlementTiers).map(mapTier).filter((item) => !!item.membershipTierId)
  return { parents, grades, stores, tiers }
}

function mapLevel(raw: unknown, index: number): LearningAuthorization {
  const r = record(raw)
  return {
    levelId: str(r.levelId || r.courseId || r.id, `level-${index}`),
    membershipTierId: str(r.membershipTierId || r.tierId),
    name: str(r.name || r.title, `课程${index + 1}`),
    unlocked: bool(r.unlocked ?? r.isUnlocked ?? (str(r.status).toLowerCase() === 'unlocked')),
    percent: num(r.percent ?? r.progress ?? r.completionPercent),
  }
}

function mapOrderSummary(raw: unknown, index: number) {
  const r = record(raw)
  const amountRaw = r.payableAmount ?? r.paidAmount ?? r.amount ?? r.paid
  const payableAmount = typeof amountRaw === 'number' && !Number.isInteger(amountRaw)
    ? Math.round(num(amountRaw) * 100)
    : num(amountRaw)
  return {
    orderId: str(r.orderId || r.id, `order-${index}`),
    orderNo: str(r.orderNo || r.number || r.orderId || r.id),
    accountId: str(r.accountId || r.userId || r.buyerId),
    memberId: str(r.memberId || r.childId),
    title: str(r.title || r.productName || r.name, '关联订单'),
    payableAmount,
    statusLabel: str(r.statusLabel || r.statusName || r.status),
    createdAt: str(r.createdAt || r.paidAt),
  }
}

function mapFeedbackSummary(raw: unknown, index: number) {
  const r = record(raw)
  const kindRaw = str(r.kind || r.type, 'training').toLowerCase()
  const kind = kindRaw.includes('camp') || kindRaw.includes('集训')
    ? 'camp' as const
    : kindRaw.includes('self') || kindRaw.includes('自学')
      ? 'self-study' as const
      : 'training' as const
  return {
    feedbackId: str(r.feedbackId || r.id, `feedback-${index}`),
    memberId: str(r.memberId),
    kind,
    title: str(r.title || r.name, '训练反馈'),
    summary: str(r.summary || r.content || r.comment),
    authorName: str(r.authorName || r.author || r.coachName || r.operatorName),
    createdAt: str(r.createdAt),
  }
}

function mapAudit(raw: unknown, index: number) {
  const r = record(raw)
  const actionRaw = str(r.action, 'grant').toLowerCase()
  const action = actionRaw.includes('revoke') ? 'revoke' as const : actionRaw.includes('restore') ? 'restore' as const : 'grant' as const
  const originRaw = str(r.origin || r.source).toLowerCase()
  return {
    operationId: str(r.operationId || r.id, `op-${index}`),
    requestId: str(r.requestId || r.idempotencyKey),
    memberId: str(r.memberId),
    accountId: str(r.accountId),
    contextId: str(r.contextId),
    membershipTierId: str(r.membershipTierId || r.tierId),
    tierName: str(r.tierName || r.membershipTierName || r.name),
    action,
    before: str(r.before || r.beforeStatus),
    after: str(r.after || r.afterStatus),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    occurredAt: str(r.occurredAt || r.createdAt),
    ...(originRaw.includes('activation') ? { origin: 'activation-code' as const } : originRaw ? { origin: 'hq' as const } : {}),
  }
}

/** Normalize member detail into dedicated UI shape with safe arrays. */
export function mapMemberDetail(raw: unknown): MemberDetail {
  const r = record(raw)
  const member = mapMemberProfile(r.member ?? r.profile ?? r)
  return {
    member,
    levels: arr(r.levels || r.courses || r.authorizations || r.learningLevels).map(mapLevel),
    orders: arr(r.orders || r.relatedOrders || r.orderSummaries).map(mapOrderSummary),
    feedback: arr(r.feedback || r.feedbacks || r.trainingFeedback).map(mapFeedbackSummary),
    audit: arr(r.audit || r.audits || r.operations || r.entitlementAudit).map(mapAudit),
  }
}

export async function realMembers(query: MemberQuery): Promise<MemberListResult> {
  try {
    const data = await unwrapData(await api.getMembers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      accountId: query.accountId || undefined,
      gradeCode: query.gradeCode || undefined,
      storeId: query.storeId || undefined,
    } as never))
    const page = asPage(data, query.page, query.pageSize)
    return {
      items: page.items.map(mapMemberProfile),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    }
  } catch (error) {
    return mapHqError(error, MemberServiceError)
  }
}

export async function realMemberOptions(): Promise<MemberOptions> {
  try {
    const data = await unwrapData(await api.getMembersCatalog())
    return mapMemberOptions(data)
  } catch (error) {
    return mapHqError(error, MemberServiceError)
  }
}

export async function realMemberDetail(memberId: string): Promise<MemberDetail> {
  try {
    const data = await unwrapData(await api.getMembersByMemberId({ memberId }))
    return mapMemberDetail(data)
  } catch (error) {
    return mapHqError(error, MemberServiceError)
  }
}

export async function realMemberMutation(input: EntitlementMutation): Promise<EntitlementResult> {
  try {
    const action = input.action === 'restore' ? 'grant' : input.action
    const entitlementId = str((input as { entitlementId?: string }).entitlementId || (input as { levelId?: string }).levelId)
    const body = mutationBody({
      ...record(input as never),
      action,
      membershipTierId: input.membershipTierId,
      memberId: input.memberId,
      accountId: input.accountId,
      contextId: input.contextId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: num((input as { version?: number }).version, 1),
    })
    if (entitlementId) {
      await unwrapData(await api.postCourseEntitlementsByEntitlementIdMutate({ entitlementId }, body as never))
    } else {
      await unwrapData(await api.postCourseEntitlements(body as never))
    }
    const detail = await realMemberDetail(input.memberId)
    return {
      member: detail.member,
      levels: detail.levels,
      operation: cast({
        operationId: input.idempotencyKey,
        requestId: input.idempotencyKey,
        memberId: input.memberId,
        accountId: input.accountId,
        contextId: input.contextId,
        membershipTierId: input.membershipTierId,
        tierName: input.membershipTierId,
        action: input.action,
        before: '',
        after: input.action === 'revoke' ? '已撤销' : '已开通（永久）',
        reason: input.reason,
        operatorId: '',
        operatorName: '',
        occurredAt: new Date().toISOString(),
      }),
      mockOnly: false,
    }
  } catch (error) {
    return mapHqError(error, MemberServiceError)
  }
}


export async function realMemberProfileMutation(input: MemberProfileMutation): Promise<MemberProfileResult> {
  try {
    const body = mutationBody({
      ...record(input as never),
      action: input.action,
      memberId: input.memberId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      version: num(input.version, 1),
      ...(input.action === 'bind-store' ? { storeId: input.storeId } : {}),
      ...(input.action === 'unbind-store' ? { storeId: input.storeId ?? undefined } : {}),
      ...(input.action === 'set-status' ? { status: input.status } : {}),
      ...(input.action === 'update-profile' ? {
        name: input.name,
        birthday: input.birthday,
        gradeCode: input.gradeCode,
        gradeLabel: input.gradeLabel,
        genderCode: input.genderCode,
        genderLabel: input.genderLabel,
      } : {}),
    })
    await unwrapData(await api.postMembersByMemberIdMutate({ memberId: input.memberId }, body as never))
    const detail = await realMemberDetail(input.memberId)
    return { member: detail.member, mockOnly: false }
  } catch (error) {
    return mapHqError(error, MemberServiceError)
  }
}
