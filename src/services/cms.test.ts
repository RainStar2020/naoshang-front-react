import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyContent, normalizeContent } from '../utils/richContent'
import type { CmsCourseDraft, CmsMutation } from '../types/cms'

let cms: typeof import('./cms')['cmsService']
let auth: typeof import('./auth')['authService']
let members: typeof import('./members')['membersService']
let token: string
beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  cms = (await import('./cms')).cmsService
  auth = (await import('./auth')).authService
  members = (await import('./members')).membersService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.restoreAllMocks())
const mutate = (input: CmsMutation) => cms.mutate(token, input)
const command = (action: 'publish' | 'offline', targetId = 'level-2', version = 1): CmsMutation => ({ action, targetId, version, reason: '测试总部发布流程', idempotencyKey: crypto.randomUUID() })
const save = (value: CmsCourseDraft, version = 1): CmsMutation => ({ action: 'save-course', targetId: value.levelId, value, version, reason: '测试保存草稿', idempotencyKey: crypto.randomUUID() })
async function draft(id = 'level-2') { return (await cms.catalog(token)).courses.find(course => course.draft.levelId === id)!.draft }

describe('结构化富文本消费契约', () => {
  it('过滤可执行HTML、事件属性和非HTTPS图片，保留合法嵌套文字', () => {
    const result = normalizeContent({ version: 1, format: 'nodes', nodes: [
      { name: 'script', children: [{ type: 'text', text: 'alert(1)' }] },
      { name: 'img', attrs: { src: 'javascript:alert(1)' } },
      { name: 'img', attrs: { src: 'https://example.com/a.png', onerror: 'evil()', style: 'position:fixed', alt: '图片' } },
      { name: 'p', children: [{ name: 'strong', children: [{ type: 'text', text: '<script>只是文本</script>' }] }] },
    ] })
    expect(result.nodes).toHaveLength(2)
    expect(JSON.stringify(result)).not.toContain('onerror')
    expect(JSON.stringify(result)).not.toContain('position:fixed')
    expect(JSON.stringify(result)).toContain('只是文本')
  })
  it('拒绝未知版本、过深和过长内容', () => {
    expect(() => normalizeContent('<p>HTML</p>')).toThrow()
    expect(() => normalizeContent({ version: 1, format: 'nodes', nodes: Array.from({ length: 2001 }, () => ({ type: 'text', text: 'x' })) })).toThrow('2000')
    let node: unknown = { type: 'text', text: 'x' }
    for (let i = 0; i < 18; i++) node = { name: 'p', children: [node] }
    expect(() => normalizeContent({ version: 1, format: 'nodes', nodes: [node] })).toThrow('16')
  })
})

