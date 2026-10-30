import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { PartnerError, type PartnerMutation, type PartnerQuery } from '../types/partners'
import { mockPartnerCatalog, mockPartnerDetail, mockPartnerList, mockPartnerMutate } from './mock/partners'
import { mockAssetUrl, mockCmsUpload } from './mock/cms'
import * as real from './real/partners'

async function authorize(token: string, permission: HqPermission = 'partners:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'partners:access') || !hasPermission(account, permission)) throw new PartnerError('FORBIDDEN', '没有合伙档案查询或此操作权限')
  return account
}

export const partnersService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockPartnerCatalog()
    return (await real.realPartnerCatalog()) as Awaited<ReturnType<typeof mockPartnerCatalog>>
  },
  async list(token: string, query: PartnerQuery) {
    await authorize(token)
    if (isMockAuth) return mockPartnerList(query)
    return (await real.realPartnerList(query)) as Awaited<ReturnType<typeof mockPartnerList>>
  },
  async detail(token: string, contextId: string) {
    await authorize(token)
    if (isMockAuth) return mockPartnerDetail(contextId)
    return (await real.realPartnerDetail(contextId)) as Awaited<ReturnType<typeof mockPartnerDetail>>
  },
  async mutate(token: string, input: PartnerMutation) {
    if (!['upgrade', 'save-benefits', 'save-level-names'].includes(input.action)) throw new PartnerError('INVALID_INPUT', '合伙操作无效')
    const permission: HqPermission = input.action === 'upgrade' ? 'partners:upgrade' : 'partners:benefits'
    const account = await authorize(token, permission)
    if (isMockAuth) return mockPartnerMutate(input, account)
    return (await real.realPartnerMutate(input)) as Awaited<ReturnType<typeof mockPartnerMutate>>
  },
  async upload(token: string, file: File) {
    await authorize(token, 'partners:benefits')
    if (isMockAuth) return mockCmsUpload(file)
    return (await real.realPartnerUpload(file)) as Awaited<ReturnType<typeof mockCmsUpload>>
  },
  resolveAsset: (url: string) => (isMockAuth ? mockAssetUrl(url) : real.realPartnerAssetUrl(url)),
}
