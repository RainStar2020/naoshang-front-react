import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { AnnouncementDraft, AnnouncementMutation } from '../types/announcements'
let service: typeof import('./announcements')['announcementsService']
let mock: typeof import('./mock/announcements')
let auth: typeof import('./auth')['authService']
let token: string
const id = 'demo-announcement-1'
const base = () => ({ id, version: 1, reason: '验收公告', idempotencyKey: crypto.randomUUID() })
const command = (action: 'publish' | 'offline', version = 1): AnnouncementMutation => ({ ...base(), action, version })
const save = (value: AnnouncementDraft, version = 1): AnnouncementMutation => ({ ...base(), action: 'save', id: value.id, value, version })
const draft = async () => (await service.catalog(token)).items[0].draft
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./announcements')).announcementsService; mock = await import('./mock/announcements'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('完整正常账号为统计分母，分页不改变人数', async () => {
  const stats = await service.stats(token, id); expect(stats.targetCount).toBe(23); expect(stats.readCount).toBe(1); expect(stats.unreadCount).toBe(22)
  expect(mock.listMockAnnouncements('account-1', 1, 1).total).toBe(1)
  expect((await service.stats(token, id)).targetCount).toBe(23)
})
it('家长身份来自真实孩子归属，其他账号不能直链读取', async () => {
  await service.mutate(token, save({ ...await draft(), audience: ['parent'] })); await service.mutate(token, command('publish', 2))
  expect((await service.stats(token, id)).targetCount).toBe(10)
  expect(mock.listMockAnnouncements('account-13').items).toEqual([])
  expect(() => mock.readMockAnnouncement('account-13', id)).toThrow('范围')
  expect(() => mock.markMockAnnouncementRead('account-13', id)).toThrow('范围')
})
it('多个身份按OR匹配，同一账号不重复计算', async () => {
  await service.mutate(token, save({ ...await draft(), audience: ['agency', 'costore'] })); await service.mutate(token, command('publish', 2))
  const stats = await service.stats(token, id); expect(stats.targetCount).toBe(1); expect(stats.recipients[0].accountId).toBe('account-1')
  expect(mock.readMockAnnouncement('account-1', id)).toBeDefined(); expect(() => mock.readMockAnnouncement('account-2', id)).toThrow('范围')
})
it('无健脑官Mock资料不伪造目标人群', async () => {
  await service.mutate(token, save({ ...await draft(), audience: ['coach'] })); await service.mutate(token, command('publish', 2)); expect((await service.stats(token, id)).targetCount).toBe(0)
})
it('冻结账号不能读取和上报', () => { expect(() => mock.readMockAnnouncement('account-5', id)).toThrow('范围'); expect(() => mock.markMockAnnouncementRead('account-5', id)).toThrow('范围') })
it('保存草稿不改变消费快照与范围', async () => {
  const value = await draft(); await service.mutate(token, save({ ...value, title: '新标题', audience: ['agency'] }))
  expect(mock.readMockAnnouncement('account-2', id).title).toBe(value.title); expect((await service.stats(token, id)).targetCount).toBe(23)
})
it('定时到时前列表、正文和上报均拒绝，到时开放', async () => {
  const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now)
  await service.mutate(token, save({ ...await draft(), publishAt: new Date(now + 60000).toISOString() })); await service.mutate(token, command('publish', 2))
  expect((await service.catalog(token)).items[0].status).toBe('scheduled'); expect(mock.listMockAnnouncements('account-2').total).toBe(0)
  expect(() => mock.readMockAnnouncement('account-2', id)).toThrow(); expect(() => mock.markMockAnnouncementRead('account-2', id)).toThrow()
  vi.spyOn(Date, 'now').mockReturnValue(now + 60000)
  expect((await service.catalog(token)).items[0].status).toBe('published'); expect(mock.readMockAnnouncement('account-2', id)).toBeDefined()
})
it('下线取消定时发布，不因到时重新显示', async () => {
  const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now)
  await service.mutate(token, save({ ...await draft(), publishAt: new Date(now + 60000).toISOString() })); await service.mutate(token, command('publish', 2)); await service.mutate(token, command('offline', 3))
  vi.spyOn(Date, 'now').mockReturnValue(now + 60000); expect(mock.listMockAnnouncements('account-1').total).toBe(0)
})
it('已读按账号幂等，不改变首次阅读时间', () => {
  const first = mock.markMockAnnouncementRead('account-2', id); vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
  expect(mock.markMockAnnouncementRead('account-2', id)).toEqual(first); expect(mock.mockAnnouncementStats(id).readCount).toBe(2)
})
it('读取正文不隐式记读，上报失败可重试且正文已独立返回', () => {
  const detail = mock.readMockAnnouncement('account-2', id); expect(mock.mockAnnouncementStats(id).readCount).toBe(1)
  const transport = vi.fn().mockImplementationOnce(() => { throw new Error('模拟上报网络失败') }).mockImplementation(() => mock.markMockAnnouncementRead('account-2', id))
  expect(() => transport()).toThrow('网络失败'); expect(detail.content.nodes.length).toBeGreaterThan(0); transport(); expect(mock.mockAnnouncementStats(id).readCount).toBe(2)
})
it('下线保留已读记录，重新发布不强制重读', async () => {
  const read = mock.markMockAnnouncementRead('account-2', id); await service.mutate(token, command('offline'))
  expect(() => mock.readMockAnnouncement('account-2', id)).toThrow(); expect((await service.stats(token, id)).readCount).toBe(2)
  await service.mutate(token, command('publish', 2)); expect(mock.markMockAnnouncementRead('account-2', id)).toEqual(read)
})
it('完整集合先置顶再时间排序后分页', async () => {
  const value = await draft()
  const first = await service.mutate(token, save({ ...value, id: '', title: '普通新公告', pinned: false }, 0)); const newId = first.items[1].draft.id
  await service.mutate(token, { ...command('publish'), id: newId })
  expect(mock.listMockAnnouncements('account-1', 1, 1).items[0].id).toBe(id)
  expect(mock.listMockAnnouncements('account-1', 2, 1).items[0].id).toBe(newId)
})
it('新建草稿不可消费，统计不提前计入目标', async () => {
  const result = await service.mutate(token, save({ ...await draft(), id: '' }, 0)); const newId = result.items[1].draft.id
  expect(mock.mockAnnouncementStats(newId).targetCount).toBe(0); expect(() => mock.readMockAnnouncement('account-1', newId)).toThrow()
})
it('发布校验正文，定时校验未来且包含时区', async () => {
  await expect(service.mutate(token, save({ ...await draft(), publishAt: '2027-01-01T10:00' }))).rejects.toThrow('时区')
  await service.mutate(token, save({ ...await draft(), content: { version: 1, format: 'nodes', nodes: [] } })); await expect(service.mutate(token, command('publish', 2))).rejects.toThrow('正文')
})
it('过期定时不能误当立即发布', async () => {
  await service.mutate(token, save({ ...await draft(), publishAt: '2020-01-01T00:00:00Z' })); await expect(service.mutate(token, command('publish', 2))).rejects.toThrow('未来')
})
it('富文本去掉脚本与事件属性', async () => {
  const value = await draft(); value.content.nodes.push({ name: 'script', children: [{ type: 'text', text: 'evil()' }] } as never)
  await service.mutate(token, save(value)); expect(JSON.stringify((await service.catalog(token)).items[0].draft.content)).not.toContain('evil')
})
it('拒绝无效身份和不安全封面', async () => {
  await expect(service.mutate(token, save({ ...await draft(), audience: ['admin' as never] }))).rejects.toThrow('身份')
  await expect(service.mutate(token, save({ ...await draft(), coverUrl: 'javascript:evil()' }))).rejects.toThrow('HTTPS')
})
it('幂等重试仅记一次审计，拒绝同请求不同参数', async () => {
  const request = command('publish'); await service.mutate(token, request); await service.mutate(token, request); expect((await service.catalog(token)).audit).toHaveLength(1)
  await expect(service.mutate(token, { ...request, reason: '改变参数' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
})
it('拒绝旧版本写入与空原因', async () => {
  await service.mutate(token, command('publish')); await expect(service.mutate(token, command('offline'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, { ...command('offline', 2), reason: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
it('返回快照修改不污染存储', async () => {
  const value = mock.readMockAnnouncement('account-1', id); value.title = '污染'; expect(mock.readMockAnnouncement('account-1', id).title).not.toBe('污染')
})
it('编辑账号可保存但不能发布、查询统计', async () => {
  const value = await draft(); const editor = (await auth.login({ loginAccount: 'hq-announcement-editor', password: 'Demo@123456' })).token
  await expect(service.mutate(editor, save(value))).resolves.toBeDefined(); await expect(service.mutate(editor, command('publish', 2))).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.stats(editor, id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('只读统计账号不能修改与上传，退出后禁止读取', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-announcement-viewer', password: 'Demo@123456' })).token
  await expect(service.stats(viewer, id)).resolves.toBeDefined(); await expect(service.mutate(viewer, command('publish'))).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.upload(viewer, new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await auth.logout(); await expect(service.catalog(viewer)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('公告上传不要求课程编辑权', async () => {
  const editor = (await auth.login({ loginAccount: 'hq-announcement-editor', password: 'Demo@123456' })).token
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo'); await expect(service.upload(editor, new File(['x'], 'x.png', { type: 'image/png' }))).resolves.toMatchObject({ previewUrl: 'blob:demo' })
})
