import type { RichContent } from './cms'
export const fulfillmentTypes = ['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'] as const
export type FulfillmentType = typeof fulfillmentTypes[number]
export interface ProductCategory { categoryId: string; categoryLabel: string; order: number; enabled: boolean; version: number }
export interface ProductType { code: FulfillmentType; title: string; version: number }
export interface ProductSpecGroup { id: string; label: string; options: { id: string; label: string }[] }
/** 所有金额均为整数分；discountLabel为展示文字，禁止据此推算实付。 */
export interface ProductPriceTier { id: string; label: string; discountLabel: string; amount: number }
export interface ProductSku { id: string; label: string; specs: Record<string, string>; amount: number; stock: number }
export const productCategoryOptions = [
  { categoryId: 'physical', categoryLabel: '脑力核心' },
  { categoryId: 'software', categoryLabel: '软件卡' },
  { categoryId: 'special', categoryLabel: '特色产品' },
  { categoryId: 'admin', categoryLabel: '行政费' },
  { categoryId: 'column', categoryLabel: '专栏产品' },
] as const
export const fulfillmentTypeLabels: Record<FulfillmentType, string> = {
  PHYSICAL: '实物商品',
  ACTIVATION_CODE: '软件卡',
  OFFLINE_SERVICE: '线下服务',
  COLUMN_ACCESS: '专栏',
}
export interface ProductDraft { productId: string; categoryId: string; title: string; summary: string; coverUrl: string; carouselUrls: string[]; content: RichContent; fulfillmentType: FulfillmentType; requiresMember: boolean; pricePresentation: 'standard-only' | 'tiered'; costAmount: number; originalAmount: number | null; standardAmount: number; activityAmount: number | null; memberPrices: ProductPriceTier[]; rolePrices: ProductPriceTier[]; specGroups: ProductSpecGroup[]; skus: ProductSku[] }
export interface ManagedProduct { draft: ProductDraft; version: number; status: 'draft' | 'on-sale' | 'off-sale'; publication: { revision: number; publishedAt: string; value: ProductDraft } | null }
export interface ProductAudit { operationId: string; targetId: string; action: ProductMutation['action']; reason: string; requestId: string; operatorName: string; beforeVersion: number; afterVersion: number; occurredAt: string }
export interface ProductCatalog { categories: ProductCategory[]; types: ProductType[]; products: ManagedProduct[]; audit: ProductAudit[] }
export type ProductMutation = { version: number; reason: string; idempotencyKey: string } & (
  { action: 'save-category'; value: ProductCategory } | { action: 'rename-type'; code: FulfillmentType; title: string } |
  { action: 'save-product'; value: ProductDraft } | { action: 'on-sale' | 'off-sale'; productId: string })
export class ProductError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'ProductError' } }
