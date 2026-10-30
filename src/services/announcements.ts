import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { AnnouncementError, type AnnouncementMutation } from '../types/announcements'
import { mockAnnouncementCatalog, mockAnnouncementMutate, mockAnnouncementStats } from './mock/announcements'
import { mockAssetUrl, mockCmsUpload } from './mock/cms'
import * as real from './real/announcements'

async function authorize(token: string, permission: HqPermission = 'announcements:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'announcements:access') || !hasPermission(account, permission)) throw new AnnouncementError('FORBIDDEN', '没有公告查询或操作权限')
  return account
}

export const announcementsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockAnnouncementCatalog()
    return (await real.realAnnouncementCatalog()) as Awaited<ReturnType<typeof mockAnnouncementCatalog>>
  },
  async stats(token: string, id: string) {
    await authorize(token, 'announcements:stats')
    if (isMockAuth) return mockAnnouncementStats(id)
    return (await real.realAnnouncementStats(id)) as Awaited<ReturnType<typeof mockAnnouncementStats>>
  },
  async mutate(token: string, input: AnnouncementMutation) {
    if (!['save', 'publish', 'offline'].includes(input.action)) throw new AnnouncementError('INVALID_INPUT', '操作类型无效')
    const account = await authorize(token, input.action === 'save' ? 'announcements:edit' : 'announcements:publish')
    if (isMockAuth) return mockAnnouncementMutate(input, account)
    return (await real.realAnnouncementMutate(input)) as Awaited<ReturnType<typeof mockAnnouncementMutate>>
  },
  async upload(token: string, file: File) {
    await authorize(token, 'announcements:edit')
    if (isMockAuth) return mockCmsUpload(file)
    return (await real.realAnnouncementUpload(file)) as Awaited<ReturnType<typeof mockCmsUpload>>
  },
  resolveAsset: (url: string) => (isMockAuth ? mockAssetUrl(url) : real.realAnnouncementAssetUrl(url)),
}
