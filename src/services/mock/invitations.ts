import type { HqAccount } from '../../types/auth'
import { InvitationError, type InvitationAccount, type InvitationAudit, type InvitationDetail, type InvitationInitialBinding, type InvitationMutation, type InvitationQuery, type InvitationRelation, type InvitationTeamQuery } from '../../types/invitations'
import { mockListUsers, mockUserDetail } from './users'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: InvitationError['code'], message: string): never => { throw new InvitationError(code, message) }
const users = mockListUsers({ page: 1, pageSize: 50 }).items
const relations = new Map(users.map((row, index) => {
  const n = index + 1, parent = n % 3 === 0 ? n - 3 : Math.floor(n / 3) * 3
  return [row.accountId, { superiorId: parent >= 3 ? `account-${parent}` : null, version: 1, effectiveAt: row.createdAt }]
}))
let graphVersion = 1
const audit: InvitationAudit[] = [], operations = new Map<string, { payload: string; result: InvitationAudit }>()
function stored(id: string) { return relations.get(id) ?? fail('NOT_FOUND', '账号邀请关系不存在') }
function account(id: string): InvitationAccount { stored(id); const row = mockUserDetail(id).account; return { accountId: id, displayId: row.displayId, name: row.nickname, phone: row.phone, frozen: row.frozen } }
const inviteCode = (id: string) => `MOCK-INV-${id.replace('account-', '').padStart(6, '0')}`
const initial = new Map<string, InvitationInitialBinding>(users.map(row => { const parent = stored(row.accountId).superiorId; return [row.accountId, { source: parent ? 'REGISTRATION_INVITE' : 'NO_INVITE', inviteCode: parent ? inviteCode(parent) : null, superior: parent ? account(parent) : null, boundAt: row.createdAt, mockOnly: true }] }))
function ancestors(id: string) { const result: string[] = [], visited = new Set([id]); let parent = stored(id).superiorId; while (parent) { if (visited.has(parent)) fail('INVALID_STATE', '关系数据存在循环，需后端处理'); visited.add(parent); result.push(parent); parent = stored(parent).superiorId }; return result }
function team(id: string) { stored(id); return [...relations.keys()].filter(other => other !== id).map(other => ({ id: other, depth: ancestors(other).indexOf(id) + 1 })).filter(row => row.depth > 0) }
function relation(id: string): InvitationRelation { const row = stored(id), members = team(id); return { account: account(id), superior: row.superiorId ? account(row.superiorId) : null, inviteCode: inviteCode(id), initialBinding: copy(initial.get(id)!), version: row.version, graphVersion, effectiveAt: row.effectiveAt, directCount: members.filter(item => item.depth === 1).length, teamCount: members.length, allowedActions: row.superiorId ? ['rebind', 'unbind'] : ['rebind'] } }
function paginate(page: number, pageSize: number) { if (!Number.isInteger(page) || page < 1 || ![5, 10, 20].includes(pageSize)) fail('INVALID_INPUT', '分页参数无效') }
function matches(row: InvitationAccount, keyword = '') { return `${row.accountId} ${row.displayId} ${row.name} ${row.phone}`.toLowerCase().includes(keyword.trim().toLowerCase()) }
/** 合伙档案与名额业务共享账号级介绍人来源；没有业务身份的账号也可出现在关系中。 */
export function mockInvitationSuperiorId(accountId: string) { return stored(accountId).superiorId }
export function mockInvitationList(query: InvitationQuery) {
  paginate(query.page, query.pageSize); if (query.binding && !['BOUND', 'UNBOUND'].includes(query.binding)) fail('INVALID_INPUT', '绑定状态无效')
  const rows = [...relations.keys()].map(relation).filter(row => matches(row.account, query.keyword) && (!query.binding || !!row.superior === (query.binding === 'BOUND')))
  return copy({ items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, summary: { accounts: rows.length, bound: rows.filter(row => row.superior).length, unbound: rows.filter(row => !row.superior).length } })
}
export function mockInvitationDetail(id: string): InvitationDetail { return copy({ relation: relation(id), ancestors: ancestors(id).map(account), history: audit.filter(row => row.account.accountId === id || row.before?.accountId === id || row.after?.accountId === id).slice().reverse() }) }
export function mockInvitationTeam(query: InvitationTeamQuery) {
  paginate(query.page, query.pageSize); if (!['DIRECT', 'ALL'].includes(query.scope)) fail('INVALID_INPUT', '团队范围无效')
  const members = team(query.accountId), rows = members.filter(row => (query.scope === 'ALL' || row.depth === 1) && matches(account(row.id), query.keyword)).map(row => ({ account: account(row.id), superior: stored(row.id).superiorId ? account(stored(row.id).superiorId!) : null, depth: row.depth }))
  return copy({ items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, directCount: members.filter(row => row.depth === 1).length, teamCount: members.length, graphVersion })
}
export function mockInvitationCandidates(accountId: string, keyword = '') {
  const row = stored(accountId), descendants = new Set(team(accountId).map(item => item.id))
  return copy({ graphVersion, items: [...relations.keys()].filter(id => id !== accountId && id !== row.superiorId && !descendants.has(id)).map(account).filter(row => !row.frozen && matches(row, keyword)) })
}
export function mockInvitationMutate(input: InvitationMutation, operator: HqAccount) {
  if (!['rebind', 'unbind'].includes(input.action) || !input.idempotencyKey?.trim() || !input.reason?.trim() || input.reason.trim().length > 200 || input.action === 'rebind' && !input.targetAccountId || input.action === 'unbind' && input.targetAccountId !== null) fail('INVALID_INPUT', '操作、目标、1至200字原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), old = operations.get(key)
  if (old) { if (old.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(old.result) }
  const row = stored(input.accountId)
  if (row.version !== input.version || input.graphVersion !== graphVersion) fail('VERSION_CONFLICT', '关系或团队结构已变化，请刷新后重新核对')
  if (input.action === 'unbind' && !row.superiorId) fail('INVALID_STATE', '当前没有介绍人，无需解绑')
  if (input.action === 'rebind') {
    const target = account(input.targetAccountId!)
    if (target.frozen) fail('INVALID_STATE', '目标账号已冻结，不能成为新介绍人')
    if (target.accountId === input.accountId || target.accountId === row.superiorId || ancestors(target.accountId).includes(input.accountId)) fail('INVALID_STATE', '不能自绑、重复绑定当前介绍人或形成循环关系')
  }
  const before = row.superiorId ? account(row.superiorId) : null; row.superiorId = input.targetAccountId; row.version++; graphVersion++; row.effectiveAt = new Date().toISOString()
  const entry: InvitationAudit = { operationId: crypto.randomUUID(), requestId: input.idempotencyKey, account: account(input.accountId), action: input.action, before, after: input.targetAccountId ? account(input.targetAccountId) : null, reason: input.reason.trim(), operatorName: operator.nickname, effectiveAt: row.effectiveAt, beforeVersion: input.version, afterVersion: row.version, graphVersion }
  audit.push(entry); operations.set(key, { payload, result: copy(entry) }); return copy(entry)
}
