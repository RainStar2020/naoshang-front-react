import type { HqAccount } from '../../types/auth'
import { ColumnError, type ColumnAccountRecord, type ColumnAudit, type ColumnCatalog, type ColumnDraft, type ColumnGrant, type ColumnMutation, type ColumnOrder, type ColumnProgress, type ColumnProgressWrite, type ManagedColumn } from '../../types/columns'
import { emptyContent, hasContent, isMediaUrl, normalizeContent } from '../../utils/richContent'
import { mockListUsers, mockUserDetail } from './users'
import { mockColumnProductOptions } from './products'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: ColumnError['code'], message: string): never => { throw new ColumnError(code, message) }
const paragraph = (text: string) => normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'p', children: [{ type: 'text', text }] }] })
const initial: ColumnDraft = { columnId: 'demo-column-memory', productId: 'product-column', title: '《记忆基础》专栏', summary: '专栏介绍与章节由总部发布，购买后联系门店取码并主动激活。', coverUrl: 'https://mock-assets.invalid/demo-cover', content: paragraph('专栏内容演示。授权属于账号，独立于孩子学习等级。'), chapters: [
  { id: 'column-memory-article', title: '图文：联想记忆入门', type: 'article', order: 1, accessibility: 'column-required', content: paragraph('通过观察和联想练习记忆。'), videoUrl: '', posterUrl: '' },
  { id: 'column-memory-video', title: '视频：观察与回忆练习', type: 'video', order: 2, accessibility: 'column-required', content: emptyContent(), videoUrl: 'https://mock-assets.invalid/demo-column-video', posterUrl: 'https://mock-assets.invalid/demo-cover' },
] }
const columns: ManagedColumn[] = [{ draft: copy(initial), version: 1, status: 'published', publication: { revision: 1, publishedAt: '2026-10-01T09:00:00+08:00', draftVersion: 1, column: copy(initial) } }]
const orders: ColumnOrder[] = [1, 2, 3, 4].map(n => ({ orderId: `column-demo-order-${n}`, orderNo: `DEMO-COLUMN-2026100${n}`, accountId: n < 3 ? 'account-1' : `account-${n - 1}`, columnId: initial.columnId, productId: initial.productId, paymentStatus: n === 4 ? 'PENDING_PAYMENT' : 'PAID', fulfillmentStatus: n < 3 ? 'DELIVERED' : 'PENDING_DELIVERY', payableAmount: 7900, createdAt: `2026-10-0${n}T09:00:00+08:00`, mockOnly: true }))
const grants: ColumnGrant[] = [{ accountId: 'account-1', columnId: initial.columnId, unlocked: true, sourceCodeId: null, activatedAt: '2026-10-02T09:00:00+08:00', expiresAt: null, version: 1 }]
const progress: ColumnProgress[] = [{ accountId: 'account-1', columnId: initial.columnId, chapterId: 'column-memory-video', positionSeconds: 45, durationSeconds: 100, percent: 45, completed: false, lastStudiedAt: '2026-10-03T09:00:00+08:00', version: 1 }]
const audit: ColumnAudit[] = []
const operations = new Map<string, { payload: string; result: ColumnCatalog }>()
const purchases = new Map<string, { payload: string; result: ColumnOrder }>()
const writes = new Map<string, { payload: string; result: ColumnProgress }>()
const find = (id: string) => columns.find(column => column.draft.columnId === id) ?? fail('NOT_FOUND', '专栏不存在')
const published = (id: string) => { const column = find(id); if (column.status !== 'published' || !column.publication) fail('INVALID_STATE', '专栏尚未发布或已经下线'); return column.publication! }
export function mockColumnCatalog(): ColumnCatalog { return copy({ columns, products: mockColumnProductOptions(), audit: [...audit].reverse(), accounts: mockListUsers({ page: 1, pageSize: 50 }).items.map(account => ({ accountId: account.accountId, nickname: account.nickname, phone: account.phone })) }) }
export function mockColumnTargets() { return columns.filter(column => column.status === 'published').map(column => ({ columnId: column.draft.columnId, title: column.publication!.column.title })) }
export function mockColumnRecords(columnId: string, accountId?: string) {
  find(columnId)
  if (accountId) mockUserDetail(accountId)
  const ids = new Set([...orders.filter(order => order.columnId === columnId).map(order => order.accountId), ...grants.filter(grant => grant.columnId === columnId).map(grant => grant.accountId), ...progress.filter(row => row.columnId === columnId).map(row => row.accountId)])
  if (accountId) ids.add(accountId)
  const accounts: ColumnAccountRecord[] = [...ids].filter(id => !accountId || id === accountId).map(id => {
    const parent = mockUserDetail(id).account
    return { accountId: id, nickname: parent.nickname, phone: parent.phone, purchaseCount: orders.filter(order => order.accountId === id && order.columnId === columnId && order.paymentStatus === 'PAID').length, pendingPurchaseCount: orders.filter(order => order.accountId === id && order.columnId === columnId && order.paymentStatus !== 'PAID').length, grant: grants.find(grant => grant.accountId === id && grant.columnId === columnId) ?? null, progress: progress.filter(row => row.accountId === id && row.columnId === columnId) }
  })
  return copy({ accounts, orders: orders.filter(order => order.columnId === columnId && (!accountId || order.accountId === accountId)) })
}
function clean(value: ColumnDraft, publishing: boolean): ColumnDraft {
  const draft = copy(value)
  if (!draft.title.trim() || draft.title.trim().length > 60 || draft.summary.length > 500 || !mockColumnProductOptions().some(product => product.productId === draft.productId)) fail('INVALID_INPUT', '请填写有效专栏名称、简介与关联专栏商品')
  draft.title = draft.title.trim()
  if (columns.some(column => column.draft.columnId !== draft.columnId && column.draft.productId === draft.productId)) fail('INVALID_INPUT', '该商品已经关联其他专栏')
  if (draft.coverUrl && !isMediaUrl(draft.coverUrl)) fail('INVALID_INPUT', '专栏封面必须为HTTPS地址')
  draft.content = normalizeContent(draft.content)
  const ids = new Set<string>()
  if (draft.chapters.length > 200) fail('INVALID_INPUT', 'Mock专栏最多200个章节')
  draft.chapters = draft.chapters.map((chapter, index) => {
    if (!chapter.id || ids.has(chapter.id) || !['article', 'video'].includes(chapter.type) || chapter.title.length > 80) fail('INVALID_INPUT', '章节ID重复、类型或标题无效')
    ids.add(chapter.id)
    const content = normalizeContent(chapter.content)
    if (chapter.videoUrl && !isMediaUrl(chapter.videoUrl) || chapter.posterUrl && !isMediaUrl(chapter.posterUrl)) fail('INVALID_INPUT', '视频与视频封面须为HTTPS地址')
    if (publishing && (!chapter.title.trim() || (chapter.type === 'article' ? !hasContent(content) : !isMediaUrl(chapter.videoUrl) || !isMediaUrl(chapter.posterUrl)))) fail('INVALID_INPUT', '发布需要章节标题、图文正文或视频及封面')
    return { ...chapter, order: index + 1, accessibility: 'column-required' as const, content, ...(chapter.type === 'article' ? { videoUrl: '', posterUrl: '' } : {}) }
  })
  if (publishing && (!draft.summary.trim() || !isMediaUrl(draft.coverUrl) || !hasContent(draft.content) || !draft.chapters.length)) fail('INVALID_INPUT', '发布需要简介、封面、介绍正文与至少一个章节')
  return draft
}
export function mockColumnMutation(input: ColumnMutation, operator: HqAccount): ColumnCatalog {
  if (!input.reason.trim() || input.reason.trim().length > 200 || !input.idempotencyKey || !['save', 'publish', 'offline'].includes(input.action)) fail('INVALID_INPUT', '请提供有效操作、请求号与1–200字原因')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数不一致'); return copy(previous.result) }
  const existing = input.columnId ? find(input.columnId) : null
  if ((existing?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '专栏已更新，请刷新后重新操作')
  const version = (existing?.version ?? 0) + 1
  let columnId = input.columnId
  if (input.action === 'save') {
    if (input.value.columnId !== input.columnId) fail('INVALID_INPUT', '专栏ID不一致')
    if (existing?.publication && input.value.productId !== existing.publication.column.productId) fail('INVALID_INPUT', '发布后的商品关联不可直接改绑，避免影响历史订单和授权')
    const draft = clean(input.value, false)
    columnId ||= `column-${crypto.randomUUID()}`; draft.columnId = columnId
    if (existing) { existing.draft = draft; existing.version = version } else columns.push({ draft, version, status: 'draft', publication: null })
  } else {
    if (!existing) fail('NOT_FOUND', '请先保存专栏草稿')
    const current = existing!
    if (input.action === 'publish') { const draft = clean(current.draft, true); current.publication = { column: copy(draft), revision: (current.publication?.revision ?? 0) + 1, draftVersion: version, publishedAt: new Date().toISOString() }; current.status = 'published' }
    else { if (current.status !== 'published') fail('INVALID_STATE', '只能下线已发布专栏'); current.status = 'offline' }
    current.version = version
  }
  audit.push({ operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action: input.action, columnId, operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(), beforeVersion: input.version, afterVersion: version, occurredAt: new Date().toISOString() })
  const result = mockColumnCatalog(); operations.set(key, { payload, result: copy(result) }); return result
}

/** 以下为账号消费端Mock验收函数，不提供总部代购买/强制激活/进度修改界面。 */
export function recordMockColumnPurchase(accountId: string, columnId: string, idempotencyKey: string) {
  mockUserDetail(accountId); const snapshot = published(columnId)
  if (!idempotencyKey) fail('INVALID_INPUT', '缺少演示购买请求号')
  const key = `${accountId}:${idempotencyKey}`, payload = JSON.stringify([accountId, columnId]), previous = purchases.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '演示购买请求号不能改变专栏'); return copy(previous.result) }
  const order: ColumnOrder = { orderId: crypto.randomUUID(), orderNo: `DEMO-COLUMN-${crypto.randomUUID()}`, accountId, columnId, productId: snapshot.column.productId, paymentStatus: 'PAID', fulfillmentStatus: 'PENDING_DELIVERY', payableAmount: 7900, createdAt: new Date().toISOString(), mockOnly: true }
  orders.push(order); purchases.set(key, { payload, result: copy(order) }); return copy(order)
}
export function prepareMockColumnActivation(accountId: string, columnId: string) {
  mockUserDetail(accountId); const snapshot = published(columnId)
  if (!orders.some(order => order.accountId === accountId && order.columnId === columnId && order.paymentStatus === 'PAID')) fail('PURCHASE_REQUIRED', '此账号尚未购买并付款该专栏，不能激活')
  if (grants.some(grant => grant.accountId === accountId && grant.columnId === columnId)) fail('ALREADY_UNLOCKED', '该账号已开通此专栏，重复购买不消耗新码、不清空进度；再次激活/转赠规则待确认')
  return { accountId, columnId, revision: snapshot.revision, productId: snapshot.column.productId, title: snapshot.column.title }
}
export function activateMockColumnCode(input: { accountId: string; columnId: string; revision: number; codeId: string }) {
  const check = prepareMockColumnActivation(input.accountId, input.columnId)
  if (check.revision !== input.revision) fail('VERSION_CONFLICT', '专栏发布版本已变化，请重新预览')
  const grant: ColumnGrant = { accountId: input.accountId, columnId: input.columnId, unlocked: true, sourceCodeId: input.codeId, activatedAt: new Date().toISOString(), expiresAt: null, version: 1 }
  grants.push(grant); return copy(grant)
}
export function readMockColumn(accountId: string, columnId: string) {
  const snapshot = published(columnId)
  if (!grants.some(grant => grant.accountId === accountId && grant.columnId === columnId)) fail('FORBIDDEN', '此账号未激活专栏，不能读取正文或提交进度')
  return copy(snapshot)
}
export function writeMockColumnProgress(input: ColumnProgressWrite): ColumnProgress {
  const snapshot = readMockColumn(input.accountId, input.columnId)
  const chapter = snapshot.column.chapters.find(chapter => chapter.id === input.chapterId) ?? fail('NOT_FOUND', '章节未发布或已移除')
  if (!input.idempotencyKey) fail('INVALID_INPUT', '缺少进度请求号')
  const key = `${input.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = writes.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '进度请求号不能用于不同内容'); return copy(previous.result) }
  const old = progress.find(row => row.accountId === input.accountId && row.columnId === input.columnId && row.chapterId === input.chapterId)
  if ((old?.version ?? 0) !== input.version) fail('VERSION_CONFLICT', '学习进度已更新，请重新读取')
  if (![input.positionSeconds, input.durationSeconds].every(Number.isFinite) || input.positionSeconds < 0 || input.durationSeconds < 0 || input.positionSeconds > input.durationSeconds || typeof input.completed !== 'boolean' || typeof input.ended !== 'boolean') fail('INVALID_INPUT', '学习进度数据无效')
  if (chapter.type === 'video' && (input.durationSeconds <= 0 || input.completed && !old?.completed && (!input.ended || input.positionSeconds < input.durationSeconds))) fail('INVALID_INPUT', '不能将未结束的视频伪报为已完成')
  if (chapter.type === 'article' && (input.positionSeconds !== 0 || input.durationSeconds !== 0)) fail('INVALID_INPUT', '图文章节不使用视频时长')
  const completed = !!old?.completed || (chapter.type === 'article' ? input.completed : input.ended && input.positionSeconds >= input.durationSeconds)
  const result: ColumnProgress = { accountId: input.accountId, columnId: input.columnId, chapterId: input.chapterId, positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds, completed, percent: completed ? 100 : chapter.type === 'video' ? Math.round(input.positionSeconds / input.durationSeconds * 100) : 0, lastStudiedAt: new Date().toISOString(), version: (old?.version ?? 0) + 1 }
  if (old) progress[progress.indexOf(old)] = result; else progress.push(result)
  writes.set(key, { payload, result: copy(result) }); return copy(result)
}

