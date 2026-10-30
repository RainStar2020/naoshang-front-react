import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { WithdrawalError, type WithdrawalMutation, type WithdrawalQuery } from '../types/withdrawals'
import { mockWithdrawalCatalog, mockWithdrawalDetail, mockWithdrawalList, mockWithdrawalMutate } from './mock/withdrawals'
import * as real from './real/withdrawals'

async function authorize(token: string, permission: HqPermission = 'withdrawals:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'withdrawals:access') || !hasPermission(account, permission)) {
    throw new WithdrawalError('FORBIDDEN', '没有提现审核查询/操作权限')
  }
  return account
}

export const withdrawalService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockWithdrawalCatalog()
    return (await real.realWithdrawalCatalog()) as Awaited<ReturnType<typeof mockWithdrawalCatalog>>
  },
  async list(token: string, query: WithdrawalQuery) {
    await authorize(token)
    if (isMockAuth) return mockWithdrawalList(query)
    return (await real.realWithdrawalList(query)) as Awaited<ReturnType<typeof mockWithdrawalList>>
  },
  async detail(token: string, withdrawalId: string) {
    await authorize(token)
    if (isMockAuth) return mockWithdrawalDetail(withdrawalId)
    return (await real.realWithdrawalDetail(withdrawalId)) as Awaited<ReturnType<typeof mockWithdrawalDetail>>
  },
  async mutate(token: string, input: WithdrawalMutation) {
    const account = await authorize(token, 'withdrawals:review')
    if (isMockAuth) return mockWithdrawalMutate(input, { operatorId: account.accountId, operatorName: account.nickname })
    return (await real.realWithdrawalMutate(input)) as Awaited<ReturnType<typeof mockWithdrawalMutate>>
  },
}
