import type {
  LegalAgreement,
  SupportAudit,
  SupportCatalog,
  SupportConfig,
  SupportFeedbackItem,
  SupportFeedbackList,
  SupportFeedbackQuery,
  SupportMutation,
  SupportMutationResult,
} from '../../types/support'
import { SupportError } from '../../types/support'
import type { RichContent } from '../../types/cms'
import { hasContent, normalizeContent } from '../../utils/richContent'

const STORAGE_KEY = 'ns_hq_support_v1'

export const FULL_CS_GAP =
  'HQ-25 仅协议与反馈预留：总部配置联系电话/说明、协议发布下线、意见反馈查阅处理；完整坐席工单/BI 非本期。勿把本配置当作已上线客服台。'

export const AGREEMENT_NOTE =
  '协议类型对齐小程序 settings/agreement?type=user|privacy；仅 PUBLISHED 对用户可见；下线后小程序应展示「内容暂未发布」。'

type IdemRecord = { fingerprint: string; result: SupportMutationResult }
type StoreShape = {
  agreements: LegalAgreement[]
  supportConfig: SupportConfig
  feedback: SupportFeedbackItem[]
  audit: SupportAudit[]
  idem: Record<string, IdemRecord>
}

function nowIso() {
  return new Date().toISOString()
}

function stamp(offsetMin = 0) {
  return new Date(Date.now() - offsetMin * 60_000).toISOString()
}

function textToContent(bodyText: string): RichContent {
  const paragraphs = bodyText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!paragraphs.length) return normalizeContent({ version: 1, format: 'nodes', nodes: [] })
  return normalizeContent({
    version: 1,
    format: 'nodes',
    nodes: paragraphs.map((text) => ({
      name: 'p',
      attrs: {},
      children: [{ type: 'text', text }],
    })),
  })
}

function agreementActions(row: LegalAgreement): LegalAgreement['allowedActions'] {
  const a: LegalAgreement['allowedActions'] = ['save-agreement']
  if (row.status === 'DRAFT' || row.status === 'OFFLINE') a.push('publish-agreement')
  if (row.status === 'PUBLISHED') a.push('offline-agreement')
  return a
}

function withAgreement(row: LegalAgreement): LegalAgreement {
  const next: LegalAgreement = {
    ...row,
    content: textToContent(row.bodyText),
    mockOnly: true,
    allowedActions: [],
  }
  next.allowedActions = agreementActions(next)
  return next
}

function withFeedback(row: SupportFeedbackItem): SupportFeedbackItem {
  return {
    ...row,
    mockOnly: true,
    allowedActions: row.status === 'OPEN' ? ['mark-feedback-handled'] : [],
  }
}

function seedAgreements(): LegalAgreement[] {
  const userBody =
    '欢迎使用脑尚合伙人服务。\n本用户协议说明账号注册、经营身份与服务使用规则。\n总部可发布新版本；请以当前已发布版本为准。'
  const privacyBody =
    '我们重视您的隐私。\n本政策说明我们如何收集、使用与保护个人信息。\n如有疑问可通过意见反馈联系我们。'
  return [
    withAgreement({
      agreementId: 'agr-user',
      type: 'user',
      title: '用户协议',
      docVersion: '2026.10.01',
      bodyText: userBody,
      content: textToContent(userBody),
      status: 'PUBLISHED',
      version: 2,
      publishedAt: stamp(60 * 24 * 10),
      updatedAt: stamp(60 * 24 * 10),
      mockOnly: true,
      allowedActions: [],
    }),
    withAgreement({
      agreementId: 'agr-privacy',
      type: 'privacy',
      title: '隐私政策',
      docVersion: '2026.10.01',
      bodyText: privacyBody,
      content: textToContent(privacyBody),
      status: 'PUBLISHED',
      version: 1,
      publishedAt: stamp(60 * 24 * 10),
      updatedAt: stamp(60 * 24 * 10),
      mockOnly: true,
      allowedActions: [],
    }),
    withAgreement({
      agreementId: 'agr-user-draft',
      type: 'user',
      title: '用户协议（修订草稿）',
      docVersion: '2026.10.28-draft',
      bodyText: '修订中的用户协议草稿，尚未发布。\n发布后将替换对用户可见的当前版本展示口径（Mock：多版本并存，小程序按类型取已发布）。',
      content: textToContent('修订中的用户协议草稿，尚未发布。'),
      status: 'DRAFT',
      version: 1,
      publishedAt: null,
      updatedAt: stamp(30),
      mockOnly: true,
      allowedActions: [],
    }),
  ]
}

function seedConfig(): SupportConfig {
  return {
    phone: '',
    description: '工作日 9:00–18:00 受理；完整在线客服后续提供，当前可先提交意见反馈。',
    feedbackMaxImages: 3,
    fullCustomerServicePending: true,
    version: 1,
    updatedAt: stamp(120),
    mockOnly: true,
  }
}

