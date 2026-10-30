import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { TraceError, type TraceAuditQuery, type TraceMutation, type TraceResourceQuery, type TraceTaskQuery } from '../types/trace'
import { mockTraceAuditList, mockTraceCatalog, mockTraceMutate, mockTraceResourceList, mockTraceTaskList } from './mock/trace'
import * as real from './real/trace'

async function authorize(token: string, permission: HqPermission = 'trace:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'trace:access') || !hasPermission(account, permission)) {
    throw new TraceError('FORBIDDEN', '没有通用资源与操作追溯查询/操作权限')
  }
  return account
}

export const traceService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockTraceCatalog()
    return (await real.realTraceCatalog()) as Awaited<ReturnType<typeof mockTraceCatalog>>
  },
  async resources(token: string, query: TraceResourceQuery) {
    await authorize(token)
    if (isMockAuth) return mockTraceResourceList(query)
    return (await real.realTraceResourceList(query)) as Awaited<ReturnType<typeof mockTraceResourceList>>
  },
  async tasks(token: string, query: TraceTaskQuery) {
    await authorize(token)
    if (isMockAuth) return mockTraceTaskList(query)
    return (await real.realTraceTaskList(query)) as Awaited<ReturnType<typeof mockTraceTaskList>>
  },
  async audits(token: string, query: TraceAuditQuery) {
    await authorize(token)
    if (isMockAuth) return mockTraceAuditList(query)
    return (await real.realTraceAuditList(query)) as Awaited<ReturnType<typeof mockTraceAuditList>>
  },
  async mutate(token: string, input: TraceMutation) {
    const account = await authorize(token, 'trace:manage')
    if (isMockAuth) return mockTraceMutate(input, { operatorId: account.accountId, operatorName: account.nickname })
    return (await real.realTraceMutate(input)) as Awaited<ReturnType<typeof mockTraceMutate>>
  },
}
