import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { ActivationError, type ActivationExportRequest, type ActivationMutation, type ActivationQuery } from '../types/activationCodes'
import { mockActivationAudit, mockActivationBatches, mockActivationDetail, mockActivationExport, mockActivationList, mockActivationMutate, mockActivationOptions } from './mock/activationCodes'
import * as real from './real/activationCodes'

async function authorize(token: string, permission: HqPermission = 'activation:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'activation:access') || !hasPermission(account, permission)) throw new ActivationError('FORBIDDEN', '没有激活码查询或此操作权限')
  return account
}

export const activationCodesService = {
  async options(token: string) {
    await authorize(token)
    if (isMockAuth) return mockActivationOptions()
    return (await real.realActivationOptions()) as Awaited<ReturnType<typeof mockActivationOptions>>
  },
  async batches(token: string) {
    await authorize(token)
    if (isMockAuth) return mockActivationBatches()
    return (await real.realActivationBatches()) as Awaited<ReturnType<typeof mockActivationBatches>>
  },
  async list(token: string, query: ActivationQuery) {
    await authorize(token)
    if (isMockAuth) return mockActivationList(query)
    return (await real.realActivationList(query)) as Awaited<ReturnType<typeof mockActivationList>>
  },
  async detail(token: string, id: string) {
    await authorize(token)
    if (isMockAuth) return mockActivationDetail(id)
    return (await real.realActivationDetail(id)) as Awaited<ReturnType<typeof mockActivationDetail>>
  },
  async audit(token: string) {
    await authorize(token)
    if (isMockAuth) return mockActivationAudit()
    return (await real.realActivationAudit()) as Awaited<ReturnType<typeof mockActivationAudit>>
  },
  async mutate(token: string, input: ActivationMutation) {
    if (!['generate', 'issue', 'revoke', 'reissue', 'set-expiry'].includes(input.action)) throw new ActivationError('INVALID_INPUT', '激活码操作类型无效')
    const permission: Record<ActivationMutation['action'], HqPermission> = { generate: 'activation:generate', issue: 'activation:issue', revoke: 'activation:revoke', reissue: 'activation:reissue', 'set-expiry': 'activation:expiry' }
    const account = await authorize(token, permission[input.action])
    if (isMockAuth) return mockActivationMutate(input, account)
    return (await real.realActivationMutate(input)) as Awaited<ReturnType<typeof mockActivationMutate>>
  },
  async export(token: string, input: ActivationExportRequest) {
    const account = await authorize(token, 'activation:export')
    if (isMockAuth) return mockActivationExport(input, account)
    return (await real.realActivationExport(input)) as Awaited<ReturnType<typeof mockActivationExport>>
  },
}
