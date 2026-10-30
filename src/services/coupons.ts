import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { CouponError, type CouponMutation, type CouponQuery } from '../types/coupons'
import { mockCouponCatalog, mockCouponDetail, mockCouponList, mockCouponMutate } from './mock/coupons'
import * as real from './real/coupons'

async function authorize(token: string, permission: HqPermission = 'coupons:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'coupons:access') || !hasPermission(account, permission)) throw new CouponError('FORBIDDEN', '没有优惠券查询或此操作权限')
  return account
}

export const couponsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockCouponCatalog()
    return (await real.realCouponCatalog()) as Awaited<ReturnType<typeof mockCouponCatalog>>
  },
  async list(token: string, query: CouponQuery) {
    await authorize(token)
    if (isMockAuth) return mockCouponList(query)
    return (await real.realCouponList(query)) as Awaited<ReturnType<typeof mockCouponList>>
  },
  async detail(token: string, id: string) {
    await authorize(token)
    if (isMockAuth) return mockCouponDetail(id)
    return (await real.realCouponDetail(id)) as Awaited<ReturnType<typeof mockCouponDetail>>
  },
  async mutate(token: string, input: CouponMutation) {
    if (!['save-template', 'issue'].includes(input.action)) throw new CouponError('INVALID_INPUT', '优惠券操作无效')
    const account = await authorize(token, input.action === 'issue' ? 'coupons:issue' : 'coupons:templates')
    if (isMockAuth) return mockCouponMutate(input, account)
    return (await real.realCouponMutate(input)) as Awaited<ReturnType<typeof mockCouponMutate>>
  },
}
