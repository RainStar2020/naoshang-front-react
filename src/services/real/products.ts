import * as api from '../../api'
import { ProductError, type ProductCatalog, type ProductMutation, type ManagedProduct, type ProductDraft, type ProductCategory, type ProductType } from '../../types/products'
import { arr, asPage, cast, fenToYuan, mapHqError, mutationBody, num, record, str, unsupported, unwrapData, yuanToFen } from './bridge'

function mapDraft(raw: unknown): ProductDraft {
  const r = record(raw)
  const skus = arr(r.skus).map((s) => {
    const sku = record(s)
    const amountRaw = sku.amount ?? sku.price ?? sku.standardPrice
    const amount = num(amountRaw)
    return {
      id: str(sku.id || sku.skuId, `sku-${Math.random().toString(36).slice(2, 8)}`),
      label: str(sku.label || sku.name, '默认规格'),
      specs: (record(sku.specs) as Record<string, string>) || {},
      amount: amount >= 1000 && Number.isInteger(amount) && !('price' in sku) ? amount : yuanToFen(amountRaw),
      stock: num(sku.stock, 0),
    }
  })
  const amountYuan = r.standardPrice ?? r.price ?? r.standardAmount
  const standardNum = num(r.standardAmount || amountYuan)
  const standardAmount = ('standardAmount' in r && standardNum >= 1000) ? standardNum : yuanToFen(amountYuan)
  return {
    productId: str(r.productId || r.id),
    categoryId: str(r.categoryId, 'default'),
    title: str(r.title || r.name, '未命名商品'),
    summary: str(r.summary || r.description),
    coverUrl: str(r.coverUrl || r.cover),
    content: (r.content as ProductDraft['content']) || { blocks: [] },
    fulfillmentType: (str(r.fulfillmentType, 'PHYSICAL') as ProductDraft['fulfillmentType']),
    requiresMember: Boolean(r.requiresMember),
    pricePresentation: (str(r.pricePresentation, 'standard-only') as ProductDraft['pricePresentation']),
    costAmount: ('costAmount' in r && num(r.costAmount) >= 1000) ? num(r.costAmount) : yuanToFen(r.costPrice ?? r.costAmount),
    originalAmount: r.originalAmount == null && r.originalPrice == null ? null : (('originalAmount' in r && num(r.originalAmount) >= 1000) ? num(r.originalAmount) : yuanToFen(r.originalPrice ?? r.originalAmount)),
    standardAmount,
    activityAmount: r.activityAmount == null && r.activityPrice == null ? null : (('activityAmount' in r && num(r.activityAmount) >= 1000) ? num(r.activityAmount) : yuanToFen(r.activityPrice ?? r.activityAmount)),
    memberPrices: arr(r.memberPrices).map((t, i) => {
      const tier = record(t)
      const a = num(tier.amount ?? tier.price)
      return { id: str(tier.id, `m${i}`), label: str(tier.label, '会员价'), discountLabel: str(tier.discountLabel), amount: ('amount' in tier && a >= 1000) ? a : yuanToFen(tier.price ?? tier.amount) }
    }),
    rolePrices: arr(r.rolePrices).map((t, i) => {
      const tier = record(t)
      const a = num(tier.amount ?? tier.price)
      return { id: str(tier.id, `r${i}`), label: str(tier.label, '角色价'), discountLabel: str(tier.discountLabel), amount: ('amount' in tier && a >= 1000) ? a : yuanToFen(tier.price ?? tier.amount) }
    }),
    specGroups: arr(r.specGroups).map((g) => {
      const group = record(g)
      return {
        id: str(group.id, 'spec'),
        label: str(group.label, '规格'),
        options: arr(group.options).map((o) => {
          const opt = record(o)
          return { id: str(opt.id), label: str(opt.label) }
        }),
      }
    }),
    skus: skus.length ? skus : [{ id: 'default', label: '默认', specs: {}, amount: standardAmount, stock: num(r.stock, 0) }],
  }
}

function mapManaged(raw: unknown): ManagedProduct {
  const r = record(raw)
  const draft = mapDraft(r.draft ?? r)
  const statusRaw = str(r.status || r.saleStatus, 'draft').toLowerCase()
  const status = ['on-sale', 'on_sale', 'onsale', 'published', 'on-shelf', 'on_shelf'].includes(statusRaw) ? 'on-sale'
    : ['off-sale', 'off_sale', 'offsale', 'unpublished', 'off-shelf', 'off_shelf'].includes(statusRaw) ? 'off-sale' : 'draft'
  return {
    draft,
    version: num(r.version, 1),
    status,
    publication: r.publication ? cast(r.publication) : (status === 'on-sale' ? { revision: 1, publishedAt: str(r.publishedAt || r.updatedAt, new Date().toISOString()), value: draft } : null),
  }
}

