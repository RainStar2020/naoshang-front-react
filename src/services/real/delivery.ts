import * as api from '../../api'
import { DeliveryError, type CheckoutDeliveryOptions, type DeliveryCatalog, type DeliveryMutation, type ManagedDeliveryOrder } from '../../types/delivery'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unsupported, unwrapData } from './bridge'

function mapAddress(raw: unknown) {
  if (raw == null) return null
  const r = record(raw)
  return {
    recipient: str(r.recipient || r.name),
    phone: str(r.phone || r.mobile),
    regionNames: stringList(r.regionNames).length ? stringList(r.regionNames) : [str(r.province), str(r.city), str(r.district)].filter(Boolean),
    detail: str(r.detail || r.address),
  }
}

function mapLogistics(raw: unknown) {
  if (raw == null) return null
  const r = record(raw)
  return { carrier: str(r.carrier || r.company), trackingNo: str(r.trackingNo || r.trackingNumber || r.waybillNo) }
}

export function mapDeliveryOrder(raw: unknown): ManagedDeliveryOrder {
  const r = record(raw)
  const actions = stringList(r.allowedActions) as ManagedDeliveryOrder['allowedActions']
  return {
    orderId: str(r.orderId || r.id),
    orderNo: str(r.orderNo || r.orderNumber),
    accountId: str(r.accountId),
    productId: str(r.productId || r.skuId),
    productTitle: str(r.productTitle || r.productName || r.title),
    fulfillmentType: str(r.fulfillmentType, 'PHYSICAL') as never,
    paymentStatus: str(r.paymentStatus || r.payStatus, 'PENDING_PAYMENT') as never,
    fulfillmentStatus: str(r.fulfillmentStatus || r.fulfillStatus, 'WAIT_DELIVERY') as never,
    deliveryMode: str(r.deliveryMode, 'HEADQUARTERS') as never,
    deliveryStoreId: nullableStr(r.deliveryStoreId),
    deliveryStoreName: str(r.deliveryStoreName || r.storeName, '总部'),
    deliveryLocked: bool(r.deliveryLocked),
    version: num(r.version, 1),
    createdAt: str(r.createdAt),
    paidAt: nullableStr(r.paidAt),
    deliveredAt: nullableStr(r.deliveredAt),
    shippedAt: nullableStr(r.shippedAt),
    address: mapAddress(r.address),
    logistics: mapLogistics(r.logistics),
    mockOnly: false,
    transaction: (r.transaction as ManagedDeliveryOrder['transaction']) ?? null,
    allowedActions: actions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action: str(r.action, 'ship') as never,
    targetId: str(r.targetId || r.orderId),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    reason: str(r.reason),
    before: str(r.before),
    after: str(r.after),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version),
    occurredAt: str(r.occurredAt || r.createdAt),
  }
}

export function mapDeliveryCatalog(raw: unknown): DeliveryCatalog {
  const r = record(raw)
  const ordersPage = asPage(r.orders)
  return {
    policies: arr(r.policies).map((item) => {
      const row = record(item)
      return {
        productId: str(row.productId || row.id),
        deliveryMode: str(row.deliveryMode, 'BOUND_STORE') as never,
        deliveryLocked: bool(row.deliveryLocked ?? (str(row.deliveryMode).toUpperCase() === 'HEADQUARTERS')),
        version: num(row.version, 1),
      }
    }),
    products: arr(r.products).map((item) => {
      const row = record(item)
      return {
        productId: str(row.productId || row.id),
        title: str(row.title || row.name),
        fulfillmentType: str(row.fulfillmentType, 'PHYSICAL') as never,
        status: str(row.status, 'ON_SALE'),
      }
    }),
    stores: arr(r.stores).map((item) => {
      const row = record(item)
      return { storeId: str(row.storeId || row.id), name: str(row.name), active: row.active !== false }
    }),
    accounts: arr(r.accounts).map((item) => {
      const row = record(item)
      return { accountId: str(row.accountId || row.id), nickname: str(row.nickname || row.name), phone: str(row.phone || row.mobile) }
    }),
    orders: (Array.isArray(r.orders) ? arr(r.orders) : ordersPage.items).map(mapDeliveryOrder),
    audit: arr(r.audit).map(mapAudit),
  }
}

export function mapCheckoutOptions(raw: unknown, accountId: string, productId: string): CheckoutDeliveryOptions {
  const r = record(raw)
  const stores = arr(r.stores ?? r.options ?? r.checkoutOptions).map((item) => {
    const row = record(item)
    return { id: str(row.id || row.storeId), name: str(row.name) }
  })
  return {
    productId: str(r.productId, productId),
    accountId: str(r.accountId, accountId),
    productRevision: num(r.productRevision ?? r.revision, 1),
    policyVersion: num(r.policyVersion ?? r.version, 1),
    defaultStoreId: nullableStr(r.defaultStoreId),
    deliveryLocked: bool(r.deliveryLocked),
    stores,
  }
}

export async function realDeliveryCatalog() {
  try { return mapDeliveryCatalog(await unwrapData(await api.getDeliveryCatalog())) }
  catch (error) { return mapHqError(error, DeliveryError) }
}

export async function realCheckoutDeliveryOptions(accountId: string, productId: string) {
  try {
    const catalog = record(await unwrapData(await api.getDeliveryCatalog()))
    return mapCheckoutOptions(catalog.checkoutOptions || catalog.options || catalog, accountId, productId)
  } catch (error) { return mapHqError(error, DeliveryError) }
}

export async function realDeliveryMutate(input: DeliveryMutation) {
  try {
    const actionMap: Record<string, string> = {
      'save-policy': 'update-tracking',
      'change-delivery': 'update-tracking',
      ship: 'ship',
      'update-logistics': 'update-tracking',
    }
    const uiAction = str((input as { action?: string }).action)
    if (uiAction === 'save-policy') unsupported(DeliveryError, 'save-policy', '交付策略保存未在 HQ delivery API 暴露')
    const action = actionMap[uiAction] || 'ship'
    const shipmentId = str((input as { shipmentId?: string }).shipmentId || (input as { orderId?: string }).orderId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    if (!shipmentId) {
      await unwrapData(await api.postDeliveryShipments(body as never))
      return realDeliveryCatalog()
    }
    await unwrapData(await api.postDeliveryShipmentsByShipmentIdMutate({ shipmentId }, body as never))
    return realDeliveryCatalog()
  } catch (error) { return mapHqError(error, DeliveryError) }
}
