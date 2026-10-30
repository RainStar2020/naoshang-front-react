import type { DeliveryOrder } from '../../types/delivery'
import type { ProductDraft } from '../../types/products'
import type { OrderTransactionSnapshot } from '../../types/orders'
import { mockUserDetail } from './users'
import { mockMembers } from './members'
/** 仅种子交易示例，在订单存入共享仓库时固定，不在订单查询时读取商品当前价格。 */
export function seedOrderTransaction(row: Omit<DeliveryOrder, 'transaction'>, p: ProductDraft, index: number): OrderTransactionSnapshot {
  const buyer = mockUserDetail(row.accountId).account
  const child = row.fulfillmentType === 'COLUMN_ACCESS' ? null : mockMembers({ page: 1, pageSize: 10, accountId: row.accountId }).items[0] ?? null
  const sku = p.skus[0], quantity = index % 3 === 0 ? 2 : 1, unitAmount = sku.amount, originalUnitAmount = Math.max(p.originalAmount ?? p.standardAmount, unitAmount)
  const goodsAmount = unitAmount * quantity, originalTotalAmount = originalUnitAmount * quantity, tierDiscountAmount = index % 2 === 0 ? Math.min(1000, goodsAmount) : 0
  const couponAmount = index % 3 === 0 ? Math.min(500, goodsAmount - tierDiscountAmount) : 0, payableAmount = goodsAmount - tierDiscountAmount - couponAmount
  const paid = row.paymentStatus === 'PAID', cancelled = row.paymentStatus === 'CANCELLED', channel = index % 2 === 0 ? 'WECHAT' as const : 'ALIPAY' as const
  return { buyerName: buyer.nickname, buyerPhone: buyer.phone, memberId: child?.memberId ?? null, memberName: child?.name ?? null, items: [{ id: `line-${row.orderId}`, productId: row.productId, skuId: sku.id, title: row.productTitle, specLabel: sku.label, coverUrl: p.coverUrl, quantity, originalUnitAmount, unitAmount, subtotalAmount: goodsAmount }], originalTotalAmount, goodsAmount, priceReductionAmount: originalTotalAmount - goodsAmount, tierDiscountAmount, tierDiscountLabel: tierDiscountAmount ? '演示身份优惠（金额快照）' : '', coupon: couponAmount ? { couponId: `demo-coupon-${index + 1}`, title: '演示满减券', discountAmount: couponAmount } : null, discountAmount: tierDiscountAmount + couponAmount, payableAmount, payments: [{ paymentId: `demo-payment-${row.orderId}`, channel, channelLabel: channel === 'WECHAT' ? '微信支付（演示）' : '支付宝（演示）', thirdPartyTradeNo: paid ? `DEMO-TRADE-${index + 1}` : null, status: paid ? 'SUCCESS' : cancelled ? 'CLOSED' : 'WAITING', amount: payableAmount, paidAt: row.paidAt }], source: { kind: 'MALL', label: '小程序选品商城（演示）', referenceId: `demo-checkout-${row.orderId}`, contextId: null }, remark: '独立演示交易，非真实支付', cancelledAt: cancelled ? '2026-10-01T10:00:00+08:00' : null, cancelReason: cancelled ? '演示支付超时自动取消' : null }
}
