/** HQ-20 Mock：训练反馈代写/撤回与课时逐次核销。余额字段对齐小程序 trainingTotal/Used、specialTotal/Used；禁止负库存与超余量。 */
import type { HqAccount } from '../../types/auth'
import {
  TrainingError,
  type FeedbackKind,
  type LessonBucket,
  type LessonConsumeRecord,
  type TrainingAudit,
  type TrainingBalanceList,
  type TrainingBalanceQuery,
  type TrainingCatalog,
  type TrainingFeedback,
  type TrainingFeedbackList,
  type TrainingFeedbackQuery,
  type TrainingMemberBalance,
  type TrainingMemberDetail,
  type TrainingMutation,
  type TrainingMutationResult,
} from '../../types/training'
import { mockMemberDetail, mockMembers } from './members'

const clone = <T,>(value: T): T => structuredClone(value)
const fail = (code: TrainingError['code'], message: string): never => { throw new TrainingError(code, message) }
const nowIso = () => new Date().toISOString()

const kindLabels: Record<FeedbackKind, string> = {
  training: '陪练反馈',
  'self-study': '智习反馈',
  camp: '集训反馈',
}
const bucketLabels: Record<LessonBucket, string> = {
  training: '陪练课时',
  special: '专项课时',
}

type BalanceRow = Omit<TrainingMemberBalance, 'trainingRemaining' | 'specialRemaining' | 'mockOnly'>

const balances = new Map<string, BalanceRow>()
const feedback: TrainingFeedback[] = []
const consumes: LessonConsumeRecord[] = []
const audit: TrainingAudit[] = []
const operations = new Map<string, { payload: string; result: TrainingMutationResult }>()
let feedbackSeq = 100
let seeded = false

function remainingOf(row: BalanceRow): TrainingMemberBalance {
  return {
    ...row,
    trainingRemaining: row.trainingTotal - row.trainingUsed,
    specialRemaining: row.specialTotal - row.specialUsed,
    mockOnly: true,
  }
}

function ensureSeed() {
  if (seeded) return
  const list = mockMembers({ page: 1, pageSize: 50 })
  for (const member of list.items) {
    const n = Number(member.memberId.replace('member-', '')) || 1
    const trainingTotal = 10 + (n % 5) * 4
    const trainingUsed = Math.min(trainingTotal, n % 7)
    const specialTotal = 8 + (n % 4) * 3
    const specialUsed = Math.min(specialTotal, (n * 2) % 5)
    balances.set(member.memberId, {
      memberId: member.memberId,
      accountId: member.accountId,
      contextId: member.contextId,
      displayId: member.displayId,
      memberName: member.name,
      storeId: member.storeId,
      storeName: member.storeName,
      trainingTotal,
      trainingUsed,
      specialTotal,
      specialUsed,
      version: 1,
    })
  }

  const samples: Array<{ memberId: string; kind: FeedbackKind; title: string; body: string; origin: 'coach' | 'hq-proxy'; coachName: string; at: string }> = [
    { memberId: 'member-1', kind: 'training', title: '专注力训练反馈（演示）', body: '本次完成观察与记忆练习，建议继续巩固。', origin: 'coach', coachName: '王老师', at: '2026-10-02T09:00:00+08:00' },
    { memberId: 'member-1', kind: 'self-study', title: '智习进度反馈', body: '本周智习完成度良好，注意休息节奏。', origin: 'coach', coachName: '王老师', at: '2026-10-05T15:20:00+08:00' },
    { memberId: 'member-2', kind: 'camp', title: '集训营中期反馈', body: '集训中期表现稳定，沟通更主动。', origin: 'coach', coachName: '赵健脑', at: '2026-10-08T11:00:00+08:00' },
    { memberId: 'member-3', kind: 'training', title: '总部代写示例反馈', body: '门店侧暂无法提交，总部代写留档。', origin: 'hq-proxy', coachName: '总部演示账号', at: '2026-10-10T10:00:00+08:00' },
  ]
  for (const sample of samples) {
    const bal = balances.get(sample.memberId)
    if (!bal) continue
    feedback.push({
      feedbackId: `fb-seed-${feedbackSeq++}`,
      memberId: bal.memberId,
      memberName: bal.memberName,
      displayId: bal.displayId,
      storeId: bal.storeId,
      storeName: bal.storeName,
      kind: sample.kind,
      title: sample.title,
      body: sample.body,
      coachName: sample.coachName,
      status: 'PUBLISHED',
      origin: sample.origin,
      attachments: sample.kind === 'training' && sample.memberId === 'member-1'
        ? [{ assetId: 'asset-fb-1', kind: 'image', name: '训练照片.jpg', sizeLabel: '1.2mb', previewUrl: 'https://cdn.example.invalid/mock/feedback-1.jpg' }]
        : [],
      createdAt: sample.at,
      withdrawnAt: null,
      withdrawReason: null,
      version: 1,
      mockOnly: true,
    })
  }
  seeded = true
}

