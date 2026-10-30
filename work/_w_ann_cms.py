from pathlib import Path
ROOT = Path(r"E:\project\react-web\naoshang-front-react\src\services\real")

ROOT.joinpath("announcements.ts").write_text(r"""import * as api from '../../api'
import { AnnouncementError, type AnnouncementCatalog, type AnnouncementDraft, type AnnouncementMutation, type AnnouncementStats, type ManagedAnnouncement } from '../../types/announcements'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unsupported, unwrapData } from './bridge'

const emptyRich = { version: 1 as const, format: 'nodes' as const, nodes: [] as never[] }

function mapDraft(raw: unknown): AnnouncementDraft {
  const r = record(raw)
  const content = record(r.content)
  return {
    id: str(r.id || r.announcementId || r.draftId),
    title: str(r.title),
    summary: str(r.summary),
    content: {
      version: 1,
      format: 'nodes',
      nodes: arr(content.nodes ?? r.nodes) as never[],
    },
    coverUrl: str(r.coverUrl || r.cover),
    pinned: bool(r.pinned),
    audience: stringList(r.audience || r.roles) as AnnouncementDraft['audience'],
    publishAt: nullableStr(r.publishAt || r.scheduledAt),
  }
}

export function mapManagedAnnouncement(raw: unknown): ManagedAnnouncement {
  const r = record(raw)
  const draft = mapDraft(r.draft ?? r)
  const statusRaw = str(r.status, 'draft').toLowerCase()
  const status = (['draft', 'scheduled', 'published', 'offline'].includes(statusRaw) ? statusRaw : 'draft') as ManagedAnnouncement['status']
  const publicationRaw = r.publication
  const publication = publicationRaw == null ? null : (() => {
    const p = record(publicationRaw)
    return {
      revision: num(p.revision, 1),
      publishedAt: str(p.publishedAt || p.createdAt),
      value: mapDraft(p.value ?? p.draft ?? p),
    }
  })()
  return { draft, version: num(r.version, 1), status, publication }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    id: str(r.id || r.operationId),
    announcementId: str(r.announcementId || r.targetId),
    action: str(r.action, 'save') as never,
    reason: str(r.reason),
    operatorName: str(r.operatorName || r.operator),
    requestId: str(r.requestId),
    occurredAt: str(r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version),
  }
}

export function mapAnnouncementCatalog(raw: unknown, listItems: unknown[] = []): AnnouncementCatalog {
  const r = record(raw)
  const itemsSrc = arr(r.items).length ? arr(r.items) : listItems
  return {
    items: itemsSrc.map(mapManagedAnnouncement),
    audit: arr(r.audit).map(mapAudit),
  }
}

export function mapAnnouncementStats(raw: unknown): AnnouncementStats {
  const r = record(raw)
  return {
    targetCount: num(r.targetCount ?? r.total),
    readCount: num(r.readCount),
    unreadCount: num(r.unreadCount),
    available: bool(r.available, true),
    recipients: arr(r.recipients).map((item) => {
      const row = record(item)
      return {
        accountId: str(row.accountId || row.id),
        nickname: str(row.nickname || row.name),
        phone: str(row.phone || row.mobile),
        roles: stringList(row.roles || row.audience) as never[],
        firstReadAt: nullableStr(row.firstReadAt),
      }
    }),
  }
}

export async function realAnnouncementCatalog() {
  try {
    const [catalog, list] = await Promise.all([
      unwrapData(await api.getAnnouncementsCatalog()),
      unwrapData(await api.getAnnouncements({ page: 1, pageSize: 100 })),
    ])
    return { ...mapAnnouncementCatalog(catalog, asPage(list).items), mockOnly: false }
  } catch (error) { return mapHqError(error, AnnouncementError) }
}

export async function realAnnouncementStats(id: string) {
  try {
    return { ...mapAnnouncementStats(await unwrapData(await api.getAnnouncementsByAnnouncementId({ announcementId: id }))), mockOnly: false }
  } catch (error) { return mapHqError(error, AnnouncementError) }
}

export async function realAnnouncementMutate(input: AnnouncementMutation) {
  try {
    const actionMap: Record<string, string> = { save: 'update', publish: 'publish', offline: 'unpublish' }
    const action = actionMap[input.action] || input.action
    const announcementId = str((input as { announcementId?: string }).announcementId || (input as { id?: string }).id || record((input as { value?: unknown }).value).id)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    if (!announcementId) {
      await unwrapData(await api.postAnnouncementsMutate(body as never))
    } else {
      await unwrapData(await api.postAnnouncementsByAnnouncementIdMutate({ announcementId }, body as never))
    }
    return realAnnouncementCatalog()
  } catch (error) { return mapHqError(error, AnnouncementError) }
}

export async function realAnnouncementUpload(_file: File) {
  return unsupported(AnnouncementError, 'upload', '公告素材上传未在 announcements API 暴露独立 upload')
}

export function realAnnouncementAssetUrl(url: string) { return url }

void emptyRich
""", encoding="utf-8")

ROOT.joinpath("cms.ts").write_text(r"""import * as api from '../../api'
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
""", encoding="utf-8")
print("announcements+cms ok")