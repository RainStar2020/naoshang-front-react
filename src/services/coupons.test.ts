import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { CouponMutation, CouponTemplateValue } from '../types/coupons'
let service: typeof import('./coupons')['couponsService']
let mock: typeof import('./mock/coupons')
let auth: typeof import('./auth')['authService']
let token: string
const base = () => ({ reason: '验收优惠券', idempotencyKey: crypto.randomUUID() })
const list = () => service.list(token, { page: 1, pageSize: 50 })
const save = (value: CouponTemplateValue, version = 1, templateId = 'demo-template-1'): CouponMutation => ({ ...base(), action: 'save-template', templateId, version, value })
const template = async () => (await service.catalog(token)).templates[0]
const owned = () => mock.mockCouponWallet('account-1')[0]
async function issue(accountIds: string[], templateId = 'demo-template-1') { const row = (await service.catalog(token)).templates.find(row => row.templateId === templateId)!; return service.mutate(token, { ...base(), action: 'issue', templateId, version: row.version, accountIds }) }
const quote = (couponId: string | null = owned().couponId, accountId = 'account-1') => mock.previewMockCouponQuote(accountId, 'product-software', 'sku-software-1', 1, couponId)
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./coupons')).couponsService; mock = await import('./mock/coupons'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.restoreAllMocks())
it('模板已发数量与用户券一致，查询分页取完整集合', async () => {
  expect((await template()).issuedQuantity).toBe(3); expect((await list()).total).toBe(3)
  await issue(['account-4', 'account-6', 'account-7', 'account-8', 'account-9', 'account-11', 'account-12', 'account-13'])
  const first = await service.list(token, { page: 1, pageSize: 10 }); const second = await service.list(token, { page: 2, pageSize: 10 }); expect(first.total).toBe(11); expect(second.items).toHaveLength(1)
})
it('发放保存快照，模板改面额门槛范围不影响旧券', async () => {
  const before = owned(); await service.mutate(token, save({ ...await template(), title: '新版模板', amount: 999, minAmount: 0, scope: { kind: 'products', productIds: ['product-physical'] } }))
  expect(owned()).toEqual(before); const result = await issue(['account-4']); expect((await service.detail(token, result.couponIds[0])).coupon.snapshot.amount).toBe(999)
})
it('停发只限制新发放，已发券仍可报价', async () => {
  await service.mutate(token, save({ ...await template(), enabled: false })); await expect(issue(['account-4'])).rejects.toThrow('停发'); expect(quote().discountAmount).toBe(500)
})
it('单人批量各发一张，幂等重试不重复扣额度', async () => {
  const request: CouponMutation = { ...base(), action: 'issue', templateId: 'demo-template-1', version: 1, accountIds: ['account-4', 'account-6'] }
  const result = await service.mutate(token, request); expect(await service.mutate(token, request)).toEqual(result); expect((await template()).issuedQuantity).toBe(5)
  await expect(service.mutate(token, { ...request, accountIds: ['account-7'] })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
})
it('冻结账号或重复账号使整批失败', async () => {
  await expect(issue(['account-4', 'account-5'])).rejects.toThrow('冻结'); await expect(issue(['account-4', 'account-4'])).rejects.toThrow('不重复'); expect((await list()).total).toBe(3)
})
it('超出总量和单账号限额整批不发', async () => {
  await service.mutate(token, save({ ...await template(), totalQuantity: 4 }))
  await expect(issue(['account-4', 'account-6'])).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' }); expect((await list()).total).toBe(3)
  await issue(['account-1']); await expect(issue(['account-1'])).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
})
it('发券竞争以模板版本阻止旧请求，不超发', async () => {
  await issue(['account-4']); await expect(service.mutate(token, { ...base(), action: 'issue', templateId: 'demo-template-1', version: 1, accountIds: ['account-6'] })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('总量与账号上限不可低于已发数量', async () => {
  await issue(['account-1']); const row = await template()
  await expect(service.mutate(token, save({ ...row, totalQuantity: 3 }, row.version))).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' }); await expect(service.mutate(token, save({ ...row, perAccountLimit: 1 }, row.version))).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
})
it('忽略模板value中伪造的已发计数与主键', async () => {
  await service.mutate(token, save({ ...await template(), issuedQuantity: 0, templateId: 'forged' } as CouponTemplateValue))
  expect(await template()).toMatchObject({ templateId: 'demo-template-1', issuedQuantity: 3 })
})
it.each([-1, 0, 1.5, Infinity])('面额必须为正整数分 %s', async amount => { await expect(service.mutate(token, save({ ...await template(), amount }))).rejects.toThrow('面额') })
it('拒绝无时区有效期、反向有效期和未知商品范围', async () => {
  const value = await template(); await expect(service.mutate(token, save({ ...value, expiresAt: '2027-01-01' }))).rejects.toThrow('有效期')
  await expect(service.mutate(token, save({ ...value, validFrom: value.expiresAt }))).rejects.toThrow('有效期')
  await expect(service.mutate(token, save({ ...value, scope: { kind: 'products', productIds: ['missing'] } }))).rejects.toThrow('适用范围')
})
it('一单零或一张券，报价不提前占用', () => {
  expect(quote(null)).toMatchObject({ discountAmount: 0, payableAmount: 30000 }); expect(quote()).toMatchObject({ goodsAmount: 30000, discountAmount: 500, payableAmount: 29500 }); expect(owned().status).toBe('available')
  expect(() => quote([owned().couponId] as never)).toThrow('最多一张')
})
it('非本人券不能读取为自己钱包或用于报价', () => {
  expect(mock.mockCouponWallet('account-2').some(row => row.couponId === owned().couponId)).toBe(false); expect(() => quote(owned().couponId, 'account-2')).toThrow('不属于')
})
it('指定范围和门槛由服务校验', async () => {
  await service.mutate(token, save({ ...await template(), scope: { kind: 'products', productIds: ['product-physical'] } })); const issued = await issue(['account-4'])
  expect(() => quote(issued.couponIds[0], 'account-4')).toThrow('适用范围')
  await service.mutate(token, save({ ...await template(), scope: { kind: 'all', productIds: [] }, minAmount: 999999 }, 3)); const high = await issue(['account-6']); expect(() => quote(high.couponIds[0], 'account-6')).toThrow('门槛')
})
it('折扣不超商品金额，最低应付为0', async () => {
  await service.mutate(token, save({ ...await template(), amount: 1000000, minAmount: 0 })); const issued = await issue(['account-4']); expect(quote(issued.couponIds[0], 'account-4')).toMatchObject({ discountAmount: 30000, payableAmount: 0 })
})
it('未来生效券允许发放但不可提前使用，到期券不可报价', async () => {
  const now = Date.now(); await service.mutate(token, save({ ...await template(), validFrom: new Date(now + 60000).toISOString(), expiresAt: new Date(now + 120000).toISOString() })); const result = await issue(['account-4'])
  expect((await service.detail(token, result.couponIds[0])).coupon.status).toBe('not-started'); expect(() => quote(result.couponIds[0], 'account-4')).toThrow('尚未生效')
  vi.spyOn(Date, 'now').mockReturnValue(now + 120000); expect((await service.detail(token, result.couponIds[0])).coupon.status).toBe('expired')
})
it('下单占用并禁止第二订单复用，报价重放不重复下单', () => {
  const preview = quote(); const order = mock.reserveMockCouponOrder(preview.quoteId, 'reserve')
  expect(owned()).toMatchObject({ status: 'reserved', reservedOrderId: order.orderId }); expect(() => quote()).toThrow('占用中')
  expect(mock.reserveMockCouponOrder(preview.quoteId, 'reserve')).toEqual(order); expect(() => mock.reserveMockCouponOrder(preview.quoteId, 'reserve-other')).toThrow('已被使用')
})
it('两个预览竞争同一张券，后下单者失败', () => {
  const one = quote(), two = quote(); mock.reserveMockCouponOrder(one.quoteId, 'one'); expect(() => mock.reserveMockCouponOrder(two.quoteId, 'two')).toThrow('占用中')
})
it('支付核销幂等，已用券保留订单和时间', () => {
  const preview = quote(), order = mock.reserveMockCouponOrder(preview.quoteId, 'reserve'); const paid = mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'pay')
  expect(paid.status).toBe('PAID'); expect(mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'pay')).toEqual(paid)
  expect(owned()).toMatchObject({ status: 'used', usedOrderId: order.orderId, reservedOrderId: null }); expect(owned().usedAt).not.toBeNull(); expect(() => quote()).toThrow('已使用')
})
it('未付款取消释放，支付后取消不能释放券', () => {
  const preview = quote(), order = mock.reserveMockCouponOrder(preview.quoteId, 'reserve'); mock.settleMockCouponOrder('account-1', order.orderId, 'cancel', 'cancel'); expect(owned()).toMatchObject({ status: 'available', reservedOrderId: null })
  const next = mock.reserveMockCouponOrder(quote().quoteId, 'reserve2'); mock.settleMockCouponOrder('account-1', next.orderId, 'pay', 'pay'); expect(() => mock.settleMockCouponOrder('account-1', next.orderId, 'cancel', 'cancel2')).toThrow('已付款')
})
it('订单超时自动释放且不能支付，过期券释放后仍过期', async () => {
  const order = mock.reserveMockCouponOrder(quote().quoteId, 'reserve'); vi.spyOn(Date, 'now').mockReturnValue(order.expiresAt)
  expect(owned().status).toBe('available'); expect(() => mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'late')).toThrow('超时')
})
it('报价期间券到期或商品版本变化都不能下单', async () => {
  const preview = quote(); const products = (await import('./products')).productsService
  await products.mutate(token, { action: 'on-sale', productId: 'product-software', version: 1, reason: '测试商品发布', idempotencyKey: crypto.randomUUID() }); expect(() => mock.reserveMockCouponOrder(preview.quoteId, 'old')).toThrow('重新报价')
})
it('结算动作校验账号归属和请求号，不能他人核销', () => {
  const order = mock.reserveMockCouponOrder(quote().quoteId, 'reserve'); expect(() => mock.settleMockCouponOrder('account-2', order.orderId, 'pay', 'theft')).toThrow('不属于')
  mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'same-key'); expect(() => mock.settleMockCouponOrder('account-1', order.orderId, 'cancel', 'same-key')).toThrow('结算动作')
})
it('状态筛选返回占用与核销订单的只读记录', async () => {
  const order = mock.reserveMockCouponOrder(quote().quoteId, 'reserve'); expect((await service.list(token, { page: 1, pageSize: 10, status: 'reserved' })).total).toBe(1)
  mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'pay'); const result = await service.list(token, { page: 1, pageSize: 10, status: 'used' }); expect(result.items[0].usedOrderId).toBe(order.orderId); expect((await service.detail(token, result.items[0].couponId)).audit.map(row => row.action)).toEqual(['use', 'reserve'])
})
it('批次上限、空发放及未授权动作均拒绝', async () => {
  await expect(issue([])).rejects.toThrow('1至50'); await expect(issue(Array.from({ length: 51 }, (_, i) => `account-${i}`))).rejects.toThrow('1至50'); await expect(service.mutate(token, { ...base(), action: 'revoke' } as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
it('发券员不可改模板，只读账号不能发券，退出后禁止查询', async () => {
  const issuer = (await auth.login({ loginAccount: 'hq-coupon-issuer', password: 'Demo@123456' })).token
  const value = (await service.catalog(issuer)).templates[0]; await expect(service.mutate(issuer, save(value))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.mutate(issuer, { ...base(), action: 'issue', templateId: value.templateId, version: value.version, accountIds: ['account-4'] })).resolves.toBeDefined()
  const viewer = (await auth.login({ loginAccount: 'hq-coupon-viewer', password: 'Demo@123456' })).token
  await expect(service.mutate(viewer, { ...base(), action: 'issue', templateId: value.templateId, version: 2, accountIds: ['account-6'] })).rejects.toMatchObject({ code: 'FORBIDDEN' }); await auth.logout(); await expect(service.list(viewer, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('查询返回独立快照，不能通过修改响应改变用户券', () => { const row = owned(); row.snapshot.amount = 1; expect(owned().snapshot.amount).toBe(500) })
it('占用后取消释放为过期券，不会错误恢复可用', async () => {
  const now = Date.now(); await service.mutate(token, save({ ...await template(), validFrom: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString() })); const issued = await issue(['account-4'])
  const order = mock.reserveMockCouponOrder(quote(issued.couponIds[0], 'account-4').quoteId, 'reserve'); vi.spyOn(Date, 'now').mockReturnValue(now + 60000)
  expect((await service.detail(token, issued.couponIds[0])).coupon.status).toBe('reserved'); mock.settleMockCouponOrder('account-4', order.orderId, 'cancel', 'cancel')
  expect((await service.detail(token, issued.couponIds[0])).coupon.status).toBe('expired')
})
it('未下单报价在券到期后不可占用，过期模板不能发新券', async () => {
  const now = Date.now(); await service.mutate(token, save({ ...await template(), validFrom: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString() })); const issued = await issue(['account-4']); const preview = quote(issued.couponIds[0], 'account-4')
  vi.spyOn(Date, 'now').mockReturnValue(now + 60000); expect(() => mock.reserveMockCouponOrder(preview.quoteId, 'late')).toThrow('已过期'); await expect(issue(['account-6'])).rejects.toThrow('过期')
})
it('优惠券生命周期演示不改写HQ-11已有交易快照', async () => {
  const orders = (await import('./orders')).ordersService, before = await orders.detail(token, 'delivery-demo-order-1')
  const order = mock.reserveMockCouponOrder(quote().quoteId, 'reserve'); mock.settleMockCouponOrder('account-1', order.orderId, 'pay', 'pay')
  expect(await orders.detail(token, 'delivery-demo-order-1')).toEqual(before)
})
