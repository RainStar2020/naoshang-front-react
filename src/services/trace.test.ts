import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TraceMutation } from '../types/trace'

let service: typeof import('./trace')['traceService']
let auth: typeof import('./auth')['authService']
let reset: typeof import('./mock/trace')['__resetTraceMockForTests']
let token: string

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T10:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
    removeItem: (k: string) => { storage.delete(k) },
  })
  service = (await import('./trace')).traceService
  auth = (await import('./auth')).authService
  reset = (await import('./mock/trace')).__resetTraceMockForTests
  reset()
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含上传契约与统一审计缺口说明；资源 assetId=fileId；审计为聚合种子', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.uploadContractNote).toMatch(/upload-intents|completions|READY/)
  expect(catalog.unifiedAuditGapNote).toMatch(/不改写|聚合/)
  expect(catalog.noTicketNote).toMatch(/不是.*工单/)
  expect(catalog.resourceSummary.total).toBeGreaterThanOrEqual(6)
  expect(catalog.taskSummary.failed).toBeGreaterThanOrEqual(1)

  const resources = await service.resources(token, { page: 1, pageSize: 20 })
  expect(resources.items.every((r) => r.assetId === r.fileId && r.mockOnly)).toBe(true)
  expect(resources.items.some((r) => r.status === 'PENDING')).toBe(true)
  expect(resources.items.some((r) => r.status === 'QUARANTINED')).toBe(true)

  const audits = await service.audits(token, { page: 1, pageSize: 20 })
  expect(audits.items.every((a) => a.source === 'AGGREGATED_MOCK')).toBe(true)
  expect(audits.total).toBeGreaterThanOrEqual(6)
})

it('只读账号不可写；无权限拒目录；响应不含密码', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-trace-viewer', password: 'Demo@123456' })).token
  const ready = (await service.resources(viewer, { page: 1, pageSize: 20, status: 'READY' })).items[0]
  await expect(service.mutate(viewer, {
    action: 'quarantine-resource',
    assetId: ready.assetId,
    version: ready.version,
    reason: '试隔离',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(JSON.stringify(await service.catalog(viewer))).not.toMatch(/password|Demo@/i)

  const empty = (await auth.login({ loginAccount: 'hq-empty', password: 'Demo@123456' })).token
  await expect(service.catalog(empty)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})

it('隔离 READY 资源；恢复隔离；幂等可重试', async () => {
  const ready = (await service.resources(token, { page: 1, pageSize: 20 }))
    .items.find((r) => r.assetId === 'ast-avatar-001')!
  const key = crypto.randomUUID()
  const input: TraceMutation = {
    action: 'quarantine-resource',
    assetId: ready.assetId,
    version: ready.version,
    reason: '违规排查',
    idempotencyKey: key,
  }
  const q = await service.mutate(token, input)
  expect(q.resource?.status).toBe('QUARANTINED')
  expect(await service.mutate(token, input)).toEqual(q)

  const restored = await service.mutate(token, {
    action: 'restore-resource',
    assetId: ready.assetId,
    version: q.resource!.version,
    reason: '误隔离恢复',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(restored.resource?.status).toBe('READY')
})

it('仅 FAILED 任务可重试；版本冲突与原因必填；PENDING 不可隔离', async () => {
  const pending = (await service.resources(token, { page: 1, pageSize: 20, status: 'PENDING' })).items[0]
  await expect(service.mutate(token, {
    action: 'quarantine-resource',
    assetId: pending.assetId,
    version: pending.version,
    reason: '试隔离 pending',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })

  const failed = (await service.tasks(token, { page: 1, pageSize: 20, status: 'FAILED' })).items[0]
  await expect(service.mutate(token, {
    action: 'retry-task',
    jobId: failed.jobId,
    version: failed.version,
    reason: '',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })

  await expect(service.mutate(token, {
    action: 'retry-task',
    jobId: failed.jobId,
    version: 99,
    reason: '旧版本',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

  const retried = await service.mutate(token, {
    action: 'retry-task',
    jobId: failed.jobId,
    version: failed.version,
    reason: '重新处理附件',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(retried.task?.status).toBe('PROCESSING')

  const succeeded = (await service.tasks(token, { page: 1, pageSize: 20, status: 'SUCCEEDED' })).items[0]
  await expect(service.mutate(token, {
    action: 'retry-task',
    jobId: succeeded.jobId,
    version: succeeded.version,
    reason: '不应重试成功任务',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('管理账号可写；筛选审计模块；写操作写入聚合审计', async () => {
  const manager = (await auth.login({ loginAccount: 'hq-trace-manager', password: 'Demo@123456' })).token
  const beforeAssets = await service.audits(manager, { page: 1, pageSize: 5, module: 'assets' })
  const beforeAll = await service.audits(manager, { page: 1, pageSize: 5 })
  const ready = (await service.resources(manager, { page: 1, pageSize: 20 }))
    .items.find((r) => r.assetId === 'ast-storefront-002')!
  await service.mutate(manager, {
    action: 'quarantine-resource',
    assetId: ready.assetId,
    version: ready.version,
    reason: '门头照复查',
    idempotencyKey: crypto.randomUUID(),
  })
  const after = await service.audits(manager, { page: 1, pageSize: 5, module: 'assets' })
  expect(after.items[0].action).toBe('quarantine-resource')
  expect(after.items[0].targetId).toBe(ready.assetId)
  expect(after.total).toBe(beforeAssets.total + 1)
  const afterAll = await service.audits(manager, { page: 1, pageSize: 5 })
  expect(afterAll.total).toBe(beforeAll.total + 1)
})

it('任务与资源关键词筛选', async () => {
  const byPurpose = await service.resources(token, { page: 1, pageSize: 20, purpose: 'support-feedback' })
  expect(byPurpose.items.every((r) => r.purpose === 'support-feedback')).toBe(true)
  const byKw = await service.tasks(token, { page: 1, pageSize: 20, keyword: '合成' })
  expect(byKw.items.some((t) => t.kind === 'MATERIAL_COMPOSE')).toBe(true)
})
