import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { PaymentError, type PaymentChannel, type PaymentMutation } from '../types/payments'
import { mockPaymentCatalog, mockPaymentDownload, mockPaymentMutate, mockPaymentSample } from './mock/payments'
import * as real from './real/payments'

async function authorize(token: string, permission: HqPermission = 'payments:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'payments:access') || !hasPermission(account, permission)) throw new PaymentError('FORBIDDEN', '没有支付查询或此操作权限')
  return account
}

export const paymentsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockPaymentCatalog()
    return (await real.realPaymentCatalog()) as Awaited<ReturnType<typeof mockPaymentCatalog>>
  },
  async mutate(token: string, input: PaymentMutation) {
    const permissions = { 'save-channel': 'payments:channels', query: 'payments:query', compensate: 'payments:compensate', reconcile: 'payments:reconcile' } as const
    const permission = permissions[input.action]
    if (!permission) throw new PaymentError('INVALID_INPUT', '支付操作无效')
    const account = await authorize(token, permission)
    if (isMockAuth) return mockPaymentMutate(input, account)
    return (await real.realPaymentMutate(input)) as Awaited<ReturnType<typeof mockPaymentMutate>>
  },
  async download(token: string, jobId: string, kind: 'source' | 'differences', reason: string, key: string) {
    const account = await authorize(token, 'payments:export')
    if (isMockAuth) return mockPaymentDownload(jobId, kind, reason, key, account)
    return (await real.realPaymentDownload(jobId, kind, reason, key)) as Awaited<ReturnType<typeof mockPaymentDownload>>
  },
  async sample(token: string, channel: PaymentChannel, date: string) {
    await authorize(token, 'payments:export')
    if (isMockAuth) return mockPaymentSample(channel, date)
    return (await real.realPaymentSample(channel, date)) as Awaited<ReturnType<typeof mockPaymentSample>>
  },
}