function seedFeedback(): SupportFeedbackItem[] {
  return [
    withFeedback({
      feedbackId: 'fb-open-001',
      accountId: 'account-1',
      accountName: '张家长',
      phone: '13800001111',
      content: '提现页面提示资料不全，但银行卡已绑定，请协助查看。',
      imageCount: 1,
      status: 'OPEN',
      createdAt: stamp(90),
      handledAt: null,
      handleNote: null,
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withFeedback({
      feedbackId: 'fb-open-002',
      accountId: 'account-2',
      accountName: '李联创',
      phone: '13900002222',
      content: '希望增加发票下载入口。',
      imageCount: 0,
      status: 'OPEN',
      createdAt: stamp(40),
      handledAt: null,
      handleNote: null,
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withFeedback({
      feedbackId: 'fb-handled-001',
      accountId: 'account-3',
      accountName: '王店长',
      phone: '13700003333',
      content: '培训反馈附件打不开。',
      imageCount: 2,
      status: 'HANDLED',
      createdAt: stamp(60 * 24),
      handledAt: stamp(60 * 20),
      handleNote: '已引导重新上传，问题关闭',
      version: 2,
      mockOnly: true,
      allowedActions: [],
    }),
  ]
}

function emptyStore(): StoreShape {
  return {
    agreements: seedAgreements(),
    supportConfig: seedConfig(),
    feedback: seedFeedback(),
    audit: [],
    idem: {},
  }
}

function load(): StoreShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StoreShape
    if (!Array.isArray(parsed.agreements) || !parsed.supportConfig || !Array.isArray(parsed.feedback)) return emptyStore()
    return {
      agreements: parsed.agreements.map((row) => withAgreement(row)),
      supportConfig: { ...parsed.supportConfig, fullCustomerServicePending: true, mockOnly: true },
      feedback: parsed.feedback.map((row) => withFeedback(row)),
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      idem: parsed.idem && typeof parsed.idem === 'object' ? parsed.idem : {},
    }
  } catch {
    return emptyStore()
  }
}

function save(state: StoreShape) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function pushAudit(state: StoreShape, input: Omit<SupportAudit, 'operationId' | 'occurredAt'>) {
  state.audit.unshift({
    ...input,
    operationId: `sa-${crypto.randomUUID()}`,
    occurredAt: nowIso(),
  })
}

function buildCatalog(state: StoreShape): SupportCatalog {
  return {
    agreements: state.agreements.map((row) => withAgreement(row)),
    supportConfig: { ...state.supportConfig, fullCustomerServicePending: true, mockOnly: true },
    feedbackSummary: {
      total: state.feedback.length,
      open: state.feedback.filter((f) => f.status === 'OPEN').length,
      handled: state.feedback.filter((f) => f.status === 'HANDLED').length,
    },
    fullCsGapNote: FULL_CS_GAP,
    agreementNote: AGREEMENT_NOTE,
    mockOnly: true,
  }
}

export function mockSupportCatalog(): SupportCatalog {
  return buildCatalog(load())
}

export function mockSupportFeedbackList(query: SupportFeedbackQuery): SupportFeedbackList {
  const state = load()
  let rows = [...state.feedback]
  if (query.status) rows = rows.filter((r) => r.status === query.status)
  const kw = query.keyword?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        r.content.toLowerCase().includes(kw) ||
        r.accountName.toLowerCase().includes(kw) ||
        r.phone.includes(kw) ||
        r.feedbackId.toLowerCase().includes(kw),
    )
  }
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const total = rows.length
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  return {
    items: rows.slice(start, start + query.pageSize).map((r) => withFeedback(r)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function mockSupportMutate(
  mutation: SupportMutation,
  operator: { operatorId: string; operatorName: string },
): SupportMutationResult {
  const state = load()
  const fingerprint = JSON.stringify(mutation)
  const prev = state.idem[mutation.idempotencyKey]
  if (prev) {
    if (prev.fingerprint === fingerprint) return prev.result
    throw new SupportError('IDEMPOTENCY_CONFLICT', '幂等键已用于其他操作')
  }
  if (!mutation.reason.trim()) throw new SupportError('INVALID_INPUT', '请填写原因')

  let result: SupportMutationResult

  if (mutation.action === 'save-agreement') {
    const row = state.agreements.find((a) => a.agreementId === mutation.agreementId)
    if (!row) throw new SupportError('NOT_FOUND', '协议不存在')
    if (row.version !== mutation.version) throw new SupportError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    const title = mutation.title.trim()
    const docVersion = mutation.docVersion.trim()
    const bodyText = mutation.bodyText.trim()
    if (!title || !docVersion) throw new SupportError('INVALID_INPUT', '请填写标题与协议文案版本')
    if (!bodyText) throw new SupportError('INVALID_INPUT', '请填写协议正文')
    const beforeV = row.version
    const before = `${row.status}:${row.docVersion}`
    row.title = title
    row.docVersion = docVersion
    row.bodyText = bodyText
    row.content = textToContent(bodyText)
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withAgreement(row)
    const idx = state.agreements.findIndex((a) => a.agreementId === row.agreementId)
    state.agreements[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'save-agreement',
      targetId: row.agreementId,
      before,
      after: `${updated.status}:${updated.docVersion}`,
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'save-agreement', mockOnly: true, message: '已保存协议草稿字段', catalog: buildCatalog(state) }
  } else if (mutation.action === 'publish-agreement') {
    const row = state.agreements.find((a) => a.agreementId === mutation.agreementId)
    if (!row) throw new SupportError('NOT_FOUND', '协议不存在')
    if (row.version !== mutation.version) throw new SupportError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status === 'PUBLISHED') throw new SupportError('INVALID_STATE', '已发布')
    if (!hasContent(textToContent(row.bodyText))) throw new SupportError('INVALID_INPUT', '正文为空，无法发布')
    for (const other of state.agreements) {
      if (other.type === row.type && other.agreementId !== row.agreementId && other.status === 'PUBLISHED') {
        other.status = 'OFFLINE'
        other.updatedAt = nowIso()
        other.version += 1
        const oi = state.agreements.findIndex((a) => a.agreementId === other.agreementId)
        state.agreements[oi] = withAgreement(other)
      }
    }
    const beforeV = row.version
    const before = row.status
    row.status = 'PUBLISHED'
    row.publishedAt = nowIso()
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withAgreement(row)
    const idx = state.agreements.findIndex((a) => a.agreementId === row.agreementId)
    state.agreements[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'publish-agreement',
      targetId: row.agreementId,
      before,
      after: `PUBLISHED:${updated.docVersion}`,
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'publish-agreement', mockOnly: true, message: '已发布协议；同类型旧版已下线', catalog: buildCatalog(state) }
  } else if (mutation.action === 'offline-agreement') {
    const row = state.agreements.find((a) => a.agreementId === mutation.agreementId)
    if (!row) throw new SupportError('NOT_FOUND', '协议不存在')
    if (row.version !== mutation.version) throw new SupportError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'PUBLISHED') throw new SupportError('INVALID_STATE', '仅已发布可下线')
    const beforeV = row.version
    const before = row.status
    row.status = 'OFFLINE'
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withAgreement(row)
    const idx = state.agreements.findIndex((a) => a.agreementId === row.agreementId)
    state.agreements[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'offline-agreement',
      targetId: row.agreementId,
      before,
      after: 'OFFLINE',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'offline-agreement', mockOnly: true, message: '已下线协议', catalog: buildCatalog(state) }
  } else if (mutation.action === 'save-support-config') {
    const cfg = state.supportConfig
    if (cfg.version !== mutation.version) throw new SupportError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    const phone = mutation.phone.trim()
    const description = mutation.description.trim()
    const max = mutation.feedbackMaxImages
    if (!Number.isInteger(max) || max < 0 || max > 9) {
      throw new SupportError('INVALID_INPUT', '反馈图片上限须为 0–9 的整数')
    }
    if (phone && !/^\d{5,20}$/.test(phone)) {
      throw new SupportError('INVALID_INPUT', '客服电话格式无效（可留空；填写时请用数字）')
    }
    if (!description) throw new SupportError('INVALID_INPUT', '请填写客服说明')
    const beforeV = cfg.version
    const before = JSON.stringify({ phone: cfg.phone, max: cfg.feedbackMaxImages })
    cfg.phone = phone
    cfg.description = description
    cfg.feedbackMaxImages = max
    cfg.fullCustomerServicePending = true
    cfg.updatedAt = nowIso()
    cfg.version += 1
    cfg.mockOnly = true
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'save-support-config',
      targetId: 'support-config',
      before,
      after: JSON.stringify({ phone: cfg.phone, max: cfg.feedbackMaxImages }),
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: cfg.version,
    })
    result = {
      action: 'save-support-config',
      mockOnly: true,
      message: '已更新客服入口配置（非完整客服系统）',
      catalog: buildCatalog(state),
    }
  } else if (mutation.action === 'mark-feedback-handled') {
    const row = state.feedback.find((f) => f.feedbackId === mutation.feedbackId)
    if (!row) throw new SupportError('NOT_FOUND', '反馈不存在')
    if (row.version !== mutation.version) throw new SupportError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'OPEN') throw new SupportError('INVALID_STATE', '仅待处理可标记完成')
    const note = mutation.handleNote.trim()
    if (!note) throw new SupportError('INVALID_INPUT', '请填写处理说明')
    const beforeV = row.version
    row.status = 'HANDLED'
    row.handledAt = nowIso()
    row.handleNote = note
    row.version += 1
    const updated = withFeedback(row)
    const idx = state.feedback.findIndex((f) => f.feedbackId === row.feedbackId)
    state.feedback[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'mark-feedback-handled',
      targetId: row.feedbackId,
      before: 'OPEN',
      after: 'HANDLED',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = {
      action: 'mark-feedback-handled',
      mockOnly: true,
      message: '已标记反馈处理完成（非客服工单系统）',
      feedback: updated,
      catalog: buildCatalog(state),
    }
  } else {
    throw new SupportError('INVALID_INPUT', '操作类型无效')
  }

  state.idem[mutation.idempotencyKey] = { fingerprint, result }
  save(state)
  return result
}

export function __resetSupportMockForTests() {
  sessionStorage.removeItem(STORAGE_KEY)
}
