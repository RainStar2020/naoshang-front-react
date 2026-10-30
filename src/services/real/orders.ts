import * as api from '../../api'
import { OrderError, type OrderDetail, type OrderList, type OrderMutation, type OrderOptions, type OrderQuery, type SalesOrder } from '../../types/orders'
import { arr, asPage, cast, mapHqError, mutationBody, num, record, str, unwrapData, yuanToFen } from './bridge'

function mapOrder(raw: unknown): SalesOrder {
  const r = record(raw)
  const amounts = ['payableAmount', 'goodsAmount', 'discountAmount', 'originalTotalAmount', 'priceReductionAmount', 'tierDiscountAmount']
  const mapped: Record<string, unknown> = { ...r }
  for (const key of amounts) {
    if (key in r) {
      const v = num(r[key])
      mapped[key] = v > 0 && v < 100000 && String(r[key]).includes('.') ? yuanToFen(r[key]) : v
    }
  }
  if (!mapped.status) mapped.status = str(r.paymentStatus || r.orderStatus, 'PENDING_PAYMENT')
  if (!mapped.orderId) mapped.orderId = str(r.orderId || r.id)
  if (!mapped.allowedActions) mapped.allowedActions = ['ship', 'update-logistics', 'confirm-delivery']
  return cast(mapped)
}

export async function realListOrders(query: OrderQuery): Promise<OrderList> {
  try {
    const data = await unwrapData(await api.getOrders({ ...query, page: query.page, pageSize: query.pageSize, keyword: query.keyword, status: query.status } as never))
    const page = asPage(data, query.page, query.pageSize)
    const summary = record(page.summary)
    return {
      items: page.items.map(mapOrder),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        orderCount: num(summary.orderCount, page.total),
        paidCount: num(summary.paidCount, 0),
        paidAmount: num(summary.paidAmount, 0) < 100000 && String(summary.paidAmount || '').includes('.') ? yuanToFen(summary.paidAmount) : num(summary.paidAmount, 0),
      },
    }
  } catch (error) {
    return mapHqError(error, OrderError)
  }
}

export async function realOrderDetail(orderId: string): Promise<OrderDetail> {
  try {
    const data = await unwrapData(await api.getOrdersByOrderId({ orderId }))
    const raw = record(data)
    return { order: mapOrder(raw.order ?? raw), audit: arr(raw.audit).map((a) => cast(a)) }
  } catch (error) {
    return mapHqError(error, OrderError)
  }
}

export async function realOrderOptions(): Promise<OrderOptions> {
  try {
    const data = await unwrapData(await api.getOrdersCatalog())
    const raw = record(data)
    return {
      accounts: arr(raw.accounts).map((a) => cast(a)),
      members: arr(raw.members).map((a) => cast(a)),
      products: arr(raw.products).map((a) => cast(a)),
      stores: arr(raw.stores).map((a) => cast(a)),
    }
  } catch (error) {
    return mapHqError(error, OrderError)
  }
}

export async function realOrderMutate(input: OrderMutation): Promise<OrderDetail> {
  try {
    const action = input.action === 'update-logistics' ? 'update-tracking' : input.action === 'confirm-delivery' ? 'deliver' : 'ship'
    const extra: Record<string, unknown> = {}
    if (input.action === 'ship' || input.action === 'update-logistics') extra.logistics = input.logistics
    if (input.action === 'confirm-delivery') extra.evidence = input.evidence
    const body = mutationBody({ action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version, orderId: input.orderId, ...extra })
    // Prefer delivery shipment mutate; fall back to order id as shipment id when backend uses same id.
    await unwrapData(await api.postDeliveryShipmentsByShipmentIdMutate({ shipmentId: input.orderId }, body as never))
    return realOrderDetail(input.orderId)
  } catch (error) {
    return mapHqError(error, OrderError)
  }
}