describe('草稿、发布与跨模块消费', () => {
  it('保存草稿不会覆盖已发布快照或改变学员消费目录', async () => {
    const value = await draft(); value.name = '尚未发布的新课程名'
    const result = await mutate(save(value))
    expect(result.courses[1].draft.name).toBe(value.name)
    expect(result.courses[1].publication!.course.name).toBe('实用记忆')
    expect((await members.detail(token, 'member-1')).levels.find(level => level.levelId === 'level-2')?.name).toBe('实用记忆')
  })
  it('发布创建独立revision并更新学员消费名称', async () => {
    const value = await draft(); value.name = '正式课程新名称'
    await mutate(save(value))
    const result = await mutate(command('publish', 'level-2', 2))
    expect(result.courses[1].publication).toMatchObject({ revision: 2, draftVersion: 3 })
    expect((await members.detail(token, 'member-1')).levels.find(level => level.levelId === 'level-2')?.name).toBe(value.name)
  })
  it('等级归属变更仅发布后影响消费权限，不改写原有权益或学习进度', async () => {
    const before = await members.detail(token, 'member-1')
    const value = await draft(); value.membershipTierId = 'demo-tier-3'
    await mutate(save(value))
    expect((await members.detail(token, 'member-1')).levels.find(level => level.levelId === 'level-2')?.unlocked).toBe(true)
    await mutate(command('publish', 'level-2', 2))
    const after = await members.detail(token, 'member-1')
    expect(after.levels.find(level => level.levelId === 'level-2')).toMatchObject({ unlocked: false, percent: 45, membershipTierId: 'demo-tier-3' })
    expect(after.member.entitlements).toEqual(before.member.entitlements)
  })
  it('下线隐藏消费内容，保留快照和权益；重新发布保留进度', async () => {
    const result = await mutate(command('offline'))
    expect(result.courses[1].publication).not.toBeNull()
    expect((await members.detail(token, 'member-1')).levels.some(level => level.levelId === 'level-2')).toBe(false)
    await mutate(command('publish', 'level-2', 2))
    expect((await members.detail(token, 'member-1')).levels.find(level => level.levelId === 'level-2')).toMatchObject({ unlocked: true, percent: 45 })
  })
  it('缺少封面、介绍正文或章节不能发布，但允许保存不完整草稿', async () => {
    const value = await draft(); value.covers = []; value.content = emptyContent(); value.chapters = []
    await mutate(save(value))
    await expect(mutate(command('publish', 'level-2', 2))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await cms.catalog(token)).courses[1].publication!.revision).toBe(1)
  })
    it('视频章节须有HTTPS视频与封面；课程正文可保留视频节点', async () => {
    const value = await draft(); value.chapters[0].type = 'video'
    await mutate(save(value))
    await expect(mutate(command('publish', 'level-2', 2))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    value.chapters[0].videoUrl = 'https://example.com/video.mp4'; value.chapters[0].posterUrl = 'https://example.com/poster.png'
    await mutate(save(value, 2)); await mutate(command('publish', 'level-2', 3))
    expect((await cms.catalog(token)).courses[1].publication!.course.chapters[0].type).toBe('video')
    const withVideo = normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'video', attrs: { src: 'https://example.com/a.mp4' } }] })
    expect(withVideo.nodes).toHaveLength(1)
    expect(!('type' in withVideo.nodes[0]) && withVideo.nodes[0].name).toBe('video')
  })

    it('图文章节文字/图片/视频交错保存后回读顺序一致', async () => {
    const value = await draft()
    value.chapters[0].type = 'article'
    value.chapters[0].content = {
      version: 1,
      format: 'nodes',
      nodes: [
        { name: 'p', attrs: {}, children: [{ type: 'text', text: '开场文字' }] },
        { name: 'img', attrs: { src: 'https://example.com/a.png', alt: '图' }, children: [] },
        { name: 'p', attrs: {}, children: [{ type: 'text', text: '图后继续' }] },
        { name: 'video', attrs: { src: 'https://example.com/a.mp4' }, children: [] },
        { name: 'p', attrs: {}, children: [{ type: 'text', text: '视频后再输入' }] },
      ],
    }
    await mutate(save(value))
    const saved = (await cms.catalog(token)).courses.find((c) => c.draft.levelId === value.levelId)!.draft.chapters[0].content
    const names = saved.nodes.map((n) => ('type' in n ? 'text' : n.name))
    expect(names).toEqual(['p', 'img', 'p', 'video', 'p'])
    const texts = saved.nodes.map((n) => {
      if ('type' in n) return n.text
      if (n.name === 'img' || n.name === 'video') return n.attrs.src ?? ''
      const child = n.children[0]
      return child && 'type' in child ? child.text : ''
    })
    expect(texts).toEqual(['开场文字', 'https://example.com/a.png', '图后继续', 'https://example.com/a.mp4', '视频后再输入'])
  })
it('课程正文含 script/iframe 时保存失败', async () => {
    const value = await draft()
    value.content = {
      version: 1,
      format: 'nodes',
      nodes: [
        { name: 'p', attrs: {}, children: [{ type: 'text', text: 'ok' }] },
        { name: 'script', attrs: {}, children: [{ type: 'text', text: 'alert(1)' }] } as never,
      ],
    }
    await expect(mutate(save(value))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    value.content = {
      version: 1,
      format: 'nodes',
      nodes: [{ name: 'iframe', attrs: { src: 'https://evil.example/' }, children: [] } as never],
    }
    await expect(mutate(save(value))).rejects.toThrow(/iframe|禁止/)
  })
it('章节重排保留稳定ID，并由服务重新生成连续顺序', async () => {
    const value = await draft()
    const originalId = value.chapters[0].id
    value.chapters.unshift({ ...structuredClone(value.chapters[0]), id: 'new-chapter', title: '新第一章', order: 99 })
    const result = await mutate(save(value))
    expect(result.courses[1].draft.chapters.map(chapter => [chapter.id, chapter.order])).toEqual([['new-chapter', 1], [originalId, 2]])
  })
  it('新增等级和课程使用服务生成ID，课程发布前不进入学员目录', async () => {
    const tierResult = await mutate({ action: 'save-tier', targetId: '', version: 0, value: { number: 4, name: '四阶演示', summary: '', coverUrl: '', benefits: emptyContent() }, reason: '新增配置', idempotencyKey: crypto.randomUUID() })
    const tier = tierResult.tiers[tierResult.tiers.length - 1]
    expect(tier.membershipTierId).toMatch(/^tier-/)
    const value = await draft(); value.levelId = ''; value.number = 11; value.membershipTierId = tier.membershipTierId
    const result = await mutate(save(value, 0))
    expect(result.courses[result.courses.length - 1].status).toBe('draft')
    expect((await members.options(token)).tiers.find(item => item.membershipTierId === tier.membershipTierId)?.levels).toHaveLength(0)
  })
  it('修改会员等级展示名保持授权ID稳定', async () => {
    const before = await members.detail(token, 'member-1')
    const tier = (await cms.catalog(token)).tiers[1]
    await mutate({ action: 'save-tier', targetId: tier.membershipTierId, version: tier.version, value: { ...tier, name: '二阶新版名称' }, reason: '调整展示名称', idempotencyKey: crypto.randomUUID() })
    expect((await members.options(token)).tiers[1].name).toBe('二阶新版名称')
    expect((await members.detail(token, 'member-1')).member.entitlements).toEqual(before.member.entitlements)
  })
})

