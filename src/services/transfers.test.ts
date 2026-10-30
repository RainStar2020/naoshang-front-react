import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TransferMutation } from '../types/transfers'

let service: typeof import('./transfers')['transferService']
let auth: typeof import('./auth')['authService']
let token: string

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T10:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  service = (await import('./transfers')).transferService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含门店与待定口径说明；列表种子覆盖双边待审/单方同意/双方同意待迁移/拒绝/异常', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.pendingPolicy.pending).toBe(true)
  expect(catalog.stores.some(s => s.storeId === 'shop-1')).toBe(true)
  const list = await service.list(token, { page: 1, pageSize: 20 })
  expect(list.total).toBe(8)
  expect(list.summary.pending).toBeGreaterThanOrEqual(2)
  expect(list.summary.awaitingMigration).toBeGreaterThanOrEqual(1)
  expect(list.summary.exceptions).toBeGreaterThanOrEqual(1)
  expect(list.items.every(row => row.mockOnly && row.type === 'TRANSFER')).toBe(true)
  const bilateral = list.items.find(row => row.applicationId === 'transfer-app-4')!
  expect(bilateral).toMatchObject({
    status: 'APPROVED',
    sourceApprovalStatus: 'APPROVED',
    targetApprovalStatus: 'APPROVED',
    migrationStatus: 'AWAITING_SERVER',
  })
})

it('详情提示双方同意不等于已迁移；不暴露密码', async () => {
  const detail = await service.detail(token, 'transfer-app-4')
  expect(detail.migrationHint).toMatch(/服务端/)
  expect(detail.application.migrationStatus).toBe('AWAITING_SERVER')
  expect(detail.pendingPolicy.unusedLessonsNote.length).toBeGreaterThan(10)
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
})

it('查询账号不可仲裁；仲裁拒绝须原因；成功后状态为 REJECTED 且不伪造迁移', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-transfers-viewer', password: 'Demo@123456' })).token
  const draft: TransferMutation = {
    action: 'force-reject',
    applicationId: 'transfer-app-1',
    version: 1,
    reason: '总部仲裁拒绝演示',
    idempotencyKey: crypto.randomUUID(),
  }
  await expect(service.mutate(viewer, draft)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  // mock 会话单例：viewer 登录会顶掉 admin，须重新登录
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.mutate(token, { ...draft, reason: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const key = crypto.randomUUID()
  const ok = await service.mutate(token, { ...draft, idempotencyKey: key })
  expect(ok).toMatchObject({ action: 'force-reject', mockOnly: true })
  expect(ok.application).toMatchObject({ status: 'REJECTED', migrationStatus: 'NOT_STARTED' })
  expect(await service.mutate(token, { ...draft, idempotencyKey: key })).toEqual(ok)
  await expect(service.mutate(token, { ...draft, reason: '改原因', idempotencyKey: key })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
})

it('单方同意仍为 PENDING；标记/清除异常与备注', async () => {
  const list = await service.list(token, { page: 1, pageSize: 20 })
  const oneSide = list.items.find(row => row.applicationId === 'transfer-app-2')!
  expect(oneSide.status).toBe('PENDING')
  expect(oneSide.sourceApprovalStatus).toBe('APPROVED')
  expect(oneSide.targetApprovalStatus).toBe('PENDING')
  const flagged = await service.mutate(token, {
    action: 'flag-exception',
    applicationId: 'transfer-app-2',
    version: oneSide.version,
    reason: '转入门店长时间未审，标记异常',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(flagged.application.exceptionFlag).toBe('FLAGGED')
  const noted = await service.mutate(token, {
    action: 'add-note',
    applicationId: 'transfer-app-2',
    version: flagged.application.version,
    note: '已电话催办转入门店',
    reason: '补充监管备注',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(noted.application.hqNote).toBe('已电话催办转入门店')
  const cleared = await service.mutate(token, {
    action: 'clear-exception',
    applicationId: 'transfer-app-2',
    version: noted.application.version,
    reason: '转入门店已响应',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(cleared.application.exceptionFlag).toBe('NONE')
})

it('仅双方同意且待迁移时可登记服务端回执；版本冲突拒绝；禁止把未同意写成已迁移', async () => {
  const pending = await service.detail(token, 'transfer-app-1')
  await expect(service.mutate(token, {
    action: 'record-migration-receipt',
    applicationId: 'transfer-app-1',
    version: pending.application.version,
    receipt: 'SUCCESS',
    receiptNote: '不应成功',
    reason: '非法登记',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })

  const awaiting = await service.detail(token, 'transfer-app-4')
  expect(awaiting.application.migrationStatus).toBe('AWAITING_SERVER')
  await expect(service.mutate(token, {
    action: 'record-migration-receipt',
    applicationId: 'transfer-app-4',
    version: 999,
    receipt: 'SUCCESS',
    receiptNote: '旧版本',
    reason: '版本冲突演示',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

  const receipted = await service.mutate(token, {
    action: 'record-migration-receipt',
    applicationId: 'transfer-app-4',
    version: awaiting.application.version,
    receipt: 'SUCCESS',
    receiptNote: '服务端回执：学员归属已切换',
    reason: '登记迁移成功回执',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(receipted.application.migrationStatus).toBe('RECEIPTED_SUCCESS')
  expect(receipted.application.migrationReceiptNote).toMatch(/服务端回执/)
  // 回执登记后不可再仲裁拒绝
  await expect(service.mutate(token, {
    action: 'force-reject',
    applicationId: 'transfer-app-4',
    version: receipted.application.version,
    reason: '试图拒绝已迁移',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('无转店权限账号拒绝访问', async () => {
  const empty = (await auth.login({ loginAccount: 'hq-training-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(empty)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.list(empty, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
