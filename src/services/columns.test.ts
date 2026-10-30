import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { ColumnDraft, ColumnMutation, ColumnProgressWrite } from '../types/columns'
let service: typeof import('./columns')['columnsService']
let mock: typeof import('./mock/columns')
let auth: typeof import('./auth')['authService']
let token: string
const id = 'demo-column-memory'
const base = () => ({ columnId: id, version: 1, reason: '验收专栏', idempotencyKey: crypto.randomUUID() })
const save = (value: ColumnDraft, version = 1): ColumnMutation => ({ ...base(), action: 'save', value, columnId: value.columnId, version })
const command = (action: 'publish' | 'offline', version = 1): ColumnMutation => ({ ...base(), action, version })
const progress = (extra: Partial<ColumnProgressWrite> = {}): ColumnProgressWrite => ({ accountId: 'account-1', columnId: id, chapterId: 'column-memory-video', positionSeconds: 60, durationSeconds: 100, completed: false, ended: false, version: 1, idempotencyKey: crypto.randomUUID(), ...extra })
beforeEach(async () => {
  vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./columns')).columnsService; mock = await import('./mock/columns'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.useRealTimers())
it('按账号统计已付和待付，付款不等于授权', async () => {
  const rows = (await service.records(token, id)).accounts
  expect(rows[0]).toMatchObject({ accountId: 'account-1', purchaseCount: 2, grant: { unlocked: true }, progress: [{ percent: 45 }] })
  expect(rows[1]).toMatchObject({ purchaseCount: 1, grant: null })
  expect(rows[2]).toMatchObject({ purchaseCount: 0, pendingPurchaseCount: 1, grant: null })
})
it('筛选无购买账号返回零记录且返回值不污染状态', async () => {
  const rows = await service.records(token, id, 'account-4'); expect(rows.accounts[0].purchaseCount).toBe(0); expect(rows.orders).toEqual([])
  rows.accounts[0].purchaseCount = 900; expect((await service.records(token, id, 'account-4')).accounts[0].purchaseCount).toBe(0)
})
it('保存草稿与发布快照隔离，发布后保留学习记录', async () => {
  const draft = (await service.catalog(token)).columns[0].draft; draft.title = '新专栏标题'
  await service.mutate(token, save(draft)); expect(mock.readMockColumn('account-1', id).column.title).not.toBe(draft.title)
  await service.mutate(token, command('publish', 2)); expect(mock.readMockColumn('account-1', id).column.title).toBe(draft.title)
  expect((await service.records(token, id)).accounts[0].progress[0].percent).toBe(45)
})
it('下线阻止读取但保留授权和进度，重新发布恢复', async () => {
  await service.mutate(token, command('offline')); expect(() => mock.readMockColumn('account-1', id)).toThrow('下线')
  expect((await service.records(token, id)).accounts[0].grant).not.toBeNull()
  await service.mutate(token, command('publish', 2)); expect(mock.readMockColumn('account-1', id).revision).toBe(2)
})
it('章节排序保留ID、移除章节保留历史进度', async () => {
  const draft = (await service.catalog(token)).columns[0].draft; draft.chapters.reverse(); await service.mutate(token, save(draft))
  expect((await service.catalog(token)).columns[0].draft.chapters[0]).toMatchObject({ id: 'column-memory-video', order: 1 })
  draft.chapters = draft.chapters.filter(chapter => chapter.type === 'article'); await service.mutate(token, save(draft, 2)); await service.mutate(token, command('publish', 3))
  expect((await service.records(token, id)).accounts[0].progress).toHaveLength(1); expect(() => mock.writeMockColumnProgress(progress())).toThrow('章节')
})
it('操作幂等并拒绝版本冲突和请求号篡改', async () => {
  const request = command('publish'); await service.mutate(token, request); await service.mutate(token, request)
  expect((await service.catalog(token)).audit).toHaveLength(1)
  await expect(service.mutate(token, { ...request, reason: '改变参数' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  await expect(service.mutate(token, command('offline'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('发布后不能改绑商品，一个商品不能绑定多个专栏', async () => {
  const draft = (await service.catalog(token)).columns[0].draft
  await expect(service.mutate(token, save({ ...draft, productId: 'demo-product-column-2' }))).rejects.toThrow('改绑')
  await expect(service.mutate(token, save({ ...draft, columnId: '' }, 0))).rejects.toThrow('关联其他专栏')
})
it('新建草稿不进入可消费目录，缺内容不能发布', async () => {
  const draft = (await service.catalog(token)).columns[0].draft
  const result = await service.mutate(token, save({ ...draft, columnId: '', productId: 'demo-product-column-2', chapters: [] }, 0))
  expect(mock.mockColumnTargets()).toHaveLength(1)
  await expect(service.mutate(token, { ...command('publish'), columnId: result.columns[1].draft.columnId })).rejects.toThrow('至少一个章节')
})
it('视频发布必须有视频封面和有效HTTPS地址', async () => {
  const draft = (await service.catalog(token)).columns[0].draft; draft.chapters[1].posterUrl = ''
  await service.mutate(token, save(draft)); await expect(service.mutate(token, command('publish', 2))).rejects.toThrow('视频及封面')
  draft.coverUrl = 'javascript:alert(1)'; await expect(service.mutate(token, save(draft, 2))).rejects.toThrow('HTTPS')
})
it('激活后仍可重复购买但不改变授权和进度', () => {
  const before = mock.mockColumnRecords(id).accounts[0]; const order = mock.recordMockColumnPurchase('account-1', id, 'purchase-1')
  expect(mock.recordMockColumnPurchase('account-1', id, 'purchase-1')).toEqual(order)
  const after = mock.mockColumnRecords(id).accounts[0]; expect(after.purchaseCount).toBe(3); expect(after.grant).toEqual(before.grant); expect(after.progress).toEqual(before.progress)
  expect(() => mock.prepareMockColumnActivation('account-1', id)).toThrow('已开通')
})
it('新购买不自动授权，未付订单不能作为激活资格', () => {
  mock.recordMockColumnPurchase('account-4', id, 'new'); expect(mock.mockColumnRecords(id, 'account-4').accounts[0].grant).toBeNull()
  expect(() => mock.prepareMockColumnActivation('account-3', id)).toThrow('付款'); expect(() => mock.readMockColumn('account-2', id)).toThrow('未激活')
})
it('进度按账号隔离并校验授权', () => {
  expect(() => mock.writeMockColumnProgress(progress({ accountId: 'account-2', version: 0 }))).toThrow('未激活')
  expect(mock.writeMockColumnProgress(progress()).percent).toBe(60)
  expect(mock.mockColumnRecords(id, 'account-2').accounts[0].progress).toEqual([])
})
it('续播进度幂等与乐观锁', () => {
  const request = progress(); const result = mock.writeMockColumnProgress(request); expect(mock.writeMockColumnProgress(request)).toEqual(result)
  expect(() => mock.writeMockColumnProgress(progress())).toThrow('已更新')
  expect(() => mock.writeMockColumnProgress({ ...request, positionSeconds: 61 })).toThrow('不同内容')
})
it.each([NaN, Infinity, -1, 101])('拒绝无效视频位置 %s', positionSeconds => { expect(() => mock.writeMockColumnProgress(progress({ positionSeconds }))).toThrow('无效') })
it('不能伪报视频完成，完成后重新观看不清除完成记录', () => {
  expect(() => mock.writeMockColumnProgress(progress({ completed: true }))).toThrow('伪报')
  const done = mock.writeMockColumnProgress(progress({ positionSeconds: 100, ended: true, completed: true })); expect(done.percent).toBe(100)
  expect(mock.writeMockColumnProgress(progress({ positionSeconds: 5, version: 2 })).completed).toBe(true)
})
it('图文确认独立记录，不混用视频时长', () => {
  expect(() => mock.writeMockColumnProgress(progress({ chapterId: 'column-memory-article', version: 0 }))).toThrow('图文章节')
  expect(mock.writeMockColumnProgress(progress({ chapterId: 'column-memory-article', version: 0, positionSeconds: 0, durationSeconds: 0, completed: true })).percent).toBe(100)
})
it('专栏编辑与只读权限在服务层生效', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-column-viewer', password: 'Demo@123456' })).token
  await expect(service.records(viewer, id)).resolves.toBeDefined(); await expect(service.mutate(viewer, command('publish'))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  const editor = (await auth.login({ loginAccount: 'hq-column-editor', password: 'Demo@123456' })).token
  await expect(service.mutate(editor, save((await service.catalog(editor)).columns[0].draft))).resolves.toBeDefined()
  await expect(service.mutate(editor, command('publish', 2))).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
async function issued(accountId: string) {
  const codes = (await import('./activationCodes')).activationCodesService
  const batch = await codes.mutate(token, { reason: '专栏验收', idempotencyKey: crypto.randomUUID(), action: 'generate', name: '专栏批次', codeType: 'column', targetId: id, quantity: 1, expiresAt: null })
  const code = (await codes.list(token, { page: 1, pageSize: 50, batchId: batch.batchId! })).items[0]
  await codes.mutate(token, { reason: '专栏交付', idempotencyKey: crypto.randomUUID(), action: 'issue', codes: [{ codeId: code.codeId, version: code.version }], accountId, memberId: null, storeId: 'shop-1' })
  const current = (await codes.detail(token, code.codeId)).code
  const exported = await codes.export(token, { reason: '专栏导出', idempotencyKey: crypto.randomUUID(), codes: [{ codeId: code.codeId, version: current.version }] })
  return { codes, codeId: code.codeId, secret: exported.csv.match(/DEMO-COL-[A-F0-9]+/)![0] }
}
it('专栏码经预览消费授予账号权益，幂等且不绑定孩子', async () => {
  const { codes, codeId, secret } = await issued('account-2'); const consumer = await import('./mock/activationCodes')
  const preview = consumer.previewMockColumnActivation(secret, 'account-2'); const grant = consumer.consumeMockColumnActivation(preview.previewToken, 'activate')
  expect(consumer.consumeMockColumnActivation(preview.previewToken, 'activate')).toEqual(grant); expect(grant.accountId).toBe('account-2')
  expect((await codes.detail(token, codeId)).code).toMatchObject({ status: 'used', usedByMemberId: null }); expect(mock.readMockColumn('account-2', id)).toBeDefined()
})
it('未付款或绑定账号不匹配不能消耗码', async () => {
  const { codes, codeId, secret } = await issued('account-3'); const consumer = await import('./mock/activationCodes')
  expect(() => consumer.previewMockColumnActivation(secret, 'account-2')).toThrow('不匹配'); expect(() => consumer.previewMockColumnActivation(secret, 'account-3')).toThrow('付款')
  expect((await codes.detail(token, codeId)).code.status).toBe('issued')
})
it('预览后发布版本变化必须重新确认，不消耗码', async () => {
  const { codes, codeId, secret } = await issued('account-2'); const consumer = await import('./mock/activationCodes'); const preview = consumer.previewMockColumnActivation(secret, 'account-2')
  await service.mutate(token, command('publish')); expect(() => consumer.consumeMockColumnActivation(preview.previewToken, 'activate')).toThrow('版本已变化')
  expect((await codes.detail(token, codeId)).code.status).toBe('issued')
})
