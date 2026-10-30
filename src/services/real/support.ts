import * as api from '../../api'
import { SupportError, type SupportFeedbackQuery, type SupportMutation } from '../../types/support'
import { arr, asPage, bool, cast, mapHqError, mutationBody, nullableStr, num, record, str, unwrapData } from './bridge'

function mapRichContent(raw: unknown, bodyText: string) {
  const r = record(raw)
  const blocks = arr(r.blocks)
  if (blocks.length) {
    return {
      blocks: blocks.map((item, index) => {
        const row = record(item)
        return {
          id: str(row.id, `b${index + 1}`),
          type: str(row.type, 'paragraph') as never,
          text: str(row.text ?? row.content ?? (typeof item === 'string' ? item : '')),
          ...row,
        }
      }),
    }
  }
  return {
    blocks: bodyText
      ? [{ id: 'p1', type: 'paragraph' as const, text: bodyText }]
      : [],
  }
}

function mapAgreement(raw: unknown) {
  const r = record(raw)
  const typeRaw = str(r.type, 'user').toLowerCase()
  const type = (typeRaw.includes('privacy') ? 'privacy' : 'user') as 'user' | 'privacy'
  const statusRaw = str(r.status, 'DRAFT').toUpperCase()
  const status = (statusRaw === 'PUBLISHED' || statusRaw === 'OFFLINE' ? statusRaw : 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  const bodyText = str(r.bodyText || r.body || r.contentText)
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw
    : status === 'PUBLISHED'
      ? ['save-agreement', 'offline-agreement']
      : ['save-agreement', 'publish-agreement']) as never
  return {
    agreementId: str(r.agreementId || r.id),
    type,
    title: str(r.title, type === 'privacy' ? '隐私政策' : '用户协议'),
    docVersion: str(r.docVersion || r.versionLabel || r.docVer),
    bodyText,
    content: mapRichContent(r.content, bodyText),
    status,
    version: num(r.version, 1),
    publishedAt: nullableStr(r.publishedAt),
    updatedAt: str(r.updatedAt || r.modifiedAt || r.createdAt),
    mockOnly: false,
    allowedActions,
  }
}

function mapSupportConfig(raw: unknown) {
  const r = record(raw)
  return {
    phone: str(r.phone || r.hotline || r.contactPhone),
    description: str(r.description || r.desc || r.tip),
    feedbackMaxImages: num(r.feedbackMaxImages ?? r.maxImages, 3),
    fullCustomerServicePending: true as const,
    version: num(r.version, 1),
    updatedAt: str(r.updatedAt || r.modifiedAt),
    mockOnly: false,
  }
}

function mapFeedback(raw: unknown) {
  const r = record(raw)
  const statusRaw = str(r.status, 'OPEN').toUpperCase()
  const status = (statusRaw === 'HANDLED' || statusRaw === 'CLOSED' || statusRaw === 'DONE' ? 'HANDLED' : 'OPEN') as 'OPEN' | 'HANDLED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item) => item === 'mark-feedback-handled')
    : status === 'OPEN' ? ['mark-feedback-handled'] : []) as ('mark-feedback-handled')[]
  return {
    feedbackId: str(r.feedbackId || r.ticketId || r.id),
    accountId: str(r.accountId || r.userId),
    accountName: str(r.accountName || r.userName || r.nickname || r.name),
    phone: str(r.phone || r.mobile),
    content: str(r.content || r.body || r.message),
    imageCount: num(r.imageCount ?? arr(r.images).length),
    status,
    createdAt: str(r.createdAt),
    handledAt: nullableStr(r.handledAt),
    handleNote: nullableStr(r.handleNote || r.note),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  const agreements = arr(r.agreements).map(mapAgreement)
  const feedbackSummary = record(r.feedbackSummary)
  return {
    agreements,
    supportConfig: mapSupportConfig(r.supportConfig ?? r.config ?? r.contact),
    feedbackSummary: {
      total: num(feedbackSummary.total),
      open: num(feedbackSummary.open),
      handled: num(feedbackSummary.handled),
    },
    fullCsGapNote: str(r.fullCsGapNote, '完整在线客服/工单流转尚未实现，本页仅协议发布与反馈查阅预留。'),
    agreementNote: str(r.agreementNote, '协议发布后供小程序阅读；草稿不影响线上版本。'),
    mockOnly: false,
  }
}

export async function realSupportCatalog() {
  try { return cast(mapCatalog(await unwrapData(await api.getSupportCatalog()))) }
  catch (error) { return mapHqError(error, SupportError) }
}

export async function realSupportFeedbackList(query: SupportFeedbackQuery) {
  try {
    const page = asPage(await unwrapData(await api.getSupportTickets({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapFeedback),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, SupportError) }
}

export async function realSupportMutate(input: SupportMutation) {
  try {
    const action = str((input as { action?: string }).action, 'reply')
    const ticketId = str((input as { ticketId?: string }).ticketId || (input as { feedbackId?: string }).feedbackId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    if (!ticketId) {
      await unwrapData(await api.postSupportTickets(body as never))
      return cast({ action: action as never, mockOnly: false, message: '已提交', catalog: await realSupportCatalog() })
    }
    await unwrapData(await api.postSupportTicketsByTicketIdMutate({ ticketId }, body as never))
    return cast({ action: action as never, mockOnly: false, message: '已提交', catalog: await realSupportCatalog() })
  } catch (error) { return mapHqError(error, SupportError) }
}