export async function realProductCatalog(): Promise<ProductCatalog> {
  try {
    const [catalogData, listData] = await Promise.all([
      unwrapData(await api.getProductsCatalog()),
      unwrapData(await api.getProducts({ page: 1, pageSize: 100 })),
    ])
    const catalog = record(catalogData)
    const page = asPage(listData)
    const categories: ProductCategory[] = arr(catalog.categories).map((c, i) => {
      const row = record(c)
      return { categoryId: str(row.categoryId || row.id, `cat-${i}`), categoryLabel: str(row.categoryLabel || row.name || row.label, `分类${i + 1}`), order: num(row.order, i + 1), enabled: row.enabled !== false, version: num(row.version, 1) }
    })
    const types: ProductType[] = arr(catalog.types).length
      ? arr(catalog.types).map((t) => {
          const row = record(t)
          return { code: str(row.code || row.fulfillmentType, 'PHYSICAL') as ProductType['code'], title: str(row.title || row.name), version: num(row.version, 1) }
        })
      : [
          { code: 'PHYSICAL', title: '实物商品', version: 1 },
          { code: 'ACTIVATION_CODE', title: '软件卡', version: 1 },
          { code: 'OFFLINE_SERVICE', title: '线下服务', version: 1 },
          { code: 'COLUMN_ACCESS', title: '专栏', version: 1 },
        ]
    const products = page.items.length ? page.items.map(mapManaged) : arr(catalog.products).map(mapManaged)
    return { categories, types, products, audit: arr(catalog.audit).map((a) => cast(a)) }
  } catch (error) {
    return mapHqError(error, ProductError)
  }
}

export async function realProductMutate(input: ProductMutation): Promise<ProductCatalog> {
  try {
    if (input.action === 'save-category' || input.action === 'rename-type') {
      return unsupported(ProductError, input.action, '商品分类/履约类型改名当前 HQ products API 未暴露')
    }
    if (input.action === 'save-product') {
      const draft = input.value
      const payload = {
        title: draft.title,
        summary: draft.summary,
        coverUrl: draft.coverUrl,
        categoryId: draft.categoryId,
        fulfillmentType: draft.fulfillmentType,
        requiresMember: draft.requiresMember,
        pricePresentation: draft.pricePresentation,
        costPrice: fenToYuan(draft.costAmount),
        standardPrice: fenToYuan(draft.standardAmount),
        activityPrice: draft.activityAmount == null ? null : fenToYuan(draft.activityAmount),
        originalPrice: draft.originalAmount == null ? null : fenToYuan(draft.originalAmount),
        content: draft.content,
        skus: draft.skus.map((sku) => ({ id: sku.id, label: sku.label, specs: sku.specs, stock: sku.stock, price: fenToYuan(sku.amount) })),
        specGroups: draft.specGroups,
        memberPrices: draft.memberPrices.map((t) => ({ id: t.id, label: t.label, discountLabel: t.discountLabel, price: fenToYuan(t.amount) })),
        rolePrices: draft.rolePrices.map((t) => ({ id: t.id, label: t.label, discountLabel: t.discountLabel, price: fenToYuan(t.amount) })),
      }
      if (draft.productId) {
        const body = mutationBody({ action: 'update', reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version, ...payload })
        await unwrapData(await api.postProductsByProductIdMutate({ productId: draft.productId }, body as never))
      } else {
        const body = mutationBody({ action: 'create', reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version, ...payload })
        await unwrapData(await api.postProductsMutate(body as never))
      }
      return realProductCatalog()
    }
    const action = input.action === 'on-sale' ? 'on-shelf' : 'off-shelf'
    const body = mutationBody({ action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    await unwrapData(await api.postProductsByProductIdMutate({ productId: input.productId }, body as never))
    return realProductCatalog()
  } catch (error) {
    return mapHqError(error, ProductError)
  }
}

export async function realProductUpload(_file: File): Promise<{ assetId: string; url: string; previewUrl: string; kind: 'image' | 'video'; mockOnly: boolean }> {
  return unsupported(ProductError, 'upload', '商品素材上传需走专栏/资料 assets 接口')
}

export function realProductAssetUrl(url: string): string {
  return url
}
