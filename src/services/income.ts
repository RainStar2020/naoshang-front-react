import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { IncomeError, type IncomeMutation, type IncomeQuery } from '../types/income'
import { mockGetIncomeCatalog, mockGetIncomeDetail, mockListIncome, mockMutateIncome } from './mock/income'
import * as real from './real/income'

async function authorize(token: string, permission: HqPermission = 'revenue:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'revenue:access') || !hasPermission(account, permission)) {
    throw new IncomeError('FORBIDDEN', '没有收益结算查询/操作权限')
  }
  return account
}

export const incomeService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockGetIncomeCatalog()
    return (await real.realGetIncomeCatalog()) as Awaited<ReturnType<typeof mockGetIncomeCatalog>>
  },
  async list(token: string, query: IncomeQuery) {
    await authorize(token)
    if (isMockAuth) return mockListIncome(query)
    return (await real.realListIncome(query)) as Awaited<ReturnType<typeof mockListIncome>>
  },
  async detail(token: string, entryId: string) {
    await authorize(token)
    if (isMockAuth) return mockGetIncomeDetail(entryId)
    return (await real.realGetIncomeDetail(entryId)) as Awaited<ReturnType<typeof mockGetIncomeDetail>>
  },
  async mutate(token: string, input: IncomeMutation) {
    const account = await authorize(token, 'revenue:manage')
    if (isMockAuth) return mockMutateIncome(input, { operatorId: account.accountId, operatorName: account.nickname })
    return (await real.realMutateIncome(input)) as Awaited<ReturnType<typeof mockMutateIncome>>
  },
}
