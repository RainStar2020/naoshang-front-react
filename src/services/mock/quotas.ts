import type { HqAccount } from '../../types/auth'
import { QuotaError, type QuotaBalance, type QuotaBatch, type QuotaDetail, type QuotaLedger, type QuotaLedgerKind, type QuotaOrder, type QuotaOwner, type QuotaQuery, type QuotaRecharge, type QuotaRechargeInput, type QuotaType } from '../../types/quotas'
import { mockPartnerDetail, mockPartnerList } from './partners'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: QuotaError['code'], message: string): never => { throw new QuotaError(code, message) }
const types: QuotaType[] = ['STANDARD', 'ACTIVITY']
const now = () => new Date().toISOString()
const zero = (quotaType: QuotaType): QuotaBalance => ({ quotaType, total: 0, remaining: 0, reserved: 0, used: 0, transferred: 0 })
const ownerIds = mockPartnerList({ page: 1, pageSize: 20 }).items.map(row => row.accountId)
const versions = new Map(ownerIds.map(id => [id, 1]))
// 独立特定授权样例：联创 account-12、后来升为联创的账号均不会自动获权。
const rechargeGrants = new Map([['account-24', { enabled: true, allowedTypes: [...types], perOperationLimit: 20, limit: 50, issued: 0 }]])
const batches: QuotaBatch[] = [], ledger: QuotaLedger[] = [], orders: QuotaOrder[] = [], recharges: QuotaRecharge[] = []
const requests = new Map<string, { payload: string; result: QuotaRecharge }>()
const callbackResults = new Map<string, { payload: string; orderId: string }>()
const consumerRequests = new Map<string, { payload: string; resultId: string }>()
function balanceOf(batch: QuotaBalance): QuotaBalance { const { quotaType, total, remaining, reserved, used, transferred } = batch; return { quotaType, total, remaining, reserved, used, transferred } }
function balance(ownerAccountId: string, quotaType: QuotaType) { return batches.filter(row => row.ownerAccountId === ownerAccountId && row.quotaType === quotaType).reduce((sum, row) => ({ quotaType, total: sum.total + row.total, remaining: sum.remaining + row.remaining, reserved: sum.reserved + row.reserved, used: sum.used + row.used, transferred: sum.transferred + row.transferred }), zero(quotaType)) }
function record(batch: QuotaBatch, kind: QuotaLedgerKind, quantity: number, before: QuotaBalance, meta: { operationId: string; requestId: string; reason: string; operatorName: string; sourceOrderId: string | null; targetAccountId: string | null }) { const row: QuotaLedger = { ledgerId: crypto.randomUUID(), ownerAccountId: batch.ownerAccountId, batchId: batch.batchId, quotaType: batch.quotaType, kind, quantity, before, after: balanceOf(batch), createdAt: now(), ...meta }; ledger.push(row); return row }
function credit(ownerAccountId: string, quotaType: QuotaType, quantity: number, source: QuotaBatch['source'], sourceOrderId: string | null, operationId: string, title: string) {
  const batch: QuotaBatch = { ...zero(quotaType), total: quantity, remaining: quantity, batchId: crypto.randomUUID(), ownerAccountId, source, sourceOrderId, operationId, title, createdAt: now(), expiresAt: null, transferable: quotaType === 'STANDARD', refundable: false }; batches.push(batch); return batch
}
for (const ownerAccountId of ownerIds) {
  for (const quotaType of types) {
    const operationId = `seed-${ownerAccountId}-${quotaType}`, orderId = quotaType === 'STANDARD' ? `purchase-${ownerAccountId}` : null
    const batch = credit(ownerAccountId, quotaType, quotaType === 'STANDARD' ? 20 : 8, quotaType === 'STANDARD' ? 'PURCHASE' : 'ACTIVITY_GRANT', orderId, operationId, quotaType === 'STANDARD' ? '标准名额购买（演示已支付）' : '活动赠送（永久有效）')
    record(batch, quotaType === 'STANDARD' ? 'PURCHASE' : 'ACTIVITY_GRANT', batch.total, zero(quotaType), { operationId, requestId: operationId, reason: '初始化演示已确认批次', operatorName: 'Mock服务端', sourceOrderId: orderId, targetAccountId: null })
    if (orderId) orders.push({ orderId, ownerAccountId, targetAccountId: null, kind: 'PURCHASE', quotaType, quantity: 20, batchId: batch.batchId, status: 'PAID', unitAmount: 100000, payableAmount: 2000000, paymentReceiptId: `seed-receipt-${ownerAccountId}`, createdAt: now(), updatedAt: now(), note: '历史标准购买样例；单价为Mock报价，不是生产定价' })
  }
}
function ensureOwner(ownerAccountId: string) { if (!versions.has(ownerAccountId)) fail('NOT_FOUND', '名额所属账号不存在'); return mockPartnerDetail(`partner:${ownerAccountId}`).profile }
function owner(ownerAccountId: string): QuotaOwner {
  const profile = ensureOwner(ownerAccountId), grant = rechargeGrants.get(ownerAccountId)
  const qualified = !!grant?.enabled && profile.partnerLevel === 'DEMO-FOUNDER'
  const remainingLimit = grant ? Math.max(0, grant.limit - grant.issued) : 0
  const active = profile.partnerStatus === 'ACTIVE', canRecharge = qualified && active && remainingLimit > 0
  return { ownerAccountId, contextId: profile.contextId, name: profile.name, phone: profile.phone, displayId: profile.displayId, partnerLevel: profile.partnerLevel, partnerStatus: profile.partnerStatus, version: versions.get(ownerAccountId)!, balances: types.map(type => balance(ownerAccountId, type)), eligibility: { qualified, canRecharge, reason: !qualified ? '未获特定充值资格（联创身份不自动获权）' : !active ? '经营身份冻结或年度权益未生效' : !remainingLimit ? '演示授权累计限额已用完' : '已获特定资格，仍需总部充值权限', allowedTypes: qualified ? [...grant!.allowedTypes] : [], perOperationLimit: qualified ? grant!.perOperationLimit : 0, remainingLimit, limitLabel: 'Mock授权累计限额，不代表生产限额或自动按月重置' } }
}
function bump(ownerAccountId: string) { versions.set(ownerAccountId, versions.get(ownerAccountId)! + 1) }
function count(quantity: number) { if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) fail('INVALID_INPUT', '名额数量必须为1至1000000的整数') }
export function mockQuotaList(query: QuotaQuery) {
  if (!Number.isInteger(query.page) || query.page < 1 || ![5, 10, 20].includes(query.pageSize) || query.eligibility && !['ALLOWED', 'DENIED'].includes(query.eligibility)) fail('INVALID_INPUT', '分页或资格筛选无效')
  const keyword = query.keyword?.trim().toLowerCase() ?? '', rows = ownerIds.map(owner).filter(row => (!keyword || `${row.ownerAccountId} ${row.displayId} ${row.name} ${row.phone}`.toLowerCase().includes(keyword)) && (!query.eligibility || row.eligibility.canRecharge === (query.eligibility === 'ALLOWED')))
  return copy({ items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, summary: { owners: rows.length, rechargeable: rows.filter(row => row.eligibility.canRecharge).length, standardRemaining: rows.reduce((sum, row) => sum + row.balances[0].remaining, 0), activityRemaining: rows.reduce((sum, row) => sum + row.balances[1].remaining, 0), reserved: rows.reduce((sum, row) => sum + row.balances.reduce((n, item) => n + item.reserved, 0), 0) } })
}
export function mockQuotaDetail(ownerAccountId: string): QuotaDetail { return copy({ owner: owner(ownerAccountId), batches: batches.filter(row => row.ownerAccountId === ownerAccountId).reverse(), ledger: ledger.filter(row => row.ownerAccountId === ownerAccountId).reverse(), orders: orders.filter(row => row.ownerAccountId === ownerAccountId).reverse(), recharges: recharges.filter(row => row.ownerAccountId === ownerAccountId).reverse(), activityServiceFeePerQuota: 200000 }) }
export function mockQuotaRecharge(input: QuotaRechargeInput, operator: HqAccount) {
  if (!input.idempotencyKey?.trim() || !input.reason?.trim() || input.reason.trim().length > 200 || !types.includes(input.quotaType)) fail('INVALID_INPUT', '请明确名额类型、1至200字原因及请求号'); count(input.quantity)
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = requests.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号已用于其他充值参数'); return copy(previous.result) }
  const current = owner(input.targetAccountId), eligibility = current.eligibility
  if (input.version !== current.version) fail('VERSION_CONFLICT', '名额版本已变化，请刷新后重新核对')
  if (!eligibility.canRecharge || !eligibility.allowedTypes.includes(input.quotaType)) fail('INVALID_STATE', eligibility.reason)
  if (input.quantity > eligibility.perOperationLimit || input.quantity > eligibility.remainingLimit) fail('INVALID_STATE', '超过单次或授权剩余充值限额')
  const operationId = crypto.randomUUID(), before = balance(input.targetAccountId, input.quotaType)
  const batch = credit(input.targetAccountId, input.quotaType, input.quantity, 'HQ_RECHARGE', null, operationId, '总部人工充值（Mock）')
  rechargeGrants.get(input.targetAccountId)!.issued += input.quantity; bump(input.targetAccountId)
  const result: QuotaRecharge = { operationId, requestId: input.idempotencyKey, ownerAccountId: input.targetAccountId, targetAccountId: input.targetAccountId, batchId: batch.batchId, quotaType: input.quotaType, quantity: input.quantity, reason: input.reason.trim(), operatorName: operator.nickname, createdAt: now(), before, after: balance(input.targetAccountId, input.quotaType), beforeVersion: current.version, afterVersion: current.version + 1 }
  recharges.push(result); record(batch, 'HQ_RECHARGE', input.quantity, zero(input.quotaType), { operationId, requestId: result.requestId, reason: result.reason, operatorName: result.operatorName, targetAccountId: input.targetAccountId, sourceOrderId: null }); requests.set(key, { payload, result: copy(result) }); return copy(result)
}
/** 以下只模拟小程序/后端状态契约，不经总部 services 暴露支付、占用、划转按钮。 */
function consumerRequest(accountId: string, idempotencyKey: string, input: unknown) { if (!idempotencyKey?.trim()) fail('INVALID_INPUT', '缺少请求号'); const key = `${accountId}:${idempotencyKey}`, payload = JSON.stringify(input), previous = consumerRequests.get(key); if (previous && previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return { key, payload, previous } }
function activeOwner(accountId: string) { const profile = ensureOwner(accountId); if (profile.partnerStatus !== 'ACTIVE') fail('INVALID_STATE', '经营身份非正常状态'); return profile }
export function mockCreateQuotaPurchase(input: { ownerAccountId: string; quantity: number; idempotencyKey: string }) {
  count(input.quantity); const request = consumerRequest(input.ownerAccountId, input.idempotencyKey, input)
  if (request.previous) return copy(orders.find(row => row.orderId === request.previous!.resultId)!)
  activeOwner(input.ownerAccountId)
  const row: QuotaOrder = { orderId: crypto.randomUUID(), ownerAccountId: input.ownerAccountId, targetAccountId: null, kind: 'PURCHASE', quotaType: 'STANDARD', quantity: input.quantity, batchId: null, status: 'UNPAID', unitAmount: 100000, payableAmount: input.quantity * 100000, paymentReceiptId: null, createdAt: now(), updatedAt: now(), note: 'Mock服务报价；未支付不产生批次，不增加余额' }; orders.push(row); consumerRequests.set(request.key, { payload: request.payload, resultId: row.orderId }); return copy(row)
}
export function mockReserveActivityQuota(input: { ownerAccountId: string; targetAccountId: string; batchId: string; quantity: number; idempotencyKey: string }) {
  count(input.quantity); const request = consumerRequest(input.ownerAccountId, input.idempotencyKey, input)
  if (request.previous) return copy(orders.find(row => row.orderId === request.previous!.resultId)!)
  activeOwner(input.ownerAccountId); const target = activeOwner(input.targetAccountId)
  if (target.superior?.accountId !== input.ownerAccountId) fail('INVALID_STATE', '仅允许直属下级的活动升级占用')
  const batch = batches.find(row => row.batchId === input.batchId) ?? fail('NOT_FOUND', '批次不存在')
  if (batch.ownerAccountId !== input.ownerAccountId) fail('FORBIDDEN', '批次不属于此账号')
  if (batch.quotaType !== 'ACTIVITY' || batch.remaining < input.quantity) fail('INVALID_STATE', '活动名额不足或批次类型不符')
  const row: QuotaOrder = { orderId: crypto.randomUUID(), ownerAccountId: input.ownerAccountId, targetAccountId: input.targetAccountId, kind: 'ACTIVITY_UPGRADE', quotaType: 'ACTIVITY', quantity: input.quantity, batchId: batch.batchId, status: 'UNPAID', unitAmount: 200000, payableAmount: input.quantity * 200000, paymentReceiptId: null, createdAt: now(), updatedAt: now(), note: '仅演示活动名额占用与服务费订单；等级资格及升级生效需真实业务API原子处理' }
  const before = balanceOf(batch); batch.remaining -= input.quantity; batch.reserved += input.quantity; bump(input.ownerAccountId); orders.push(row)
  record(batch, 'RESERVE', input.quantity, before, { operationId: crypto.randomUUID(), requestId: input.idempotencyKey, reason: '活动升级待支付，仅占用', operatorName: 'Mock小程序账号', sourceOrderId: row.orderId, targetAccountId: row.targetAccountId }); consumerRequests.set(request.key, { payload: request.payload, resultId: row.orderId }); return copy(row)
}
export function mockQuotaPaymentReceipt(input: { orderId: string; paymentReceiptId: string; status: 'PAID' | 'CANCELLED'; idempotencyKey: string }) {
  if (!input.idempotencyKey?.trim() || !input.paymentReceiptId?.trim() || !['PAID', 'CANCELLED'].includes(input.status)) fail('INVALID_INPUT', '支付回执参数无效')
  const payload = JSON.stringify(input), previous = callbackResults.get(input.idempotencyKey)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '回执请求参数已改变'); return copy(orders.find(row => row.orderId === previous.orderId)!) }
  const row = orders.find(row => row.orderId === input.orderId) ?? fail('NOT_FOUND', '名额订单不存在')
  if (row.status !== 'UNPAID') fail('INVALID_STATE', '订单已终态，不能再次到账、消耗或释放')
  if (orders.some(order => order.paymentReceiptId === input.paymentReceiptId)) fail('INVALID_STATE', '支付回执已被其他订单使用')
  const operationId = crypto.randomUUID()
  if (row.kind === 'PURCHASE' && input.status === 'PAID') {
    const batch = credit(row.ownerAccountId, 'STANDARD', row.quantity, 'PURCHASE', row.orderId, operationId, '标准购买支付到账（Mock）'); row.batchId = batch.batchId
    record(batch, 'PURCHASE', row.quantity, zero('STANDARD'), { operationId, requestId: input.idempotencyKey, reason: '支付成功回执确认后到账', operatorName: 'Mock支付服务', sourceOrderId: row.orderId, targetAccountId: null }); bump(row.ownerAccountId)
  } else if (row.kind === 'ACTIVITY_UPGRADE') {
    const batch = batches.find(item => item.batchId === row.batchId) ?? fail('NOT_FOUND', '占用批次不存在')
    if (batch.reserved < row.quantity) fail('INVALID_STATE', '占用状态不一致')
    const before = balanceOf(batch); batch.reserved -= row.quantity
    if (input.status === 'PAID') batch.used += row.quantity; else batch.remaining += row.quantity
    record(batch, input.status === 'PAID' ? 'CONSUME' : 'RELEASE', row.quantity, before, { operationId, requestId: input.idempotencyKey, reason: input.status === 'PAID' ? '服务费支付成功后消耗；等级生效由真实业务API负责' : '未支付取消，仅释放占用，非退款', operatorName: 'Mock支付服务', sourceOrderId: row.orderId, targetAccountId: row.targetAccountId }); bump(row.ownerAccountId)
  }
  row.status = input.status; row.paymentReceiptId = input.paymentReceiptId; row.updatedAt = now(); callbackResults.set(input.idempotencyKey, { payload, orderId: row.orderId }); return copy(row)
}
export function mockTransferStandardQuota(input: { ownerAccountId: string; targetAccountId: string; batchId: string; quantity: number; idempotencyKey: string }) {
  count(input.quantity); const request = consumerRequest(input.ownerAccountId, input.idempotencyKey, input)
  if (request.previous) return request.previous.resultId
  activeOwner(input.ownerAccountId); activeOwner(input.targetAccountId)
  if (input.ownerAccountId === input.targetAccountId) fail('INVALID_INPUT', '不能向自己划转')
  const batch = batches.find(row => row.batchId === input.batchId) ?? fail('NOT_FOUND', '批次不存在')
  if (batch.ownerAccountId !== input.ownerAccountId) fail('FORBIDDEN', '批次不属于此账号')
  if (batch.quotaType !== 'STANDARD' || !batch.transferable || batch.remaining < input.quantity) fail('INVALID_STATE', '仅可划转足量标准名额，活动名额不可转让')
  const operationId = crypto.randomUUID(), before = balanceOf(batch); batch.remaining -= input.quantity; batch.transferred += input.quantity
  record(batch, 'TRANSFER_OUT', input.quantity, before, { operationId, requestId: input.idempotencyKey, reason: '标准名额划出（Mock）', operatorName: 'Mock小程序账号', sourceOrderId: null, targetAccountId: input.targetAccountId })
  const received = credit(input.targetAccountId, 'STANDARD', input.quantity, 'TRANSFER', null, operationId, `标准名额划入，来源${input.ownerAccountId}`)
  record(received, 'TRANSFER_IN', input.quantity, zero('STANDARD'), { operationId, requestId: input.idempotencyKey, reason: `标准名额划入，来源${input.ownerAccountId}`, operatorName: 'Mock小程序账号', sourceOrderId: null, targetAccountId: input.ownerAccountId }); bump(input.ownerAccountId); bump(input.targetAccountId); consumerRequests.set(request.key, { payload: request.payload, resultId: operationId }); return operationId
}
// 固定历史样例不调用实时用户操作，避免年度到期时模块初始化失败。
const seedPurchase: QuotaOrder = { orderId: 'seed-unpaid-purchase', ownerAccountId: 'account-3', targetAccountId: null, kind: 'PURCHASE', quotaType: 'STANDARD', quantity: 5, batchId: null, status: 'UNPAID', unitAmount: 100000, payableAmount: 500000, paymentReceiptId: null, createdAt: now(), updatedAt: now(), note: 'Mock标准购买待支付，尚未到账' }
orders.push(seedPurchase)
const activity = batches.find(row => row.ownerAccountId === 'account-3' && row.quotaType === 'ACTIVITY')!
for (const [index, status] of (['UNPAID', 'PAID', 'CANCELLED'] as const).entries()) {
  const orderId = `seed-activity-${index}`, quantity = index ? 1 : 2, before = balanceOf(activity)
  activity.remaining -= quantity; activity.reserved += quantity
  record(activity, 'RESERVE', quantity, before, { operationId: `${orderId}-reserve`, requestId: `${orderId}-reserve`, reason: '演示活动升级待支付占用', operatorName: 'Mock小程序账号', sourceOrderId: orderId, targetAccountId: 'account-6' })
  if (status !== 'UNPAID') { const reserved = balanceOf(activity); activity.reserved -= quantity; if (status === 'PAID') activity.used += quantity; else activity.remaining += quantity; record(activity, status === 'PAID' ? 'CONSUME' : 'RELEASE', quantity, reserved, { operationId: `${orderId}-finish`, requestId: `${orderId}-finish`, reason: status === 'PAID' ? '演示支付确认后消耗' : '演示未付取消仅释放占用', operatorName: 'Mock支付服务', sourceOrderId: orderId, targetAccountId: 'account-6' }) }
  orders.push({ orderId, ownerAccountId: 'account-3', targetAccountId: 'account-6', kind: 'ACTIVITY_UPGRADE', quotaType: 'ACTIVITY', quantity, batchId: activity.batchId, status, unitAmount: 200000, payableAmount: quantity * 200000, paymentReceiptId: status === 'UNPAID' ? null : `${orderId}-receipt`, createdAt: now(), updatedAt: now(), note: '历史Mock名额状态样例，不代表真实升级结果' })
}
const source = batches.find(row => row.ownerAccountId === 'account-6' && row.quotaType === 'STANDARD')!, beforeTransfer = balanceOf(source), transferId = 'seed-transfer'
source.remaining -= 3; source.transferred += 3
record(source, 'TRANSFER_OUT', 3, beforeTransfer, { operationId: transferId, requestId: transferId, reason: '历史标准划出样例', operatorName: 'Mock小程序账号', sourceOrderId: null, targetAccountId: 'account-3' })
const received = credit('account-3', 'STANDARD', 3, 'TRANSFER', null, transferId, '历史标准划入样例，来源account-6')
record(received, 'TRANSFER_IN', 3, zero('STANDARD'), { operationId: transferId, requestId: transferId, reason: '历史标准划入样例，来源account-6', operatorName: 'Mock小程序账号', sourceOrderId: null, targetAccountId: 'account-6' })
