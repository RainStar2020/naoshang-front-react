import * as api from '../../api'
import { TrainingError, type TrainingBalanceQuery, type TrainingFeedbackQuery, type TrainingMutation, type TrainingMemberBalance, type TrainingFeedback } from '../../types/training'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, nullableStr, unwrapData } from './bridge'

export function mapTrainingBalance(raw: unknown): TrainingMemberBalance {
  const r = record(raw)
  const trainingTotal = num(r.trainingTotal ?? r.totalLessons)
  const trainingUsed = num(r.trainingUsed ?? r.usedLessons)
  const specialTotal = num(r.specialTotal)
  const specialUsed = num(r.specialUsed)
  return {
    memberId: str(r.memberId || r.id),
    accountId: str(r.accountId),
    contextId: str(r.contextId),
    displayId: str(r.displayId || r.userNo),
    memberName: str(r.memberName || r.name, '未命名学员'),
    storeId: nullableStr(r.storeId),
    storeName: nullableStr(r.storeName),
    trainingTotal,
    trainingUsed,
    trainingRemaining: num(r.trainingRemaining, Math.max(0, trainingTotal - trainingUsed)),
    specialTotal,
    specialUsed,
    specialRemaining: num(r.specialRemaining, Math.max(0, specialTotal - specialUsed)),
    version: num(r.version, 1),
    mockOnly: false,
  }
}

export function mapTrainingFeedback(raw: unknown): TrainingFeedback {
  const r = record(raw)
  const kindRaw = str(r.kind, 'training')
  const kind = (kindRaw === 'self-study' || kindRaw === 'camp' ? kindRaw : 'training') as TrainingFeedback['kind']
  const status = str(r.status, 'PUBLISHED').toUpperCase() === 'WITHDRAWN' ? 'WITHDRAWN' as const : 'PUBLISHED' as const
  return {
    feedbackId: str(r.feedbackId || r.id),
    memberId: str(r.memberId),
    memberName: str(r.memberName || r.name),
    displayId: str(r.displayId),
    storeId: nullableStr(r.storeId),
    storeName: nullableStr(r.storeName),
    kind,
    title: str(r.title),
    body: str(r.body || r.content),
    coachName: str(r.coachName || r.authorName),
    status,
    origin: str(r.origin) === 'hq-proxy' ? 'hq-proxy' : 'coach',
    attachments: arr(r.attachments).map((item) => {
      const row = record(item)
      const kind = str(row.kind, 'image')
      return {
        assetId: str(row.assetId || row.id),
        kind: (kind === 'file' || kind === 'video' ? kind : 'image') as never,
        name: str(row.name || row.fileName),
        sizeLabel: nullableStr(row.sizeLabel),
        previewUrl: nullableStr(row.previewUrl || row.url),
      }
    }),
    createdAt: str(r.createdAt),
    withdrawnAt: nullableStr(r.withdrawnAt),
    withdrawReason: nullableStr(r.withdrawReason),
    version: num(r.version, 1),
    mockOnly: false,
  }
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  return {
    stores: arr(r.stores).map((item) => {
      const row = record(item)
      return { storeId: str(row.storeId || row.id), name: str(row.name) }
    }),
    audit: arr(r.audit),
    mockOnly: false,
    ...r,
  }
}

export async function realTrainingCatalog() {
  try { return mapCatalog(await unwrapData(await api.getTrainingCatalog())) }
  catch (error) { return mapHqError(error, TrainingError) }
}

export async function realTrainingBalances(query: TrainingBalanceQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrainingBalances({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapTrainingBalance)
    const summary = record(page.summary)
    return {
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        members: num(summary.members, items.length),
        trainingRemaining: num(summary.trainingRemaining, items.reduce((s, i) => s + i.trainingRemaining, 0)),
        specialRemaining: num(summary.specialRemaining, items.reduce((s, i) => s + i.specialRemaining, 0)),
        lowBalance: num(summary.lowBalance, items.filter((i) => i.trainingRemaining + i.specialRemaining <= 2).length),
      },
    }
  } catch (error) { return mapHqError(error, TrainingError) }
}

export async function realTrainingFeedbackList(query: TrainingFeedbackQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrainingFeedback({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapTrainingFeedback)
    const summary = record(page.summary)
    return {
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        feedback: num(summary.feedback ?? summary.total, items.length),
        published: num(summary.published, items.filter((i) => i.status === 'PUBLISHED').length),
        withdrawn: num(summary.withdrawn, items.filter((i) => i.status === 'WITHDRAWN').length),
        hqProxy: num(summary.hqProxy, items.filter((i) => i.origin === 'hq-proxy').length),
      },
    }
  } catch (error) { return mapHqError(error, TrainingError) }
}

