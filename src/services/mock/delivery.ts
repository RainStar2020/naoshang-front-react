import { seedOrderTransaction } from './orderSnapshots'
import type { HqAccount } from '../../types/auth'
import { DeliveryError, type CheckoutDeliveryOptions, type DeliveryAction, type DeliveryCatalog, type DeliveryLogistics, type DeliveryMutation, type DeliveryOrder, type DeliveryPolicy, type DeliveryPolicyMode } from '../../types/delivery'
import { mockProductCatalog, readMockProduct } from './products'
import { mockListUsers, mockUserDetail, mockUserOptions } from './users'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: DeliveryError['code'], message: string): never => { throw new DeliveryError(code, message) }
const policies: DeliveryPolicy[] = []
const audit: DeliveryCatalog['audit'] = []
const operations = new Map<string, { payload: string; result: DeliveryCatalog }>()
const product = (id: string) => mockProductCatalog().products.find(row => row.draft.productId === id) ?? fail('NOT_FOUND', '商品不存在')
function policy(id: string): DeliveryPolicy {
  const row = product(id)
  if (row.draft.fulfillmentType === 'PHYSICAL') fail('INVALID_INPUT', '实物使用总部物流发货，不配置非实物交付策略')
  return policies.find(item => item.productId === id) ?? { productId: id, deliveryMode: 'BOUND_STORE', deliveryLocked: false, version: 0 }
}
const initialProducts = mockProductCatalog().products
const orders: DeliveryOrder[] = Array.from({ length: 7 }, (_, i) => {
  const physical = i >= 4, p = initialProducts[physical ? 0 : i === 2 ? 4 : 1].draft, hq = i === 1 || physical
  const paid = i !== 3, shipped = i === 5, delivered = i === 6 || i === 2
  return { orderId: `delivery-demo-order-${i + 1}`, orderNo: `DEMO-DELIVERY-202610${i + 1}`, accountId: `account-${i + 1}`, productId: p.productId, productTitle: p.title, fulfillmentType: p.fulfillmentType, paymentStatus: paid ? 'PAID' : 'PENDING_PAYMENT', fulfillmentStatus: physical ? delivered ? 'DELIVERED' : shipped ? 'SHIPPED' : 'WAIT_SHIP' : delivered ? 'DELIVERED' : 'WAIT_DELIVERY', deliveryMode: hq ? 'HEADQUARTERS' : 'STORE', deliveryStoreId: hq ? null : 'shop-1', deliveryStoreName: hq ? '总部交付' : '脑商训练营梧桐街店', deliveryLocked: physical || i === 1, version: 1, createdAt: '2026-10-01T09:00:00+08:00', paidAt: paid ? '2026-10-01T09:05:00+08:00' : null, deliveredAt: delivered ? '2026-10-02T09:00:00+08:00' : null, shippedAt: shipped || physical && delivered ? '2026-10-01T14:00:00+08:00' : null, address: physical ? { recipient: '演示收件人', phone: '13800000001', regionNames: ['河南省', '郑州市', '中原区'], detail: '演示地址1号（非真实收货地址）' } : null, logistics: shipped || physical && delivered ? { carrier: '演示快递', trackingNo: `DEMO-TRACK-${i + 1}` } : null, mockOnly: true, transaction: null }
})
// HQ-11补充取消、线下服务及多页演示订单，前7个既有ID保持稳定。
for (let i = 7; i < 13; i++) {
  const template = copy(orders[i % 2 === 0 ? 0 : 4]), p = initialProducts[i % 2 === 0 ? 2 : 0].draft
  const cancelled = i === 7 || i === 8
  orders.push({ ...template, orderId: `delivery-demo-order-${i + 1}`, orderNo: `DEMO-DELIVERY-202610${i + 1}`, accountId: `account-${i + 1}`, productId: p.productId, productTitle: p.title, fulfillmentType: p.fulfillmentType, paymentStatus: cancelled ? 'CANCELLED' : 'PAID', paidAt: cancelled ? null : template.paidAt, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T09:00:00+08:00` })
}
for (const [index, row] of orders.entries()) row.transaction = seedOrderTransaction(row, initialProducts.find(p => p.draft.productId === row.productId)!.draft, index)
const findOrder = (id: string) => orders.find(row => row.orderId === id) ?? fail('NOT_FOUND', '订单不存在')
function allowed(row: DeliveryOrder): DeliveryAction[] {
  if (row.paymentStatus !== 'PAID' || row.deliveredAt) return []
  if (row.fulfillmentType === 'PHYSICAL') return row.fulfillmentStatus === 'WAIT_SHIP' ? ['ship'] : row.fulfillmentStatus === 'SHIPPED' ? ['update-logistics'] : []
  return row.fulfillmentStatus === 'WAIT_DELIVERY' && !(row.deliveryMode === 'HEADQUARTERS' && (row.deliveryLocked || policy(row.productId).deliveryLocked)) ? ['change-delivery'] : []
}
export function mockDeliveryCatalog(): DeliveryCatalog { const catalog = mockProductCatalog(); return copy({ policies: catalog.products.filter(row => row.draft.fulfillmentType !== 'PHYSICAL').map(row => policy(row.draft.productId)), products: catalog.products.map(row => ({ productId: row.draft.productId, title: row.draft.title, fulfillmentType: row.draft.fulfillmentType, status: row.status })), stores: mockUserOptions().stores, accounts: mockListUsers({ page: 1, pageSize: 50 }).items.map(row => ({ accountId: row.accountId, nickname: row.nickname, phone: row.phone })), orders: orders.map(row => ({ ...row, allowedActions: allowed(row) })), audit: [...audit].reverse() }) }
function logistics(value: DeliveryLogistics) { if (!value.carrier.trim() || value.carrier.trim().length > 40 || !/^[A-Za-z0-9-]{4,64}$/.test(value.trackingNo.trim())) fail('INVALID_INPUT', '请填写1至40字物流公司及4至64位字母/数字/连字符单号'); return { carrier: value.carrier.trim(), trackingNo: value.trackingNo.trim() } }
export function mockDeliveryMutate(input: DeliveryMutation, operator: HqAccount) {
  if (!['save-policy', 'change-delivery', 'ship', 'update-logistics'].includes(input.action) || !input.reason.trim() || input.reason.trim().length > 200 || !input.idempotencyKey) fail('INVALID_INPUT', '交付操作、原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(previous.result) }
  let targetId: string, before: string, after: string
  if (input.action === 'save-policy') {
    const old = policy(input.productId)
    if (old.version !== input.version) fail('VERSION_CONFLICT', '交付策略已更新，请刷新')
    if (!['BOUND_STORE', 'HEADQUARTERS'].includes(input.deliveryMode)) fail('INVALID_INPUT', '交付策略无效')
    const value: DeliveryPolicy = { productId: input.productId, deliveryMode: input.deliveryMode, deliveryLocked: input.deliveryMode === 'HEADQUARTERS', version: old.version + 1 }
    targetId = input.productId; before = JSON.stringify(old); after = JSON.stringify(value)
    const index = policies.findIndex(row => row.productId === input.productId); if (index >= 0) policies[index] = value; else policies.push(value)
  } else {
    const row = findOrder(input.orderId)
    if (row.version !== input.version) fail('VERSION_CONFLICT', '订单交付已更新，请刷新')
    if (!allowed(row).includes(input.action)) fail('INVALID_STATE', '当前付款或履约状态不允许此操作')
    targetId = row.orderId; before = JSON.stringify(row)
    if (input.action === 'change-delivery') {
      if (input.selectedStoreId !== 'headquarters' && (row.deliveryLocked || policy(row.productId).deliveryLocked)) fail('FORBIDDEN', '总部专供锁定，不能改为门店交付')
      const store = input.selectedStoreId === 'headquarters' ? null : mockUserOptions().stores.find(store => store.storeId === input.selectedStoreId && store.active) ?? fail('INVALID_INPUT', '请选择有效交付门店')
      if ((store?.storeId ?? null) === row.deliveryStoreId && row.deliveryMode === (store ? 'STORE' : 'HEADQUARTERS')) fail('INVALID_INPUT', '目标交付方未改变')
      row.deliveryMode = store ? 'STORE' : 'HEADQUARTERS'; row.deliveryStoreId = store?.storeId ?? null; row.deliveryStoreName = store?.name ?? '总部交付'
    } else {
      const value = logistics(input.logistics)
      if (input.action === 'update-logistics' && JSON.stringify(value) === JSON.stringify(row.logistics)) fail('INVALID_INPUT', '物流资料未改变')
      if (input.action === 'ship' && !row.address) fail('INVALID_STATE', '缺少收货快照，不能发货')
      row.logistics = value
      if (input.action === 'ship') { row.fulfillmentStatus = 'SHIPPED'; row.shippedAt = new Date().toISOString() }
    }
    row.version++; after = JSON.stringify(row)
  }
  audit.push({ operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action: input.action, targetId, operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(), before, after, beforeVersion: input.version, afterVersion: input.version + 1, occurredAt: new Date().toISOString() })
  const result = mockDeliveryCatalog(); operations.set(key, { payload, result: copy(result) }); return result
}
/** 消费端交付契约Mock，正式接口必须从已认证会话取得accountId。不提供前端自选分账方式。 */
export function mockCheckoutDeliveryOptions(accountId: string, productId: string): CheckoutDeliveryOptions {
  const account = mockUserDetail(accountId).account
  if (account.frozen) fail('FORBIDDEN', '账号已冻结')
  const current = readMockProduct(productId), managed = product(productId)
  const value = current.fulfillmentType === 'PHYSICAL' ? { deliveryMode: 'HEADQUARTERS' as DeliveryPolicyMode, deliveryLocked: true, version: 0 } : policy(productId)
  const stores = value.deliveryLocked ? [{ id: 'headquarters', name: '总部交付' }] : mockUserOptions().stores.filter(row => row.active).map(row => ({ id: row.storeId, name: row.name }))
  return copy({ accountId, productId, productRevision: managed.publication!.revision, policyVersion: value.version, defaultStoreId: value.deliveryLocked ? 'headquarters' : stores.some(row => row.id === account.storeId) ? account.storeId : null, deliveryLocked: value.deliveryLocked, stores })
}
export function resolveMockCheckoutDelivery(accountId: string, productId: string, selectedStoreId: string) {
  const options = mockCheckoutDeliveryOptions(accountId, productId), selected = options.stores.find(row => row.id === selectedStoreId) ?? fail('FORBIDDEN', '选择的交付方不在服务端允许范围内')
  return { options, deliveryMode: selected.id === 'headquarters' ? 'HEADQUARTERS' as const : 'STORE' as const, deliveryStoreId: selected.id === 'headquarters' ? null : selected.id, deliveryStoreName: selected.name }
}
interface DeliveryQuote { quoteId: string; accountId: string; productId: string; selectedStoreId: string; resolved: ReturnType<typeof resolveMockCheckoutDelivery>; expiresAt: number }
const consumedQuotes = new Set<string>()
const quotes = new Map<string, DeliveryQuote>(), creations = new Map<string, { quoteId: string; order: DeliveryOrder }>()
/** 仅验证交付在options→quote→order之间的一致性，不计算金额、不支付、不预占库存。 */
export function previewMockDeliveryQuote(accountId: string, productId: string, selectedStoreId: string) { const resolved = resolveMockCheckoutDelivery(accountId, productId, selectedStoreId); const value = { quoteId: crypto.randomUUID(), accountId, productId, selectedStoreId, resolved, expiresAt: Date.now() + 5 * 60000 }; quotes.set(value.quoteId, copy(value)); return copy(value) }
export function createMockDeliveryOrderFromQuote(quoteId: string, requestId: string) {
  const quote = quotes.get(quoteId) ?? fail('NOT_FOUND', '请先校验交付报价')
  if (!requestId) fail('INVALID_INPUT', '缺少演示下单请求号')
  const key = `${quote.accountId}:${requestId}`, old = creations.get(key)
  if (old) { if (old.quoteId !== quoteId) fail('IDEMPOTENCY_CONFLICT', '请求号不能更换报价'); return copy(old.order) }
  if (consumedQuotes.has(quoteId)) fail('INVALID_STATE', '此报价已生成演示订单，请勿重复下单')
  if (quote.expiresAt <= Date.now()) fail('INVALID_STATE', '报价已过期')
  const latest = resolveMockCheckoutDelivery(quote.accountId, quote.productId, quote.selectedStoreId)
  if (JSON.stringify(latest) !== JSON.stringify(quote.resolved)) fail('VERSION_CONFLICT', '商品、门店或交付策略已变化，请重新报价')
  const p = readMockProduct(quote.productId)
  if (p.fulfillmentType === 'PHYSICAL') fail('INVALID_INPUT', '实物下单还需收货地址，本交付契约演示不创建实物订单')
  const row: DeliveryOrder = { orderId: crypto.randomUUID(), orderNo: `DEMO-DELIVERY-${crypto.randomUUID()}`, accountId: quote.accountId, productId: quote.productId, productTitle: p.title, fulfillmentType: p.fulfillmentType, paymentStatus: 'PENDING_PAYMENT', fulfillmentStatus: 'WAIT_DELIVERY', deliveryMode: latest.deliveryMode, deliveryStoreId: latest.deliveryStoreId, deliveryStoreName: latest.deliveryStoreName, deliveryLocked: latest.options.deliveryLocked, version: 1, createdAt: new Date().toISOString(), paidAt: null, deliveredAt: null, shippedAt: null, address: null, logistics: null, mockOnly: true, transaction: null }
  orders.push(row); consumedQuotes.add(quoteId); creations.set(key, { quoteId, order: copy(row) }); return copy(row)
}




/** HQ-11复用同一交付仓库；确认交付不发码、不激活权益。 */
export function mockConfirmOrderDelivery(input: { orderId: string; version: number; reason: string; idempotencyKey: string; evidence: string }, operator: HqAccount) {
  if (!input.reason.trim() || input.reason.trim().length > 200 || !input.idempotencyKey || !input.evidence.trim() || input.evidence.trim().length > 300) fail('INVALID_INPUT', '请填写操作原因、1至300字交付凭据说明和请求号')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify({ ...input, action: 'confirm-delivery' }), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(previous.result) }
  const row = findOrder(input.orderId)
  if (row.version !== input.version) fail('VERSION_CONFLICT', '订单已更新，请刷新')
  if (row.paymentStatus !== 'PAID' || row.fulfillmentType === 'PHYSICAL' || row.fulfillmentStatus !== 'WAIT_DELIVERY' || row.deliveredAt || !row.transaction) fail('INVALID_STATE', '仅已付款、待交付且有完整交易快照的非实物订单可确认交付')
  const before = JSON.stringify(row)
  row.fulfillmentStatus = 'DELIVERED'; row.deliveredAt = new Date().toISOString(); row.version++
  audit.push({ operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action: 'confirm-delivery', targetId: row.orderId, operatorId: operator.accountId, operatorName: operator.nickname, reason: `${input.reason.trim()}；交付凭据：${input.evidence.trim()}`, before, after: JSON.stringify(row), beforeVersion: input.version, afterVersion: row.version, occurredAt: new Date().toISOString() })
  const result = mockDeliveryCatalog(); operations.set(key, { payload, result: copy(result) }); return result
}
