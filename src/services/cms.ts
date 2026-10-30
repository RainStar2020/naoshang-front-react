import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { CmsError, type CmsMutation } from '../types/cms'
import { mockAssetUrl, mockCmsCatalog, mockCmsMutate, mockCmsUpload } from './mock/cms'
import type { HqPermission } from '../types/auth'
import * as real from './real/cms'

async function authorize(token: string, permission: HqPermission = 'course:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'course:access') || !hasPermission(account, permission)) throw new CmsError('FORBIDDEN', '没有课程CMS查询或操作权限')
  return account
}

export const cmsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockCmsCatalog()
    return (await real.realCmsCatalog()) as Awaited<ReturnType<typeof mockCmsCatalog>>
  },
  async mutate(token: string, input: CmsMutation) {
    if (!['save-tier', 'save-course', 'publish', 'offline'].includes(input.action)) throw new CmsError('INVALID_INPUT', 'CMS操作类型无效')
    const operator = await authorize(token, input.action === 'publish' || input.action === 'offline' ? 'course:publish' : 'course:edit')
    if (isMockAuth) return mockCmsMutate(input, operator)
    return (await real.realCmsMutate(input)) as Awaited<ReturnType<typeof mockCmsMutate>>
  },
  async upload(token: string, file: File) {
    await authorize(token, 'course:edit')
    if (isMockAuth) return mockCmsUpload(file)
    return (await real.realCmsUpload(file)) as Awaited<ReturnType<typeof mockCmsUpload>>
  },
  resolveAsset: (url: string) => (isMockAuth ? mockAssetUrl(url) : real.realCmsAssetUrl(url)),
}