describe('权限、版本、资源和审计', () => {
  it('课程查询账号不能编辑或发布', async () => {
    const value = await draft()
    token = (await auth.login({ loginAccount: 'hq-course-viewer', password: 'Demo@123456' })).token
    expect((await cms.catalog(token)).courses).toHaveLength(10)
    await expect(mutate(save(value))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(mutate(command('publish'))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('内容编辑账号能保存草稿但不能发布或下线', async () => {
    const value = await draft()
    token = (await auth.login({ loginAccount: 'hq-content', password: 'Demo@123456' })).token
    await mutate(save(value))
    for (const action of ['publish', 'offline'] as const) await expect(mutate(command(action, 'level-2', 2))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('无模块权限或已退出的会话不能访问CMS', async () => {
    token = (await auth.login({ loginAccount: 'hq-members-viewer', password: 'Demo@123456' })).token
    await expect(cms.catalog(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await auth.logout()
    await expect(cms.catalog(token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('并发重试只增加一个发布版本和一条记录', async () => {
    const input = command('publish')
    const [a, b] = await Promise.all([mutate(input), mutate(input)])
    expect(a).toEqual(b)
    expect(a.courses[1].publication?.revision).toBe(2)
    expect(a.audit).toHaveLength(1)
    await expect(mutate({ ...input, reason: '变更原因' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('版本冲突与无效操作不能覆盖现有版本', async () => {
    await mutate(command('offline'))
    await expect(mutate(command('publish'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    await expect(mutate(command('offline', 'level-2', 2))).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect((await cms.catalog(token)).audit).toHaveLength(1)
  })
  it('校验重复编号、重复章节ID和操作原因', async () => {
    const value = await draft(); value.number = 1
    await expect(mutate(save(value))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    value.number = 2; value.chapters.push(structuredClone(value.chapters[0]))
    await expect(mutate(save(value))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(mutate({ ...command('publish'), reason: ' ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('返回副本且记录总部操作者、原因和版本', async () => {
    const catalog = await mutate(command('publish'))
    expect(catalog.audit[0]).toMatchObject({ operatorId: 'HQ001', targetId: 'level-2', beforeVersion: 1, afterVersion: 2 })
    catalog.courses[1].publication!.course.name = '非法直接修改'
    expect((await cms.catalog(token)).courses[1].publication!.course.name).toBe('实用记忆')
  })
  it('Mock上传返回HTTPS占位符和单独的本地预览，不接受不支持的文件', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview')
    const asset = await cms.upload(token, new File(['image'], 'cover.png', { type: 'image/png' }))
    expect(asset.url).toMatch(/^https:\/\/mock-assets.invalid\//)
    expect(cms.resolveAsset(asset.url)).toBe('blob:local-preview')
    await expect(cms.upload(token, new File(['code'], 'test.html', { type: 'text/html' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(cms.upload(token, new File([], 'empty.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('课程查询账号不能上传资源', async () => {
    token = (await auth.login({ loginAccount: 'hq-course-viewer', password: 'Demo@123456' })).token
    await expect(cms.upload(token, new File(['image'], 'cover.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('未知操作不能绕过发布权限改变课程状态', async () => {
    token = (await auth.login({ loginAccount: 'hq-content', password: 'Demo@123456' })).token
    await expect(mutate({ ...command('offline'), action: 'unknown' } as unknown as CmsMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await cms.catalog(token)).courses[1].status).toBe('published')
  })
})
