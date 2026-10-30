import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { QuotaError, type QuotaQuery, type QuotaRechargeInput } from '../types/quotas'
import { mockQuotaDetail, mockQuotaList, mockQuotaRecharge } from './mock/quotas'
import * as real from './real/quotas'

async function authorize(token: string, recharge = false) {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'quotas:access') || (recharge && !hasPermission(account, 'quotas:recharge'))) throw new QuotaError('FORBIDDEN', '没有名额查询或总部充值权限')
  return account
}

export const quotasService = {
  async list(token: string, query: QuotaQuery) {
    await authorize(token)
    if (isMockAuth) return mockQuotaList(query)
    return (await real.realQuotaList(query)) as Awaited<ReturnType<typeof mockQuotaList>>
  },
  async detail(token: string, ownerAccountId: string) {
    await authorize(token)
    if (isMockAuth) return mockQuotaDetail(ownerAccountId)
    return (await real.realQuotaDetail(ownerAccountId)) as Awaited<ReturnType<typeof mockQuotaDetail>>
  },
  async recharge(token: string, input: QuotaRechargeInput) {
    const account = await authorize(token, true)
    if (isMockAuth) return mockQuotaRecharge(input, account)
    return (await real.realQuotaRecharge(input)) as Awaited<ReturnType<typeof mockQuotaRecharge>>
  },
}
