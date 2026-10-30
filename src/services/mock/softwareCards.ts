import type { HqAccount } from '../../types/auth'
import { SoftwareCardError, softwareStockLabels, type SoftwareAudit, type SoftwareBatch, type SoftwareCard, type SoftwareCardType, type SoftwareCatalog, type SoftwareExport, type SoftwareExportRequest, type SoftwareMutation, type SoftwareMutationResult, type SoftwareOrderOption, type SoftwareQuery, type SoftwareSelection } from '../../types/softwareCards'
import { mockListUsers, mockUserDetail, mockUserOptions } from './users'
import { makeCsv } from '../../utils/csv'

const clone = <T,>(value: T): T => structuredClone(value)
const fail = (code: SoftwareCardError['code'], message: string): never => { throw new SoftwareCardError(code, message) }
const limits = { maxImportSize: 100, maxSelectionSize: 100 }
const types: SoftwareCardType[] = ['百科', '单词', '语文', '速读', '潜能', '督学', '智学'].map((name, index) => ({ typeId: `sw-type-${index + 1}`, businessCode: ['ENCYCLOPEDIA', 'WORD', 'CHINESE', 'READING', 'POTENTIAL', 'SUPERVISION', 'SMART_LEARNING'][index], name: `${name}软件卡`, termLabel: '供应商定义，待接入', systemLabel: '外部软件系统（待对接）', description: '演示类型，名称不决定履约或激活行为', active: true, version: 1 }))
interface StoredCard extends SoftwareCard { secret: string }
const cards: StoredCard[] = [], batches: SoftwareBatch[] = [], audit: SoftwareAudit[] = []
const operations = new Map<string, { fingerprint: string; result: SoftwareMutationResult }>()
const exports = new Map<string, { payload: string; result: SoftwareExport }>()
const orders: Omit<SoftwareOrderOption, 'remainingQuantity'>[] = [
  { orderId: 'sw-demo-order-store', orderNo: 'DEMO-SW-ORDER-001', accountId: 'account-1', typeId: 'sw-type-1', fulfillmentType: 'ACTIVATION_CODE', status: 'PAID', quantity: 1, deliveryMode: 'store', deliveryStoreId: 'shop-1', mockOnly: true },
  { orderId: 'sw-demo-order-hq', orderNo: 'DEMO-SW-ORDER-002', accountId: 'account-2', typeId: 'sw-type-1', fulfillmentType: 'ACTIVATION_CODE', status: 'PAID', quantity: 1, deliveryMode: 'hq', deliveryStoreId: null, mockOnly: true },
  { orderId: 'sw-demo-order-unpaid', orderNo: 'DEMO-SW-ORDER-003', accountId: 'account-3', typeId: 'sw-type-1', fulfillmentType: 'ACTIVATION_CODE', status: 'PENDING_PAYMENT', quantity: 1, deliveryMode: 'store', deliveryStoreId: 'shop-3', mockOnly: true },
  { orderId: 'sw-demo-order-open', orderNo: 'DEMO-SW-ORDER-004', accountId: 'account-4', typeId: 'sw-type-1', fulfillmentType: 'ACTIVATION_CODE', status: 'PAID', quantity: 2, deliveryMode: 'store', deliveryStoreId: 'shop-1', mockOnly: true },
]
function stored(batch: SoftwareBatch, secret: string): StoredCard {
  return { cardId: crypto.randomUUID(), batchId: batch.batchId, typeId: batch.typeId, typeName: batch.typeName, secret, maskedCode: `DEMO-SW-…${secret.slice(-4)}`, status: 'available', version: 1, claimDeadline: batch.claimDeadline, claimExpired: false, externalStatus: 'unknown', externalValidUntil: null, externalCheckedAt: null, deliveryMode: null, deliveryStoreId: null, accountId: null, accountName: null, sourceOrderId: null, assignedAt: null, deliveredAt: null, secretExportedAt: null, replacesCardId: null, replacementCardId: null, createdAt: batch.createdAt }
}
for (let n = 0; n < 2; n++) {
  const batch: SoftwareBatch = { batchId: `sw-batch-${n + 1}`, name: `${types[n].name}演示批次`, typeId: types[n].typeId, typeName: types[n].name, source: 'mock', sourceName: 'Mock供应商', referenceNo: `DEMO-REF-${n + 1}`, quantity: 6, claimDeadline: null, createdAt: '2026-10-01T09:00:00+08:00', createdBy: 'Mock初始化' }
  batches.push(batch)
  for (let i = 0; i < 6; i++) {
    const card = stored(batch, `DEMO-SW-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`)
    card.cardId = `sw-card-${n * 6 + i + 1}`
    if (n === 0 && i === 1) Object.assign(card, { status: 'assigned', accountId: 'account-1', accountName: '林晓雅', deliveryMode: 'store', deliveryStoreId: 'shop-1', sourceOrderId: 'sw-demo-order-store', assignedAt: batch.createdAt })
    if (n === 0 && i === 2) Object.assign(card, { status: 'delivered', accountId: 'account-2', accountName: '陈明', deliveryMode: 'hq', sourceOrderId: 'sw-demo-order-hq', assignedAt: batch.createdAt, deliveredAt: batch.createdAt })
    if (n === 0 && i === 3) card.claimDeadline = '2020-01-01T00:00:00Z'
    if (n === 0 && i === 4) card.status = 'retired'
    cards.push(card)
  }
}
const find = (id: string) => cards.find(card => card.cardId === id) ?? fail('NOT_FOUND', '软件卡不存在')
// 已披露的停发卡仍占用订单交付数量，避免通过“停发→重新分配”绕过供应商补发核验。
const countsAgainstOrder = (card: StoredCard) => ['assigned', 'delivered'].includes(card.status) || card.status === 'retired' && (!!card.secretExportedAt || card.externalStatus !== 'unknown')
function view(card: StoredCard): SoftwareCard {
  const { secret: _, ...value } = card
  return clone({ ...value, typeName: types.find(type => type.typeId === card.typeId)!.name, claimExpired: ['available', 'assigned'].includes(card.status) && !!card.claimDeadline && Date.parse(card.claimDeadline) <= Date.now() })
}
export function mockSoftwareCatalog(): SoftwareCatalog {
  return clone({ types, batches: [...batches].reverse(), audit: [...audit].reverse(), options: { ...limits, accounts: mockListUsers({ page: 1, pageSize: 50 }).items.map(account => ({ accountId: account.accountId, name: account.nickname, phone: account.phone, storeId: account.storeId })), stores: mockUserOptions().stores, orders: orders.map(order => ({ ...order, remainingQuantity: Math.max(0, order.quantity - cards.filter(card => card.sourceOrderId === order.orderId && countsAgainstOrder(card)).length) })) } })
}
export function mockSoftwareList(query: SoftwareQuery) {
  if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const list = cards.map(view).filter(card => (!keyword || [card.cardId, card.maskedCode, card.accountName ?? '', card.sourceOrderId ?? ''].some(text => text.toLowerCase().includes(keyword))) && (!query.batchId || card.batchId === query.batchId) && (!query.typeId || card.typeId === query.typeId) && (!query.status || card.status === query.status) && (!query.deliveryMode || card.deliveryMode === query.deliveryMode) && (!query.storeId || card.deliveryStoreId === query.storeId) && (!query.accountId || card.accountId === query.accountId) && (!query.claimState || card.claimExpired === (query.claimState === 'expired'))).reverse()
  return { items: list.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: list.length, page: query.page, pageSize: query.pageSize }
}
export function mockSoftwareDetail(id: string) {
  const card = find(id)
  return clone({ card: view(card), batch: batches.find(batch => batch.batchId === card.batchId)!, type: types.find(type => type.typeId === card.typeId)!, audit: audit.filter(entry => entry.cardIds.includes(id)).reverse() })
}
export function mockSoftwareReplacements(id: string) {
  const old = find(id)
  return cards.filter(card => card.cardId !== id && card.typeId === old.typeId && card.status === 'available' && !card.secretExportedAt && !view(card).claimExpired && card.externalStatus === 'unknown').map(view)
}
function select(items: SoftwareSelection[]) {
  if (!items.length || items.length > limits.maxSelectionSize || new Set(items.map(item => item.cardId)).size !== items.length) fail('INVALID_INPUT', '请选择不重复的软件卡，不能超过服务返回的操作上限')
  return items.map(item => { const card = find(item.cardId); if (card.version !== item.version) fail('VERSION_CONFLICT', '卡库存已更新，请刷新后重试'); return card })
}
function reason(value: string) { if (!value?.trim() || value.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字操作原因') }
function addAudit(action: SoftwareAudit['action'], cardIds: string[], batchId: string | null, typeId: string | null, input: { reason: string; idempotencyKey: string }, operator: HqAccount, before: string, after: string) {
  const entry: SoftwareAudit = { operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action, cardIds, batchId, typeId, reason: input.reason.trim(), operatorId: operator.accountId, operatorName: operator.nickname, before, after, occurredAt: new Date().toISOString() }
  audit.push(entry); return entry
}
function activeType(id: string) { return types.find(type => type.typeId === id && type.active) ?? fail('INVALID_INPUT', '软件卡类型不存在或已停用') }
export async function mockSoftwareMutate(input: SoftwareMutation, operator: HqAccount): Promise<SoftwareMutationResult> {
  reason(input.reason)
  if (!input.idempotencyKey || !['save-type', 'import', 'assign', 'deliver', 'retire', 'replace'].includes(input.action)) fail('INVALID_INPUT', '操作类型或请求号无效')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
  const fingerprint = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
  const key = `${operator.accountId}:${input.idempotencyKey}`, previous = operations.get(key)
  if (previous) { if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', '请求号已用于不同内容，请刷新后重新操作'); return clone(previous.result) }
  let cardIds: string[] = [], batchId: string | null = null, typeId: string | null = null, before = '', after = ''
  if (input.action === 'save-type') {
    const old = types.find(type => type.typeId === input.typeId)
    if (input.typeId && !old) fail('NOT_FOUND', '软件卡类型不存在')
    if ((old?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '类型配置已更新，请刷新后重试')
    const value = clone(input.value)
    if (!/^[A-Z][A-Z0-9_]{1,30}$/.test(value.businessCode) || types.some(type => type.typeId !== input.typeId && type.businessCode === value.businessCode)) fail('INVALID_INPUT', '业务编码须唯一，使用大写字母、数字或下划线')
    if (old && old.businessCode !== value.businessCode) fail('INVALID_INPUT', '已创建的业务编码不可修改，改名不改变业务语义')
    if (!value.name.trim() || value.name.length > 60 || !value.termLabel.trim() || value.termLabel.length > 100 || value.systemLabel.length > 100 || value.description.length > 500 || typeof value.active !== 'boolean') fail('INVALID_INPUT', '类型名称、有效期说明或其他字段无效')
    typeId = old?.typeId ?? crypto.randomUUID(); before = old ? `${old.name} V${old.version}` : '未创建'
    const type = { ...value, name: value.name.trim(), typeId, version: (old?.version ?? 0) + 1 }
    if (old) types[types.indexOf(old)] = type; else types.push(type)
    after = `${type.name} V${type.version}，不改变已有交付或激活状态`
  } else if (input.action === 'import') {
    const type = activeType(input.typeId)
    const secrets = input.codes.map(code => code.trim().toUpperCase())
    if (!input.name.trim() || input.name.length > 60 || !['supplier', 'hq', 'mock'].includes(input.source) || !input.sourceName.trim() || input.sourceName.length > 100 || input.referenceNo.length > 100) fail('INVALID_INPUT', '批次和发码来源信息无效')
    if (!secrets.length || secrets.length > limits.maxImportSize || secrets.some(code => !/^DEMO-SW-[A-Z0-9-]{4,80}$/.test(code))) fail('INVALID_INPUT', '仅允许DEMO-SW-开头的演示码，每行一个；禁止录入真实供应商码或会员/专栏码')
    if (new Set(secrets).size !== secrets.length || secrets.some(code => cards.some(card => card.secret === code))) fail('INVALID_INPUT', '本批次或库存中存在重复软件卡号')
    if (input.claimDeadline !== null && (!Number.isFinite(Date.parse(input.claimDeadline)) || Date.parse(input.claimDeadline) <= Date.now())) fail('INVALID_INPUT', '领用截止时间须为未来时间或明确不设期限')
    const batch: SoftwareBatch = { batchId: crypto.randomUUID(), name: input.name.trim(), typeId: type.typeId, typeName: type.name, source: input.source, sourceName: input.sourceName.trim(), referenceNo: input.referenceNo.trim(), quantity: secrets.length, claimDeadline: input.claimDeadline ? new Date(input.claimDeadline).toISOString() : null, createdAt: new Date().toISOString(), createdBy: operator.nickname }
    const imported = secrets.map(secret => stored(batch, secret))
    batches.push(batch); cards.push(...imported); cardIds = imported.map(card => card.cardId); batchId = batch.batchId; typeId = type.typeId
    before = '未录入'; after = `已录入${imported.length}张演示库存卡，未分配、未激活`
  } else if (input.action === 'replace') {
    const [old, replacement] = select([input.oldCard, input.replacementCard])
    if (old.status === 'delivered' || old.secretExportedAt || old.externalStatus !== 'unknown') fail('EXTERNAL_VERIFICATION_REQUIRED', '已交付、已导出或已有外部状态的卡须先完成供应商核验与作废确认，当前不能自动补发')
    if (old.status !== 'assigned' || old.replacementCardId) fail('INVALID_STATE', '仅可为已分配且尚未交付/导出的库存卡补发')
    if (replacement.typeId !== old.typeId || replacement.status !== 'available' || view(replacement).claimExpired || replacement.secretExportedAt || replacement.externalStatus !== 'unknown') fail('INVALID_STATE', '替代卡须为同类型、未导出、未过领用期的可用库存')
    activeType(old.typeId)
    before = `原卡${old.cardId}待交付，替代卡${replacement.cardId}可分配`
    Object.assign(replacement, { status: 'assigned', accountId: old.accountId, accountName: old.accountName, deliveryMode: old.deliveryMode, deliveryStoreId: old.deliveryStoreId, sourceOrderId: old.sourceOrderId, assignedAt: new Date().toISOString(), replacesCardId: old.cardId, version: replacement.version + 1 })
    old.status = 'replaced'; old.replacementCardId = replacement.cardId; old.version++
    cardIds = [old.cardId, replacement.cardId]; typeId = old.typeId; after = '替代卡继承原交付对象与订单；原卡仅在总部库存停发，不代表供应商已作废'
  } else {
    const rows = select(input.cards)
    before = rows.map(card => `${card.cardId}:${softwareStockLabels[card.status]}`).join('；')
    if (input.action === 'assign') {
      if (rows.some(card => card.status !== 'available' || view(card).claimExpired)) fail('INVALID_STATE', '仅可分配未过领用期的可用库存卡')
      rows.forEach(card => activeType(card.typeId))
      const account = mockUserDetail(input.accountId).account
      if (!['hq', 'store'].includes(input.deliveryMode) || input.deliveryMode === 'hq' && input.deliveryStoreId !== null || input.deliveryMode === 'store' && !mockUserOptions().stores.some(store => store.storeId === input.deliveryStoreId && store.active)) fail('INVALID_INPUT', '请选择总部交付，或选择有效门店交付')
      if (input.sourceOrderId) {
        const order = orders.find(order => order.orderId === input.sourceOrderId) ?? fail('NOT_FOUND', '演示软件卡订单不存在')
        if (order.accountId !== input.accountId || order.status !== 'PAID') fail('INVALID_INPUT', '订单购买账号不匹配或尚未付款')
        if (rows.some(card => card.typeId !== order.typeId)) fail('INVALID_INPUT', '软件卡类型与订单配置不匹配，不能从商品展示名称推断类型')
        if (order.deliveryMode !== input.deliveryMode || order.deliveryStoreId !== input.deliveryStoreId) fail('INVALID_INPUT', '交付方必须与订单快照一致；调整订单交付方需独立订单操作')
        const allocated = cards.filter(card => card.sourceOrderId === order.orderId && countsAgainstOrder(card)).length
        if (allocated + rows.length > order.quantity) fail('INVALID_STATE', '分配数量超过订单可交付数量')
      }
      rows.forEach(card => Object.assign(card, { status: 'assigned', accountId: account.accountId, accountName: account.nickname, sourceOrderId: input.sourceOrderId, deliveryMode: input.deliveryMode, deliveryStoreId: input.deliveryStoreId, assignedAt: new Date().toISOString(), version: card.version + 1 }))
      after = `已分配给${account.nickname}，待${input.deliveryMode === 'hq' ? '总部' : '门店'}交付；未激活`
    } else if (input.action === 'deliver') {
      if (rows.some(card => card.status !== 'assigned' || view(card).claimExpired)) fail('INVALID_STATE', '仅可记录已分配、未过领用期卡的交付')
      rows.forEach(card => { card.status = 'delivered'; card.deliveredAt = new Date().toISOString(); card.version++ })
      after = '已记录Mock交付，不代表已发送短信、已激活或已开通学习权益'
    } else {
      if (rows.some(card => !['available', 'assigned'].includes(card.status))) fail('INVALID_STATE', '仅可对未交付的可用/已分配库存停发')
      rows.forEach(card => { card.status = 'retired'; card.version++ }); after = '已在总部库存停发；未向供应商发送作废指令'
    }
    cardIds = rows.map(card => card.cardId)
  }
  const operation = addAudit(input.action, cardIds, batchId, typeId, input, operator, before, after)
  const result: SoftwareMutationResult = { batchId, cardIds, operation, mockOnly: true }
  operations.set(key, { fingerprint, result: clone(result) }); return clone(result)
}
export function mockSoftwareExport(input: SoftwareExportRequest, operator: HqAccount): SoftwareExport {
  reason(input.reason)
  if (!input.idempotencyKey) fail('INVALID_INPUT', '缺少导出请求号')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input)
  const previous = exports.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '导出请求参数不一致'); return clone(previous.result) }
  const rows = select(input.cards)
  const csv = makeCsv([['环境', '库存ID', '批次ID', '类型', '完整演示码', '库存状态', '外部激活状态', '领用截止', '交付对象', '交付方', '来源订单'], ...rows.map(card => ['仅Mock演示，不可用于真实软件', card.cardId, card.batchId, view(card).typeName, card.secret, softwareStockLabels[card.status], card.externalStatus, card.claimDeadline, card.accountName, card.deliveryMode === 'hq' ? '总部' : card.deliveryStoreId ?? '', card.sourceOrderId])])
  const now = new Date().toISOString()
  rows.forEach(card => { card.secretExportedAt ??= now; card.version++ })
  addAudit('export', rows.map(card => card.cardId), null, null, input, operator, '完整码受独立导出权限保护', `已导出${rows.length}张演示卡；标记完整码已披露，后续补发须供应商核验`)
  const result: SoftwareExport = { csv, fileName: `software-card-demo-${crypto.randomUUID()}.csv`, count: rows.length, mockOnly: true }
  exports.set(key, { payload, result: clone(result) }); return result
}
