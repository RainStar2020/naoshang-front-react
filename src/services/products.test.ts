import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { ProductDraft, ProductMutation } from '../types/products'
import { generateProductSkus } from '../utils/productSkus'
let service: typeof import('./products')['productsService']
let mock: typeof import('./mock/products')
let auth: typeof import('./auth')['authService']
let token: string
const base = () => ({ version: 1, reason: '验收商品目录', idempotencyKey: crypto.randomUUID() })
const save = (value: ProductDraft, version = 1): ProductMutation => ({ ...base(), action: 'save-product', value, version })
const command = (action: 'on-sale' | 'off-sale', version = 1, productId = 'product-software'): ProductMutation => ({ ...base(), action, version, productId })
const draft = async () => (await service.catalog(token)).products.find(row => row.draft.productId === 'product-software')!.draft
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./products')).productsService; mock = await import('./mock/products'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.restoreAllMocks())
it('目录提供五类商品、四类固定履约类型和分单位金额', async () => {
  const result = await service.catalog(token); expect(result.categories).toHaveLength(5); expect(result.types).toHaveLength(4)
  expect(mock.readMockProduct('product-software')).toMatchObject({ standardAmount: 36000, skus: [{ amount: 30000 }, { amount: 120000 }] })
})
it('分类新增和稳定排序，不改变原分类ID', async () => {
  const category = { categoryId: '', categoryLabel: '自定义分类', order: 0, enabled: true, version: 0 }
  const result = await service.mutate(token, { ...base(), action: 'save-category', value: category, version: 0 }); expect(result.categories[0].categoryLabel).toBe('自定义分类'); expect(result.categories[0].categoryId).not.toBe('')
})
it('分类停用阻止目录和直链，保留商品与发布快照', async () => {
  const value = (await service.catalog(token)).categories.find(row => row.categoryId === 'software')!
  await service.mutate(token, { ...base(), action: 'save-category', value: { ...value, enabled: false } })
  expect(mock.mockAvailableProducts('software')).toEqual([]); expect(() => mock.readMockProduct('product-software')).toThrow('停用')
  expect((await service.catalog(token)).products.find(row => row.draft.productId === 'product-software')?.publication).not.toBeNull()
  await service.mutate(token, { ...base(), action: 'save-category', value: { ...value, enabled: true }, version: 2 }); expect(mock.readMockProduct('product-software')).toBeDefined()
})
it('拒绝重复分类名称与非法排序', async () => {
  const value = (await service.catalog(token)).categories[0]
  await expect(service.mutate(token, { ...base(), action: 'save-category', value: { ...value, categoryLabel: '软件卡' } })).rejects.toThrow('重复')
  await expect(service.mutate(token, { ...base(), action: 'save-category', value: { ...value, order: -1 } })).rejects.toThrow('排序')
})
it('类型改名只改变标题不改变编码或SKU售价', async () => {
  await service.mutate(token, { ...base(), action: 'rename-type', code: 'ACTIVATION_CODE', title: '数字权益卡' })
  expect(mock.readMockProduct('product-software')).toMatchObject({ fulfillmentType: 'ACTIVATION_CODE', typeTitle: '数字权益卡', skus: [{ amount: 30000 }, { amount: 120000 }] })
})
it('已保存商品不允许更改履约类型', async () => { await expect(service.mutate(token, save({ ...await draft(), fulfillmentType: 'PHYSICAL' }))).rejects.toThrow('履约类型') })
it('草稿价格修改不影响已发布商品，重新上架后更新', async () => {
  const value = await draft(); value.skus[0].amount = 12345; await service.mutate(token, save(value)); expect(mock.readMockProduct('product-software').skus[0].amount).toBe(30000)
  await service.mutate(token, command('on-sale', 2)); expect(mock.readMockProduct('product-software').skus[0].amount).toBe(12345)
})
it('下架停止目录读取，不删除商品', async () => {
  await service.mutate(token, command('off-sale')); expect(() => mock.readMockProduct('product-software')).toThrow('下架')
  await service.mutate(token, command('on-sale', 2)); expect(mock.readMockProduct('product-software')).toBeDefined()
})
it('价格字段互相独立，修改折扣标签不推算SKU售价', async () => {
  const value = await draft(); value.standardAmount = 90000; value.activityAmount = 70000; value.originalAmount = 100000; value.memberPrices[0] = { ...value.memberPrices[0], discountLabel: '1折', amount: 23456 }; value.rolePrices = [{ id: 'agency', label: '区县', discountLabel: '2折', amount: 34567 }]
  await service.mutate(token, save(value)); await service.mutate(token, command('on-sale', 2)); expect(mock.readMockProduct('product-software')).toMatchObject({ standardAmount: 90000, activityAmount: 70000, memberPrices: [{ amount: 23456 }], rolePrices: [{ amount: 34567 }], skus: [{ amount: 30000 }, { amount: 120000 }] })
})
it.each([-1, 1.1, NaN, Infinity, 1000000001])('拒绝非法分金额 %s', async amount => { const value = await draft(); value.skus[0].amount = amount; await expect(service.mutate(token, save(value))).rejects.toThrow('售价') })
it('库存为非负整数，售罄商品可发布', async () => {
  const value = await draft(); value.skus[0].stock = 0; await service.mutate(token, save(value)); await service.mutate(token, command('on-sale', 2)); expect(mock.readMockProduct('product-software').skus[0].stock).toBe(0)
  value.skus[0].stock = 1.5; await expect(service.mutate(token, save(value, 3))).rejects.toThrow('库存')
})
it('SKU组合生成保留稳定ID和原有金额库存，新增为0', async () => {
  const value = await draft(); value.specGroups[0].options[0].label = '一个月'; value.specGroups[0].options.push({ id: 'new-option', label: '季卡' })
  const result = generateProductSkus(value); expect(result[0]).toMatchObject({ id: value.skus[0].id, amount: 30000, stock: 20, label: '一个月' }); expect(result[2]).toMatchObject({ amount: 0, stock: 0 })
})
it('多规格组合生成准确且限制组合数量', async () => {
  const value = await draft(); value.specGroups.push({ id: 'color', label: '颜色', options: [{ id: 'r', label: '红' }, { id: 'b', label: '蓝' }] }); expect(generateProductSkus(value)).toHaveLength(4)
  value.specGroups[1].options = Array.from({ length: 51 }, (_, i) => ({ id: String(i), label: String(i) })); expect(() => generateProductSkus(value)).toThrow('100')
})
it('规格变化必须同步SKU，不能提交悬空选项', async () => {
  const value = await draft(); value.specGroups[0].options.pop(); await expect(service.mutate(token, save(value))).rejects.toThrow('规格组不一致')
  value.skus = generateProductSkus(value); await expect(service.mutate(token, save(value))).resolves.toBeDefined()
})
it('拒绝重复组合、重复SKU ID和跨商品SKU冲突', async () => {
  const value = await draft(); value.skus.push({ ...value.skus[0], id: 'duplicate-combo' }); await expect(service.mutate(token, save(value))).rejects.toThrow('同一规格')
  value.skus.pop(); value.skus[1].id = value.skus[0].id; await expect(service.mutate(token, save(value))).rejects.toThrow('SKU ID')
  value.skus[1].id = 'sku-physical-1'; await expect(service.mutate(token, save(value))).rejects.toThrow('其他商品')
})
it('无规格默认SKU可发布，空SKU不能上架', async () => {
  const value = await draft(); value.specGroups = []; value.skus = generateProductSkus(value); await service.mutate(token, save(value)); await service.mutate(token, command('on-sale', 2))
  value.skus = []; await service.mutate(token, save(value, 3)); await expect(service.mutate(token, command('on-sale', 4))).rejects.toThrow('SKU')
})
it('新建商品进入草稿目录，不直接可购买', async () => {
  const value = await draft(); value.productId = ''; value.skus = []; const result = await service.mutate(token, save(value, 0)); const created = result.products[result.products.length - 1]
  expect(created.status).toBe('draft'); expect(() => mock.readMockProduct(created.draft.productId)).toThrow()
})
it('发布校验封面正文及启用分类', async () => {
  const value = await draft(); value.coverUrl = ''; await service.mutate(token, save(value)); await expect(service.mutate(token, command('on-sale', 2))).rejects.toThrow('封面')
})
it('富文本安全过滤脚本，拒绝不安全资源地址', async () => {
  const value = await draft(); value.content.nodes.push({ name: 'script', children: [{ type: 'text', text: 'evil()' }] } as never); await service.mutate(token, save(value)); expect(JSON.stringify((await service.catalog(token)).products[1].draft.content)).not.toContain('evil')
  value.coverUrl = 'http://unsafe.test/a.png'; await expect(service.mutate(token, save(value, 2))).rejects.toThrow('HTTPS')
})
it('请求幂等及乐观版本冲突', async () => {
  const request = command('on-sale'); await service.mutate(token, request); await service.mutate(token, request); expect((await service.catalog(token)).audit).toHaveLength(1)
  await expect(service.mutate(token, { ...request, reason: '篡改' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }); await expect(service.mutate(token, command('off-sale'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('编辑权限不能发布或修改分类/类型，上传不要求课程权限', async () => {
  const value = await draft(); const editor = (await auth.login({ loginAccount: 'hq-product-editor', password: 'Demo@123456' })).token
  await expect(service.mutate(editor, save(value))).resolves.toBeDefined(); await expect(service.mutate(editor, command('on-sale', 2))).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.mutate(editor, { ...base(), action: 'rename-type', code: 'PHYSICAL', title: '新标题' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo'); await expect(service.upload(editor, new File(['x'], 'x.png', { type: 'image/png' }))).resolves.toMatchObject({ previewUrl: 'blob:demo' })
})
it('只读权限拒绝写入，退出拒绝读取', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-product-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(viewer)).resolves.toBeDefined(); await expect(service.mutate(viewer, command('on-sale'))).rejects.toMatchObject({ code: 'FORBIDDEN' }); await auth.logout(); await expect(service.catalog(viewer)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('HQ-07专栏商品关联来自统一目录，新增专栏类型商品可选', async () => {
  const value = await draft(); value.productId = ''; value.fulfillmentType = 'COLUMN_ACCESS'; value.skus = []
  const result = await service.mutate(token, save(value, 0)); const created = result.products[result.products.length - 1]
  const columns = (await import('./columns')).columnsService; expect((await columns.catalog(token)).products.some(product => product.productId === created.draft.productId)).toBe(true)
  expect(mock.mockColumnProductOptions().every(product => product.fulfillmentType === 'COLUMN_ACCESS')).toBe(true)
})
it('目录读取返回副本，修改不污染状态', () => { const value = mock.readMockProduct('product-software'); value.skus[0].amount = 1; expect(mock.readMockProduct('product-software').skus[0].amount).toBe(30000) })


it('四类 fulfillmentType 均可新建草稿（不含 VIRTUAL/MEMBERSHIP）', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.types.map((t) => t.code).sort()).toEqual(['ACTIVATION_CODE', 'COLUMN_ACCESS', 'OFFLINE_SERVICE', 'PHYSICAL'])
  expect(catalog.types.some((t) => (t.code as string) === 'VIRTUAL' || (t.code as string) === 'MEMBERSHIP')).toBe(false)
  for (const code of ['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'] as const) {
    const value = structuredClone(await draft())
    value.productId = ''
    value.fulfillmentType = code
    value.costAmount = 1000
    value.standardAmount = 2000
    value.skus = []
    const result = await service.mutate(token, save(value, 0))
    const created = result.products[result.products.length - 1]
    expect(created.status).toBe('draft')
    expect(created.draft.fulfillmentType).toBe(code)
    expect(created.draft.costAmount).toBe(1000)
  }
})

it('售价低于成本价默认可保存，成本与售价按分存储', async () => {
  const value = await draft()
  value.costAmount = 50000
  value.standardAmount = 10000
  await expect(service.mutate(token, save(value))).resolves.toBeDefined()
  const saved = (await service.catalog(token)).products.find((row) => row.draft.productId === 'product-software')!
  expect(saved.draft.costAmount).toBe(50000)
  expect(saved.draft.standardAmount).toBe(10000)
})

it('商品详情含 video 节点时保存失败并提示', async () => {
  const value = await draft()
  value.content = {
    version: 1,
    format: 'nodes',
    nodes: [
      { name: 'p', attrs: {}, children: [{ type: 'text', text: '正文' }] },
      { name: 'video', attrs: { src: 'https://mock-assets.invalid/a.mp4' }, children: [] } as never,
    ],
  }
  await expect(service.mutate(token, save(value))).rejects.toThrow(/视频|video/i)
})

it('新建必须给出合法履约类型', async () => {
  const value = await draft()
  value.productId = ''
  value.fulfillmentType = '' as never
  value.skus = []
  await expect(service.mutate(token, save(value, 0))).rejects.toThrow()
})

it('已保存商品不可改履约类型', async () => {
  const value = structuredClone(await draft())
  const original = value.fulfillmentType
  const next = (['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'] as const).find((code) => code !== original)!
  value.fulfillmentType = next
  await expect(service.mutate(token, save(value))).rejects.toThrow(/履约类型|不能改变|不可/)
  const again = (await service.catalog(token)).products.find((row) => row.draft.productId === 'product-software')!
  expect(again.draft.fulfillmentType).toBe(original)
})