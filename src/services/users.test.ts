import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserMutation } from '../types/users'

let service: typeof import('./users')['usersService']
let auth: typeof import('./auth')['authService']
let token: string
beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  service = (await import('./users')).usersService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
const change = (overrides: Partial<UserMutation> = {}): UserMutation => ({ accountId: 'account-1', version: 1, reason: '总部核实后调整', idempotencyKey: crypto.randomUUID(), action: 'freeze', frozen: true, ...overrides } as UserMutation)

describe('用户查询、分页与身份边界', () => {
  it('返回全量筛选总数与独立分页，不以当前页冒充总数', async () => {
    const first = await service.list(token, { page: 1, pageSize: 10 })
    const second = await service.list(token, { page: 2, pageSize: 10 })
    expect(first.total).toBe(28)
    expect(first.items).toHaveLength(10)
    expect(second.items[0].accountId).toBe('account-11')
  })
  it('支持手机号、编号和昵称查询', async () => {
    for (const keyword of ['13800000001', 'vip0001', '林晓雅']) {
      const result = await service.list(token, { keyword, page: 1, pageSize: 10 })
      expect(result.items[0].accountId).toBe('account-1')
    }
  })
  it('组合省市区、门店和冻结条件过滤', async () => {
    const result = await service.list(token, { regionCodes: ['410000', '410100'], storeId: 'shop-2', status: 'frozen', page: 1, pageSize: 10 })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every(item => item.frozen && item.storeId === 'shop-2' && item.regionCodes[0] === '410000')).toBe(true)
  })
  it('支持未绑定门店与空结果', async () => {
    const result = await service.list(token, { storeId: 'unbound', page: 1, pageSize: 10 })
    expect(result.total).toBe(4)
    expect(result.items.every(item => item.storeId === null)).toBe(true)
    expect((await service.list(token, { keyword: '不存在的账号', page: 1, pageSize: 10 })).total).toBe(0)
  })
  it('同一账号保留多委任和独立合店合同，不混用孩子ID', async () => {
    const { account } = await service.detail(token, 'account-1')
    expect(account.businessContexts.filter(item => item.assignmentId)).toHaveLength(2)
    expect(account.businessContexts.filter(item => item.contractId)).toHaveLength(1)
    await expect(service.detail(token, 'member-1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('返回数据副本，页面不能通过修改对象绕过服务', async () => {
    const detail = await service.detail(token, 'account-1')
    detail.account.frozen = true
    expect((await service.detail(token, 'account-1')).account.frozen).toBe(false)
  })
  it('非法分页参数被拒绝', async () => {
    await expect(service.list(token, { page: 0, pageSize: 10 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('独立总部权限与会话校验', () => {
  it('无用户模块权限的内容账号无法查询用户', async () => {
    const session = await auth.login({ loginAccount: 'hq-content', password: 'Demo@123456' })
    await expect(service.list(session.token, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('用户查询账号可查询，但三个写操作均被拒绝', async () => {
    const session = await auth.login({ loginAccount: 'hq-users-viewer', password: 'Demo@123456' })
    expect((await service.detail(session.token, 'account-1')).account.accountId).toBe('account-1')
    const inputs: UserMutation[] = [change(), change({ action: 'change-store', storeId: 'shop-2' }), change({ action: 'reset-password', newPassword: 'New@123456' }), change({ action: 'change-display-id', prefix: 'VIP', serial: '9999' })]
    for (const input of inputs) await expect(service.mutate(session.token, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('退出后不能继续读写用户资料', async () => {
    await auth.logout()
    await expect(service.detail(token, 'account-1')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(service.mutate(token, change())).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})

describe('写入、追溯与防重复操作', () => {
  it('冻结/解冻记录版本、原因、操作者、前后状态', async () => {
    const frozen = await service.mutate(token, change())
    expect(frozen.account).toMatchObject({ frozen: true, version: 2 })
    expect(frozen.operation).toMatchObject({ operatorId: 'HQ001', before: '正常', after: '冻结', reason: '总部核实后调整' })
    const active = await service.mutate(token, change({ frozen: false, version: 2 }))
    expect(active.account).toMatchObject({ frozen: false, version: 3 })
    expect((await service.detail(token, 'account-1')).audit).toHaveLength(2)
  })
  it('并发重复提交只生成一条流水；原请求重试返回原结果', async () => {
    const input = change()
    const [a, b] = await Promise.all([service.mutate(token, input), service.mutate(token, input)])
    expect(a).toEqual(b)
    expect((await service.detail(token, 'account-1')).audit).toHaveLength(1)
    await expect(service.mutate(token, { ...input, reason: '修改了参数' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('过期版本不能覆盖新状态', async () => {
    await service.mutate(token, change())
    await expect(service.mutate(token, change({ frozen: false }))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    expect((await service.detail(token, 'account-1')).audit).toHaveLength(1)
  })
  it('换店只改所属门店并记录快照，保留经营身份', async () => {
    const before = await service.detail(token, 'account-1')
    const result = await service.mutate(token, change({ action: 'change-store', storeId: 'shop-2' }))
    expect(result.account.storeId).toBe('shop-2')
    expect(result.account.businessContexts).toEqual(before.account.businessContexts)
    expect(result.operation).toMatchObject({ before: '脑商训练营梧桐街店', after: '脑商训练营桐柏路店' })
  })
  it('拒绝同店、停业和不存在的门店', async () => {
    for (const storeId of ['shop-1', 'shop-closed', 'missing']) {
      await expect(service.mutate(token, change({ action: 'change-store', storeId }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    expect((await service.detail(token, 'account-1')).audit).toHaveLength(0)
  })
  it('所有操作必须填写有效原因', async () => {
    await expect(service.mutate(token, change({ reason: '  ' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, change({ reason: '字'.repeat(201) }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('模拟密码重置不回显密码，幂等重试不重复产生流水', async () => {
    const input = change({ action: 'reset-password', newPassword: 'New@123456' })
    const result = await service.mutate(token, input)
    expect(result.account.passwordResetAt).toBeTruthy()
    expect(JSON.stringify(result)).not.toContain('New@123456')
    expect(JSON.stringify(await service.detail(token, 'account-1'))).not.toContain('New@123456')
    expect(await service.mutate(token, input)).toEqual(result)
    await expect(service.mutate(token, { ...input, newPassword: 'Another@123' } as UserMutation)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('无效密码被拒绝，不改变版本和操作历史', async () => {
    for (const newPassword of ['12345', 'abc def', 'a'.repeat(33)]) {
      await expect(service.mutate(token, change({ action: 'reset-password', newPassword }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    const detail = await service.detail(token, 'account-1')
    expect(detail.account.version).toBe(1)
    expect(detail.audit).toHaveLength(0)
  })
})

describe('账号编号编辑（HQ-02）', () => {
  it('账号编号仅允许四前缀与四位数字，非法无法保存', async () => {
    const detail = await service.detail(token, 'account-1')
    expect(detail.account.displayId).toMatch(/^(VIP|TS|SD|LC)\d{4}$/)
    for (const bad of [
      { prefix: 'XX' as never, serial: '0001' },
      { prefix: 'VIP' as const, serial: '001' },
      { prefix: 'VIP' as const, serial: '00001' },
      { prefix: 'VIP' as const, serial: '00a1' },
    ]) {
      await expect(service.mutate(token, change({ action: 'change-display-id', ...bad }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
    expect((await service.detail(token, 'account-1')).account).toMatchObject({ displayId: detail.account.displayId, version: 1 })
  })

  it('合法修改编号后列表与详情回读，冲突不覆盖', async () => {
    const result = await service.mutate(token, change({ action: 'change-display-id', prefix: 'LC', serial: '8888' }))
    expect(result.account.displayId).toBe('LC8888')
    expect(result.operation).toMatchObject({ action: 'change-display-id', before: 'VIP0001', after: 'LC8888' })
    expect((await service.detail(token, 'account-1')).account.displayId).toBe('LC8888')
    expect((await service.list(token, { keyword: 'LC8888', page: 1, pageSize: 10 })).items[0].accountId).toBe('account-1')
    const other = await service.detail(token, 'account-2')
    await expect(service.mutate(token, {
      action: 'change-display-id', accountId: 'account-2', version: other.account.version,
      prefix: 'LC', serial: '8888', reason: '冲突测试', idempotencyKey: crypto.randomUUID(),
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await service.detail(token, 'account-2')).account.displayId).toBe(other.account.displayId)
  })
})
