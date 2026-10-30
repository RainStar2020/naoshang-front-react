import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntitlementMutation } from '../types/members'

let service: typeof import('./members')['membersService']
let auth: typeof import('./auth')['authService']
let token: string
beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./members')).membersService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
const input = (overrides: Partial<EntitlementMutation> = {}): EntitlementMutation => ({ memberId: 'member-1', accountId: 'account-1', contextId: 'child:account-1:1', membershipTierId: 'demo-tier-1', action: 'grant', version: 1, reason: '总部核实后人工处理', idempotencyKey: crypto.randomUUID(), ...overrides })

describe('学员档案与跨模块数据边界', () => {
  it('分页总数来自全量查询，页间数据不重叠', async () => {
    const first = await service.list(token, { page: 1, pageSize: 10 })
    const second = await service.list(token, { page: 2, pageSize: 10 })
    expect(first.total).toBe(24)
    expect(first.items).toHaveLength(10)
    expect(second.items[0].memberId).toBe('member-11')
  })
  it('支持学员编号和姓名查询', async () => {
    expect((await service.list(token, { page: 1, pageSize: 10, keyword: 'xy00001' })).items[0].memberId).toBe('member-1')
    expect((await service.list(token, { page: 1, pageSize: 10, keyword: '林小禾' })).total).toBeGreaterThan(0)
  })
  it('组合家长、年级、门店筛选以及空结果', async () => {
    const query = { page: 1, pageSize: 10, accountId: 'account-1', gradeCode: 'PRIMARY_1', storeId: 'shop-1' }
    expect((await service.list(token, query)).items.map(item => item.memberId)).toEqual(['member-1'])
    expect((await service.list(token, { ...query, keyword: '不存在' })).total).toBe(0)
  })
  it('无门店筛选与无效分页', async () => {
    const result = await service.list(token, { page: 1, pageSize: 10, storeId: 'unbound' })
    expect(result.total).toBe(4)
    expect(result.items.every(item => item.storeId === null)).toBe(true)
    await expect(service.list(token, { page: 0, pageSize: 10 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('账号ID不能作为学员ID查询，返回对象不能直接修改源数据', async () => {
    await expect(service.detail(token, 'account-1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const detail = await service.detail(token, 'member-1')
    detail.member.entitlements[0].status = 'revoked'
    expect((await service.detail(token, 'member-1')).member.entitlements[0].status).toBe('active')
  })
  it('关联订单购买人是账号，服务对象是孩子；反馈与学员关联', async () => {
    const detail = await service.detail(token, 'member-1')
    expect(detail.orders[0]).toMatchObject({ accountId: 'account-1', memberId: 'member-1' })
    expect(detail.feedback[0].memberId).toBe('member-1')
    expect((await service.detail(token, 'member-2')).orders).toHaveLength(0)
  })
  it('总部修改家长所属店不会静默改变孩子门店和学习权益', async () => {
    const before = await service.detail(token, 'member-1')
    const { usersService } = await import('./users')
    await usersService.mutate(token, { accountId: 'account-1', action: 'change-store', storeId: 'shop-2', version: 1, reason: '测试账号门店与孩子门店隔离', idempotencyKey: crypto.randomUUID() })
    const after = await service.detail(token, 'member-1')
    expect(after.member.storeId).toBe(before.member.storeId)
    expect(after.levels).toEqual(before.levels)
  })
})

describe('永久学习权益与组内解锁', () => {
  it('开通三阶会解锁全部五个学习等级，不自动赠送其他等级', async () => {
    const result = await service.mutate(token, input({ memberId: 'member-3', accountId: 'account-2', contextId: 'child:account-2:3', membershipTierId: 'demo-tier-3' }))
    expect(result.levels.filter(level => level.unlocked).map(level => level.levelId)).toEqual(['level-6', 'level-7', 'level-8', 'level-9', 'level-10'])
    expect(result.member.entitlements[0]).toMatchObject({ expiresAt: null, source: 'hq-manual', status: 'active' })
  })
  it('撤销整组学习权限，保留进度，恢复后仍永久有效', async () => {
    const revoked = await service.mutate(token, input({ action: 'revoke', membershipTierId: 'demo-tier-2' }))
    expect(revoked.levels.some(level => level.unlocked)).toBe(false)
    expect(revoked.levels.find(level => level.levelId === 'level-2')?.percent).toBe(45)
    const restored = await service.mutate(token, input({ action: 'restore', membershipTierId: 'demo-tier-2', version: 2 }))
    expect(restored.levels.filter(level => level.unlocked)).toHaveLength(4)
    expect(restored.levels.find(level => level.levelId === 'level-2')?.percent).toBe(45)
    expect(restored.member.entitlements[0]).toMatchObject({ grantedAt: '2026-09-01T09:00:00+08:00', source: 'activation-code', expiresAt: null })
  })
  it('同一账号两个孩子的授权和操作记录互不影响', async () => {
    const before = await service.detail(token, 'member-1')
    await service.mutate(token, input({ memberId: 'member-2', contextId: 'child:account-1:2', action: 'restore', membershipTierId: 'demo-tier-3' }))
    expect(await service.detail(token, 'member-1')).toEqual(before)
  })
  it('拒绝混用账号、孩子或学习身份', async () => {
    for (const overrides of [{ accountId: 'account-2' }, { contextId: 'parent:account-1' }, { contextId: 'child:account-1:2' }]) {
      await expect(service.mutate(token, input(overrides))).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' })
    }
  })
  it('已激活等级不能重复开通，未开通不能撤销或恢复', async () => {
    for (const action of ['grant', 'restore'] as const) await expect(service.mutate(token, input({ action, membershipTierId: 'demo-tier-2' }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    for (const action of ['revoke', 'restore'] as const) await expect(service.mutate(token, input({ action }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expect(service.mutate(token, input({ memberId: 'member-2', contextId: 'child:account-1:2', membershipTierId: 'demo-tier-3' }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('无效等级和空原因被拒绝', async () => {
    await expect(service.mutate(token, input({ membershipTierId: 'unknown' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, input({ reason: '  ' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, input({ reason: '字'.repeat(201) }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('权限、幂等与追溯', () => {
  it('学员只读账号可以查询，不能执行任意权益操作', async () => {
    token = (await auth.login({ loginAccount: 'hq-members-viewer', password: 'Demo@123456' })).token
    expect((await service.detail(token, 'member-1')).member.memberId).toBe('member-1')
    for (const action of ['grant', 'revoke', 'restore'] as const) await expect(service.mutate(token, input({ action }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('普通用户查询权限不能访问孩子档案，失效会话不能读写', async () => {
    token = (await auth.login({ loginAccount: 'hq-users-viewer', password: 'Demo@123456' })).token
    await expect(service.detail(token, 'member-1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await auth.logout()
    await expect(service.mutate(token, input())).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('重复并发请求只发放一次、只生成一条记录', async () => {
    const request = input()
    const [a, b] = await Promise.all([service.mutate(token, request), service.mutate(token, request)])
    expect(a).toEqual(b)
    const detail = await service.detail(token, 'member-1')
    expect(detail.audit).toHaveLength(1)
    expect(detail.member.version).toBe(2)
    await expect(service.mutate(token, { ...request, reason: '不同原因' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('版本冲突不能覆盖先前权益修改', async () => {
    await service.mutate(token, input())
    await expect(service.mutate(token, input({ action: 'revoke', membershipTierId: 'demo-tier-2' }))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    expect((await service.detail(token, 'member-1')).audit).toHaveLength(1)
  })
  it('记录服务验证的总部操作人、受益人、原因和前后状态', async () => {
    const result = await service.mutate(token, input())
    expect(result.operation).toMatchObject({ memberId: 'member-1', accountId: 'account-1', contextId: 'child:account-1:1', operatorId: 'HQ001', before: '未开通', after: '已开通（永久）', reason: '总部核实后人工处理' })
    expect((await service.detail(token, 'member-1')).audit[0].requestId).toBe(result.operation.requestId)
  })
})

it('档案写：编辑资料、绑店、解绑、设状态；版本冲突可拦截', async () => {
  const detail = await service.detail(token, 'member-1')
  const v = detail.member.version
  const updated = await service.profileMutate(token, {
    action: 'update-profile', memberId: 'member-1', name: '林小禾改', birthday: '2018-05-01',
    gradeCode: 'PRIMARY_2', genderCode: 'FEMALE', genderLabel: '女',
    version: v, reason: '联调改资料', idempotencyKey: crypto.randomUUID(),
  })
  expect(updated.member).toMatchObject({ name: '林小禾改', birthday: '2018-05-01', gradeCode: 'PRIMARY_2', genderCode: 'FEMALE', version: v + 1 })

  const stores = (await service.options(token)).stores
  const storeId = stores.find(s => s.storeId === 'shop-2')?.storeId ?? stores[0]?.storeId
  expect(storeId).toBeTruthy()
  const bound = await service.profileMutate(token, {
    action: 'bind-store', memberId: 'member-1', storeId: storeId!, version: v + 1,
    reason: '联调绑店', idempotencyKey: crypto.randomUUID(),
  })
  expect(bound.member.storeId).toBe(storeId)

  const unbound = await service.profileMutate(token, {
    action: 'unbind-store', memberId: 'member-1', storeId, version: v + 2,
    reason: '联调解绑', idempotencyKey: crypto.randomUUID(),
  })
  expect(unbound.member.storeId).toBeNull()

  const paused = await service.profileMutate(token, {
    action: 'set-status', memberId: 'member-1', status: 'INACTIVE', version: v + 3,
    reason: '联调停用', idempotencyKey: crypto.randomUUID(),
  })
  expect(paused.member.status).toBe('INACTIVE')

  await expect(service.profileMutate(token, {
    action: 'set-status', memberId: 'member-1', status: 'ACTIVE', version: v,
    reason: '旧版本', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
