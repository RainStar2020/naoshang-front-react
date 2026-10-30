import type { HqAccount } from '../../types/auth'
import { announcementRoles, AnnouncementError, type AnnouncementCatalog, type AnnouncementDraft, type AnnouncementMutation, type AnnouncementRead, type AnnouncementRole, type ManagedAnnouncement } from '../../types/announcements'
import { mockListUsers, mockUserDetail } from './users'
import { mockMembers } from './members'
import { hasContent, isMediaUrl, normalizeContent } from '../../utils/richContent'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: AnnouncementError['code'], text: string): never => { throw new AnnouncementError(code, text) }
const initial: AnnouncementDraft = { id: 'demo-announcement-1', title: '学习服务与公告说明', summary: '欢迎查看总部发布的学习服务公告。', content: normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'p', children: [{ type: 'text', text: '请关注学习安排，具体服务请联系所属门店。' }] }] }), coverUrl: '', pinned: true, audience: [], publishAt: null }
const items: ManagedAnnouncement[] = [{ draft: copy(initial), version: 1, status: 'published', publication: { revision: 1, publishedAt: '2026-10-01T09:00:00+08:00', value: copy(initial) } }]
const reads: AnnouncementRead[] = [{ accountId: 'account-1', announcementId: initial.id, firstReadAt: '2026-10-02T09:00:00+08:00' }]
const audit: AnnouncementCatalog['audit'] = []
const operations = new Map<string, { payload: string; result: AnnouncementCatalog }>()
const find = (id: string) => items.find(row => row.draft.id === id) ?? fail('NOT_FOUND', '公告不存在')
export function announcementStatus(row: ManagedAnnouncement): ManagedAnnouncement['status'] { return row.status === 'scheduled' && Date.parse(row.publication!.publishedAt) <= Date.now() ? 'published' : row.status }
function identities(accountId: string): AnnouncementRole[] {
  const account = mockUserDetail(accountId).account
  const roles: AnnouncementRole[] = account.businessContexts.map(context => context.module)
  if (mockMembers({ page: 1, pageSize: 10, accountId }).total > 0) roles.push('parent')
  return [...new Set(roles)]
}
function target(accountId: string, audience: AnnouncementRole[]) { const account = mockUserDetail(accountId).account; return !account.frozen && (!audience.length || identities(accountId).some(role => audience.includes(role))) }
function visible(accountId: string, id: string) {
  const row = find(id)
  if (announcementStatus(row) !== 'published' || !row.publication || !target(accountId, row.publication.value.audience)) fail('FORBIDDEN', '公告未到发布时间、已下线或不属于此账号范围')
  return row.publication!
}
export function mockAnnouncementCatalog(): AnnouncementCatalog { return copy({ items: items.map(row => ({ ...row, status: announcementStatus(row) })), audit: [...audit].reverse() }) }
function clean(value: AnnouncementDraft) {
  const draft = copy(value)
  if (!draft.title.trim() || draft.title.length > 80 || draft.summary.length > 300 || typeof draft.pinned !== 'boolean' || !Array.isArray(draft.audience) || draft.audience.some(role => !announcementRoles.includes(role))) fail('INVALID_INPUT', '标题、摘要、置顶或目标身份无效')
  if (draft.coverUrl && !isMediaUrl(draft.coverUrl)) fail('INVALID_INPUT', '封面须为HTTPS地址')
  if (draft.publishAt !== null && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(draft.publishAt) || !Number.isFinite(Date.parse(draft.publishAt)))) fail('INVALID_INPUT', '定时时间需包含时区')
  draft.title = draft.title.trim(); draft.audience = [...new Set(draft.audience)]; draft.content = normalizeContent(draft.content); return draft
}
export function mockAnnouncementMutate(input: AnnouncementMutation, operator: HqAccount) {
  if (!['save', 'publish', 'offline'].includes(input.action) || !input.reason.trim() || input.reason.trim().length > 200 || !input.idempotencyKey) fail('INVALID_INPUT', '操作类型、原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), old = operations.get(key)
  if (old) { if (old.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(old.result) }
  const row = input.id ? find(input.id) : null
  if ((row?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '公告已更新，请刷新')
  const version = input.version + 1; let id = input.id
  if (input.action === 'save') {
    if (input.value.id !== input.id) fail('INVALID_INPUT', '公告ID不一致')
    const draft = clean(input.value); id ||= crypto.randomUUID(); draft.id = id
    if (row) { row.draft = draft; row.version = version } else items.push({ draft, version, status: 'draft', publication: null })
  } else {
    if (!row) fail('NOT_FOUND', '请先保存公告')
    const current = row!
    if (input.action === 'publish') {
      const value = clean(current.draft)
      if (!hasContent(value.content)) fail('INVALID_INPUT', '发布需要公告正文')
      if (value.publishAt && Date.parse(value.publishAt) <= Date.now()) fail('INVALID_INPUT', '定时发布必须选择未来时间；立即发布请清空定时')
      current.publication = { revision: (current.publication?.revision ?? 0) + 1, publishedAt: value.publishAt ?? new Date().toISOString(), value }
      current.status = value.publishAt ? 'scheduled' : 'published'
    } else { if (!['published', 'scheduled'].includes(announcementStatus(current))) fail('INVALID_STATE', '仅已发布或待定时公告可以下线'); current.status = 'offline' }
    current.version = version
  }
  audit.push({ id: crypto.randomUUID(), announcementId: id, action: input.action, reason: input.reason.trim(), operatorName: operator.nickname, requestId: input.idempotencyKey, occurredAt: new Date().toISOString(), beforeVersion: input.version, afterVersion: version })
  const result = mockAnnouncementCatalog(); operations.set(key, { payload, result: copy(result) }); return result
}
export function mockAnnouncementStats(id: string) {
  const row = find(id), available = announcementStatus(row) === 'published'
  if (!row.publication) return { targetCount: 0, readCount: 0, unreadCount: 0, available: false, recipients: [] }
  const recipients = mockListUsers({ page: 1, pageSize: 50 }).items.filter(account => target(account.accountId, row.publication!.value.audience)).map(account => ({ accountId: account.accountId, nickname: account.nickname, phone: account.phone, roles: identities(account.accountId), firstReadAt: reads.find(read => read.announcementId === id && read.accountId === account.accountId)?.firstReadAt ?? null }))
  const readCount = recipients.filter(row => row.firstReadAt).length
  return copy({ targetCount: recipients.length, readCount, unreadCount: recipients.length - readCount, available, recipients })
}
/** 消费端契约验收入口：正式API从登录会话取accountId，禁止信任客户端传入身份。 */
export function readMockAnnouncement(accountId: string, id: string) { const publication = visible(accountId, id); return copy({ ...publication.value, revision: publication.revision, publishedAt: publication.publishedAt }) }
export function listMockAnnouncements(accountId: string, page = 1, pageSize = 10) {
  mockUserDetail(accountId)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) fail('INVALID_INPUT', '分页参数无效')
  const all = items.filter(row => announcementStatus(row) === 'published' && row.publication && target(accountId, row.publication.value.audience)).sort((a, b) => Number(b.publication!.value.pinned) - Number(a.publication!.value.pinned) || Date.parse(b.publication!.publishedAt) - Date.parse(a.publication!.publishedAt) || a.draft.id.localeCompare(b.draft.id))
  return { total: all.length, items: all.slice((page - 1) * pageSize, page * pageSize).map(row => { const publication = row.publication!; return { id: row.draft.id, title: publication.value.title, summary: publication.value.summary, pinned: publication.value.pinned, publishedAt: publication.publishedAt, read: reads.some(read => read.accountId === accountId && read.announcementId === row.draft.id) } }) }
}
export function markMockAnnouncementRead(accountId: string, id: string) {
  visible(accountId, id)
  const old = reads.find(row => row.accountId === accountId && row.announcementId === id)
  if (old) return copy(old)
  const result = { accountId, announcementId: id, firstReadAt: new Date().toISOString() }; reads.push(result); return copy(result)
}