function syncMemberCard(memberId: string) {
  // 保持与 HQ-03 详情中演示反馈摘要的只读边界；本模块自有流水，不回写 members Mock 权益。
  void memberId
}

function pushAudit(entry: Omit<TrainingAudit, 'operationId' | 'occurredAt'>) {
  audit.unshift({ ...entry, operationId: crypto.randomUUID(), occurredAt: nowIso() })
}

export function mockTrainingCatalog(): TrainingCatalog {
  ensureSeed()
  const stores = mockMembers({ page: 1, pageSize: 50 }).items
    .reduce<{ storeId: string; name: string }[]>((acc, row) => {
      if (!row.storeId || !row.storeName) return acc
      if (!acc.some(item => item.storeId === row.storeId)) acc.push({ storeId: row.storeId, name: row.storeName })
      return acc
    }, [])
  return clone({
    stores,
    kinds: (Object.keys(kindLabels) as FeedbackKind[]).map(value => ({ value, label: kindLabels[value] })),
    buckets: (Object.keys(bucketLabels) as LessonBucket[]).map(value => ({ value, label: bucketLabels[value] })),
    audit: audit.slice(0, 50),
    mockOnly: true,
  })
}

export function mockTrainingBalances(query: TrainingBalanceQuery): TrainingBalanceList {
  ensureSeed()
  if (!Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    fail('INVALID_INPUT', '分页参数无效')
  }
  const keyword = query.keyword?.trim() ?? ''
  const all = [...balances.values()].map(remainingOf)
  const filtered = all.filter(row =>
    (!keyword || row.memberName.includes(keyword) || row.displayId.toLowerCase().includes(keyword.toLowerCase()) || row.memberId.includes(keyword))
    && (!query.storeId || row.storeId === query.storeId),
  )
  const start = (query.page - 1) * query.pageSize
  return clone({
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      members: filtered.length,
      trainingRemaining: filtered.reduce((sum, row) => sum + row.trainingRemaining, 0),
      specialRemaining: filtered.reduce((sum, row) => sum + row.specialRemaining, 0),
      lowBalance: filtered.filter(row => row.trainingRemaining <= 2 || row.specialRemaining <= 2).length,
    },
  })
}

export function mockTrainingFeedbackList(query: TrainingFeedbackQuery): TrainingFeedbackList {
  ensureSeed()
  if (!Number.isInteger(query.page) || query.page < 1 || !Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    fail('INVALID_INPUT', '分页参数无效')
  }
  const keyword = query.keyword?.trim() ?? ''
  const filtered = feedback.filter(row =>
    (!keyword || row.title.includes(keyword) || row.memberName.includes(keyword) || row.feedbackId.includes(keyword))
    && (!query.kind || row.kind === query.kind)
    && (!query.status || row.status === query.status)
    && (!query.memberId || row.memberId === query.memberId)
    && (!query.storeId || row.storeId === query.storeId),
  )
  const start = (query.page - 1) * query.pageSize
  return clone({
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      feedback: filtered.length,
      published: filtered.filter(row => row.status === 'PUBLISHED').length,
      withdrawn: filtered.filter(row => row.status === 'WITHDRAWN').length,
      hqProxy: filtered.filter(row => row.origin === 'hq-proxy').length,
    },
  })
}

