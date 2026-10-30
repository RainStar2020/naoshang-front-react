import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SoftwareCard, SoftwareCardType, SoftwareMutation } from '../types/softwareCards'

let service: typeof import('./softwareCards')['softwareCardsService']
let auth: typeof import('./auth')['authService']
let members: typeof import('./members')['membersService']
let token: string
beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./softwareCards')).softwareCardsService
  auth = (await import('./auth')).authService
  members = (await import('./members')).membersService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.useRealTimers())
const base = () => ({ reason: '测试总部软件卡管理', idempotencyKey: crypto.randomUUID() })
const pick = (cards: SoftwareCard[]) => cards.map(card => ({ cardId: card.cardId, version: card.version }))
const card = async (id = 'sw-card-1') => (await service.detail(token, id)).card
const importRequest = (overrides: Partial<Extract<SoftwareMutation, { action: 'import' }>> = {}): SoftwareMutation => ({ ...base(), action: 'import', name: '软件卡演示入库', typeId: 'sw-type-1', source: 'mock', sourceName: '测试供应商', referenceNo: 'DEMO-REF', codes: ['DEMO-SW-TEST-0001', 'DEMO-SW-TEST-0002'], claimDeadline: null, ...overrides })
const saveType = (type: SoftwareCardType, value: Partial<SoftwareCardType> = {}): Extract<SoftwareMutation, { action: 'save-type' }> => ({ ...base(), action: 'save-type', typeId: type.typeId, version: type.version, value: { ...type, ...value } })
const assign = (rows: SoftwareCard[], overrides: Partial<Extract<SoftwareMutation, { action: 'assign' }>> = {}): SoftwareMutation => ({ ...base(), action: 'assign', cards: pick(rows), accountId: 'account-4', deliveryMode: 'store', deliveryStoreId: 'shop-1', sourceOrderId: 'sw-demo-order-open', ...overrides })

