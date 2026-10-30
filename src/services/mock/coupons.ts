import type { HqAccount } from '../../types/auth'
import { CouponError, type CouponAudit, type CouponCatalog, type CouponCheckoutOrder, type CouponMutation, type CouponMutationResult, type CouponQuery, type CouponScope, type CouponStatus, type CouponTemplate, type CouponTemplateValue, type UserCoupon } from '../../types/coupons'
import { mockListUsers, mockUserDetail } from './users'
import { mockProductCatalog, readMockProduct } from './products'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: CouponError['code'], message: string): never => { throw new CouponError(code, message) }
const limits = { maxBatchSize: 50, maxAmount: 100000000 }
const templates: CouponTemplate[] = [{ templateId: 'demo-template-1', title: '演示选品满减券', amount: 500, minAmount: 10000, scope: { kind: 'all', productIds: [] }, validFrom: '2026-01-01T00:00:00+08:00', expiresAt: '2027-12-31T23:59:59+08:00', enabled: true, totalQuantity: 100, perAccountLimit: 2, version: 1, issuedQuantity: 0 }]
const coupons: UserCoupon[] = [], audit: CouponAudit[] = [], orders: CouponCheckoutOrder[] = []
const operations = new Map<string, { payload: string; result: CouponMutationResult }>()
const findTemplate = (id: string) => templates.find(row => row.templateId === id) ?? fail('NOT_FOUND', '券模板不存在')
const findCoupon = (id: string) => coupons.find(row => row.couponId === id) ?? fail('NOT_FOUND', '用户券不存在')
function log(action: CouponAudit['action'], requestId: string, templateId: string | null, couponIds: string[], operatorName: string, reason: string, detail: string) { const row = { operationId: crypto.randomUUID(), requestId, templateId, couponIds, operatorName, action, reason, detail, occurredAt: new Date().toISOString() }; audit.push(row); return row.operationId }
function issued(template: CouponTemplate, accountId: string): UserCoupon { const { title, amount, minAmount, scope, validFrom, expiresAt } = template; return { couponId: `coupon-${crypto.randomUUID()}`, templateId: template.templateId, templateVersion: template.version, accountId, snapshot: copy({ title, amount, minAmount, scope, validFrom, expiresAt }), status: 'available', version: 1, issuedAt: new Date().toISOString(), reservedOrderId: null, usedOrderId: null, reservedAt: null, usedAt: null } }
for (const accountId of ['account-1', 'account-2', 'account-3']) coupons.push(issued(templates[0], accountId))
templates[0].issuedQuantity = coupons.length
function effective(row: UserCoupon): CouponStatus { return row.status === 'available' ? Date.parse(row.snapshot.expiresAt) <= Date.now() ? 'expired' : Date.parse(row.snapshot.validFrom) > Date.now() ? 'not-started' : 'available' : row.status }
function release(order: CouponCheckoutOrder, requestId: string, reason: string) { if (order.couponId) { const coupon = findCoupon(order.couponId); if (coupon.status === 'reserved' && coupon.reservedOrderId === order.orderId) { coupon.status = 'available'; coupon.reservedOrderId = null; coupon.reservedAt = null; coupon.version++; log('release', requestId, coupon.templateId, [coupon.couponId], 'Mock消费端', reason, order.orderId) } } order.status = 'CANCELLED' }
function sweep() { for (const order of orders) if (order.status === 'PENDING_PAYMENT' && order.expiresAt <= Date.now()) release(order, `expiry:${order.orderId}`, '未付款演示订单超时，释放占用券') }
function validDate(value: string) { return typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) }
function clean(value: CouponTemplateValue) {
  const { title, amount, minAmount, scope, validFrom, expiresAt, enabled, totalQuantity, perAccountLimit } = value
  const result: CouponTemplateValue = copy({ title, amount, minAmount, scope, validFrom, expiresAt, enabled, totalQuantity, perAccountLimit }), productIds = mockProductCatalog().products.map(row => row.draft.productId)
  if (!result.title.trim() || result.title.length > 60 || !Number.isSafeInteger(result.amount) || result.amount <= 0 || result.amount > limits.maxAmount || !Number.isSafeInteger(result.minAmount) || result.minAmount < 0 || result.minAmount > limits.maxAmount || typeof result.enabled !== 'boolean') fail('INVALID_INPUT', '模板标题、面额、门槛或启停状态无效（金额为整数分）')
  if (!validDate(result.validFrom) || !validDate(result.expiresAt) || Date.parse(result.validFrom) >= Date.parse(result.expiresAt)) fail('INVALID_INPUT', '有效期需包含时区且结束时间晚于开始时间')
  if (!Number.isSafeInteger(result.totalQuantity) || result.totalQuantity < 1 || result.totalQuantity > 1000000 || !Number.isSafeInteger(result.perAccountLimit) || result.perAccountLimit < 1 || result.perAccountLimit > 20) fail('INVALID_INPUT', 'Mock总量为1至1000000，单账号上限为1至20')
  if (!result.scope || !['all', 'products'].includes(result.scope.kind) || !Array.isArray(result.scope.productIds) || (result.scope.kind === 'all' ? result.scope.productIds.length !== 0 : !result.scope.productIds.length || result.scope.productIds.some(id => !productIds.includes(id)) || new Set(result.scope.productIds).size !== result.scope.productIds.length)) fail('INVALID_INPUT', '请选择有效适用范围及商品ID')
  result.title = result.title.trim(); return result
}
export function mockCouponCatalog(): CouponCatalog { sweep(); return copy({ templates, audit: [...audit].reverse(), limits, accounts: mockListUsers({ page: 1, pageSize: 50 }).items.map(row => ({ accountId: row.accountId, nickname: row.nickname, phone: row.phone, frozen: row.frozen })), products: mockProductCatalog().products.map(row => ({ productId: row.draft.productId, title: row.draft.title })) }) }
export function mockCouponList(query: CouponQuery) { sweep(); if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize) || query.status && !['available', 'not-started', 'reserved', 'used', 'expired'].includes(query.status)) fail('INVALID_INPUT', '分页或状态参数无效'); const keyword = query.keyword?.trim().toLowerCase() ?? ''; const rows = coupons.map(row => ({ ...copy(row), status: effective(row) })).filter(row => (!query.templateId || row.templateId === query.templateId) && (!query.accountId || row.accountId === query.accountId) && (!query.status || row.status === query.status) && (!keyword || `${row.snapshot.title} ${row.couponId} ${row.reservedOrderId ?? ''} ${row.usedOrderId ?? ''}`.toLowerCase().includes(keyword))).reverse(); return { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize } }
export function mockCouponDetail(id: string) { sweep(); const row = findCoupon(id); return copy({ coupon: { ...row, status: effective(row) }, audit: [...audit].reverse().filter(item => item.couponIds.includes(id)) }) }
export function mockCouponMutate(input: CouponMutation, operator: HqAccount): CouponMutationResult {
  sweep()
  if (!['save-template', 'issue'].includes(input.action) || !input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写有效操作、请求号和1至200字原因')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(previous.result) }
  const template = input.templateId ? findTemplate(input.templateId) : null
  if ((template?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '模板或已发数量已更新，请刷新后重新核对')
  let templateId = input.templateId, couponIds: string[] = [], detail: string
  if (input.action === 'save-template') {
    const value = clean(input.value)
    if (template) { const counts = new Map<string, number>(); coupons.filter(row => row.templateId === template.templateId).forEach(row => counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1)); if (value.totalQuantity < template.issuedQuantity || [...counts.values()].some(count => count > value.perAccountLimit)) fail('QUOTA_EXCEEDED', '总量或单账号上限不能低于已经发放的数量'); Object.assign(template, value, { version: template.version + 1 }) }
    else { templateId = `template-${crypto.randomUUID()}`; templates.push({ ...value, templateId, version: 1, issuedQuantity: 0 }) }
    detail = '保存模板；已发券快照保持不变'
  } else {
    if (!template || !template.enabled || Date.parse(template.expiresAt) <= Date.now()) fail('INVALID_STATE', '模板不存在、已停发或已过期')
    const current = template!
    if (!Array.isArray(input.accountIds) || !input.accountIds.length || input.accountIds.length > limits.maxBatchSize || new Set(input.accountIds).size !== input.accountIds.length) fail('INVALID_INPUT', '每批1至50个不重复账号，每个账号发1张')
    for (const accountId of input.accountIds) { if (mockUserDetail(accountId).account.frozen) fail('INVALID_INPUT', '发放对象包含冻结账号，请重新选择'); if (coupons.filter(row => row.accountId === accountId && row.templateId === current.templateId).length >= current.perAccountLimit) fail('QUOTA_EXCEEDED', '发放对象中有账号已达领取上限') }
    if (current.issuedQuantity + input.accountIds.length > current.totalQuantity) fail('QUOTA_EXCEEDED', '模板剩余总量不足，整批未发放')
    const rows = input.accountIds.map(accountId => issued(current, accountId)); coupons.push(...rows); couponIds = rows.map(row => row.couponId); current.issuedQuantity += rows.length; current.version++; detail = `向${rows.length}个账号各发1张，整批成功`
  }
  const operationId = log(input.action, input.idempotencyKey, templateId, couponIds, operator.nickname, input.reason.trim(), detail)
  const result = { templateId, couponIds, operationId }; operations.set(key, { payload, result: copy(result) }); return result
}
interface CouponQuote { quoteId: string; accountId: string; productId: string; skuId: string; quantity: number; couponId: string | null; goodsAmount: number; discountAmount: number; payableAmount: number; productRevision: number; couponVersion: number | null; expiresAt: number }
const quotes = new Map<string, CouponQuote>(), consumedQuotes = new Set<string>(), checkoutRequests = new Map<string, { fingerprint: string; result: CouponCheckoutOrder }>()
function calculate(accountId: string, productId: string, skuId: string, quantity: number, couponId: string | null) {
  if (mockUserDetail(accountId).account.frozen) fail('FORBIDDEN', '账号已冻结')
  const product = readMockProduct(productId), sku = product.skus.find(row => row.id === skuId) ?? fail('NOT_FOUND', 'SKU不存在')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > sku.stock || couponId !== null && (typeof couponId !== 'string' || !couponId.trim())) fail('INVALID_INPUT', '数量、库存或优惠券参数无效，一单最多一张券')
  const goodsAmount = sku.amount * quantity; let discountAmount = 0, couponVersion: number | null = null
  if (couponId) { const row = findCoupon(couponId); if (row.accountId !== accountId) fail('FORBIDDEN', '优惠券不属于当前账号'); if (effective(row) !== 'available') fail('INVALID_STATE', '优惠券尚未生效、已过期、占用中或已使用'); if (row.snapshot.scope.kind === 'products' && !row.snapshot.scope.productIds.includes(productId) || goodsAmount < row.snapshot.minAmount) fail('INVALID_INPUT', '商品不在适用范围或未达到门槛'); discountAmount = Math.min(row.snapshot.amount, goodsAmount); couponVersion = row.version }
  return { accountId, productId, skuId, quantity, couponId, goodsAmount, discountAmount, payableAmount: goodsAmount - discountAmount, productRevision: mockProductCatalog().products.find(row => row.draft.productId === productId)!.publication!.revision, couponVersion }
}
/** 仅优惠券生命周期验收，无支付/库存预占/真实下单，也不替代HQ-10交付或HQ-11订单API。 */
export function previewMockCouponQuote(accountId: string, productId: string, skuId: string, quantity: number, couponId: string | null) { sweep(); const value = { ...calculate(accountId, productId, skuId, quantity, couponId), quoteId: crypto.randomUUID(), expiresAt: Date.now() + 300000 }; quotes.set(value.quoteId, copy(value)); return copy(value) }
export function reserveMockCouponOrder(quoteId: string, requestId: string) {
  sweep(); const quote = quotes.get(quoteId) ?? fail('NOT_FOUND', '请先取得券报价')
  if (!requestId) fail('INVALID_INPUT', '缺少请求号')
  const key = `${quote.accountId}:${requestId}`, fingerprint = `reserve:${quoteId}`, previous = checkoutRequests.get(key)
  if (previous) { if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', '请求号不能更换报价'); return copy(previous.result) }
  if (consumedQuotes.has(quoteId) || quote.expiresAt <= Date.now()) fail('INVALID_STATE', '报价已被使用或已过期')
  const current = calculate(quote.accountId, quote.productId, quote.skuId, quote.quantity, quote.couponId)
  if (current.productRevision !== quote.productRevision || current.couponVersion !== quote.couponVersion) fail('VERSION_CONFLICT', '商品或券状态已变化，请重新报价')
  const order: CouponCheckoutOrder = { orderId: `DEMO-COUPON-ORDER-${crypto.randomUUID()}`, accountId: quote.accountId, productId: quote.productId, skuId: quote.skuId, quantity: quote.quantity, couponId: quote.couponId, goodsAmount: quote.goodsAmount, discountAmount: quote.discountAmount, payableAmount: quote.payableAmount, status: 'PENDING_PAYMENT', expiresAt: Date.now() + 900000, mockOnly: true }
  if (order.couponId) { const coupon = findCoupon(order.couponId); coupon.status = 'reserved'; coupon.reservedOrderId = order.orderId; coupon.reservedAt = new Date().toISOString(); coupon.version++; log('reserve', requestId, coupon.templateId, [coupon.couponId], 'Mock消费端', '演示下单占用', order.orderId) }
  orders.push(order); consumedQuotes.add(quoteId); checkoutRequests.set(key, { fingerprint, result: copy(order) }); return copy(order)
}
export function settleMockCouponOrder(accountId: string, orderId: string, action: 'pay' | 'cancel', requestId: string) {
  sweep(); const order = orders.find(row => row.orderId === orderId && row.accountId === accountId) ?? fail('FORBIDDEN', '订单不存在或不属于此账号')
  if (!['pay', 'cancel'].includes(action) || !requestId) fail('INVALID_INPUT', '结算动作或请求号无效')
  const key = `${accountId}:${requestId}`, fingerprint = `${action}:${orderId}`, previous = checkoutRequests.get(key)
  if (previous) { if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', '请求号不能更换结算动作'); return copy(previous.result) }
  if (order.status !== 'PENDING_PAYMENT') fail('INVALID_STATE', '订单已付款、已取消或已超时')
  if (action === 'cancel') release(order, requestId, '演示未付款取消释放')
  else { if (order.couponId) { const coupon = findCoupon(order.couponId); if (coupon.status !== 'reserved' || coupon.reservedOrderId !== orderId) fail('INVALID_STATE', '优惠券占用不匹配'); coupon.status = 'used'; coupon.usedOrderId = orderId; coupon.usedAt = new Date().toISOString(); coupon.reservedOrderId = null; coupon.version++; log('use', requestId, coupon.templateId, [coupon.couponId], 'Mock消费端', '模拟付款成功核销，非真实支付', orderId) } order.status = 'PAID' }
  checkoutRequests.set(key, { fingerprint, result: copy(order) }); return copy(order)
}
export function mockCouponWallet(accountId: string) { mockUserDetail(accountId); sweep(); return coupons.filter(row => row.accountId === accountId).map(row => ({ ...copy(row), status: effective(row), id: row.couponId, title: row.snapshot.title, discountAmount: row.snapshot.amount, thresholdText: row.snapshot.minAmount ? `满${row.snapshot.minAmount / 100}元可用` : '无门槛', scopeLabel: row.snapshot.scope.kind === 'all' ? '全部商品（演示）' : '指定商品', validUntilLabel: row.snapshot.expiresAt })) }

