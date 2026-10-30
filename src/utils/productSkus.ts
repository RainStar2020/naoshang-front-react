import type { ProductDraft, ProductSku } from '../types/products'
export function skuCombinationKey(specs: Record<string, string>) { return JSON.stringify(Object.entries(specs).sort(([a], [b]) => a.localeCompare(b))) }
/** 显式生成组合，保留未变组合的SKU ID/售价/库存；不以标签作为ID。 */
export function generateProductSkus(draft: ProductDraft): ProductSku[] {
  let combinations: { specs: Record<string, string>; labels: string[] }[] = [{ specs: {}, labels: [] }]
  for (const group of draft.specGroups) {
    if (!group.options.length) throw new Error('每个规格组至少需要一个选项')
    if (combinations.length * group.options.length > 100) throw new Error('演示规格组合最多100个')
    combinations = combinations.flatMap(row => group.options.map(option => ({ specs: { ...row.specs, [group.id]: option.id }, labels: [...row.labels, option.label] })))
  }
  return combinations.map(row => { const old = draft.skus.find(sku => skuCombinationKey(sku.specs) === skuCombinationKey(row.specs)); return { id: old?.id ?? `sku-${crypto.randomUUID()}`, label: row.labels.join('，') || '默认', specs: row.specs, amount: old?.amount ?? 0, stock: old?.stock ?? 0 } })
}