describe('独立软件卡目录与类型配置', () => {
  it('库存分页和筛选返回完整总数', async () => {
    expect((await service.list(token, { page: 1, pageSize: 10 })).total).toBe(12)
    expect((await service.list(token, { page: 2, pageSize: 10 })).items).toHaveLength(2)
    const filtered = await service.list(token, { page: 1, pageSize: 10, accountId: 'account-1', deliveryMode: 'store', storeId: 'shop-1', status: 'assigned' })
    expect(filtered.items.map(row => row.cardId)).toEqual(['sw-card-2'])
    expect((await service.list(token, { page: 1, pageSize: 10, claimState: 'expired' })).items.map(row => row.cardId)).toEqual(['sw-card-4'])
  })
  it('提供七类软件卡且不将任何库存状态当作外部已激活', async () => {
    const catalog = await service.catalog(token)
    expect(catalog.types).toHaveLength(7)
    expect((await card('sw-card-3'))).toMatchObject({ status: 'delivered', externalStatus: 'unknown', externalValidUntil: null, externalCheckedAt: null })
  })
  it('详情包含来源和交付快照，但永不返回secret', async () => {
    const detail = await service.detail(token, 'sw-card-2')
    expect(detail.card).toMatchObject({ accountId: 'account-1', sourceOrderId: 'sw-demo-order-store', deliveryStoreId: 'shop-1' })
    expect(detail.batch.sourceName).toBe('Mock供应商')
    expect(detail.card).not.toHaveProperty('secret')
    detail.card.status = 'delivered'
    expect((await card('sw-card-2')).status).toBe('assigned')
  })
  it('类型改名保留稳定编码和已有库存状态', async () => {
    const type = (await service.catalog(token)).types[0]
    await service.mutate(token, saveType(type, { name: '百科软件卡新版名称' }))
    expect((await card('sw-card-1')).typeName).toBe('百科软件卡新版名称')
    expect((await service.catalog(token)).types[0].businessCode).toBe('ENCYCLOPEDIA')
    expect((await card('sw-card-2')).status).toBe('assigned')
    await expect(service.mutate(token, saveType({ ...type, version: 2 }, { businessCode: 'OTHER_CODE' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('可创建新类型，但拒绝重复编码和旧版本覆盖', async () => {
    const type = (await service.catalog(token)).types[0]
    await expect(service.mutate(token, { ...saveType(type), typeId: '', version: 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const result = await service.mutate(token, { ...saveType(type, { businessCode: 'CUSTOM_CARD', name: '自定义演示软件卡' }), typeId: '', version: 0 })
    expect(result.operation.typeId).toBeTruthy()
    await service.mutate(token, saveType(type, { name: '新名字' }))
    await expect(service.mutate(token, saveType(type))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })
})

describe('批次录入与数据隔离', () => {
  it('演示码录入保留来源，不分配账号或开通学习权益', async () => {
    const before = await members.detail(token, 'member-1')
    const result = await service.mutate(token, importRequest())
    const rows = await service.list(token, { page: 1, pageSize: 10, batchId: result.batchId! })
    expect(rows.items).toHaveLength(2)
    expect(rows.items.every(row => row.status === 'available' && row.accountId === null && row.externalStatus === 'unknown')).toBe(true)
    expect((await service.detail(token, rows.items[0].cardId)).batch.referenceNo).toBe('DEMO-REF')
    expect(await members.detail(token, 'member-1')).toEqual(before)
  })
  it('不接受真实卡号、会员码、重复码或超出配置的批量', async () => {
    for (const codes of [['REAL-VENDOR-123'], ['DEMO-MEM-12345'], ['DEMO-SW-SAME', 'demo-sw-same']]) await expect(service.mutate(token, importRequest({ codes }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const max = (await service.catalog(token)).options.maxImportSize
    await expect(service.mutate(token, importRequest({ codes: Array.from({ length: max + 1 }, (_, i) => `DEMO-SW-TEST-${i}`) }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await service.catalog(token)).batches).toHaveLength(2)
  })
  it('已有库存重复录入会全批拒绝，领用期限不能在过去', async () => {
    await service.mutate(token, importRequest())
    await expect(service.mutate(token, importRequest({ codes: ['DEMO-SW-NEW-0001', 'DEMO-SW-TEST-0001'] }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, importRequest({ codes: ['DEMO-SW-NEW-0002'], claimDeadline: '2020-01-01T00:00:00Z' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await service.list(token, { page: 1, pageSize: 50 })).total).toBe(14)
  })
  it('相同导入请求并发重试只建立一批，改变内容必须用新请求', async () => {
    const input = importRequest()
    const [a, b] = await Promise.all([service.mutate(token, input), service.mutate(token, input)])
    expect(a).toEqual(b)
    expect((await service.catalog(token)).batches).toHaveLength(3)
    await expect(service.mutate(token, { ...input, reason: '改动参数' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('软件卡码不能进入会员/专栏激活通道', async () => {
    const consumer = await import('./mock/activationCodes')
    expect(() => consumer.previewMockActivation('DEMO-SW-TEST-0001', 'account-1', 'member-1')).toThrow('不接受软件卡')
  })
})

describe('分配、订单与交付状态', () => {
  it('已付款订单严格限制账号、卡类型、交付方和数量', async () => {
    const a = await card('sw-card-1'), b = await card('sw-card-6')
    await service.mutate(token, assign([a, b]))
    expect((await service.catalog(token)).options.orders.find(order => order.orderId === 'sw-demo-order-open')?.remainingQuantity).toBe(0)
    expect(await card(a.cardId)).toMatchObject({ status: 'assigned', accountId: 'account-4', sourceOrderId: 'sw-demo-order-open', deliveryStoreId: 'shop-1', externalStatus: 'unknown' })
    const result = await service.mutate(token, importRequest({ codes: ['DEMO-SW-OVER-ORDER'] }))
    const extra = (await service.list(token, { batchId: result.batchId!, page: 1, pageSize: 10 })).items[0]
    await expect(service.mutate(token, assign([extra]))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('拒绝未付款、账号不匹配、卡类型不符和交付快照不一致', async () => {
    const a = await card(), wrongType = await card('sw-card-7')
    await expect(service.mutate(token, assign([a], { accountId: 'account-3', sourceOrderId: 'sw-demo-order-unpaid', deliveryStoreId: 'shop-3' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, assign([a], { accountId: 'account-1' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, assign([wrongType]))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, assign([a], { deliveryMode: 'hq', deliveryStoreId: null }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await card()).status).toBe('available')
  })
  it('总部人工无订单分配可明确选择总部交付，不凭账号门店改变交付快照', async () => {
    const a = await card()
    await service.mutate(token, assign([a], { accountId: 'account-1', sourceOrderId: null, deliveryMode: 'hq', deliveryStoreId: null }))
    expect(await card()).toMatchObject({ status: 'assigned', deliveryMode: 'hq', deliveryStoreId: null, sourceOrderId: null })
  })
  it('记录交付不推断外部激活，不开通任何孩子权益', async () => {
    const before = await members.detail(token, 'member-1')
    const a = await card('sw-card-2')
    await service.mutate(token, { ...base(), action: 'deliver', cards: pick([a]) })
    expect(await card('sw-card-2')).toMatchObject({ status: 'delivered', externalStatus: 'unknown', externalValidUntil: null })
    expect(await members.detail(token, 'member-1')).toEqual(before)
  })
  it('领用已过期不能分配；分配后到期也不能交付', async () => {
    vi.useFakeTimers()
    await expect(service.mutate(token, assign([await card('sw-card-4')], { sourceOrderId: null }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    const result = await service.mutate(token, importRequest({ codes: ['DEMO-SW-SHORT-CLAIM'], claimDeadline: new Date(Date.now() + 1000).toISOString() }))
    const a = (await service.list(token, { page: 1, pageSize: 10, batchId: result.batchId! })).items[0]
    await service.mutate(token, assign([a], { sourceOrderId: null }))
    vi.advanceTimersByTime(2000)
    await expect(service.mutate(token, { ...base(), action: 'deliver', cards: pick([await card(a.cardId)]) })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('领用期限不会被当作已交付软件的激活有效期', async () => {
    vi.useFakeTimers()
    const result = await service.mutate(token, importRequest({ codes: ['DEMO-SW-DELIVERED-CLAIM'], claimDeadline: new Date(Date.now() + 1000).toISOString() }))
    const a = (await service.list(token, { page: 1, pageSize: 10, batchId: result.batchId! })).items[0]
    await service.mutate(token, assign([a], { sourceOrderId: null }))
    await service.mutate(token, { ...base(), action: 'deliver', cards: pick([await card(a.cardId)]) })
    vi.advanceTimersByTime(2000)
    expect(await card(a.cardId)).toMatchObject({ status: 'delivered', claimExpired: false, externalStatus: 'unknown', externalValidUntil: null })
  })
  it('批量操作先校验全部卡，重复或不合格选择不会部分成功', async () => {
    const a = await card(), delivered = await card('sw-card-3')
    await expect(service.mutate(token, { ...base(), action: 'retire', cards: pick([a, delivered]) })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect((await card()).status).toBe('available')
    await expect(service.mutate(token, { ...base(), action: 'retire', cards: pick([a, a]) })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('类型停用阻止新录入/分配，但不清空既有待交付记录', async () => {
    const type = (await service.catalog(token)).types[0]
    await service.mutate(token, saveType(type, { active: false }))
    await expect(service.mutate(token, importRequest())).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, assign([await card()]))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await service.mutate(token, { ...base(), action: 'deliver', cards: pick([await card('sw-card-2')]) })
    expect((await card('sw-card-2')).status).toBe('delivered')
  })
})

describe('库存补发、完整码披露及追溯', () => {
  it('同类型库存补发继承账号、订单、交付方并双向关联', async () => {
    const old = await card('sw-card-2'), replacement = await card('sw-card-1')
    const input: SoftwareMutation = { ...base(), action: 'replace', oldCard: pick([old])[0], replacementCard: pick([replacement])[0] }
    const result = await service.mutate(token, input)
    expect(await card(old.cardId)).toMatchObject({ status: 'replaced', replacementCardId: replacement.cardId })
    expect(await card(replacement.cardId)).toMatchObject({ status: 'assigned', replacesCardId: old.cardId, accountId: 'account-1', sourceOrderId: 'sw-demo-order-store', deliveryMode: 'store', deliveryStoreId: 'shop-1' })
    expect(await service.mutate(token, input)).toEqual(result)
    expect((await service.catalog(token)).options.orders.find(order => order.orderId === 'sw-demo-order-store')?.remainingQuantity).toBe(0)
  })
  it('已交付或完整码已披露的旧卡不能自动补发', async () => {
    const replacement = await card(), delivered = await card('sw-card-3')
    await expect(service.mutate(token, { ...base(), action: 'replace', oldCard: pick([delivered])[0], replacementCard: pick([replacement])[0] })).rejects.toMatchObject({ code: 'EXTERNAL_VERIFICATION_REQUIRED' })
    const old = await card('sw-card-2')
    await service.export(token, { ...base(), cards: pick([old]) })
    await expect(service.mutate(token, { ...base(), action: 'replace', oldCard: pick([await card(old.cardId)])[0], replacementCard: pick([replacement])[0] })).rejects.toMatchObject({ code: 'EXTERNAL_VERIFICATION_REQUIRED' })
  })
  it('替代卡必须同类型、未过期、未导出且仍可用', async () => {
    const old = await card('sw-card-2')
    for (const id of ['sw-card-7', 'sw-card-4', 'sw-card-5']) await expect(service.mutate(token, { ...base(), action: 'replace', oldCard: pick([old])[0], replacementCard: pick([await card(id)])[0] })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    const replacement = await card()
    await service.export(token, { ...base(), cards: pick([replacement]) })
    await expect(service.mutate(token, { ...base(), action: 'replace', oldCard: pick([old])[0], replacementCard: pick([await card()])[0] })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('库存停发保留历史关联，不声称供应商已作废', async () => {
    const old = await card('sw-card-2')
    const result = await service.mutate(token, { ...base(), action: 'retire', cards: pick([old]) })
    expect(await card(old.cardId)).toMatchObject({ status: 'retired', externalStatus: 'unknown', accountId: old.accountId, sourceOrderId: old.sourceOrderId })
    expect(result.operation.after).toContain('未向供应商')
    expect((await service.catalog(token)).options.orders.find(order => order.orderId === old.sourceOrderId)?.remainingQuantity).toBe(1)
  })
  it('已披露卡不能通过停发释放订单数量来绕过补发核验', async () => {
    const old = await card('sw-card-2')
    await service.export(token, { ...base(), cards: pick([old]) })
    await service.mutate(token, { ...base(), action: 'retire', cards: pick([await card(old.cardId)]) })
    expect((await service.catalog(token)).options.orders.find(order => order.orderId === old.sourceOrderId)?.remainingQuantity).toBe(0)
    await expect(service.mutate(token, assign([await card()], { accountId: 'account-1', sourceOrderId: old.sourceOrderId }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('完整码导出使用标准CSV并标记披露，重试不重复修改版本或写日志', async () => {
    const a = await card()
    const input = { ...base(), cards: pick([a]) }
    const result = await service.export(token, input)
    expect(result.csv).toMatch(/^\uFEFF"环境","库存ID"/)
    expect(result.csv).toMatch(/DEMO-SW-[A-F0-9]{32}/)
    expect(await card()).toMatchObject({ version: 2, status: 'available' })
    expect((await card()).secretExportedAt).toBeTruthy()
    expect(await service.export(token, input)).toEqual(result)
    expect((await service.catalog(token)).audit.filter(entry => entry.action === 'export')).toHaveLength(1)
    expect(JSON.stringify((await service.catalog(token)).audit)).not.toMatch(/DEMO-SW-[A-F0-9]{32}/)
  })
  it('旧版本不能覆盖分配或导出后更新的库存', async () => {
    const a = await card()
    await service.export(token, { ...base(), cards: pick([a]) })
    await expect(service.mutate(token, assign([a]))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })
})

describe('总部权限与无外部激活入口', () => {
  it('软件卡只读账号可查询但不能执行写入或导出', async () => {
    const type = (await service.catalog(token)).types[0], a = await card(), old = await card('sw-card-2')
    token = (await auth.login({ loginAccount: 'hq-software-viewer', password: 'Demo@123456' })).token
    expect((await service.list(token, { page: 1, pageSize: 10 })).total).toBe(12)
    const inputs: SoftwareMutation[] = [importRequest(), saveType(type), assign([a]), { ...base(), action: 'deliver', cards: pick([old]) }, { ...base(), action: 'retire', cards: pick([a]) }, { ...base(), action: 'replace', oldCard: pick([old])[0], replacementCard: pick([a])[0] }]
    for (const input of inputs) await expect(service.mutate(token, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.export(token, { ...base(), cards: pick([a]) })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('软件卡与会员激活码权限独立，退出后不能继续查询', async () => {
    token = (await auth.login({ loginAccount: 'hq-codes-viewer', password: 'Demo@123456' })).token
    await expect(service.catalog(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await auth.logout()
    await expect(service.detail(token, 'sw-card-1')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('未知操作不能伪造外部激活，所有变更必须填写原因并记录总部操作者', async () => {
    await expect(service.mutate(token, { ...base(), action: 'set-external-active' } as unknown as SoftwareMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, { ...importRequest(), reason: '  ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const result = await service.mutate(token, importRequest())
    expect(result.operation).toMatchObject({ action: 'import', operatorId: 'HQ001', reason: '测试总部软件卡管理' })
    expect((await service.catalog(token)).audit[0].requestId).toBe(result.operation.requestId)
  })
})