function mapConsume(raw: unknown, memberId: string) {
  const row = record(raw)
  return {
    recordId: str(row.recordId || row.consumeId || row.id),
    memberId: str(row.memberId || memberId),
    memberName: str(row.memberName || row.name),
    displayId: str(row.displayId),
    storeId: row.storeId == null || row.storeId === '' ? null : str(row.storeId),
    bucket: (str(row.bucket, 'training') === 'special' ? 'special' : 'training') as 'training' | 'special',
    quantity: num(row.quantity ?? row.lessons, 1),
    beforeRemaining: num(row.beforeRemaining),
    afterRemaining: num(row.afterRemaining),
    beforeUsed: num(row.beforeUsed),
    afterUsed: num(row.afterUsed),
    reason: str(row.reason),
    operatorId: str(row.operatorId),
    operatorName: str(row.operatorName || row.operator),
    requestId: str(row.requestId),
    occurredAt: str(row.occurredAt || row.createdAt),
    beforeVersion: num(row.beforeVersion),
    afterVersion: num(row.afterVersion ?? row.version),
  }
}

function mapAuditRow(raw: unknown, targetId: string) {
  const row = record(raw)
  return {
    operationId: str(row.operationId || row.id),
    requestId: str(row.requestId),
    action: str(row.action, 'proxy-feedback') as never,
    targetId: str(row.targetId || targetId),
    before: str(row.before),
    after: str(row.after),
    reason: str(row.reason),
    operatorId: str(row.operatorId),
    operatorName: str(row.operatorName || row.operator),
    occurredAt: str(row.occurredAt || row.createdAt),
    beforeVersion: num(row.beforeVersion),
    afterVersion: num(row.afterVersion ?? row.version),
  }
}

export async function realTrainingMemberDetail(memberId: string) {
  try {
    const raw = record(await unwrapData(await api.getTrainingMembersByMemberId({ memberId })))
    return {
      balance: mapTrainingBalance(raw.balance ?? raw),
      feedback: arr(raw.feedback).map(mapTrainingFeedback),
      consumes: arr(raw.consumes ?? raw.records).map((item) => mapConsume(item, memberId)),
      audit: arr(raw.audit).map((item) => mapAuditRow(item, memberId)),
    }
  } catch (error) { return mapHqError(error, TrainingError) }
}

export async function realTrainingFeedbackDetail(feedbackId: string) {
  try {
    const page = asPage(await unwrapData(await api.getTrainingFeedback({ keyword: feedbackId, page: 1, pageSize: 20 } as never)))
    const hit = page.items.find((i) => str(record(i).feedbackId || record(i).id) === feedbackId) || page.items[0]
    if (!hit) throw new TrainingError('NOT_FOUND', '反馈不存在')
    return mapTrainingFeedback(hit)
  } catch (error) { return mapHqError(error, TrainingError) }
}

export async function realTrainingMutate(input: TrainingMutation) {
  try {
    const actionMap: Record<string, string> = {
      'proxy-feedback': 'grant',
      'withdraw-feedback': 'reset',
      'consume-lessons': 'deduct',
    }
    const action = actionMap[input.action] || 'grant'
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    await unwrapData(await api.postTrainingMutate(body as never))
    const memberId = str((input as { memberId?: string }).memberId)
    if (input.action === 'consume-lessons' && memberId) {
      const detail = await realTrainingMemberDetail(memberId)
      const recordRow = detail.consumes[0] || mapConsume({ memberId, reason: input.reason }, memberId)
      return { action: 'consume-lessons' as const, balance: detail.balance, record: recordRow, mockOnly: false }
    }
    if (input.action === 'withdraw-feedback') {
      const feedbackId = str((input as { feedbackId?: string }).feedbackId)
      const feedback = feedbackId
        ? await realTrainingFeedbackDetail(feedbackId).catch(() => mapTrainingFeedback({ feedbackId, memberId, status: 'WITHDRAWN' }))
        : mapTrainingFeedback({ memberId, status: 'WITHDRAWN' })
      return { action: 'withdraw-feedback' as const, feedback, mockOnly: false }
    }
    const feedback = mapTrainingFeedback({ memberId, status: 'PUBLISHED', origin: 'hq-proxy' })
    return { action: 'proxy-feedback' as const, feedback, mockOnly: false }
  } catch (error) { return mapHqError(error, TrainingError) }
}