export function mockTrainingMemberDetail(memberId: string): TrainingMemberDetail {
  ensureSeed()
  const row = balances.get(memberId) ?? fail('NOT_FOUND', '学员课时档案不存在，请刷新')
  // 确认 HQ-03 仍有该学员，避免孤儿数据
  mockMemberDetail(memberId)
  return clone({
    balance: remainingOf(row),
    consumes: consumes.filter(item => item.memberId === memberId),
    feedback: feedback.filter(item => item.memberId === memberId),
    audit: audit.filter(item => item.targetId === memberId || item.targetId.startsWith(`${memberId}:`) || feedback.some(f => f.feedbackId === item.targetId && f.memberId === memberId)).slice(0, 40),
  })
}

export function mockTrainingFeedbackDetail(feedbackId: string): TrainingFeedback {
  ensureSeed()
  const row = feedback.find(item => item.feedbackId === feedbackId) ?? fail('NOT_FOUND', '反馈不存在或已删除')
  return clone(row)
}

export function mockTrainingMutate(input: TrainingMutation, operator: HqAccount): TrainingMutationResult {
  ensureSeed()
  const reason = input.reason?.trim() ?? ''
  if (!reason || reason.length > 200) fail('INVALID_INPUT', '请填写 1—200 字操作原因')
  if (!input.idempotencyKey?.trim()) fail('INVALID_INPUT', '缺少幂等请求号')

  const key = `${operator.accountId}:${input.idempotencyKey}`
  const payload = JSON.stringify(input)
  const previous = operations.get(key)
  if (previous) {
    if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '相同请求号参数不一致，请更换请求号')
    return clone(previous.result)
  }

  let result: TrainingMutationResult

  if (input.action === 'proxy-feedback') {
    const bal = balances.get(input.memberId) ?? fail('NOT_FOUND', '学员不存在')
    mockMemberDetail(input.memberId)
    const title = input.title?.trim() ?? ''
    const body = input.body?.trim() ?? ''
    if (!title || title.length > 80) fail('INVALID_INPUT', '标题须为 1—80 字')
    if (!body || body.length > 3000) fail('INVALID_INPUT', '反馈内容须为 1—3000 字')
    if (!['training', 'self-study', 'camp'].includes(input.kind)) fail('INVALID_INPUT', '反馈类型无效')
    const row: TrainingFeedback = {
      feedbackId: `fb-hq-${feedbackSeq++}`,
      memberId: bal.memberId,
      memberName: bal.memberName,
      displayId: bal.displayId,
      storeId: bal.storeId,
      storeName: bal.storeName,
      kind: input.kind,
      title,
      body,
      coachName: operator.nickname,
      status: 'PUBLISHED',
      origin: 'hq-proxy',
      attachments: [],
      createdAt: nowIso(),
      withdrawnAt: null,
      withdrawReason: null,
      version: 1,
      mockOnly: true,
    }
    feedback.unshift(row)
    pushAudit({
      requestId: input.idempotencyKey, action: input.action, targetId: row.feedbackId,
      before: '(无)', after: `PUBLISHED:${title}`, reason,
      operatorId: operator.accountId, operatorName: operator.nickname,
      beforeVersion: 0, afterVersion: 1,
    })
    syncMemberCard(bal.memberId)
    result = { action: 'proxy-feedback', feedback: clone(row), mockOnly: true }
  } else if (input.action === 'withdraw-feedback') {
    const row = feedback.find(item => item.feedbackId === input.feedbackId) ?? fail('NOT_FOUND', '反馈不存在')
    if (row.version !== input.version) fail('VERSION_CONFLICT', '反馈已更新，请刷新后重试')
    if (row.status === 'WITHDRAWN') fail('INVALID_STATE', '反馈已撤回')
    const before = `PUBLISHED:v${row.version}`
    row.status = 'WITHDRAWN'
    row.withdrawnAt = nowIso()
    row.withdrawReason = reason
    row.version += 1
    pushAudit({
      requestId: input.idempotencyKey, action: input.action, targetId: row.feedbackId,
      before, after: `WITHDRAWN:v${row.version}`, reason,
      operatorId: operator.accountId, operatorName: operator.nickname,
      beforeVersion: input.version, afterVersion: row.version,
    })
    result = { action: 'withdraw-feedback', feedback: clone(row), mockOnly: true }
  } else if (input.action === 'consume-lessons') {
    const bal = balances.get(input.memberId) ?? fail('NOT_FOUND', '学员课时档案不存在')
    if (bal.version !== input.version) fail('VERSION_CONFLICT', '课时余额已更新，请刷新后重试')
    if (!['training', 'special'].includes(input.bucket)) fail('INVALID_INPUT', '课时类型无效')
    if (!Number.isInteger(input.quantity) || input.quantity < 1) fail('INVALID_INPUT', '核销课时须为正整数')
    if (input.quantity > 100) fail('INVALID_INPUT', '单次核销不得超过 100 课时')
    const remaining = input.bucket === 'training' ? bal.trainingTotal - bal.trainingUsed : bal.specialTotal - bal.specialUsed
    if (input.quantity > remaining) fail('INVALID_STATE', '核销数量超过剩余课时，禁止超余量或负库存')
    const beforeUsed = input.bucket === 'training' ? bal.trainingUsed : bal.specialUsed
    const beforeRemaining = remaining
    if (input.bucket === 'training') bal.trainingUsed += input.quantity
    else bal.specialUsed += input.quantity
    bal.version += 1
    const afterRemaining = input.bucket === 'training' ? bal.trainingTotal - bal.trainingUsed : bal.specialTotal - bal.specialUsed
    const afterUsed = input.bucket === 'training' ? bal.trainingUsed : bal.specialUsed
    if (afterRemaining < 0 || bal.trainingUsed > bal.trainingTotal || bal.specialUsed > bal.specialTotal) {
      fail('INVALID_STATE', '核销后将出现负库存，已拒绝')
    }
    const record: LessonConsumeRecord = {
      recordId: crypto.randomUUID(),
      memberId: bal.memberId,
      memberName: bal.memberName,
      displayId: bal.displayId,
      storeId: bal.storeId,
      bucket: input.bucket,
      quantity: input.quantity,
      beforeRemaining,
      afterRemaining,
      beforeUsed,
      afterUsed,
      reason,
      operatorId: operator.accountId,
      operatorName: operator.nickname,
      requestId: input.idempotencyKey,
      occurredAt: nowIso(),
      beforeVersion: input.version,
      afterVersion: bal.version,
    }
    consumes.unshift(record)
    pushAudit({
      requestId: input.idempotencyKey, action: input.action, targetId: `${bal.memberId}:${input.bucket}`,
      before: `${bucketLabels[input.bucket]}剩余${beforeRemaining}`, after: `核销${input.quantity}后剩余${afterRemaining}`,
      reason, operatorId: operator.accountId, operatorName: operator.nickname,
      beforeVersion: input.version, afterVersion: bal.version,
    })
    result = { action: 'consume-lessons', balance: clone(remainingOf(bal)), record: clone(record), mockOnly: true }
  } else {
    return fail('INVALID_INPUT', '未知操作')
  }

  operations.set(key, { payload, result })
  return clone(result)
}
