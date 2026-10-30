import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { DeliveryError, type DeliveryMutation } from '../types/delivery'
import { mockDeliveryCatalog, mockDeliveryMutate, mockCheckoutDeliveryOptions } from './mock/delivery'
import * as real from './real/delivery'

async function authorize(token: string, permission: HqPermission = 'delivery:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'delivery:access') || !hasPermission(account, permission)) throw new DeliveryError('FORBIDDEN', '没有交付查询或此操作权限')
  return account
}

export const deliveryService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockDeliveryCatalog()
    return (await real.realDeliveryCatalog()) as Awaited<ReturnType<typeof mockDeliveryCatalog>>
  },
  async checkoutPreview(token: string, accountId: string, productId: string) {
    await authorize(token, 'delivery:policies')
    if (isMockAuth) return mockCheckoutDeliveryOptions(accountId, productId)
    return (await real.realCheckoutDeliveryOptions(accountId, productId)) as Awaited<ReturnType<typeof mockCheckoutDeliveryOptions>>
  },
  async mutate(token: string, input: DeliveryMutation) {
    const permissions = { 'save-policy': 'delivery:policies', 'change-delivery': 'delivery:adjust', ship: 'delivery:shipping', 'update-logistics': 'delivery:shipping' } as const
    const permission = permissions[input.action]
    if (!permission) throw new DeliveryError('INVALID_INPUT', '交付操作无效')
    const account = await authorize(token, permission)
    if (isMockAuth) return mockDeliveryMutate(input, account)
    return (await real.realDeliveryMutate(input)) as Awaited<ReturnType<typeof mockDeliveryMutate>>
  },
}
