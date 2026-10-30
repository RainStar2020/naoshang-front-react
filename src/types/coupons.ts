export type CouponScope = { kind: 'all'; productIds: [] } | { kind: 'products'; productIds: string[] }
export interface CouponTemplateValue { title: string; amount: number; minAmount: number; scope: CouponScope; validFrom: string; expiresAt: string; enabled: boolean; totalQuantity: number; perAccountLimit: number }
export interface CouponTemplate extends CouponTemplateValue { templateId: string; version: number; issuedQuantity: number }
export type CouponStatus = 'available' | 'not-started' | 'reserved' | 'used' | 'expired'
/** 金额为整数分；用户券保存发放时模板快照。 */
export interface UserCoupon { couponId: string; templateId: string; templateVersion: number; accountId: string; snapshot: Pick<CouponTemplateValue, 'title' | 'amount' | 'minAmount' | 'scope' | 'validFrom' | 'expiresAt'>; status: CouponStatus; version: number; issuedAt: string; reservedOrderId: string | null; usedOrderId: string | null; reservedAt: string | null; usedAt: string | null }
export interface CouponAudit { operationId: string; requestId: string; action: 'save-template' | 'issue' | 'reserve' | 'use' | 'release'; templateId: string | null; couponIds: string[]; operatorName: string; reason: string; detail: string; occurredAt: string }
export interface CouponCatalog { templates: CouponTemplate[]; audit: CouponAudit[]; accounts: { accountId: string; nickname: string; phone: string; frozen: boolean }[]; products: { productId: string; title: string }[]; limits: { maxBatchSize: number; maxAmount: number } }
export type CouponMutation = { reason: string; idempotencyKey: string } & ({ action: 'save-template'; templateId: string; version: number; value: CouponTemplateValue } | { action: 'issue'; templateId: string; version: number; accountIds: string[] })
export interface CouponQuery { page: number; pageSize: number; templateId?: string; accountId?: string; status?: CouponStatus; keyword?: string }
export interface CouponList { items: UserCoupon[]; total: number; page: number; pageSize: number }
export interface CouponMutationResult { templateId: string; couponIds: string[]; operationId: string }
export interface CouponCheckoutOrder { orderId: string; accountId: string; productId: string; skuId: string; quantity: number; couponId: string | null; goodsAmount: number; discountAmount: number; payableAmount: number; status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED'; expiresAt: number; mockOnly: boolean }
export class CouponError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'QUOTA_EXCEEDED', message: string) { super(message); this.name = 'CouponError' } }
