import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { DeliveryMutation, DeliveryPolicyMode } from '../types/delivery'
let service: typeof import('./delivery')['deliveryService']
let mock: typeof import('./mock/delivery')
let auth: typeof import('./auth')['authService']
let token: string
const base = () => ({ version: 1, reason: '验收交付流程', idempotencyKey: crypto.randomUUID() })
const policy = (deliveryMode: DeliveryPolicyMode, version = 0): Extract<DeliveryMutation, { action: 'save-policy' }> => ({ ...base(), action: 'save-policy', productId: 'product-software', deliveryMode, version })
const change = (orderId = 'delivery-demo-order-1', selectedStoreId = 'shop-2', version = 1): DeliveryMutation => ({ ...base(), action: 'change-delivery', orderId, selectedStoreId, version })
const ship = (action: 'ship' | 'update-logistics' = 'ship', orderId = 'delivery-demo-order-5', version = 1): DeliveryMutation => ({ ...base(), action, orderId, version, logistics: { carrier: '演示物流', trackingNo: 'DEMO-SHIP-1234' } })
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./delivery')).deliveryService; mock = await import('./mock/delivery'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.restoreAllMocks())
it('默认按账号绑定有效门店，未绑定或停业绑定不伪造默认值', () => {
  expect(mock.mockCheckoutDeliveryOptions('account-1', 'product-software')).toMatchObject({ defaultStoreId: 'shop-1', deliveryLocked: false })
  expect(mock.mockCheckoutDeliveryOptions('account-6', 'product-software').defaultStoreId).toBeNull()
  expect(mock.mockCheckoutDeliveryOptions('account-7', 'product-software').defaultStoreId).toBeNull()
})
it('总部专供只返回总部且阻止手动传入门店', async () => {
  await service.mutate(token, policy('HEADQUARTERS'))
  expect(mock.mockCheckoutDeliveryOptions('account-1', 'product-software')).toMatchObject({ defaultStoreId: 'headquarters', deliveryLocked: true, stores: [{ id: 'headquarters' }] })
  expect(() => mock.resolveMockCheckoutDelivery('account-1', 'product-software', 'shop-1')).toThrow('允许范围')
})
it('所属门店策略只接受有效门店，拒绝前端伪造总部或停业门店', () => {
  expect(() => mock.resolveMockCheckoutDelivery('account-1', 'product-software', 'headquarters')).toThrow()
  expect(() => mock.resolveMockCheckoutDelivery('account-1', 'product-software', 'shop-closed')).toThrow()
  expect(mock.resolveMockCheckoutDelivery('account-1', 'product-software', 'shop-2')).toMatchObject({ deliveryMode: 'STORE', deliveryStoreId: 'shop-2' })
})
it('冻结账号不能查看交付选项', () => { expect(() => mock.mockCheckoutDeliveryOptions('account-5', 'product-software')).toThrow('冻结') })
it('实物不配置非实物策略，只提供总部物流路径', async () => {
  await expect(service.mutate(token, { ...policy('HEADQUARTERS'), productId: 'product-physical' })).rejects.toThrow('实物')
  expect(mock.mockCheckoutDeliveryOptions('account-1', 'product-physical').deliveryLocked).toBe(true)
})
it('策略变更不改写已有订单快照', async () => {
  const before = (await service.catalog(token)).orders; await service.mutate(token, policy('HEADQUARTERS')); expect((await service.catalog(token)).orders.map(({ allowedActions: _, ...row }) => row)).toEqual(before.map(({ allowedActions: _, ...row }) => row))
})
it('交付报价与创建订单保持交付方一致并幂等', () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); const order = mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'create-1')
  expect(order).toMatchObject({ deliveryStoreId: 'shop-2', deliveryMode: 'STORE', paymentStatus: 'PENDING_PAYMENT', fulfillmentStatus: 'WAIT_DELIVERY' })
  expect(mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'create-1')).toEqual(order)
  expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'create-2')).toThrow('重复下单')
})
it('总部报价创建总部订单，前端不能改写分账方式', async () => {
  await service.mutate(token, policy('HEADQUARTERS')); const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'headquarters')
  expect(mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'hq-create')).toMatchObject({ deliveryMode: 'HEADQUARTERS', deliveryLocked: true, deliveryStoreId: null })
})
it('报价后策略变化必须重新报价', async () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); await service.mutate(token, policy('HEADQUARTERS'))
  expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'create')).toThrow()
})
it('报价过期不能下单', () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); vi.spyOn(Date, 'now').mockReturnValue(quote.expiresAt)
  expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'expired')).toThrow('过期')
})
it('商品下架后旧报价不能使用', async () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); const products = (await import('./products')).productsService
  await products.mutate(token, { ...base(), action: 'off-sale', productId: 'product-software' }); expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'off')).toThrow()
})
it('商品发布版本变化后拒绝旧报价', async () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); const products = (await import('./products')).productsService
  await products.mutate(token, { ...base(), action: 'on-sale', productId: 'product-software' }); expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'new-revision')).toThrow('重新报价')
})
it('账号换店使旧默认范围报价失效，历史订单不变', async () => {
  const quote = mock.previewMockDeliveryQuote('account-1', 'product-software', 'shop-2'); const users = (await import('./users')).usersService
  await users.mutate(token, { ...base(), action: 'change-store', accountId: 'account-1', storeId: 'shop-3' }); expect(() => mock.createMockDeliveryOrderFromQuote(quote.quoteId, 'changed-store')).toThrow('重新报价')
  expect((await service.catalog(token)).orders[0].deliveryStoreId).toBe('shop-1')
})
it('调整交付方只修改此订单，不自动交付、不改账号归属', async () => {
  const before = (await service.catalog(token)).orders[0]; await service.mutate(token, change())
  const after = (await service.catalog(token)).orders[0]; expect(after).toMatchObject({ deliveryStoreId: 'shop-2', fulfillmentStatus: 'WAIT_DELIVERY', paymentStatus: 'PAID', deliveredAt: null, version: 2 })
  expect(after.productTitle).toBe(before.productTitle); expect(mock.mockCheckoutDeliveryOptions('account-1', 'product-software').defaultStoreId).toBe('shop-1')
})
it('订单可调整为总部，不能把总部锁定订单绕回门店', async () => {
  await service.mutate(token, change('delivery-demo-order-1', 'headquarters')); expect((await service.catalog(token)).orders[0].deliveryMode).toBe('HEADQUARTERS')
  await expect(service.mutate(token, change('delivery-demo-order-2'))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('策略锁定后已有门店待交付订单只能改到总部', async () => {
  await service.mutate(token, policy('HEADQUARTERS')); await expect(service.mutate(token, change())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.mutate(token, change('delivery-demo-order-1', 'headquarters'))).resolves.toBeDefined()
})
it.each(['delivery-demo-order-3', 'delivery-demo-order-4'])('已交付或待付款订单 %s 不能改交付方', async orderId => { await expect(service.mutate(token, change(orderId))).rejects.toMatchObject({ code: 'INVALID_STATE' }) })
it('目标门店须有效且不允许无变化提交', async () => {
  await expect(service.mutate(token, change('delivery-demo-order-1', 'shop-closed'))).rejects.toThrow('有效')
  await expect(service.mutate(token, change('delivery-demo-order-1', 'shop-1'))).rejects.toThrow('未改变')
})
it('实物发货记录时间和物流，不冒充签收完成', async () => {
  const before = (await service.catalog(token)).orders[4]; await service.mutate(token, ship()); const after = (await service.catalog(token)).orders[4]
  expect(after).toMatchObject({ fulfillmentStatus: 'SHIPPED', paymentStatus: 'PAID', deliveredAt: null, logistics: { carrier: '演示物流' }, allowedActions: ['update-logistics'] }); expect(after.shippedAt).not.toBeNull(); expect(after.address).toEqual(before.address)
})
it('物流修改不改首次发货时间，记录前后值与原因', async () => {
  const before = (await service.catalog(token)).orders[5]; await service.mutate(token, ship('update-logistics', before.orderId)); const after = (await service.catalog(token)).orders[5]
  expect(after.shippedAt).toBe(before.shippedAt); expect(after.fulfillmentStatus).toBe('SHIPPED'); expect((await service.catalog(token)).audit[0]).toMatchObject({ operatorId: 'HQ001', reason: '验收交付流程', beforeVersion: 1, afterVersion: 2 })
})
it('非实物、已发货、已完成不能再次发货', async () => {
  for (const orderId of ['delivery-demo-order-1', 'delivery-demo-order-6', 'delivery-demo-order-7']) await expect(service.mutate(token, ship('ship', orderId))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('物流校验失败不会改变订单或审计', async () => {
  const before = await service.catalog(token); await expect(service.mutate(token, { ...base(), action: 'ship', orderId: 'delivery-demo-order-5', logistics: { carrier: '', trackingNo: '<script>' } })).rejects.toThrow('物流公司'); expect(await service.catalog(token)).toEqual(before)
})
it('相同请求重试不重复发货，参数变化和版本冲突被拒绝', async () => {
  const request = ship(); await service.mutate(token, request); await service.mutate(token, request); expect((await service.catalog(token)).audit).toHaveLength(1)
  await expect(service.mutate(token, { ...request, reason: '篡改' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }); await expect(service.mutate(token, ship())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('策略需原因、版本与已知模式', async () => {
  await expect(service.mutate(token, { ...policy('HEADQUARTERS'), reason: '' })).rejects.toThrow('原因'); await service.mutate(token, policy('HEADQUARTERS')); await expect(service.mutate(token, policy('BOUND_STORE'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('操作员可调整和发货但无策略权限', async () => {
  const operator = (await auth.login({ loginAccount: 'hq-delivery-operator', password: 'Demo@123456' })).token
  await expect(service.mutate(operator, change())).resolves.toBeDefined(); await expect(service.mutate(operator, ship())).resolves.toBeDefined(); await expect(service.mutate(operator, policy('HEADQUARTERS'))).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.checkoutPreview(operator, 'account-1', 'product-software')).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('只读账号不能写，退出后禁止查询', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-delivery-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(viewer)).resolves.toBeDefined(); await expect(service.mutate(viewer, change())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await auth.logout(); await expect(service.catalog(viewer)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('返回订单副本不能污染记录', async () => { const value = await service.catalog(token); value.orders[0].deliveryStoreName = '污染'; expect((await service.catalog(token)).orders[0].deliveryStoreName).not.toBe('污染') })

