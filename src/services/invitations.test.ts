import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { InvitationMutation } from '../types/invitations'
let service: typeof import('./invitations')['invitationsService'], auth: typeof import('./auth')['authService'], token: string
const detail = (id = 'account-6') => service.detail(token, id)
const input = (extra: Partial<InvitationMutation> = {}): InvitationMutation => ({ action: 'rebind', accountId: 'account-6', targetAccountId: 'account-2', version: 1, graphVersion: 1, reason: '核对后调整介绍人', idempotencyKey: crypto.randomUUID(), ...extra })
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T09:00:00+08:00')); vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./invitations')).invitationsService; auth = (await import('./auth')).authService; token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('28个账号关系分页，完整筛选统计不依赖当前页', async () => {
  const one = await service.list(token, { page: 1, pageSize: 5 }), two = await service.list(token, { page: 2, pageSize: 5 })
  expect(one.summary).toEqual({ accounts: 28, bound: 25, unbound: 3 }); expect(two.summary).toEqual(one.summary); expect(one.items).toHaveLength(5)
})
it('支持手机号、编号、绑定状态筛选和空结果', async () => {
  expect((await service.list(token, { page: 1, pageSize: 10, keyword: 'TS0006', binding: 'BOUND' })).items[0].account.accountId).toBe('account-6')
  expect((await service.list(token, { page: 1, pageSize: 10, keyword: '13800000006', binding: 'UNBOUND' })).total).toBe(0)
})
it('首次注册绑定、本人邀请码、上级路径独立返回', async () => {
  const value = await detail('account-9'); expect(value.ancestors.map(row => row.accountId)).toEqual(['account-6', 'account-3'])
  expect(value.relation.initialBinding).toMatchObject({ source: 'REGISTRATION_INVITE', superior: { accountId: 'account-6' }, inviteCode: 'MOCK-INV-000006', mockOnly: true }); expect(value.relation.inviteCode).toBe('MOCK-INV-000009')
  expect((await detail('account-3')).relation.initialBinding).toMatchObject({ source: 'NO_INVITE', superior: null, inviteCode: null })
})
it('直属与全部团队分页不混淆，层级与当前介绍人来自完整关系', async () => {
  const direct = await service.team(token, { accountId: 'account-3', scope: 'DIRECT', page: 1, pageSize: 5 }), all = await service.team(token, { accountId: 'account-3', scope: 'ALL', page: 1, pageSize: 5 })
  expect(direct.items.map(row => row.account.accountId)).toEqual(['account-4', 'account-5', 'account-6']); expect(direct.directCount).toBe(3); expect(all.teamCount).toBe(25); expect(all.total).toBe(25)
  const search = await service.team(token, { accountId: 'account-3', scope: 'ALL', keyword: 'SD0027', page: 1, pageSize: 5 }); expect(search.items[0]).toMatchObject({ depth: 8, superior: { accountId: 'account-24' } }); expect(search.teamCount).toBe(25)
})
it('候选介绍人排除本人、当前上级、所有下级和冻结目标', async () => {
  const candidates = await service.candidates(token, 'account-6'); expect(candidates.items.map(row => row.accountId)).toContain('account-2')
  for (const id of ['account-6', 'account-3', 'account-9', 'account-28', 'account-5']) expect(candidates.items.map(row => row.accountId)).not.toContain(id)
})
it('换绑留痕、服务生效时间、前后版本与首次注册记录保留', async () => {
  const before = await detail(), result = await service.mutate(token, input()), after = await detail()
  expect(result).toMatchObject({ action: 'rebind', before: { accountId: 'account-3' }, after: { accountId: 'account-2' }, reason: '核对后调整介绍人', operatorName: '总部演示账号', beforeVersion: 1, afterVersion: 2, graphVersion: 2, effectiveAt: '2026-10-27T01:00:00.000Z' })
  expect(after.relation.superior?.accountId).toBe('account-2'); expect(after.relation.initialBinding).toEqual(before.relation.initialBinding); expect(after.history[0]).toEqual(result)
})
it('迁移整棵下级关系，但不改变下级直属介绍人或其注册记录', async () => {
  const child = await detail('account-9'); await service.mutate(token, input())
  const moved = await detail('account-9'); expect(moved.relation.superior).toEqual(child.relation.superior); expect(moved.relation.initialBinding).toEqual(child.relation.initialBinding); expect(moved.ancestors.map(row => row.accountId)).toEqual(['account-6', 'account-2'])
  expect((await detail('account-3')).relation.teamCount).toBe(2); expect((await detail('account-2')).relation.teamCount).toBe(23)
})
it('解绑保留首次注册绑定，本人与前后上级均可追溯变更', async () => {
  await service.mutate(token, input({ action: 'unbind', targetAccountId: null })); const value = await detail()
  expect(value.relation.superior).toBeNull(); expect(value.relation.initialBinding.superior?.accountId).toBe('account-3'); expect(value.relation.allowedActions).toEqual(['rebind']); expect((await detail('account-3')).history).toHaveLength(1)
  expect((await detail('account-9')).ancestors.map(row => row.accountId)).toEqual(['account-6'])
})
it('未绑定账号可总部绑定，注册未绑定记录仍保持原状', async () => {
  await service.mutate(token, input({ accountId: 'account-1', targetAccountId: 'account-2' })); expect((await detail('account-1')).relation.initialBinding.superior).toBeNull()
})
it('拒绝自绑、当前上级重复绑定和跨多层循环，失败无副作用', async () => {
  for (const targetAccountId of ['account-6', 'account-3', 'account-9', 'account-27']) await expect(service.mutate(token, input({ targetAccountId }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  expect((await detail()).relation.version).toBe(1); expect((await detail()).history).toHaveLength(0)
})
it('当前无介绍人不能重复解绑，冻结目标不可绑定', async () => {
  await expect(service.mutate(token, input({ action: 'unbind', accountId: 'account-3', targetAccountId: null }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(service.mutate(token, input({ targetAccountId: 'account-5' }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('变更后生成的循环同样被提交校验拦截', async () => {
  await service.mutate(token, input())
  await expect(service.mutate(token, input({ accountId: 'account-2', targetAccountId: 'account-27', graphVersion: 2 }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('候选查询后目标冻结时仍由提交重新校验', async () => {
  await service.candidates(token, 'account-6'); const users = (await import('./users')).usersService, row = await users.detail(token, 'account-2')
  await users.mutate(token, { action: 'freeze', frozen: true, accountId: 'account-2', version: row.account.version, reason: '测试冻结', idempotencyKey: crypto.randomUUID() })
  await expect(service.mutate(token, input())).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('关系版本和全局结构版本阻止并发变更，重新查询后才能继续', async () => {
  await service.mutate(token, input()); await expect(service.mutate(token, input())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, input({ accountId: 'account-1', targetAccountId: 'account-3' }))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await service.mutate(token, input({ accountId: 'account-1', targetAccountId: 'account-3', graphVersion: 2 })); expect((await detail('account-1')).relation.superior?.accountId).toBe('account-3')
})
it('相同请求重试只变更一次，更改对象或目标拒绝', async () => {
  const request = input(), first = await service.mutate(token, request); expect(await service.mutate(token, request)).toEqual(first)
  await expect(service.mutate(token, { ...request, targetAccountId: 'account-1' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }); expect((await detail()).history).toHaveLength(1)
})
it('原因、动作、目标、版本和请求号必须有效', async () => {
  for (const extra of [{ reason: '' }, { reason: 'x'.repeat(201) }, { idempotencyKey: '' }, { action: 'delete' }, { targetAccountId: null }, { action: 'unbind', targetAccountId: 'account-1' }]) await expect(service.mutate(token, input(extra as Partial<InvitationMutation>))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, input({ targetAccountId: 'unknown' }))).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('只读账号可查团队但不能查变更候选或写入，无模块权限被拒绝', async () => {
  token = (await auth.login({ loginAccount: 'hq-invitation-viewer', password: 'Demo@123456' })).token
  expect((await detail()).relation.account.accountId).toBe('account-6'); await expect(service.mutate(token, input())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.candidates(token, 'account-6')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-partner-operator', password: 'Demo@123456' })).token; await expect(detail()).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('总部关系处理账号可以变更，退出后无法查询', async () => {
  token = (await auth.login({ loginAccount: 'hq-invitation-operator', password: 'Demo@123456' })).token; await service.mutate(token, input()); await auth.logout(); await expect(detail()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('合伙档案与新介绍人共享来源，普通账号介绍人不伪造业务身份', async () => {
  const partner = await import('./mock/partners'), before = partner.mockPartnerDetail('partner:account-6')
  await service.mutate(token, input()); const after = partner.mockPartnerDetail('partner:account-6')
  expect(after.profile.superior).toMatchObject({ accountId: 'account-2', contextId: null }); expect(after.profile.task).toEqual(before.profile.task); expect(after.profile.partnerLevel).toEqual(before.profile.partnerLevel); expect(after.profile.annualValidUntil).toEqual(before.profile.annualValidUntil)
})
it('换绑不回写名额与订单历史，新活动占用按当前直属关系校验', async () => {
  const quotas = await import('./mock/quotas'), before = quotas.mockQuotaDetail('account-3'), batch = before.batches.find(row => row.quotaType === 'ACTIVITY')!
  await service.mutate(token, input()); expect(quotas.mockQuotaDetail('account-3')).toEqual(before)
  expect(() => quotas.mockReserveActivityQuota({ ownerAccountId: 'account-3', targetAccountId: 'account-6', batchId: batch.batchId, quantity: 1, idempotencyKey: crypto.randomUUID() })).toThrow()
})
it('返回对象是快照，不能通过对象引用改写关系或首次注册记录', async () => {
  const row = await detail(); row.relation.initialBinding.superior!.accountId = 'fake'; row.relation.superior!.accountId = 'fake'; row.ancestors.length = 0
  expect((await detail()).relation.superior?.accountId).toBe('account-3'); expect((await detail()).relation.initialBinding.superior?.accountId).toBe('account-3')
})
it('非法分页、范围、绑定状态和不存在账号被拒绝', async () => {
  await expect(service.list(token, { page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(service.list(token, { page: 1, pageSize: 5, binding: 'X' as never })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(service.team(token, { accountId: 'account-3', scope: 'X' as never, page: 1, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(detail('unknown')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
