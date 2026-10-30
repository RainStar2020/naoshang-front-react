import type { DeliveryAddress, DeliveryAudit, DeliveryLogistics, ManagedDeliveryOrder } from './delivery'
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'COMPLETED' | 'CANCELLED'
export interface OrderLine { id: string; productId: string; skuId: string; title: string; specLabel: string; coverUrl: string; quantity: number; originalUnitAmount: number; unitAmount: number; subtotalAmount: number }
export interface OrderPayment { paymentId: string; channel: 'WECHAT' | 'ALIPAY'; channelLabel: string; thirdPartyTradeNo: string | null; status: 'WAITING' | 'SUCCESS' | 'CLOSED'; amount: number; paidAt: string | null }
/** 所有金额均为整数分，交易快照不从当前商品折扣标签推算。 */
export interface OrderTransactionSnapshot { buyerName: string; buyerPhone: string; memberId: string | null; memberName: string | null; items: OrderLine[]; originalTotalAmount: number; goodsAmount: number; priceReductionAmount: number; tierDiscountAmount: number; tierDiscountLabel: string; coupon: { couponId: string; title: string; discountAmount: number } | null; discountAmount: number; payableAmount: number; payments: OrderPayment[]; source: { kind: 'MALL' | 'MEMBERSHIP' | 'BUSINESS'; label: string; referenceId: string | null; contextId: string | null }; remark: string; cancelledAt: string | null; cancelReason: string | null }
export type OrderAction = 'ship' | 'update-logistics' | 'confirm-delivery'
export interface SalesOrder extends Omit<ManagedDeliveryOrder, 'allowedActions'> { status: OrderStatus; allowedActions: OrderAction[] }
export interface OrderFilters { keyword?: string; accountId?: string; memberId?: string; productId?: string; deliveryMode?: 'STORE' | 'HEADQUARTERS'; deliveryStoreId?: string; channel?: 'WECHAT' | 'ALIPAY'; status?: OrderStatus; fulfillmentStatus?: ManagedDeliveryOrder['fulfillmentStatus']; createdFrom?: string; createdTo?: string }
export interface OrderQuery extends OrderFilters { page: number; pageSize: number }
export interface OrderList { items: SalesOrder[]; total: number; page: number; pageSize: number; summary: { orderCount: number; paidCount: number; paidAmount: number } }
export interface OrderOptions { accounts: { accountId: string; nickname: string; phone: string }[]; members: { memberId: string; name: string; accountId: string }[]; products: { productId: string; title: string }[]; stores: { storeId: string; name: string }[] }
export interface OrderDetail { order: SalesOrder; audit: DeliveryAudit[] }
export type OrderMutation = { orderId: string; version: number; reason: string; idempotencyKey: string } & ({ action: 'ship' | 'update-logistics'; logistics: DeliveryLogistics } | { action: 'confirm-delivery'; evidence: string })
export class OrderError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'OrderError' } }
export type OrderAddressSnapshot = DeliveryAddress
