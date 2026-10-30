import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { SupportError, type SupportFeedbackQuery, type SupportMutation } from '../types/support'
import { mockSupportCatalog, mockSupportFeedbackList, mockSupportMutate } from './mock/support'
import * as real from './real/support'

async function authorize(token: string, permission: HqPermission = 'support:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'support:access') || !hasPermission(account, permission)) {
    throw new SupportError('FORBIDDEN', '没有协议与客服预留查询/操作权限')
  }
  return account
}

export const supportService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockSupportCatalog()
    return (await real.realSupportCatalog()) as Awaited<ReturnType<typeof mockSupportCatalog>>
  },
  async feedbackList(token: string, query: SupportFeedbackQuery) {
    await authorize(token)
    if (isMockAuth) return mockSupportFeedbackList(query)
    return (await real.realSupportFeedbackList(query)) as Awaited<ReturnType<typeof mockSupportFeedbackList>>
  },
  async mutate(token: string, input: SupportMutation) {
    const account = await authorize(token, 'support:manage')
    if (isMockAuth) return mockSupportMutate(input, { operatorId: account.accountId, operatorName: account.nickname })
    return (await real.realSupportMutate(input)) as Awaited<ReturnType<typeof mockSupportMutate>>
  },
}
