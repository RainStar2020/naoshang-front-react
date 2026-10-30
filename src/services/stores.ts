import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { StoreError, type StoreMutation, type StoreQuery } from '../types/stores'
import { mockStoreCatalog, mockStoreDetail, mockStoreList, mockStoreMutate } from './mock/stores'
import * as real from './real/stores'

async function authorize(token: string, manage = false) {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'stores:access')) throw new StoreError('FORBIDDEN', '没有门店主档查询权限')
  if (manage && !hasPermission(account, 'stores:manage')) throw new StoreError('FORBIDDEN', '没有门店主档或健脑官监管写权限')
  return account
}

export const storeService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockStoreCatalog()
    return (await real.realStoreCatalog()) as Awaited<ReturnType<typeof mockStoreCatalog>>
  },
  async list(token: string, query: StoreQuery) {
    await authorize(token)
    if (isMockAuth) return mockStoreList(query)
    return (await real.realStoreList(query)) as Awaited<ReturnType<typeof mockStoreList>>
  },
  async detail(token: string, storeId: string) {
    await authorize(token)
    if (isMockAuth) return mockStoreDetail(storeId)
    return (await real.realStoreDetail(storeId)) as Awaited<ReturnType<typeof mockStoreDetail>>
  },
  async mutate(token: string, input: StoreMutation) {
    const account = await authorize(token, true)
    if (isMockAuth) return mockStoreMutate(input, account)
    return (await real.realStoreMutate(input)) as unknown as Awaited<ReturnType<typeof mockStoreMutate>>
  },
}
