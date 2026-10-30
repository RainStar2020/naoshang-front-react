import * as api from '../../api'
import { CmsError, type CmsCatalog, type CmsCourse, type CmsMutation, type CmsTier } from '../../types/cms'
import { arr, bool, mapHqError, mutationBody, num, record, str, stringList, unsupported, unwrapData } from './bridge'

const emptyRich = { version: 1 as const, format: 'nodes' as const, nodes: [] as never[] }

function mapRich(raw: unknown) {
  const r = record(raw)
  return { version: 1 as const, format: 'nodes' as const, nodes: arr(r.nodes) as never[] }
}

function mapTier(raw: unknown): CmsTier {
  const r = record(raw)
  return {
    membershipTierId: str(r.membershipTierId || r.tierId || r.id),
    number: num(r.number),
    name: str(r.name || r.title, '未命名等级'),
    summary: str(r.summary),
    coverUrl: str(r.coverUrl || r.cover),
    benefits: mapRich(r.benefits ?? emptyRich),
    version: num(r.version, 1),
  }
}

function mapChapter(raw: unknown, index: number) {
  const r = record(raw)
  const type = str(r.type, 'article') === 'video' ? 'video' as const : 'article' as const
  return {
    id: str(r.id, `chapter-${index}`),
    title: str(r.title),
    type,
    order: num(r.order, index + 1),
    accessibility: 'membership-required' as const,
    content: mapRich(r.content ?? emptyRich),
    videoUrl: str(r.videoUrl),
    posterUrl: str(r.posterUrl),
  }
}

function mapCourseDraft(raw: unknown) {
  const r = record(raw)
  return {
    levelId: str(r.levelId || r.courseId || r.id),
    membershipTierId: str(r.membershipTierId || r.tierId),
    number: num(r.number),
    name: str(r.name || r.title, '未命名课程'),
    summary: str(r.summary),
    covers: stringList(r.covers ?? r.coverUrls ?? (r.coverUrl ? [r.coverUrl] : [])),
    content: mapRich(r.content ?? emptyRich),
    chapters: arr(r.chapters).map(mapChapter),
  }
}

export function mapCmsCourse(raw: unknown): CmsCourse {
  const r = record(raw)
  const draft = mapCourseDraft(r.draft ?? r)
  const statusRaw = str(r.status, 'draft').toLowerCase()
  const status = (['draft', 'published', 'offline'].includes(statusRaw) ? statusRaw : 'draft') as CmsCourse['status']
  const publication = r.publication == null ? null : (() => {
    const p = record(r.publication)
    return {
      revision: num(p.revision, 1),
      publishedAt: str(p.publishedAt),
      draftVersion: num(p.draftVersion ?? p.version, 1),
      tierName: str(p.tierName),
      course: mapCourseDraft(p.course ?? p.draft ?? p),
    }
  })()
  return { draft, version: num(r.version, 1), status, publication }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    targetId: str(r.targetId || r.courseId || r.levelId),
    action: str(r.action, 'save-course') as never,
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    reason: str(r.reason),
    occurredAt: str(r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version),
  }
}

export function mapCmsCatalog(raw: unknown): CmsCatalog {
  const r = record(raw)
  const tiers = arr(r.tiers ?? r.membershipTiers).map(mapTier)
  const courses = arr(r.courses ?? r.levels ?? r.items).map(mapCmsCourse)
  // course-catalog entitlements fallback: map flat entitlements into empty courses with safe arrays
  if (!courses.length && arr(r.entitlements).length) {
    for (const item of arr(r.entitlements)) {
      const row = record(item)
      courses.push(mapCmsCourse({
        draft: {
          levelId: str(row.entitlementId || row.id),
          membershipTierId: str(row.membershipTierId || row.tierId),
          number: num(row.number),
          name: str(row.name || row.title || row.productName, '权益条目'),
          summary: str(row.summary || row.description),
          covers: [],
          content: emptyRich,
          chapters: [],
        },
        version: num(row.version, 1),
        status: 'draft',
        publication: null,
      }))
    }
  }
  return {
    tiers,
    courses,
    audit: arr(r.audit).map(mapAudit),
  }
}

export async function realCmsCatalog() {
  try {
    const data = await unwrapData(await api.getCourseCatalog())
    return { ...mapCmsCatalog(data), mockOnly: false, source: 'course-catalog' }
  } catch (error) { return mapHqError(error, CmsError) }
}

export async function realCmsMutate(input: CmsMutation) {
  try {
    if (input.action === 'save-tier' || input.action === 'save-course') {
      return unsupported(CmsError, input.action, '课程内容 CMS 写入未在 HQ course API 暴露（仅有 entitlements）')
    }
    const action = input.action === 'publish' ? 'grant' : input.action === 'offline' ? 'revoke' : input.action
    const entitlementId = str((input as { entitlementId?: string }).entitlementId || (input as { courseId?: string }).courseId || (input as { levelId?: string }).levelId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    if (!entitlementId) unsupported(CmsError, input.action, '缺少 entitlementId，无法调用 course entitlements mutate')
    await unwrapData(await api.postCourseEntitlementsByEntitlementIdMutate({ entitlementId }, body as never))
    return realCmsCatalog()
  } catch (error) { return mapHqError(error, CmsError) }
}

export async function realCmsUpload(_file: File) {
  return unsupported(CmsError, 'upload', '课程 CMS 上传未在 course API 暴露；可改用 columns/materials assets')
}

export function realCmsAssetUrl(url: string) { return url }

void bool
