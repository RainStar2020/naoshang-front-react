import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentMutation } from '../types/agents'

let service: typeof import('./agents')['agentsService']
let auth: typeof import('./auth')['authService']
let token: string

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-27T09:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  service = (await import('./agents')).agentsService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('目录含方案参考、区域独占与代理档案，佣金仅为快照', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.planGroups.length).toBeGreaterThan(0)
  expect(catalog.territories.some((t) => t.exclusive)).toBe(true)
  expect(catalog.agents.every((a) => typeof a.commissionSnapshotCents === 'number')).toBe(true)
  expect(catalog.agents.find((a) => a.status === 'EXITED')?.allowedActions).toEqual([])
})

it('分页与状态筛选，关键字命中区域名', async () => {
  const all = await service.list(token, { page: 1, pageSize: 10 })
  expect(all.total).toBe(4)
  expect(all.summary.activeCount).toBe(3)
  const filtered = await service.list(token, { page: 1, pageSize: 10, status: 'ACTIVE', keyword: '浦江' })
  expect(filtered.items.map((x) => x.agentId)).toEqual(['AG001'])
})

it('暂停与恢复监管生效，幂等重试不重复，参数改变冲突', async () => {
  const key = crypto.randomUUID()
  const first = await service.mutate(token, { action: 'suspend', agentId: 'AG001', reason: '区域合规核查暂停', version: 1, idempotencyKey: key })
  expect(first.agent.status).toBe('SUSPENDED')
  expect(first.agent.version).toBe(2)
  const again = await service.mutate(token, { action: 'suspend', agentId: 'AG001', reason: '区域合规核查暂停', version: 1, idempotencyKey: key })
  expect(again.agent.version).toBe(2)
  await expect(service.mutate(token, { action: 'suspend', agentId: 'AG001', reason: '改了原因', version: 1, idempotencyKey: key })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  const resumed = await service.mutate(token, { action: 'resume', agentId: 'AG001', reason: '核查结束恢复', version: 2, idempotencyKey: crypto.randomUUID() })
  expect(resumed.agent.status).toBe('ACTIVE')
})

it('旧版本暂停被拒绝；已退出不可暂停', async () => {
  await expect(service.mutate(token, { action: 'suspend', agentId: 'AG001', reason: '旧版本', version: 0, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await service.mutate(token, { action: 'suspend', agentId: 'AG002', reason: '先暂停', version: 1, idempotencyKey: crypto.randomUUID() })
  await expect(service.mutate(token, { action: 'suspend', agentId: 'AG002', reason: '再用旧版本', version: 1, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, { action: 'suspend', agentId: 'AG003', reason: '已退出', version: 1, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('开启独占时多名在职冲突；关闭独占成功留痕', async () => {
  const catalog = await service.catalog(token)
  const openTerr = catalog.territories.find((t) => t.territoryId === 'terr-hz-bj')!
  expect(openTerr.exclusive).toBe(false)
  // 滨江当前 holder 为已退出 AG003，可开启独占
  const enabled = await service.mutate(token, { action: 'set-exclusivity', territoryId: 'terr-hz-bj', exclusive: true, reason: '滨江改独占', version: openTerr.version, idempotencyKey: crypto.randomUUID() })
  expect(enabled.territories.find((t) => t.territoryId === 'terr-hz-bj')?.exclusive).toBe(true)
  const closed = await service.mutate(token, {
    action: 'set-exclusivity',
    territoryId: 'terr-hz-bj',
    exclusive: false,
    reason: '恢复非独占',
    version: enabled.territories.find((t) => t.territoryId === 'terr-hz-bj')!.version,
    idempotencyKey: crypto.randomUUID(),
  })
  expect(closed.territories.find((t) => t.territoryId === 'terr-hz-bj')?.exclusive).toBe(false)
  expect(closed.audit[0]?.action).toBe('set-exclusivity')
})

it('空原因与未知操作拒绝；只读账号不能管理', async () => {
  await expect(service.mutate(token, { action: 'suspend', agentId: 'AG001', reason: '  ', version: 1, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, { action: 'noop' as AgentMutation['action'], agentId: 'AG001', reason: '非法', version: 1, idempotencyKey: crypto.randomUUID() } as AgentMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const viewerToken = (await auth.login({ loginAccount: 'hq-users-viewer', password: 'Demo@123456' })).token
  await expect(service.list(viewerToken, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('详情审计在暂停后可追溯；响应副本不能改写内存', async () => {
  await service.mutate(token, { action: 'suspend', agentId: 'AG004', reason: '抽查暂停', version: 1, idempotencyKey: crypto.randomUUID() })
  const detail = await service.detail(token, 'AG004')
  expect(detail.agent.status).toBe('SUSPENDED')
  expect(detail.audit.some((a) => a.action === 'suspend')).toBe(true)
  detail.agent.status = 'ACTIVE'
  const again = await service.detail(token, 'AG004')
  expect(again.agent.status).toBe('SUSPENDED')
})
