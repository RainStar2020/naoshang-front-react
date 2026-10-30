import type { HqAccount } from '../../types/auth'
import { fulfillmentTypes, ProductError, type FulfillmentType, type ProductCatalog, type ProductCategory, type ProductDraft, type ProductMutation, type ProductType, type ManagedProduct } from '../../types/products'
import { hasContent, isMediaUrl, normalizeContent } from '../../utils/richContent'
import { assertProductContentAllowsSave } from '../../utils/productContent'
import { skuCombinationKey } from '../../utils/productSkus'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: ProductError['code'], message: string): never => { throw new ProductError(code, message) }
const categories: ProductCategory[] = ['脑力核心', '软件卡', '特色产品', '行政费', '专栏产品'].map((categoryLabel, i) => ({ categoryId: ['physical', 'software', 'special', 'admin', 'column'][i], categoryLabel, order: i + 1, enabled: true, version: 1 }))
const types: ProductType[] = fulfillmentTypes.map((code, i) => ({ code, title: ['实物商品', '软件卡', '线下服务', '专栏'][i], version: 1 }))
const content = () => normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'p', children: [{ type: 'text', text: '总部商品介绍演示，实际交易金额以后端报价为准。' }] }] })
const products: ManagedProduct[] = categories.map((category, i) => {
  const amounts = [158000, 30000, 108000, 20000, 7900], standards = [198000, 36000, 128000, 20000, 9900]
  const type: FulfillmentType = ['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'][i] as FulfillmentType
  const options = (i === 1 ? ['月卡', '年卡'] : ['默认', '进阶版']).map((label, j) => ({ id: `opt-${j + 1}`, label }))
  const value: ProductDraft = { productId: `product-${category.categoryId}`, categoryId: category.categoryId, title: ['平板', 'xxx软件卡', 'xxxxxx集训营', 'XXX期训练营行政费', 'BZ-《记忆基础》'][i], summary: '商品配置演示，规格及价格需总部确认。', coverUrl: 'https://mock-assets.invalid/demo-cover', content: content(), fulfillmentType: type, costAmount: Math.floor(amounts[i] * 0.6), requiresMember: i === 2 || i === 3, pricePresentation: i === 3 ? 'standard-only' : 'tiered', originalAmount: standards[i], standardAmount: standards[i], activityAmount: amounts[i], memberPrices: [{ id: 'vip', label: 'VIP', discountLabel: '演示标签', amount: amounts[i] }], rolePrices: [], specGroups: [{ id: 'spec', label: '规格', options }], skus: options.map((option, j) => ({ id: `sku-${category.categoryId}-${j + 1}`, label: option.label, specs: { spec: option.id }, amount: j === 1 && i === 1 ? 120000 : amounts[i], stock: j === 0 ? 20 : 8 })) }
  return { draft: value, version: 1, status: 'on-sale', publication: { revision: 1, publishedAt: '2026-10-01T09:00:00+08:00', value: copy(value) } }
})
// 保留HQ-07既有测试目标ID，统一来源后不改变专栏绑定。
const second = copy(products[4]); second.draft.productId = 'demo-product-column-2'; second.draft.title = '专栏商品演示二'; second.draft.skus = second.draft.skus.map(sku => ({ ...sku, id: `secondary-${sku.id}` })); second.publication!.value = copy(second.draft); products.push(second)
const audit: ProductCatalog['audit'] = [], operations = new Map<string, { payload: string; result: ProductCatalog }>()
const find = (id: string) => products.find(row => row.draft.productId === id) ?? fail('NOT_FOUND', '商品不存在')
export function mockProductCatalog(): ProductCatalog { return copy({ categories: [...categories].sort((a, b) => a.order - b.order || a.categoryId.localeCompare(b.categoryId)), types, products, audit: [...audit].reverse() }) }
const amount = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000
function clean(value: ProductDraft, publishing: boolean): ProductDraft {
  const draft = copy(value)
  if (!draft.title.trim() || draft.title.length > 80 || draft.summary.length > 500 || !categories.some(row => row.categoryId === draft.categoryId) || !fulfillmentTypes.includes(draft.fulfillmentType) || typeof draft.requiresMember !== 'boolean' || !['standard-only', 'tiered'].includes(draft.pricePresentation)) fail('INVALID_INPUT', '商品标题、分类、类型或展示配置无效')
  if (draft.coverUrl && !isMediaUrl(draft.coverUrl)) fail('INVALID_INPUT', '封面必须为HTTPS地址')
  if (!amount(draft.costAmount) || !amount(draft.standardAmount) || draft.activityAmount !== null && !amount(draft.activityAmount) || draft.originalAmount !== null && !amount(draft.originalAmount)) fail('INVALID_INPUT', '成本价/售价等金额必须为0至1000000000的整数分')
  try { assertProductContentAllowsSave(draft.content) } catch (error) { fail('INVALID_INPUT', error instanceof Error ? error.message : '商品详情含禁止媒体') }
  for (const tiers of [draft.memberPrices, draft.rolePrices]) {
    const ids = new Set<string>(); if (tiers.length > 20) fail('INVALID_INPUT', '价格档位最多20个')
    for (const tier of tiers) { if (!tier.id || ids.has(tier.id) || !tier.label.trim() || tier.label.length > 40 || tier.discountLabel.length > 40 || !amount(tier.amount)) fail('INVALID_INPUT', '价格档位ID、名称或金额无效'); ids.add(tier.id) }
  }
  const groupIds = new Set<string>(); if (draft.specGroups.length > 5 || draft.skus.length > 100) fail('INVALID_INPUT', '演示限制5个规格组、100个SKU')
  for (const group of draft.specGroups) { if (!group.id || groupIds.has(group.id) || !group.label.trim() || group.label.length > 40 || !group.options.length || group.options.length > 30) fail('INVALID_INPUT', '规格组名称、ID或选项无效'); groupIds.add(group.id); const ids = new Set<string>(); for (const option of group.options) { if (!option.id || ids.has(option.id) || !option.label.trim() || option.label.length > 40) fail('INVALID_INPUT', '规格选项ID或名称无效'); ids.add(option.id) } }
  const skuIds = new Set<string>(), combinations = new Set<string>()
  for (const sku of draft.skus) {
    if (!sku.id || skuIds.has(sku.id) || !sku.label.trim() || sku.label.length > 200 || !amount(sku.amount) || !Number.isSafeInteger(sku.stock) || sku.stock < 0 || sku.stock > 1000000000) fail('INVALID_INPUT', 'SKU ID、名称、售价或库存无效')
    skuIds.add(sku.id)
    const key = skuCombinationKey(sku.specs)
    if (combinations.has(key)) fail('INVALID_INPUT', '同一规格组合不能配置多个SKU'); combinations.add(key)
    if (Object.keys(sku.specs).length !== draft.specGroups.length || draft.specGroups.some(group => !group.options.some(option => option.id === sku.specs[group.id]))) fail('INVALID_INPUT', 'SKU规格与当前规格组不一致，请重新生成组合')
    if (products.some(row => row.draft.productId !== draft.productId && row.draft.skus.some(other => other.id === sku.id))) fail('INVALID_INPUT', 'SKU ID已被其他商品使用')
  }
  draft.title = draft.title.trim(); draft.content = normalizeContent(draft.content)
  if (publishing && (!draft.summary.trim() || !isMediaUrl(draft.coverUrl) || !hasContent(draft.content) || !draft.skus.length || !categories.find(row => row.categoryId === draft.categoryId)?.enabled)) fail('INVALID_INPUT', '上架需要启用分类、简介、封面、正文与SKU')
  return draft
}
export function mockProductMutate(input: ProductMutation, operator: HqAccount) {
  if (!['save-category', 'rename-type', 'save-product', 'on-sale', 'off-sale'].includes(input.action) || !input.reason.trim() || input.reason.trim().length > 200 || !input.idempotencyKey) fail('INVALID_INPUT', '操作、原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数改变'); return copy(previous.result) }
  let targetId: string
  const version = input.version + 1
  if (input.action === 'save-category') {
    const value = copy(input.value), row = value.categoryId ? categories.find(row => row.categoryId === value.categoryId) ?? fail('NOT_FOUND', '分类不存在') : null
    if ((row?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '分类已更新')
    if (!value.categoryLabel.trim() || value.categoryLabel.length > 40 || !Number.isSafeInteger(value.order) || value.order < 0 || value.order > 9999 || typeof value.enabled !== 'boolean' || categories.some(other => other.categoryId !== value.categoryId && other.categoryLabel === value.categoryLabel.trim())) fail('INVALID_INPUT', '分类名称、排序或状态无效/重复')
    value.categoryId ||= `category-${crypto.randomUUID()}`; value.version = version; value.categoryLabel = value.categoryLabel.trim(); targetId = value.categoryId
    if (row) Object.assign(row, value); else categories.push(value)
  } else if (input.action === 'rename-type') {
    const row = types.find(row => row.code === input.code) ?? fail('INVALID_INPUT', '履约类型编码无效')
    if (row.version !== input.version) fail('VERSION_CONFLICT', '类型已更新')
    if (!input.title.trim() || input.title.length > 40) fail('INVALID_INPUT', '类型标题须为1至40字')
    row.title = input.title.trim(); row.version = version; targetId = row.code
  } else {
    const id = input.action === 'save-product' ? input.value.productId : input.productId, row = id ? find(id) : null
    if ((row?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '商品已更新，请刷新')
    if (input.action === 'save-product') {
      if (row && row.draft.fulfillmentType !== input.value.fulfillmentType) fail('INVALID_INPUT', '已建商品不能改变履约类型，请新建商品')
      const value = clean(input.value, false); value.productId ||= `product-${crypto.randomUUID()}`; targetId = value.productId
      if (row) { row.draft = value; row.version = version } else products.push({ draft: value, version, status: 'draft', publication: null })
    } else {
      if (!row) fail('NOT_FOUND', '请先保存商品')
      const current = row!; targetId = id
      if (input.action === 'on-sale') { const value = clean(current.draft, true); current.publication = { value, revision: (current.publication?.revision ?? 0) + 1, publishedAt: new Date().toISOString() }; current.status = 'on-sale' }
      else { if (current.status !== 'on-sale') fail('INVALID_STATE', '仅已上架商品可下架'); current.status = 'off-sale' }
      current.version = version
    }
  }
  audit.push({ operationId: crypto.randomUUID(), targetId, action: input.action, reason: input.reason.trim(), requestId: input.idempotencyKey, operatorName: operator.nickname, beforeVersion: input.version, afterVersion: version, occurredAt: new Date().toISOString() })
  const result = mockProductCatalog(); operations.set(key, { payload, result: copy(result) }); return result
}
export function mockAvailableProducts(categoryId?: string) {
  return copy(products.filter(row => row.status === 'on-sale' && row.publication && categories.some(category => category.categoryId === row.publication!.value.categoryId && category.enabled) && (!categoryId || row.publication!.value.categoryId === categoryId)).map(row => ({ ...row.publication!.value, categoryLabel: categories.find(category => category.categoryId === row.publication!.value.categoryId)!.categoryLabel, typeTitle: types.find(type => type.code === row.publication!.value.fulfillmentType)!.title })))
}
export function readMockProduct(id: string) { return mockAvailableProducts().find(row => row.productId === id) ?? fail('FORBIDDEN', '商品已下架、未发布或分类已停用') }
/** HQ-07关联选项使用统一商品目录；含已保存商品以保留既有绑定，禁止非专栏类型。 */
export function mockColumnProductOptions() { return copy(products.filter(row => row.draft.fulfillmentType === 'COLUMN_ACCESS').map(row => ({ productId: row.draft.productId, title: row.draft.title, fulfillmentType: 'COLUMN_ACCESS' as const, mockOnly: true as const }))) }
