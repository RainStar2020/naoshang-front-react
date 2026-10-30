import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { OrderError, type OrderMutation, type OrderQuery } from '../types/orders'
import { mockListOrders, mockOrderDetail, mockOrderMutate, mockOrderOptions } from './mock/orders'
import * as real from './real/orders'

async function authorize(token: string, permission: HqPermission = 'orders:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'orders:access') || !hasPermission(account, permission)) throw new OrderError('FORBIDDEN', '没有订单查询或此履约操作权限')
  return account
}

export const ordersService = {
  async list(token: string, query: OrderQuery) {
    await authorize(token)
    if (isMockAuth) return mockListOrders(query)
    return (await real.realListOrders(query)) as Awaited<ReturnType<typeof mockListOrders>>
  },
  async detail(token: string, orderId: string) {
    await authorize(token)
    if (isMockAuth) return mockOrderDetail(orderId)
    return (await real.realOrderDetail(orderId)) as Awaited<ReturnType<typeof mockOrderDetail>>
  },
  async options(token: string) {
    await authorize(token)
    if (isMockAuth) return mockOrderOptions()
    return (await real.realOrderOptions()) as Awaited<ReturnType<typeof mockOrderOptions>>
  },
  async mutate(token: string, input: OrderMutation) {
    if (!['ship', 'update-logistics', 'confirm-delivery'].includes(input.action)) throw new OrderError('INVALID_INPUT', '订单操作无效')
    const account = await authorize(token, input.action === 'confirm-delivery' ? 'orders:fulfill' : 'orders:shipping')
    if (isMockAuth) return mockOrderMutate(input, account)
    return (await real.realOrderMutate(input)) as Awaited<ReturnType<typeof mockOrderMutate>>
  },
}
