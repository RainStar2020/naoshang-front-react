import type { HqAccount } from '../../types/auth'
import { MemberServiceError, type EntitlementAudit, type EntitlementMutation, type EntitlementResult, type MemberDetail, type MemberEntitlement, type MemberOptions, type MemberProfile, type MemberProfileMutation, type MemberProfileResult, type MemberQuery, type MembershipTier } from '../../types/members'
import { mockListUsers, mockUserDetail, mockUserOptions } from './users'
import { mockPublishedTiers } from './cms'

const clone = <T,>(value: T): T => structuredClone(value)
const fail = (code: MemberServiceError['code'], message: string): never => { throw new MemberServiceError(code, message) }
const grades = [
  ...Array.from({ length: 6 }, (_, i) => ({ code: `PRIMARY_${i + 1}`, label: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'][i] })),
  ...Array.from({ length: 3 }, (_, i) => ({ code: `JUNIOR_${i + 1}`, label: ['初一', '初二', '初三'][i] })),
  { code: 'OTHER', label: '其他' },
]
const members: MemberProfile[] = Array.from({ length: 24 }, (_, i) => {
  const n = i + 1
  const accountId = `account-${Math.floor(i / 2) + 1}`
  const parent = mockUserDetail(accountId).account
  const grade = grades[i % grades.length]
  const entitlements: MemberEntitlement[] = n % 3 === 0 ? [] : [{
    grantId: `seed-grant-${n}`, membershipTierId: n % 3 === 1 ? 'demo-tier-2' : 'demo-tier-3', status: n % 3 === 1 ? 'active' : 'revoked',
    source: 'activation-code', grantedAt: '2026-09-01T09:00:00+08:00', lastChangedAt: '2026-10-01T09:00:00+08:00', expiresAt: null,
  }]
  return { memberId: `member-${n}`, accountId, contextId: `child:${accountId}:${n}`, displayId: `XY${String(n).padStart(5, '0')}`, name: `${['林小禾', '林小满', '陈子安', '陈一诺'][i % 4]}${n > 4 ? n : ''}`, gradeCode: grade.code, gradeLabel: grade.label, genderCode: i % 2 ? 'FEMALE' : 'MALE', genderLabel: i % 2 ? '女' : '男', birthday: n % 5 === 0 ? null : `201${n % 10}-0${(n % 9) + 1}-15`, avatar: null, parentName: parent.nickname, parentPhone: parent.phone, storeId: parent.storeId, storeName: parent.storeName, status: n % 11 === 0 ? 'INACTIVE' : 'ACTIVE', version: 1, entitlements }
})
const audit: EntitlementAudit[] = []
const operations = new Map<string, { payload: string; result: EntitlementResult }>()
const find = (id: string) => members.find(item => item.memberId === id) ?? fail('NOT_FOUND', '学员不存在，请刷新列表')
function profile(member: MemberProfile): MemberProfile {
  const parent = mockUserDetail(member.accountId).account
  return clone({ ...member, parentName: parent.nickname, parentPhone: parent.phone })
}
function levels(member: MemberProfile) {
  return mockPublishedTiers().flatMap(tier => tier.levels.map(level => ({ ...level, membershipTierId: tier.membershipTierId, unlocked: member.entitlements.some(grant => grant.membershipTierId === tier.membershipTierId && grant.status === 'active'), percent: member.memberId === 'member-1' && level.levelId === 'level-2' ? 45 : member.memberId === 'member-2' && level.levelId === 'level-6' ? 60 : 0 })))
}
export function mockMemberOptions(): MemberOptions {
  return clone({ parents: mockListUsers({ page: 1, pageSize: 50 }).items.map(item => ({ accountId: item.accountId, nickname: item.nickname, phone: item.phone })), grades, stores: mockUserOptions().stores, tiers: mockPublishedTiers() })
}
export function mockMembers(query: MemberQuery) {
  if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  const keyword = query.keyword?.trim() ?? ''
  const filtered = members.filter(item => (!keyword || item.name.includes(keyword) || item.displayId.toLowerCase().includes(keyword.toLowerCase())) && (!query.accountId || item.accountId === query.accountId) && (!query.gradeCode || item.gradeCode === query.gradeCode) && (!query.storeId || (query.storeId === 'unbound' ? item.storeId === null : item.storeId === query.storeId)))
  return { items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(profile), total: filtered.length, page: query.page, pageSize: query.pageSize }
}
export function mockMemberDetail(id: string): MemberDetail {
  const member = find(id)
  return clone({ member: profile(member), levels: levels(member),
    orders: id === 'member-1' ? [{ orderId: 'member-demo-order-1', orderNo: 'DEMO-20261001001', accountId: member.accountId, memberId: id, title: '学习会员服务（演示交易快照）', payableAmount: 19900, statusLabel: '已付款 / 待交付', createdAt: '2026-10-01T09:00:00+08:00' }] : [],
    feedback: id === 'member-1' ? [{ feedbackId: 'member-demo-feedback-1', memberId: id, kind: 'training', title: '专注力训练反馈（演示）', summary: '本次完成观察与记忆练习，建议继续巩固。', authorName: '演示健脑官', createdAt: '2026-10-02T09:00:00+08:00' }] : [],
    audit: audit.filter(item => item.memberId === id).slice().reverse(),
  })
}
export function mockMemberMutation(input: EntitlementMutation, operator: HqAccount): EntitlementResult {
  if (!['grant', 'revoke', 'restore'].includes(input.action) || !input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字原因并提供有效操作参数')
  const tier = mockPublishedTiers().find(item => item.membershipTierId === input.membershipTierId) ?? fail('INVALID_INPUT', '会员等级不存在')
  const member = find(input.memberId)
  if (member.accountId !== input.accountId || member.contextId !== input.contextId) fail('IDENTITY_MISMATCH', '账号或孩子学习身份不匹配，禁止跨身份操作')
  const key = `${operator.accountId}:${input.idempotencyKey}`
  const payload = JSON.stringify([input.memberId, input.accountId, input.contextId, input.membershipTierId, input.action, input.version, input.reason.trim()])
  const previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数不一致，请关闭后重新操作'); return clone(previous.result) }
  if (member.version !== input.version) fail('VERSION_CONFLICT', '学员权益已变化，请刷新后重新操作')
  const grant = member.entitlements.find(item => item.membershipTierId === tier.membershipTierId)
  if (input.action === 'grant' && grant) fail('INVALID_STATE', grant.status === 'active' ? '该等级已开通，无需重复发放' : '该等级已撤销，请使用恢复权益')
  if (input.action === 'revoke' && grant?.status !== 'active') fail('INVALID_STATE', '只能撤销已开通的权益')
  if (input.action === 'restore' && grant?.status !== 'revoked') fail('INVALID_STATE', '只能恢复已撤销的权益')
  const before = grant ? (grant.status === 'active' ? '已开通（永久）' : '已撤销') : '未开通'
  const now = new Date().toISOString()
  if (input.action === 'grant') member.entitlements.push({ grantId: crypto.randomUUID(), membershipTierId: tier.membershipTierId, status: 'active', source: 'hq-manual', grantedAt: now, lastChangedAt: now, expiresAt: null })
  else if (grant) { grant.status = input.action === 'revoke' ? 'revoked' : 'active'; grant.lastChangedAt = now }
  member.version++
  const operation: EntitlementAudit = { operationId: crypto.randomUUID(), requestId: input.idempotencyKey, memberId: member.memberId, accountId: member.accountId, contextId: member.contextId, membershipTierId: tier.membershipTierId, tierName: tier.name, action: input.action, before, after: input.action === 'revoke' ? '已撤销' : '已开通（永久）', reason: input.reason.trim(), operatorId: operator.accountId, operatorName: operator.nickname, occurredAt: now }
  audit.push(operation)
  const result: EntitlementResult = { member: profile(member), levels: levels(member), operation, mockOnly: true }
  operations.set(key, { payload, result: clone(result) })
  return clone(result)
}

/** 仅供独立激活码Mock消费端调用，不是总部人工开通接口；不依赖年度经营权益。 */
export function mockActivateMemberCode(input: { memberId: string; accountId: string; contextId: string; version: number; targetId: string; codeId: string; requestId: string }) {
  const member = find(input.memberId)
  if (member.accountId !== input.accountId || member.contextId !== input.contextId) fail('IDENTITY_MISMATCH', '受益孩子与账号不匹配')
  if (member.version !== input.version) fail('VERSION_CONFLICT', '学员资料已更新，请重新预览')
  const tier = mockPublishedTiers().find(item => item.membershipTierId === input.targetId) ?? fail('INVALID_INPUT', '会员等级不存在')
  if (!tier.levels.length) fail('INVALID_INPUT', '该等级暂无已发布学习课程，请联系总部')
  if (member.entitlements.some(item => item.membershipTierId === input.targetId)) fail('INVALID_STATE', '此等级已有权益记录；已撤销权益请使用总部恢复流程，不消耗新码')
  const now = new Date().toISOString()
  member.entitlements.push({ grantId: crypto.randomUUID(), membershipTierId: input.targetId, status: 'active', source: 'activation-code', sourceCodeId: input.codeId, grantedAt: now, lastChangedAt: now, expiresAt: null })
  member.version++
  audit.push({ operationId: crypto.randomUUID(), requestId: input.requestId, memberId: member.memberId, accountId: member.accountId, contextId: member.contextId, membershipTierId: input.targetId, tierName: tier.name, action: 'grant', origin: 'activation-code', before: '未开通', after: '已开通（永久）', reason: `Mock用户消费激活码 ${input.codeId}`, operatorId: input.accountId, operatorName: 'Mock用户主动激活', occurredAt: now })
  return { member: profile(member), levels: levels(member) }
}


const profileOps = new Map<string, { payload: string; result: MemberProfileResult }>()

export function mockMemberProfileMutation(input: MemberProfileMutation, operator: HqAccount): MemberProfileResult {
  if (!input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字原因并提供有效操作参数')
  if (!['update-profile', 'bind-store', 'unbind-store', 'set-status'].includes(input.action)) fail('INVALID_INPUT', '未知会员档案操作')
  const member = find(input.memberId)
  const key = `${operator.accountId}:profile:${input.idempotencyKey}`
  const payload = JSON.stringify([input.memberId, input.action, input.version, input.reason.trim(),
    input.action === 'update-profile' ? [input.name, input.birthday, input.gradeCode, input.genderCode] : null,
    input.action === 'bind-store' || input.action === 'unbind-store' ? (input as { storeId?: string | null }).storeId : null,
    input.action === 'set-status' ? (input as { status: string }).status : null,
  ])
  const previous = profileOps.get(key)
  if (previous) {
    if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数不一致，请关闭后重新操作')
    return clone(previous.result)
  }
  if (member.version !== input.version) fail('VERSION_CONFLICT', '学员资料已更新，请刷新后重新操作')

  if (input.action === 'update-profile') {
    const name = input.name?.trim()
    if (name !== undefined) {
      if (!name || Array.from(name).length > 24) fail('INVALID_INPUT', '请填写1—24字姓名')
      member.name = name
    }
    if (input.birthday !== undefined) member.birthday = input.birthday?.trim() || null
    if (input.gradeCode !== undefined) {
      const grade = grades.find(g => g.code === input.gradeCode) ?? fail('INVALID_INPUT', '年级无效')
      member.gradeCode = grade.code
      member.gradeLabel = input.gradeLabel?.trim() || grade.label
    }
    if (input.genderCode !== undefined) {
      member.genderCode = input.genderCode
      member.genderLabel = input.genderLabel?.trim() || ({ MALE: '男', FEMALE: '女', UNDISCLOSED: '未披露' }[input.genderCode] ?? '未披露')
    }
  } else if (input.action === 'bind-store') {
    const storeId = input.storeId.trim()
    if (!storeId) fail('INVALID_INPUT', '请选择门店')
    const store = mockUserOptions().stores.find(s => s.storeId === storeId)
    if (!store) fail('INVALID_INPUT', '门店不存在')
    const bound = store as { storeId: string; name: string }
    member.storeId = bound.storeId
    member.storeName = bound.name
  } else if (input.action === 'unbind-store') {
    if (!member.storeId) fail('INVALID_STATE', '学员尚未绑定门店')
    member.storeId = null
    member.storeName = null
  } else if (input.action === 'set-status') {
    if (input.status !== 'ACTIVE' && input.status !== 'INACTIVE') fail('INVALID_INPUT', '状态无效')
    member.status = input.status
  }

  member.version += 1
  const result: MemberProfileResult = { member: profile(member), mockOnly: true }
  profileOps.set(key, { payload, result: clone(result) })
  return clone(result)
}
