import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { OrderMutation, OrderQuery } from '../types/orders'
let service: typeof import('./orders')['ordersService']
let delivery: typeof import('./delivery')['deliveryService']
let auth: typeof import('./auth')['authService']
let token: string
const query = (value: Partial<OrderQuery> = {}): OrderQuery => ({ page: 1, pageSize: 10, ...value })
const confirm = (orderId = 'delivery-demo-order-1', version = 1): Extract<OrderMutation, { action: 'confirm-delivery' }> => ({ action: 'confirm-delivery', orderId, version, reason: '验收非实物交付', evidence: '演示交付记录 DEMO-DELIVER-01', idempotencyKey: crypto.randomUUID() })
const ship = (action: 'ship' | 'update-logistics' = 'ship', orderId = 'delivery-demo-order-5', version = 1): OrderMutation => ({ action, orderId, version, reason: '验收订单物流', logistics: { carrier: '演示物流', trackingNo: 'DEMO-TRACK-1234' }, idempotencyKey: crypto.randomUUID() })
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./orders')).ordersService; delivery = (await import('./delivery')).deliveryService; auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.restoreAllMocks())
it('完整结果统计与分页一致，分页不改变分母或金额', async () => {
  const first = await service.list(token, query()), second = await service.list(token, query({ page: 2 }))
  expect(first.total).toBe(13); expect(first.items).toHaveLength(10); expect(second.items).toHaveLength(3); expect(first.summary).toEqual(second.summary); expect(first.summary.paidCount).toBe(10)
  expect(new Set([...first.items, ...second.items].map(row => row.orderId)).size).toBe(13)
})
it('账号、学员、商品、门店、渠道和状态可组合筛选', async () => {
  const row = (await service.detail(token, 'delivery-demo-order-1')).order
  const result = await service.list(token, query({ accountId: row.accountId, memberId: row.transaction!.memberId!, productId: row.productId, deliveryStoreId: row.deliveryStoreId!, deliveryMode: 'STORE', channel: 'WECHAT', status: 'PAID', fulfillmentStatus: 'WAIT_DELIVERY' }))
  expect(result.items.map(item => item.orderId)).toEqual([row.orderId])
})
it('关键字搜索账号昵称、手机号和订单号，空结果金额为0', async () => {
  expect((await service.list(token, query({ keyword: 'DEMO-DELIVERY-2026101' }))).total).toBeGreaterThan(0)
  expect((await service.list(token, query({ keyword: '13800000001' }))).total).toBe(1)
  expect((await service.list(token, query({ keyword: '不存在的订单' }))).summary).toEqual({ orderCount: 0, paidCount: 0, paidAmount: 0 })
})
it('日期按带时区起止边界筛选，逆序范围报错', async () => {
  const result = await service.list(token, query({ createdFrom: '2026-10-13T00:00:00+08:00', createdTo: '2026-10-13T23:59:59+08:00' })); expect(result.items.map(row => row.orderId)).toEqual(['delivery-demo-order-13'])
  await expect(service.list(token, query({ createdFrom: '2026-10-14T00:00:00+08:00', createdTo: '2026-10-01T00:00:00+08:00' }))).rejects.toThrow('开始时间')
  await expect(service.list(token, query({ createdFrom: '2026-10-01' }))).rejects.toThrow('时区')
})
it('交易金额构成与数量、身份优惠和券快照一致', async () => {
  const tx = (await service.detail(token, 'delivery-demo-order-1')).order.transaction!
  expect(tx.items[0].quantity).toBe(2); expect(tx.goodsAmount).toBe(tx.items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0))
  expect(tx.originalTotalAmount - tx.priceReductionAmount).toBe(tx.goodsAmount); expect(tx.discountAmount).toBe(tx.tierDiscountAmount + tx.coupon!.discountAmount)
  expect(tx.payableAmount).toBe(tx.goodsAmount - tx.discountAmount); expect(tx.payments[0].amount).toBe(tx.payableAmount); expect(tx.coupon).toMatchObject({ couponId: 'demo-coupon-1', title: '演示满减券' })
})
it('原价成交金额券信息不随商品改名改价更新', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-1')).order.transaction
  const products = (await import('./products')).productsService; const product = (await products.catalog(token)).products.find(row => row.draft.productId === 'product-software')!
  product.draft.title = '改名后软件'; product.draft.standardAmount = 1; product.draft.skus[0].amount = 1
  await products.mutate(token, { action: 'save-product', value: product.draft, version: 1, reason: '测试改价', idempotencyKey: crypto.randomUUID() })
  await products.mutate(token, { action: 'on-sale', productId: product.draft.productId, version: 2, reason: '测试发布', idempotencyKey: crypto.randomUUID() })
  const after = (await service.detail(token, 'delivery-demo-order-1')).order; expect(after.transaction).toEqual(before); expect(after.productTitle).toBe('xxx软件卡')
})
it('账号换店不改写交付方与购买人快照', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-1')).order
  const users = (await import('./users')).usersService; await users.mutate(token, { action: 'change-store', accountId: 'account-1', storeId: 'shop-3', version: 1, reason: '测试换店', idempotencyKey: crypto.randomUUID() })
  expect((await service.detail(token, before.orderId)).order).toEqual(before)
})
it('待付款订单不显示成已完成，未成功支付不计入已付合计', async () => {
  const result = await service.list(token, query({ status: 'PENDING_PAYMENT' })); expect(result.total).toBe(1); expect(result.summary.paidAmount).toBe(0); expect(result.items[0].allowedActions).toEqual([])
})
it('取消订单保留取消时间原因和已关闭支付', async () => {
  const result = await service.list(token, query({ status: 'CANCELLED' })); expect(result.total).toBe(2)
  expect(result.items[0].transaction).toMatchObject({ cancelReason: '演示支付超时自动取消', payments: [{ status: 'CLOSED' }] }); expect(result.items[0].allowedActions).toEqual([])
})
it('非实物确认交付由PAID变COMPLETED，不改写付款时间', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-1')).order
  const result = await service.mutate(token, confirm()); expect(result.order).toMatchObject({ status: 'COMPLETED', fulfillmentStatus: 'DELIVERED', allowedActions: [], version: 2 })
  expect(result.order.paidAt).toBe(before.paidAt); expect(result.order.deliveredAt).not.toBeNull(); expect(result.order.transaction).toEqual(before.transaction)
})
it('确认交付不激活专栏、不更改孩子权益', async () => {
  const columns = (await import('./columns')).columnsService, members = (await import('./members')).membersService
  const before = await columns.records(token, 'demo-column-memory'), child = await members.detail(token, 'member-1')
  await service.mutate(token, confirm()); expect(await columns.records(token, 'demo-column-memory')).toEqual(before); expect(await members.detail(token, 'member-1')).toEqual(child)
})
it('交付凭据和原因必填，失败不修改状态或审计', async () => {
  const before = await service.detail(token, 'delivery-demo-order-1')
  await expect(service.mutate(token, { ...confirm(), evidence: '' })).rejects.toThrow('凭据'); await expect(service.mutate(token, { ...confirm(), reason: '' })).rejects.toThrow('原因')
  expect(await service.detail(token, 'delivery-demo-order-1')).toEqual(before)
})
it.each(['delivery-demo-order-3', 'delivery-demo-order-4', 'delivery-demo-order-5', 'delivery-demo-order-8'])('订单%s不能非法确认非实物交付', async orderId => { await expect(service.mutate(token, confirm(orderId))).rejects.toMatchObject({ code: 'INVALID_STATE' }) })
it('履约幂等重试不重复登记，凭据改变拒绝复用请求号', async () => {
  const request = confirm(); await service.mutate(token, request); await service.mutate(token, request); expect((await service.detail(token, request.orderId)).audit).toHaveLength(1)
  await expect(service.mutate(token, { ...request, evidence: '改变凭据' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
})
it('版本冲突拒绝旧履约操作', async () => {
  await delivery.mutate(token, { action: 'change-delivery', orderId: 'delivery-demo-order-1', selectedStoreId: 'shop-2', version: 1, reason: '测试调整', idempotencyKey: crypto.randomUUID() })
  await expect(service.mutate(token, confirm())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('HQ-10交付调整在订单详情同步，且完整金额不变', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-1')).order.transaction
  await delivery.mutate(token, { action: 'change-delivery', orderId: 'delivery-demo-order-1', selectedStoreId: 'shop-2', version: 1, reason: '交付调整', idempotencyKey: crypto.randomUUID() })
  const result = await service.detail(token, 'delivery-demo-order-1'); expect(result.order.deliveryStoreId).toBe('shop-2'); expect(result.order.transaction).toEqual(before); expect(result.audit[0].action).toBe('change-delivery')
})
it('订单发货同步HQ-10仓库，不改变收货快照或实付', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-5')).order
  await service.mutate(token, ship()); const after = (await service.detail(token, before.orderId)).order
  expect(after).toMatchObject({ status: 'PAID', fulfillmentStatus: 'SHIPPED', deliveredAt: null }); expect(after.address).toEqual(before.address); expect(after.transaction).toEqual(before.transaction)
  expect((await delivery.catalog(token)).orders.find(row => row.orderId === before.orderId)?.logistics).toEqual(after.logistics)
})
it('物流修改保留首次发货时间，重复发货拒绝', async () => {
  const before = (await service.detail(token, 'delivery-demo-order-6')).order
  await service.mutate(token, ship('update-logistics', before.orderId)); expect((await service.detail(token, before.orderId)).order.shippedAt).toBe(before.shippedAt)
  await expect(service.mutate(token, ship('ship', before.orderId, 2))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('没有真实金额的交付契约订单不冒充完整交易或已付款', async () => {
  const consumer = await import('./mock/delivery'); const quote = consumer.previewMockDeliveryQuote('account-1', 'product-software', 'shop-1'); const order = consumer.createMockDeliveryOrderFromQuote(quote.quoteId, 'create')
  expect((await service.detail(token, order.orderId)).order).toMatchObject({ transaction: null, status: 'PENDING_PAYMENT', allowedActions: [] })
})
it('不存在订单、非法分页和伪造操作被拒绝', async () => {
  await expect(service.detail(token, 'none')).rejects.toMatchObject({ code: 'NOT_FOUND' }); await expect(service.list(token, query({ page: 0 }))).rejects.toThrow('分页')
  await expect(service.mutate(token, { ...confirm(), action: 'refund' } as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
it('只读账号不能履约且退出后禁止读取', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-order-viewer', password: 'Demo@123456' })).token
  await expect(service.detail(viewer, 'delivery-demo-order-1')).resolves.toBeDefined(); await expect(service.mutate(viewer, confirm())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.mutate(viewer, ship())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await auth.logout(); await expect(service.list(viewer, query())).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('订单操作员无需交付配置权限即可处理订单', async () => {
  const operator = (await auth.login({ loginAccount: 'hq-order-operator', password: 'Demo@123456' })).token
  await expect(service.mutate(operator, confirm())).resolves.toBeDefined(); await expect(delivery.catalog(operator)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('返回的金额、支付和券对象为副本', async () => {
  const result = await service.detail(token, 'delivery-demo-order-1'); result.order.transaction!.coupon!.title = '污染'; result.order.transaction!.payableAmount = 1
  expect((await service.detail(token, result.order.orderId)).order.transaction!.coupon!.title).toBe('演示满减券')
})
