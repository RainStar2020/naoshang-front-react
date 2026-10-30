import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TrainingMutation } from '../types/training'

let service: typeof import('./training')['trainingService']
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
  service = (await import('./training')).trainingService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含门店/类型；课时列表种子对齐 HQ-03 学员且剩余=总量-已用', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.kinds.map(row => row.value)).toEqual(['training', 'self-study', 'camp'])
  expect(catalog.buckets.map(row => row.value)).toEqual(['training', 'special'])
  const list = await service.balances(token, { page: 1, pageSize: 10 })
  expect(list.total).toBe(24)
  expect(list.items[0]).toMatchObject({ mockOnly: true })
  expect(list.items[0].trainingRemaining).toBe(list.items[0].trainingTotal - list.items[0].trainingUsed)
  expect(list.items[0].specialRemaining).toBe(list.items[0].specialTotal - list.items[0].specialUsed)
})

it('反馈列表含门店侧与总部代写种子；详情可查附件元数据且无密码', async () => {
  const list = await service.feedbackList(token, { page: 1, pageSize: 20 })
  expect(list.summary.feedback).toBeGreaterThanOrEqual(4)
  expect(list.items.some(row => row.origin === 'hq-proxy')).toBe(true)
  const detail = await service.feedbackDetail(token, list.items.find(row => row.memberId === 'member-1')!.feedbackId)
  expect(detail.body.length).toBeGreaterThan(0)
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
})

it('总部代写反馈须标题正文与原因；成功后可在列表查到 hq-proxy', async () => {
  const bad: TrainingMutation = {
    action: 'proxy-feedback', memberId: 'member-2', kind: 'training', title: '', body: '内容', reason: '代写', idempotencyKey: crypto.randomUUID(),
  }
  await expect(service.mutate(token, bad)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const key = crypto.randomUUID()
  const ok = await service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-2', kind: 'training', title: '总部代写标题', body: '代写正文内容足够长。', reason: '门店侧无法提交，总部代写', idempotencyKey: key,
  }) as { feedback: { feedbackId: string; origin: string; status: string } }
  expect(ok.feedback).toMatchObject({ origin: 'hq-proxy', status: 'PUBLISHED' })
  expect(await service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-2', kind: 'training', title: '总部代写标题', body: '代写正文内容足够长。', reason: '门店侧无法提交，总部代写', idempotencyKey: key,
  })).toEqual(ok)
  await expect(service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-2', kind: 'training', title: '总部代写标题', body: '代写正文内容足够长。', reason: '改原因', idempotencyKey: key,
  })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
})

it('可撤回已发布反馈；重复撤回与版本冲突拒绝', async () => {
  const created = await service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-4', kind: 'camp', title: '待撤回', body: '正文', reason: '代写后撤回演示', idempotencyKey: crypto.randomUUID(),
  }) as { feedback: { feedbackId: string; version: number } }
  const withdrawn = await service.mutate(token, {
    action: 'withdraw-feedback', feedbackId: created.feedback.feedbackId, version: created.feedback.version, reason: '内容需撤回', idempotencyKey: crypto.randomUUID(),
  }) as { feedback: { status: string; version: number } }
  expect(withdrawn.feedback).toMatchObject({ status: 'WITHDRAWN', version: 2 })
  await expect(service.mutate(token, {
    action: 'withdraw-feedback', feedbackId: created.feedback.feedbackId, version: 1, reason: '旧版本', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, {
    action: 'withdraw-feedback', feedbackId: created.feedback.feedbackId, version: 2, reason: '再次撤回', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('课时核销递减余量；超余量与非正整数拒绝；版本冲突拒绝', async () => {
  const before = await service.memberDetail(token, 'member-1')
  const rem = before.balance.trainingRemaining
  await expect(service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-1', bucket: 'training', quantity: rem + 1, version: before.balance.version,
    reason: '超余量', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-1', bucket: 'training', quantity: 0, version: before.balance.version,
    reason: '非法', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const qty = Math.min(2, Math.max(1, rem))
  const key = crypto.randomUUID()
  const first = await service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-1', bucket: 'training', quantity: qty, version: before.balance.version,
    reason: '总部逐次核销演示', idempotencyKey: key,
  }) as { balance: { trainingUsed: number; trainingRemaining: number; version: number }; record: { quantity: number } }
  expect(first.record.quantity).toBe(qty)
  expect(first.balance.trainingUsed).toBe(before.balance.trainingUsed + qty)
  expect(first.balance.trainingRemaining).toBe(before.balance.trainingRemaining - qty)
  expect(first.balance.version).toBe(before.balance.version + 1)
  expect(await service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-1', bucket: 'training', quantity: qty, version: before.balance.version,
    reason: '总部逐次核销演示', idempotencyKey: key,
  })).toEqual(first)
  await expect(service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-1', bucket: 'training', quantity: 1, version: before.balance.version,
    reason: '旧版本', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})

it('只读账号可查；无 feedback/consume 拒绝写；无模块权限拒绝', async () => {
  token = (await auth.login({ loginAccount: 'hq-training-viewer', password: 'Demo@123456' })).token
  expect((await service.balances(token, { page: 1, pageSize: 5 })).total).toBe(24)
  await expect(service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-1', kind: 'training', title: 'x', body: 'y', reason: '无权限', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-training-feedback', password: 'Demo@123456' })).token
  await service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-5', kind: 'training', title: '反馈权代写', body: '正文', reason: '有反馈权', idempotencyKey: crypto.randomUUID(),
  })
  await expect(service.mutate(token, {
    action: 'consume-lessons', memberId: 'member-5', bucket: 'special', quantity: 1, version: 1, reason: '无核销权', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-training-consumer', password: 'Demo@123456' })).token
  const detail = await service.memberDetail(token, 'member-5')
  if (detail.balance.specialRemaining > 0) {
    await service.mutate(token, {
      action: 'consume-lessons', memberId: 'member-5', bucket: 'special', quantity: 1, version: detail.balance.version,
      reason: '有核销权', idempotencyKey: crypto.randomUUID(),
    })
  }
  await expect(service.mutate(token, {
    action: 'proxy-feedback', memberId: 'member-5', kind: 'training', title: '无反馈权', body: '正文', reason: '无反馈权', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-stores-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('会话失效拒绝；快照隔离；非法分页与未知对象拒绝', async () => {
  const list = await service.balances(token, { page: 1, pageSize: 5 })
  list.items[0].memberName = '篡改'
  expect((await service.balances(token, { page: 1, pageSize: 5 })).items[0].memberName).not.toBe('篡改')
  await auth.logout()
  await expect(service.balances(token, { page: 1, pageSize: 5 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.balances(token, { page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.memberDetail(token, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(service.feedbackDetail(token, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
