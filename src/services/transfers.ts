import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { TransferError, type TransferMutation, type TransferQuery } from '../types/transfers'
import { mockTransferCatalog, mockTransferDetail, mockTransferList, mockTransferMutate } from './mock/transfers'
import * as real from './real/transfers'

async function authorize(token: string, permission: HqPermission = 'transfers:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'transfers:access') || !hasPermission(account, permission)) {
    throw new TransferError('FORBIDDEN', '没有转店审核监管查询/操作权限')
  }
  return account
}

export const transferService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockTransferCatalog()
    return (await real.realTransferCatalog()) as Awaited<ReturnType<typeof mockTransferCatalog>>
  },
  async list(token: string, query: TransferQuery) {
    await authorize(token)
    if (isMockAuth) return mockTransferList(query)
    return (await real.realTransferList(query)) as Awaited<ReturnType<typeof mockTransferList>>
  },
  async detail(token: string, applicationId: string) {
    await authorize(token)
    if (isMockAuth) return mockTransferDetail(applicationId)
    return (await real.realTransferDetail(applicationId)) as Awaited<ReturnType<typeof mockTransferDetail>>
  },
  async mutate(token: string, input: TransferMutation) {
    const account = await authorize(token, 'transfers:arbitrate')
    if (isMockAuth) return mockTransferMutate(input, account)
    return (await real.realTransferMutate(input)) as Awaited<ReturnType<typeof mockTransferMutate>>
  },
}
