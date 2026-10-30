import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { CostoreError, type CostoreMutation, type CostoreQuery } from '../types/costore'
import { mockCostoreCatalog, mockCostoreDetail, mockCostoreList, mockCostoreMutate } from './mock/costore'
import * as real from './real/costore'

async function auth(token: string, manage = false) {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'costore:access') || (manage && !hasPermission(account, 'costore:manage'))) throw new CostoreError('FORBIDDEN', '没有合店查询或总部干预权限')
  return account
}

export const costoreService = {
  async catalog(t: string) {
    await auth(t)
    if (isMockAuth) return mockCostoreCatalog()
    return (await real.realCostoreCatalog()) as Awaited<ReturnType<typeof mockCostoreCatalog>>
  },
  async list(t: string, q: CostoreQuery) {
    await auth(t)
    if (isMockAuth) return mockCostoreList(q)
    return (await real.realCostoreList(q)) as Awaited<ReturnType<typeof mockCostoreList>>
  },
  async detail(t: string, id: string) {
    await auth(t)
    if (isMockAuth) return mockCostoreDetail(id)
    return (await real.realCostoreDetail(id)) as Awaited<ReturnType<typeof mockCostoreDetail>>
  },
  async mutate(t: string, i: CostoreMutation) {
    const account = await auth(t, true)
    if (isMockAuth) return mockCostoreMutate(i, account)
    return (await real.realCostoreMutate(i)) as Awaited<ReturnType<typeof mockCostoreMutate>>
  },
}
