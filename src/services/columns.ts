import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { ColumnError, type ColumnMutation } from '../types/columns'
import { mockColumnCatalog, mockColumnMutation, mockColumnRecords } from './mock/columns'
import { mockAssetUrl, mockCmsUpload } from './mock/cms'
import * as real from './real/columns'

async function authorize(token: string, permission: HqPermission = 'columns:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'columns:access') || !hasPermission(account, permission)) throw new ColumnError('FORBIDDEN', '没有专栏查询或此操作权限')
  return account
}

export const columnsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockColumnCatalog()
    return (await real.realColumnCatalog()) as Awaited<ReturnType<typeof mockColumnCatalog>>
  },
  async records(token: string, columnId: string, accountId?: string) {
    await authorize(token, 'columns:records')
    if (isMockAuth) return mockColumnRecords(columnId, accountId)
    return (await real.realColumnRecords(columnId, accountId)) as Awaited<ReturnType<typeof mockColumnRecords>>
  },
  async mutate(token: string, input: ColumnMutation) {
    if (!['save', 'publish', 'offline'].includes(input.action)) throw new ColumnError('INVALID_INPUT', '专栏操作类型无效')
    const account = await authorize(token, input.action === 'save' ? 'columns:edit' : 'columns:publish')
    if (isMockAuth) return mockColumnMutation(input, account)
    return (await real.realColumnMutation(input)) as Awaited<ReturnType<typeof mockColumnMutation>>
  },
  async upload(token: string, file: File) {
    await authorize(token, 'columns:edit')
    if (isMockAuth) return mockCmsUpload(file)
    return (await real.realColumnUpload(file)) as Awaited<ReturnType<typeof mockCmsUpload>>
  },
  resolveAsset: (url: string) => (isMockAuth ? mockAssetUrl(url) : real.realColumnAssetUrl(url)),
}
