import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WithdrawalMutation } from '../types/withdrawals'

let service: typeof import('./withdrawals')['withdrawalService']
let auth: typeof import('./auth')['authService']
let reset: typeof import('./mock/withdrawals')['__resetWithdrawalsMockForTests']
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
  service = (await import('./withdrawals')).withdrawalService
  auth = (await import('./auth')).authService
  reset = (await import('./mock/withdrawals')).__resetWithdrawalsMockForTests
  reset()
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含待定政策与打款缺口说明；列表覆盖待审/处理中/成功/拒绝/回执失败；金额为分', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.pendingPolicy.minAmountPending).toBe(true)
  expect(catalog.payoutGapNote).toMatch(/回执/)
  const list = await service.list(token, { page: 1, pageSize: 20 })
  expect(list.total).toBeGreaterThanOrEqual(7)
  expect(list.summary.pendingReview).toBeGreaterThanOrEqual(2)
  expect(list.summary.processing).toBeGreaterThanOrEqual(1)
  expect(list.summary.receiptFailed).toBeGreaterThanOrEqual(1)
  expect(list.items.every((row) => row.mockOnly && Number.isInteger(row.amount))).toBe(true)
})

it('详情提示不改余额；关联 HQ-22 流水只读；不暴露密码', async () => {
  const detail = await service.detail(token, 'wd-pending-001')
  expect(detail.balanceNote).toMatch(/不改写可用余额/)
  expect(detail.application.relatedIncomeEntryIds).toContain('inc-wh-001')
  expect(detail.payoutGapNote).toMatch(/服务端/)
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
})

it('查询账号不可审核；同意后为 PROCESSING 非 SUCCEEDED；幂等可重放', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-withdrawals-viewer', password: 'Demo@123456' })).token
  const draft: WithdrawalMutation = {
    action: 'approve',
    withdrawalId: 'wd-pending-001',
    version: 1,
    reason: '资料齐全同意打款',
    idempotencyKey: crypto.randomUUID(),
  }
  await expect(service.mutate(viewer, draft)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.mutate(token, { ...draft, reason: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const key = crypto.randomUUID()
  const ok = await service.mutate(token, { ...draft, idempotencyKey: key })
  expect(ok).toMatchObject({ action: 'approve', mockOnly: true })
  expect(ok.application).toMatchObject({ status: 'PROCESSING', payoutReceiptStatus: 'NONE' })
  expect(ok.application.status).not.toBe('SUCCEEDED')
  expect(await service.mutate(token, { ...draft, idempotencyKey: key })).toEqual(ok)
  await expect(service.mutate(token, { ...draft, reason: '改原因', idempotencyKey: key })).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
  })
})

it('拒绝须原因；拒绝后不可再登记回执；不伪造到账', async () => {
  const key = crypto.randomUUID()
  const rejected = await service.mutate(token, {
    action: 'reject',
    withdrawalId: 'wd-pending-002',
    version: 1,
    reason: '银行卡信息与实名不符',
    idempotencyKey: key,
  })
  expect(rejected.application).toMatchObject({
    status: 'REJECTED',
    rejectionReason: '银行卡信息与实名不符',
  })
  await expect(
    service.mutate(token, {
      action: 'register-receipt',
      withdrawalId: 'wd-pending-002',
      version: rejected.application.version,
      receipt: 'SUCCESS',
      reason: '不应成功',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('处理中可登记成功/失败回执；失败后仍可重试；成功才 SUCCEEDED', async () => {
  const before = await service.detail(token, 'wd-processing-001')
  const fail = await service.mutate(token, {
    action: 'register-receipt',
    withdrawalId: 'wd-processing-001',
    version: before.application.version,
    receipt: 'FAILED',
    reason: '通道超时',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(fail.application).toMatchObject({
    status: 'PROCESSING',
    payoutReceiptStatus: 'FAILED',
  })
  const ok = await service.mutate(token, {
    action: 'register-receipt',
    withdrawalId: 'wd-processing-001',
    version: fail.application.version,
    receipt: 'SUCCESS',
    reason: '通道回执成功',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(ok.application).toMatchObject({
    status: 'SUCCEEDED',
    payoutReceiptStatus: 'SUCCESS',
  })
  expect(ok.application.voucherUrl).toMatch(/mock-assets\.invalid/)
})

it('版本冲突；已完成不可再同意；待审核不可直接登记回执', async () => {
  await expect(
    service.mutate(token, {
      action: 'approve',
      withdrawalId: 'wd-pending-003',
      version: 99,
      reason: '版本错',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(
    service.mutate(token, {
      action: 'approve',
      withdrawalId: 'wd-ok-001',
      version: 3,
      reason: '已完成不可再审',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(
    service.mutate(token, {
      action: 'register-receipt',
      withdrawalId: 'wd-pending-003',
      version: 1,
      receipt: 'SUCCESS',
      reason: '未审核不可回执',
      idempotencyKey: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
