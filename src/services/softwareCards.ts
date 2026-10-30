import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { SoftwareCardError, type SoftwareExportRequest, type SoftwareMutation, type SoftwareQuery } from '../types/softwareCards'
import { mockSoftwareCatalog, mockSoftwareDetail, mockSoftwareExport, mockSoftwareList, mockSoftwareMutate, mockSoftwareReplacements } from './mock/softwareCards'
import * as real from './real/softwareCards'

async function authorize(token: string, permission: HqPermission = 'software:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'software:access') || !hasPermission(account, permission)) throw new SoftwareCardError('FORBIDDEN', '没有软件卡查询或此操作权限')
  return account
}

export const softwareCardsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockSoftwareCatalog()
    return (await real.realSoftwareCatalog()) as Awaited<ReturnType<typeof mockSoftwareCatalog>>
  },
  async list(token: string, query: SoftwareQuery) {
    await authorize(token)
    if (isMockAuth) return mockSoftwareList(query)
    return (await real.realSoftwareList(query)) as Awaited<ReturnType<typeof mockSoftwareList>>
  },
  async detail(token: string, id: string) {
    await authorize(token)
    if (isMockAuth) return mockSoftwareDetail(id)
    return (await real.realSoftwareDetail(id)) as Awaited<ReturnType<typeof mockSoftwareDetail>>
  },
  async replacements(token: string, id: string) {
    await authorize(token, 'software:replace')
    if (isMockAuth) return mockSoftwareReplacements(id)
    return (await real.realSoftwareReplacements(id)) as Awaited<ReturnType<typeof mockSoftwareReplacements>>
  },
  async mutate(token: string, input: SoftwareMutation) {
    if (!['save-type', 'import', 'assign', 'deliver', 'retire', 'replace'].includes(input.action)) throw new SoftwareCardError('INVALID_INPUT', '软件卡操作类型无效，不能在前端修改外部激活状态')
    const permissions: Record<SoftwareMutation['action'], HqPermission> = { 'save-type': 'software:types', import: 'software:import', assign: 'software:assign', deliver: 'software:deliver', retire: 'software:retire', replace: 'software:replace' }
    const account = await authorize(token, permissions[input.action])
    if (isMockAuth) return mockSoftwareMutate(input, account)
    return (await real.realSoftwareMutate(input)) as Awaited<ReturnType<typeof mockSoftwareMutate>>
  },
  async export(token: string, input: SoftwareExportRequest) {
    const account = await authorize(token, 'software:export')
    if (isMockAuth) return mockSoftwareExport(input, account)
    return (await real.realSoftwareExport(input)) as Awaited<ReturnType<typeof mockSoftwareExport>>
  },
}
