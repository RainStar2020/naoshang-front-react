import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { IncomeMutation } from '../types/income'

let service: typeof import('./income')['incomeService']
let auth: typeof import('./auth')['authService']
let reset: typeof import('./mock/income')['__resetIncomeMockForTests']
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
  service = (await import('./income')).incomeService
  auth = (await import('./auth')).authService
  reset = (await import('./mock/income')).__resetIncomeMockForTests
  reset()
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录与列表覆盖多业务线/渠道；金额为整数分；含待分配与奖励', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.engineGapNote).toMatch(/结算引擎/)
  expect(catalog.modules.map(m => m.value)).toEqual(expect.arrayContaining(['wholesale', 'costore', 'agency']))
  const list = await service.list(token, { page: 1, pageSize: 20 })
  expect(list.total).toBeGreaterThanOrEqual(8)
  expect(list.summary.pendingAllocation).toBeGreaterThanOrEqual(2)
  expect(list.items.every(row => row.mockOnly && Number.isInteger(row.amount))).toBe(true)
  expect(list.items.some(row => row.channel === 'GLOBAL_AWARD')).toBe(true)
  expect(list.items.some(row => row.module === 'agency')).toBe(true)
  expect(list.items.some(row => row.allocationStatus === 'PENDING')).toBe(true)
})

it('筛选门店/结算状态；详情含引擎缺口说明且不暴露密码', async () => {
  const filtered = await service.list(token, { page: 1, pageSize: 20, storeId: 'store-wutong' })
  expect(filtered.items.length).toBeGreaterThan(0)
  expect(filtered.items.every(r => r.storeId === 'store-wutong')).toBe(true)
  const pending = await service.list(token, { page: 1, pageSize: 20, settlementStatus: 'PENDING_ALLOCATION' })
  expect(pending.items.every(r => r.settlementStatus === 'PENDING_ALLOCATION')).toBe(true)
  const detail = await service.detail(token, 'inc-wh-003')
  expect(detail.engineGapNote).toMatch(/可提现/)
  expect(detail.entry.amount).toBe(5400)
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
})

it('查询账号不可改分配；改分配后仍待结算且不覆盖历史流水号', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-revenue-viewer', password: 'Demo@123456' })).token
  const draft: IncomeMutation = {
    action: 'reassign-allocation',
    entryId: 'inc-wh-003',
    version: 1,
    targetId: 'hq',
    reason: '总部指定销售方',
    idempotencyKey: crypto.randomUUID(),
  }
  await expect(service.mutate(viewer, draft)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.mutate(token, { ...draft, reason: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const key = crypto.randomUUID()
  const ok = await service.mutate(token, { ...draft, idempotencyKey: key })
  expect(ok).toMatchObject({ action: 'reassign-allocation', mockOnly: true })
  expect(ok.entry).toMatchObject({
    entryId: 'inc-wh-003',
    allocationStatus: 'ALLOCATED',
    settlementStatus: 'PENDING_SETTLEMENT',
    allocationTarget: 'hq',
  })
  expect(ok.entry.version).toBe(2)
  expect(await service.mutate(token, { ...draft, idempotencyKey: key })).toEqual(ok)
  await expect(service.mutate(token, { ...draft, reason: '改原因', idempotencyKey: key })).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
  })
})

it('重算关联新流水且原单金额不变；状态为 RECALC_PENDING', async () => {
  const before = await service.detail(token, 'inc-wh-001')
  const amount = before.entry.amount
  const result = await service.mutate(token, {
    action: 'request-recalc',
    entryId: 'inc-wh-001',
    version: before.entry.version,
    reason: '比例异常需重算',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(result.action).toBe('request-recalc')
  if (result.action !== 'request-recalc') throw new Error('unexpected')
  expect(result.entry.settlementStatus).toBe('RECALC_PENDING')
  expect(result.entry.amount).toBe(amount)
  expect(result.linked.kind).toBe('RECALC')
  expect(result.linked.relatedEntryId).toBe('inc-wh-001')
  const detail = await service.detail(token, 'inc-wh-001')
  expect(detail.entry.amount).toBe(amount)
  expect(detail.related.some(r => r.kind === 'RECALC')).toBe(true)
})

it('冲正新增负向关联流水；原单标记 REVERSED 且金额保留', async () => {
  const before = await service.detail(token, 'inc-co-001')
  const amount = before.entry.amount
  const result = await service.mutate(token, {
    action: 'request-reverse',
    entryId: 'inc-co-001',
    version: before.entry.version,
    reason: '错账冲正演示',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(result.action).toBe('request-reverse')
  if (result.action !== 'request-reverse') throw new Error('unexpected')
  expect(result.entry.settlementStatus).toBe('REVERSED')
  expect(result.entry.amount).toBe(amount)
  expect(result.linked.kind).toBe('REVERSAL')
  expect(result.linked.amount).toBe(-Math.abs(amount))
  expect(result.linked.relatedEntryId).toBe('inc-co-001')
})

it('版本冲突；已分配不可再改分配；待分配不可冲正', async () => {
  await expect(
    service.mutate(token, {
      action: 'reassign-allocation',
      entryId: 'inc-ag-002',
      version: 99,
      targetId: 'self',
      reason: '版本错',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(
    service.mutate(token, {
      action: 'reassign-allocation',
      entryId: 'inc-wh-001',
      version: 1,
      targetId: 'self',
      reason: '已结算不可改分配',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(
    service.mutate(token, {
      action: 'request-reverse',
      entryId: 'inc-ag-002',
      version: 1,
      reason: '待分配勿冲',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
