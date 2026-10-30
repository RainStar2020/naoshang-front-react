import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { PromoMaterialError, type PromoMaterialMutation, type PromoMaterialQuery } from '../types/promo-materials'
import { mockPromoMaterialCatalog, mockPromoMaterialDetail, mockPromoMaterialList, mockPromoMaterialMutate } from './mock/promo-materials'
import * as real from './real/promo-materials'

async function authorize(token: string, permission: HqPermission = 'materials:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'materials:access') || !hasPermission(account, permission)) {
    throw new PromoMaterialError('FORBIDDEN', '没有推广素材查询/操作权限')
  }
  return account
}

export const promoMaterialService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockPromoMaterialCatalog()
    return (await real.realPromoMaterialCatalog()) as Awaited<ReturnType<typeof mockPromoMaterialCatalog>>
  },
  async list(token: string, query: PromoMaterialQuery) {
    await authorize(token)
    if (isMockAuth) return mockPromoMaterialList(query)
    return (await real.realPromoMaterialList(query)) as Awaited<ReturnType<typeof mockPromoMaterialList>>
  },
  async detail(token: string, materialId: string) {
    await authorize(token)
    if (isMockAuth) return mockPromoMaterialDetail(materialId)
    return (await real.realPromoMaterialDetail(materialId)) as Awaited<ReturnType<typeof mockPromoMaterialDetail>>
  },
  async mutate(token: string, input: PromoMaterialMutation) {
    const account = await authorize(token, 'materials:edit')
    if (isMockAuth) return mockPromoMaterialMutate(input, { operatorId: account.accountId, operatorName: account.nickname })
    return (await real.realPromoMaterialMutate(input)) as Awaited<ReturnType<typeof mockPromoMaterialMutate>>
  },
}
