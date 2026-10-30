import * as api from '../../api'
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
