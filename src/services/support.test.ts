import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SupportMutation } from '../types/support'

let service: typeof import('./support')['supportService']
let auth: typeof import('./auth')['authService']
let reset: typeof import('./mock/support')['__resetSupportMockForTests']
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
  service = (await import('./support')).supportService
  auth = (await import('./auth')).authService
  reset = (await import('./mock/support')).__resetSupportMockForTests
  reset()
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含协议缺口说明与客服配置；反馈汇总；完整客服仍为缺口', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.fullCsGapNote).toMatch(/HQ-25|坐席工单|完整.*工单/)
  expect(catalog.agreementNote).toMatch(/user|privacy|PUBLISHED/)
  expect(catalog.supportConfig.fullCustomerServicePending).toBe(true)
  expect(catalog.supportConfig.feedbackMaxImages).toBe(3)
  expect(catalog.agreements.some((a) => a.type === 'user' && a.status === 'PUBLISHED')).toBe(true)
  expect(catalog.agreements.some((a) => a.type === 'privacy' && a.status === 'PUBLISHED')).toBe(true)
  expect(catalog.feedbackSummary.open).toBeGreaterThanOrEqual(2)
  const list = await service.feedbackList(token, { page: 1, pageSize: 10 })
  expect(list.total).toBeGreaterThanOrEqual(3)
  expect(list.items.every((r) => r.mockOnly)).toBe(true)
})

it('只读账号不可写；无权限拒目录；响应不含密码', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-support-viewer', password: 'Demo@123456' })).token
  await expect(service.mutate(viewer, {
    action: 'save-support-config',
    version: 1,
    reason: '试改',
    idempotencyKey: crypto.randomUUID(),
    phone: '4008000000',
    description: 'x',
    feedbackMaxImages: 3,
  })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  const cat = await service.catalog(viewer)
  expect(JSON.stringify(cat)).not.toMatch(/password|Demo@/i)

  const empty = (await auth.login({ loginAccount: 'hq-empty', password: 'Demo@123456' })).token
  await expect(service.catalog(empty)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})

it('保存并发布协议；同类型旧版下线；幂等可重试', async () => {
  const draftId = 'agr-user-draft'
  const keySave = crypto.randomUUID()
  const saved = await service.mutate(token, {
    action: 'save-agreement',
    agreementId: draftId,
    version: 1,
    reason: '修订正文',
    idempotencyKey: keySave,
    title: '用户协议（修订草稿）',
    docVersion: '2026.10.28',
    bodyText: '修订后的用户协议正文。\n第二段。',
  })
  expect(saved.action).toBe('save-agreement')
  expect(await service.mutate(token, {
    action: 'save-agreement',
    agreementId: draftId,
    version: 1,
    reason: '修订正文',
    idempotencyKey: keySave,
    title: '用户协议（修订草稿）',
    docVersion: '2026.10.28',
    bodyText: '修订后的用户协议正文。\n第二段。',
  })).toEqual(saved)

  const afterSave = (await service.catalog(token)).agreements.find((a) => a.agreementId === draftId)!
  const keyPub = crypto.randomUUID()
  const published = await service.mutate(token, {
    action: 'publish-agreement',
    agreementId: draftId,
    version: afterSave.version,
    reason: '发布新版用户协议',
    idempotencyKey: keyPub,
  })
  expect(published.message).toMatch(/同类型旧版已下线|已发布/)
  const cat = await service.catalog(token)
  const publishedUser = cat.agreements.filter((a) => a.type === 'user' && a.status === 'PUBLISHED')
  expect(publishedUser).toHaveLength(1)
  expect(publishedUser[0].agreementId).toBe(draftId)
  expect(cat.agreements.find((a) => a.agreementId === 'agr-user')?.status).toBe('OFFLINE')
})

it('下线已发布协议；版本冲突；原因必填；非法电话与图片上限', async () => {
  const privacy = (await service.catalog(token)).agreements.find((a) => a.agreementId === 'agr-privacy')!
  await expect(service.mutate(token, {
    action: 'offline-agreement',
    agreementId: privacy.agreementId,
    version: privacy.version,
    reason: '',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })

  await expect(service.mutate(token, {
    action: 'offline-agreement',
    agreementId: privacy.agreementId,
    version: 99,
    reason: '旧版本',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

  const off = await service.mutate(token, {
    action: 'offline-agreement',
    agreementId: privacy.agreementId,
    version: privacy.version,
    reason: '临时下线隐私政策',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(off.action).toBe('offline-agreement')
  expect((await service.catalog(token)).agreements.find((a) => a.agreementId === 'agr-privacy')?.status).toBe('OFFLINE')

  const cfg = (await service.catalog(token)).supportConfig
  await expect(service.mutate(token, {
    action: 'save-support-config',
    version: cfg.version,
    reason: '坏电话',
    idempotencyKey: crypto.randomUUID(),
    phone: 'abc',
    description: '说明',
    feedbackMaxImages: 3,
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, {
    action: 'save-support-config',
    version: cfg.version,
    reason: '坏上限',
    idempotencyKey: crypto.randomUUID(),
    phone: '',
    description: '说明',
    feedbackMaxImages: 99,
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('客服配置可保存电话与反馈图片上限；完整客服标志仍为 pending', async () => {
  const cfg = (await service.catalog(token)).supportConfig
  const key = crypto.randomUUID()
  const saved = await service.mutate(token, {
    action: 'save-support-config',
    version: cfg.version,
    reason: '配置客服电话',
    idempotencyKey: key,
    phone: '4008001234',
    description: '工作日 9:00–18:00；完整客服后续提供。',
    feedbackMaxImages: 5,
  })
  expect(saved.catalog?.supportConfig).toMatchObject({
    phone: '4008001234',
    feedbackMaxImages: 5,
    fullCustomerServicePending: true,
  })
  expect(await service.mutate(token, {
    action: 'save-support-config',
    version: cfg.version,
    reason: '配置客服电话',
    idempotencyKey: key,
    phone: '4008001234',
    description: '工作日 9:00–18:00；完整客服后续提供。',
    feedbackMaxImages: 5,
  })).toEqual(saved)
})

it('标记反馈已处理；管理账号可写；筛选 OPEN', async () => {
  const manager = (await auth.login({ loginAccount: 'hq-support-manager', password: 'Demo@123456' })).token
  const openList = await service.feedbackList(manager, { page: 1, pageSize: 20, status: 'OPEN' })
  expect(openList.items.every((i) => i.status === 'OPEN')).toBe(true)
  const target = openList.items.find((i) => i.feedbackId === 'fb-open-001')!
  const handled = await service.mutate(manager, {
    action: 'mark-feedback-handled',
    feedbackId: target.feedbackId,
    version: target.version,
    reason: '已电话回访',
    idempotencyKey: crypto.randomUUID(),
    handleNote: '已引导核对银行卡信息',
  })
  expect(handled.feedback?.status).toBe('HANDLED')
  expect(handled.feedback?.handleNote).toMatch(/银行卡/)
  await expect(service.mutate(manager, {
    action: 'mark-feedback-handled',
    feedbackId: target.feedbackId,
    version: handled.feedback!.version,
    reason: '再标一次',
    idempotencyKey: crypto.randomUUID(),
    handleNote: '重复',
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
