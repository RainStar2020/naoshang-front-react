import type { HqAccount } from '../../types/auth'
import { CmsError, type CmsAsset, type CmsAudit, type CmsCatalog, type CmsChapter, type CmsCourse, type CmsCourseDraft, type CmsMutation, type CmsTier } from '../../types/cms'
import { emptyContent, hasContent, isMediaUrl, normalizeContent } from '../../utils/richContent'
import { assertCourseContentAllowsSave } from '../../utils/courseContent'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: CmsError['code'], message: string): never => { throw new CmsError(code, message) }
const paragraph = (text: string) => normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'p', children: [{ type: 'text', text }] }] })
const tiers: CmsTier[] = ['一阶菁英会员', '二阶行能会员', '三阶羿烁会员'].map((name, i) => ({ membershipTierId: `demo-tier-${i + 1}`, number: i + 1, name, summary: '小程序既有演示配置，正式权益说明待配置', coverUrl: '', benefits: emptyContent(), version: 1 }))
const names = ['超级记忆', '实用记忆', '语文系统', '外语系统', '百科系统', '导图大师', '速读大师', '记忆大师', '潜能开发', '未来领袖']
const courses: CmsCourse[] = names.map((name, i) => {
  const tier = tiers[i === 0 ? 0 : i < 5 ? 1 : 2]
  const draft: CmsCourseDraft = { levelId: `level-${i + 1}`, membershipTierId: tier.membershipTierId, number: i + 1, name, summary: `${name}课程介绍（演示）`, covers: ['https://mock-assets.invalid/demo-cover'], content: paragraph(`${name}课程简介，请由总部编辑正式内容。`), chapters: [{ id: `level-${i + 1}-article`, title: '第一章：学习入门', type: 'article', order: 1, accessibility: 'membership-required', content: paragraph('这是图文课时的演示正文。'), videoUrl: '', posterUrl: '' }] }
  return { draft, version: 1, status: 'published', publication: { course: copy(draft), revision: 1, publishedAt: '2026-10-01T09:00:00+08:00', draftVersion: 1, tierName: tier.name } }
})
const audit: CmsAudit[] = []
const operations = new Map<string, { payload: string; result: CmsCatalog }>()
const assets = new Map<string, CmsAsset>()
export function mockCmsCatalog(): CmsCatalog { return copy({ tiers, courses, audit: [...audit].reverse() }) }
export function mockPublishedTiers() {
  return copy(tiers.map(tier => ({ membershipTierId: tier.membershipTierId, name: tier.name, levels: courses.filter(course => course.status === 'published' && course.publication?.course.membershipTierId === tier.membershipTierId).map(course => ({ levelId: course.publication!.course.levelId, name: course.publication!.course.name })) })))
}
export function mockPublishedCourse(id: string) { return copy(courses.find(course => course.draft.levelId === id && course.status === 'published')?.publication ?? null) }
export function mockAssetUrl(url: string) { return url === 'https://mock-assets.invalid/demo-cover' ? './favicon.svg' : assets.get(url)?.previewUrl ?? url }
export function mockCmsUpload(file: File): CmsAsset {
  const kind = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? 'image' : file.type === 'video/mp4' ? 'video' : fail('INVALID_INPUT', '仅支持 PNG/JPG/WebP 图片或 MP4 视频')
  if (!file.size || file.size > (kind === 'image' ? 10 : 200) * 1024 * 1024) fail('INVALID_INPUT', kind === 'image' ? '演示图片限制10MB' : '演示视频限制200MB')
  const assetId = crypto.randomUUID()
  const url = `https://mock-assets.invalid/${assetId}`
  const asset: CmsAsset = { assetId, url, previewUrl: URL.createObjectURL(file), kind, mockOnly: true }
  assets.set(url, asset)
  return copy(asset)
}
function text(value: string, max: number, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail('INVALID_INPUT', `${label}须为1–${max}字`)
  return value.trim()
}
function validateCourse(value: CmsCourseDraft, publish: boolean) {
  const draft = copy(value)
  draft.name = text(value.name, 60, '学习等级名称')
  if (!Number.isInteger(draft.number) || draft.number < 1 || draft.number > 999) fail('INVALID_INPUT', '学习等级编号须为1–999的整数')
  if (!tiers.some(tier => tier.membershipTierId === draft.membershipTierId)) fail('INVALID_INPUT', '会员等级归属不存在')
  if (courses.some(course => course.draft.levelId !== draft.levelId && course.draft.number === draft.number)) fail('INVALID_INPUT', '学习等级编号已被使用')
  if (draft.summary.length > 500 || draft.covers.length > 5 || draft.covers.some(url => !isMediaUrl(url))) fail('INVALID_INPUT', '简介最多500字，封面最多5张且须为HTTPS地址')
  try { assertCourseContentAllowsSave(draft.content) } catch (error) { fail('INVALID_INPUT', error instanceof Error ? error.message : '课程介绍含禁止节点') }
  draft.content = normalizeContent(draft.content)
  if (draft.chapters.length > 200) fail('INVALID_INPUT', '演示课程最多200个章节')
  const ids = new Set<string>()
  draft.chapters = draft.chapters.map((chapter, i): CmsChapter => {
    if (!chapter.id || ids.has(chapter.id) || !['article', 'video'].includes(chapter.type)) fail('INVALID_INPUT', '章节ID重复或类型无效')
    ids.add(chapter.id)
    if (chapter.title.length > 80) fail('INVALID_INPUT', '章节标题最多80字')
    try { assertCourseContentAllowsSave(chapter.content) } catch (error) { fail('INVALID_INPUT', error instanceof Error ? error.message : '章节正文含禁止节点') }
    const content = normalizeContent(chapter.content)
    if (chapter.videoUrl && !isMediaUrl(chapter.videoUrl) || chapter.posterUrl && !isMediaUrl(chapter.posterUrl)) fail('INVALID_INPUT', '视频和封面必须为HTTPS地址')
    if (publish) {
      text(chapter.title, 80, '章节标题')
      if (chapter.type === 'article' && !hasContent(content)) fail('INVALID_INPUT', `图文章节「${chapter.title}」缺少正文`)
      if (chapter.type === 'video' && (!isMediaUrl(chapter.videoUrl) || !isMediaUrl(chapter.posterUrl))) fail('INVALID_INPUT', `视频章节「${chapter.title}」需要视频与封面`)
    }
    return { ...chapter, order: i + 1, accessibility: 'membership-required', content, ...(chapter.type === 'article' ? { videoUrl: '', posterUrl: '' } : {}) }
  })
  if (publish && (!draft.summary.trim() || !hasContent(draft.content) || !draft.chapters.length || !draft.covers.length)) fail('INVALID_INPUT', '发布需要课程简介、封面、介绍正文及至少一个章节')
  return draft
}
export function mockCmsMutate(input: CmsMutation, operator: HqAccount): CmsCatalog {
  if (!input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字操作原因')
  const key = `${operator.accountId}:${input.idempotencyKey}`
  const payload = JSON.stringify(input)
  const previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号已用于不同内容，请刷新后重新操作'); return copy(previous.result) }
  let targetId = input.targetId
  let beforeVersion = 0
  let afterVersion = 0
  if (input.action === 'save-tier') {
    const old = tiers.find(tier => tier.membershipTierId === targetId)
    if (targetId && !old) fail('NOT_FOUND', '会员等级不存在')
    if ((old?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '会员等级已更新，请刷新后重试')
    const value = copy(input.value)
    value.name = text(value.name, 60, '会员等级名称')
    if (!Number.isInteger(value.number) || value.number < 1 || tiers.some(tier => tier.membershipTierId !== targetId && tier.number === value.number)) fail('INVALID_INPUT', '会员阶层须为未使用的正整数')
    if (value.summary.length > 500 || value.coverUrl && !isMediaUrl(value.coverUrl)) fail('INVALID_INPUT', '简介最多500字，封面须为HTTPS地址')
    value.benefits = normalizeContent(value.benefits)
    beforeVersion = old?.version ?? 0; afterVersion = beforeVersion + 1
    targetId ||= `tier-${crypto.randomUUID()}`
    const tier: CmsTier = { ...value, membershipTierId: targetId, version: afterVersion }
    if (old) tiers[tiers.indexOf(old)] = tier; else tiers.push(tier)
  } else {
    const course = courses.find(item => item.draft.levelId === targetId)
    if (targetId && !course) fail('NOT_FOUND', '学习等级不存在')
    if ((course?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '课程已更新，请刷新后重新操作')
    beforeVersion = course?.version ?? 0; afterVersion = beforeVersion + 1
    if (input.action === 'save-course') {
      if (input.value.levelId !== targetId) fail('INVALID_INPUT', '学习等级ID不一致')
      const draft = validateCourse(input.value, false)
      targetId ||= `level-${crypto.randomUUID()}`
      draft.levelId = targetId
      if (course) { course.draft = draft; course.version = afterVersion }
      else courses.push({ draft, version: afterVersion, status: 'draft', publication: null })
    } else {
      if (!course) fail('NOT_FOUND', '课程不存在')
      const target = course!
      if (input.action === 'publish') {
        const draft = validateCourse(target.draft, true)
        target.publication = { course: copy(draft), revision: (target.publication?.revision ?? 0) + 1, draftVersion: afterVersion, publishedAt: new Date().toISOString(), tierName: tiers.find(tier => tier.membershipTierId === draft.membershipTierId)!.name }
        target.status = 'published'
      } else {
        if (target.status !== 'published') fail('INVALID_STATE', '只能下线已发布课程')
        target.status = 'offline'
      }
      target.version = afterVersion
    }
  }
  audit.push({ operationId: crypto.randomUUID(), requestId: input.idempotencyKey, targetId, action: input.action, operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(), occurredAt: new Date().toISOString(), beforeVersion, afterVersion })
  const result = mockCmsCatalog()
  operations.set(key, { payload, result: copy(result) })
  return result
}
