import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { QuotaRechargeInput } from '../types/quotas'
let service: typeof import('./quotas')['quotasService'], mock: typeof import('./mock/quotas'), auth: typeof import('./auth')['authService'], token: string
const input = (extra: Partial<QuotaRechargeInput> = {}): QuotaRechargeInput => ({ targetAccountId: 'account-24', quotaType: 'ACTIVITY', quantity: 5, version: 1, reason: '总部核对后充值', idempotencyKey: crypto.randomUUID(), ...extra })
const detail = (id = 'account-24') => service.detail(token, id)
const activity = async () => (await detail('account-3')).batches.find(row => row.quotaType === 'ACTIVITY')!
const reserve = async (quantity = 1) => mock.mockReserveActivityQuota({ ownerAccountId: 'account-3', targetAccountId: 'account-6', batchId: (await activity()).batchId, quantity, idempotencyKey: crypto.randomUUID() })
const receipt = (orderId: string, status: 'PAID' | 'CANCELLED' = 'PAID') => ({ orderId, status, paymentReceiptId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })
function invariant(value: Awaited<ReturnType<typeof detail>>) { for (const row of [...value.batches, ...value.owner.balances]) { expect(row.total).toBe(row.remaining + row.reserved + row.used + row.transferred); expect(Math.min(row.remaining, row.reserved, row.used, row.transferred)).toBeGreaterThanOrEqual(0) } }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T09:00:00+08:00')); vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./quotas')).quotasService; mock = await import('./mock/quotas'); auth = (await import('./auth')).authService; token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('完整结果统计不受分页影响，默认只有一个特定联创可充值', async () => {
  const one = await service.list(token, { page: 1, pageSize: 5 }), two = await service.list(token, { page: 2, pageSize: 5 })
  expect(one.total).toBe(9); expect(two.items).toHaveLength(4); expect(one.summary).toEqual(two.summary); expect(one.summary).toMatchObject({ owners: 9, rechargeable: 1, standardRemaining: 180, activityRemaining: 69, reserved: 2 })
})
it('按账号编号、手机号、名字及资格组合筛选', async () => {
  expect((await service.list(token, { page: 1, pageSize: 10, keyword: 'LC0024', eligibility: 'ALLOWED' })).items.map(row => row.ownerAccountId)).toEqual(['account-24'])
  expect((await service.list(token, { page: 1, pageSize: 10, keyword: '13800000024', eligibility: 'DENIED' })).total).toBe(0)
})
it('永久批次和服务费报价与标准/活动类型分离', async () => {
  const value = await detail('account-3'); expect(value.activityServiceFeePerQuota).toBe(200000)
  for (const batch of value.batches) { expect(batch.expiresAt).toBeNull(); expect(batch.refundable).toBe(false); expect(batch.transferable).toBe(batch.quotaType === 'STANDARD') }; invariant(value)
  expect(value.ledger.map(row => row.kind)).toEqual(expect.arrayContaining(['RESERVE', 'RELEASE', 'CONSUME', 'TRANSFER_IN', 'PURCHASE', 'ACTIVITY_GRANT']))
})
it('总部充值新增独立批次、前后余额、原因、操作者与版本', async () => {
  const result = await service.recharge(token, input()), value = await detail()
  expect(result).toMatchObject({ ownerAccountId: 'account-24', targetAccountId: 'account-24', quantity: 5, reason: '总部核对后充值', operatorName: '总部演示账号', beforeVersion: 1, afterVersion: 2 })
  expect(result.before.remaining).toBe(8); expect(result.after.remaining).toBe(13); expect(value.owner.eligibility.remainingLimit).toBe(45)
  expect(value.batches[0]).toMatchObject({ batchId: result.batchId, source: 'HQ_RECHARGE', quotaType: 'ACTIVITY', total: 5, expiresAt: null, transferable: false, sourceOrderId: null }); expect(value.ledger[0].operationId).toBe(result.operationId); expect(value.recharges).toHaveLength(1); invariant(value)
})
it('充值标准名额仅改变标准余额，不改变合伙等级或年度', async () => {
  const partner = await import('./mock/partners'), before = partner.mockPartnerDetail('partner:account-24')
  await service.recharge(token, input({ quotaType: 'STANDARD', quantity: 2 })); const value = await detail()
  expect(value.owner.balances.map(row => row.remaining)).toEqual([22, 8]); expect(partner.mockPartnerDetail('partner:account-24')).toEqual(before)
})
it('同一请求充值重试只入账一次，修改类型/对象/数量拒绝', async () => {
  const request = input(), first = await service.recharge(token, request); expect(await service.recharge(token, request)).toEqual(first)
  for (const extra of [{ quantity: 6 }, { quotaType: 'STANDARD' as const }, { targetAccountId: 'account-12' }]) await expect(service.recharge(token, { ...request, ...extra })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  expect((await detail()).recharges).toHaveLength(1)
})
it('旧名额版本阻止并发重复充值', async () => {
  await service.recharge(token, input()); await expect(service.recharge(token, input())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('单次限额与累计剩余限额按服务校验，用尽后不允许充值', async () => {
  await expect(service.recharge(token, input({ quantity: 21 }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await service.recharge(token, input({ quantity: 20 })); await service.recharge(token, input({ quantity: 20, version: 2 }))
  expect((await detail()).owner.eligibility.remainingLimit).toBe(10)
  await expect(service.recharge(token, input({ quantity: 11, version: 3 }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await service.recharge(token, input({ quantity: 10, version: 3 })); expect((await detail()).owner.eligibility.canRecharge).toBe(false)
  await expect(service.recharge(token, input({ quantity: 1, version: 4 }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('联创身份没有默认特定授权，人工升到联创也不自动获权', async () => {
  expect((await detail('account-12')).owner.eligibility.qualified).toBe(false)
  const partners = (await import('./partners')).partnersService
  await partners.mutate(token, { action: 'upgrade', contextId: 'partner:account-3', targetLevel: 'DEMO-FOUNDER', version: 1, reason: '测试人工升级', idempotencyKey: crypto.randomUUID() })
  expect((await detail('account-3')).owner).toMatchObject({ partnerLevel: 'DEMO-FOUNDER', eligibility: { qualified: false, canRecharge: false } })
  await expect(service.recharge(token, input({ targetAccountId: 'account-3' }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('特定联创冻结或年度到期后仍有资格标记但不可充值', async () => {
  const users = (await import('./users')).usersService; const value = await users.detail(token, 'account-24')
  await users.mutate(token, { action: 'freeze', frozen: true, accountId: 'account-24', version: value.account.version, reason: '测试冻结', idempotencyKey: crypto.randomUUID() })
  expect((await detail()).owner.eligibility).toMatchObject({ qualified: true, canRecharge: false }); await expect(service.recharge(token, input())).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('年度到期状态不受页面缓存影响，历史余额仍可查询', async () => {
  vi.setSystemTime(new Date('2028-01-01T00:00:00+08:00')); token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  expect((await detail()).owner).toMatchObject({ partnerStatus: 'EXPIRED', eligibility: { qualified: true, canRecharge: false } }); await expect(service.recharge(token, input())).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('类型、数量、原因及请求号均校验，拒绝不存在账号', async () => {
  for (const extra of [{ quotaType: 'UNKNOWN' }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.1 }, { quantity: NaN }, { reason: ' ' }, { reason: 'x'.repeat(201) }, { idempotencyKey: '' }]) await expect(service.recharge(token, input(extra as Partial<QuotaRechargeInput>))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.recharge(token, input({ targetAccountId: 'account-1' }))).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('名额只读账号、普通合伙后台账号与退出会话不能充值', async () => {
  token = (await auth.login({ loginAccount: 'hq-quota-viewer', password: 'Demo@123456' })).token
  expect((await detail()).owner.ownerAccountId).toBe('account-24'); await expect(service.recharge(token, input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-partner-operator', password: 'Demo@123456' })).token
  await expect(detail()).rejects.toMatchObject({ code: 'FORBIDDEN' }); token = (await auth.login({ loginAccount: 'hq-quota-operator', password: 'Demo@123456' })).token
  await service.recharge(token, input()); await auth.logout(); await expect(detail()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('总部服务无个人支付、划转、释放或活动退款接口', () => {
  expect(Object.keys(service)).toEqual(['list', 'detail', 'recharge'])
})
it('名额购买创建未付订单不入账，支付成功才产生永久批次', async () => {
  const before = await detail('account-3'), order = mock.mockCreateQuotaPurchase({ ownerAccountId: 'account-3', quantity: 4, idempotencyKey: 'purchase-test' })
  expect(order.status).toBe('UNPAID'); expect((await detail('account-3')).owner.balances).toEqual(before.owner.balances)
  const callback = receipt(order.orderId); expect(mock.mockQuotaPaymentReceipt(callback).status).toBe('PAID'); const after = await detail('account-3')
  expect(after.owner.balances[0].remaining).toBe(before.owner.balances[0].remaining + 4); expect(after.batches[0]).toMatchObject({ sourceOrderId: order.orderId, expiresAt: null, total: 4 }); invariant(after)
})
it('重复支付回执不重复到账，换请求的终态回执也不能再次入账', async () => {
  const order = mock.mockCreateQuotaPurchase({ ownerAccountId: 'account-3', quantity: 2, idempotencyKey: 'purchase-test' }), callback = receipt(order.orderId), first = mock.mockQuotaPaymentReceipt(callback)
  expect(mock.mockQuotaPaymentReceipt(callback)).toEqual(first); const before = await detail('account-3')
  expect(() => mock.mockQuotaPaymentReceipt(receipt(order.orderId))).toThrow(); expect(() => mock.mockQuotaPaymentReceipt({ ...callback, status: 'CANCELLED' })).toThrow(); expect((await detail('account-3')).owner.balances).toEqual(before.owner.balances)
})
it('未付购买取消不增加余额，迟到支付回执不能复活已取消订单', async () => {
  const before = await detail('account-3'), order = mock.mockCreateQuotaPurchase({ ownerAccountId: 'account-3', quantity: 2, idempotencyKey: 'cancel-test' })
  mock.mockQuotaPaymentReceipt(receipt(order.orderId, 'CANCELLED')); expect((await detail('account-3')).owner.balances).toEqual(before.owner.balances)
  expect(() => mock.mockQuotaPaymentReceipt(receipt(order.orderId))).toThrow()
})
it('活动升级付款前只占用，服务端报价每个2000元，成功后转为消耗', async () => {
  const before = await activity(), order = await reserve(2), held = await activity()
  expect(order).toMatchObject({ status: 'UNPAID', unitAmount: 200000, payableAmount: 400000 }); expect(held).toMatchObject({ remaining: before.remaining - 2, reserved: before.reserved + 2, used: before.used })
  mock.mockQuotaPaymentReceipt(receipt(order.orderId)); const after = await activity(); expect(after).toMatchObject({ remaining: before.remaining - 2, reserved: before.reserved, used: before.used + 2 }); invariant(await detail('account-3'))
})
it('未付取消仅释放自己的活动占用，不影响其他未付订单或已消耗量', async () => {
  const before = await activity(), order = await reserve(1); const callback = receipt(order.orderId, 'CANCELLED'); mock.mockQuotaPaymentReceipt(callback); mock.mockQuotaPaymentReceipt(callback)
  expect(await activity()).toEqual(before); expect((await detail('account-3')).ledger[0]).toMatchObject({ kind: 'RELEASE', sourceOrderId: order.orderId, quantity: 1 }); expect((await detail('account-3')).owner.balances[1].reserved).toBe(2)
})
it('活动占用同请求重试不重复占用，余额不足不允许透支', async () => {
  const batch = await activity(), request = { ownerAccountId: 'account-3', targetAccountId: 'account-6', batchId: batch.batchId, quantity: 2, idempotencyKey: 'reserve-test' }
  const first = mock.mockReserveActivityQuota(request); expect(mock.mockReserveActivityQuota(request)).toEqual(first)
  expect((await activity()).remaining).toBe(batch.remaining - 2); expect(() => mock.mockReserveActivityQuota({ ...request, quantity: 3 })).toThrow()
  expect(() => mock.mockReserveActivityQuota({ ...request, quantity: 10, idempotencyKey: 'more' })).toThrow(); invariant(await detail('account-3'))
})
it('活动不能划转，不能占用别人的批次或非直属下级', async () => {
  const batch = await activity(), request = { ownerAccountId: 'account-3', targetAccountId: 'account-6', batchId: batch.batchId, quantity: 1, idempotencyKey: 'ownership-test' }
  expect(() => mock.mockTransferStandardQuota(request)).toThrow(); expect(() => mock.mockReserveActivityQuota({ ...request, ownerAccountId: 'account-6', targetAccountId: 'account-9' })).toThrow()
  expect(() => mock.mockReserveActivityQuota({ ...request, targetAccountId: 'account-24' })).toThrow()
})
it('标准划转有双边关联流水、守恒和幂等，不改变活动余额', async () => {
  const from = await detail('account-3'), to = await detail('account-6'), batch = from.batches.find(row => row.quotaType === 'STANDARD')!
  const request = { ownerAccountId: 'account-3', targetAccountId: 'account-6', batchId: batch.batchId, quantity: 2, idempotencyKey: 'transfer-test' }, operationId = mock.mockTransferStandardQuota(request)
  expect(mock.mockTransferStandardQuota(request)).toBe(operationId); const afterFrom = await detail('account-3'), afterTo = await detail('account-6')
  expect(afterFrom.owner.balances[0].remaining).toBe(from.owner.balances[0].remaining - 2); expect(afterTo.owner.balances[0].remaining).toBe(to.owner.balances[0].remaining + 2)
  expect(afterFrom.ledger[0]).toMatchObject({ operationId, kind: 'TRANSFER_OUT', targetAccountId: 'account-6' }); expect(afterTo.ledger[0]).toMatchObject({ operationId, kind: 'TRANSFER_IN', targetAccountId: 'account-3' }); expect(afterFrom.owner.balances[1]).toEqual(from.owner.balances[1]); invariant(afterFrom); invariant(afterTo)
})
it('返回对象不能修改内存余额或充值授权，额外到期字段不会生效', async () => {
  const value = await detail(); value.owner.eligibility.canRecharge = false; value.batches[0].remaining = 900
  expect((await detail()).owner.eligibility.canRecharge).toBe(true); expect((await detail()).batches[0].remaining).not.toBe(900)
  await service.recharge(token, { ...input(), expiresAt: '2027-01-01', transferable: true } as QuotaRechargeInput); expect((await detail()).batches[0]).toMatchObject({ expiresAt: null, transferable: false })
})
it('分页参数非法、批次所属账号不存在时拒绝', async () => {
  await expect(service.list(token, { page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(service.list(token, { page: 1, pageSize: 99 })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(detail('account-1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('同一支付回执不能用于另一订单，购买创建请求重试不重复建单', async () => {
  const request = { ownerAccountId: 'account-3', quantity: 2, idempotencyKey: 'purchase-retry' }, first = mock.mockCreateQuotaPurchase(request)
  expect(mock.mockCreateQuotaPurchase(request).orderId).toBe(first.orderId)
  const callback = receipt(first.orderId); mock.mockQuotaPaymentReceipt(callback)
  const second = mock.mockCreateQuotaPurchase({ ...request, idempotencyKey: 'another-purchase' })
  expect(() => mock.mockQuotaPaymentReceipt({ ...receipt(second.orderId), paymentReceiptId: callback.paymentReceiptId })).toThrow()
  expect((await detail('account-3')).orders.find(row => row.orderId === second.orderId)?.status).toBe('UNPAID')
})
it('年度全部到期后的首次加载仍能查询历史批次，不在初始化时执行业务', async () => {
  vi.setSystemTime(new Date('2028-01-01T00:00:00+08:00')); vi.resetModules()
  const future = await import('./mock/quotas'), value = future.mockQuotaDetail('account-3')
  expect(value.owner.partnerStatus).toBe('EXPIRED'); expect(value.batches).toHaveLength(3); expect(value.owner.eligibility.canRecharge).toBe(false); invariant(value)
})
