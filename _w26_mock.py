# -*- coding: utf-8 -*-
from pathlib import Path
root = Path(r"E:\project\react-web\naoshang-front-react")

(root/"src/services/mock/trace.ts").write_text(r'''import type {
  TraceAuditList,
  TraceAuditQuery,
  TraceCatalog,
  TraceMutation,
  TraceMutationResult,
  TraceResourceList,
  TraceResourceQuery,
  TraceTask,
  TraceTaskList,
  TraceTaskQuery,
  UnifiedAuditEntry,
  UploadResource,
} from '../../types/trace'
import { TraceError } from '../../types/trace'

const STORAGE_KEY = 'ns_hq_trace_v1'

export const UPLOAD_CONTRACT_NOTE =
  '对齐小程序上传三步：POST /assets/upload-intents → 实际上传字节 → POST /assets/{id}/completions；仅 READY 可绑定业务。assetId 与 fileId 同值。真实 CDN 签名与私有读仍待联调。'

export const UNIFIED_AUDIT_GAP_NOTE =
  '统一操作审计台为跨模块聚合只读视图。本 Mock 使用独立种子，不改写 HQ-01～25 各模块 sessionStorage；生产应由后端统一审计流供数。'

export const NO_TICKET_NOTE =
  '本模块不是客服/审批工单系统：仅查阅通用上传资源、异步任务与操作追溯；业务审批仍在对应 HQ 模块或小程序完成。'

type IdemRecord = { fingerprint: string; result: TraceMutationResult }
type StoreShape = {
  resources: UploadResource[]
  tasks: TraceTask[]
  audits: UnifiedAuditEntry[]
  idem: Record<string, IdemRecord>
}

function nowIso() {
  return new Date().toISOString()
}

function stamp(offsetMin = 0) {
  return new Date(Date.now() - offsetMin * 60_000).toISOString()
}

function withResource(row: UploadResource): UploadResource {
  const allowed: UploadResource['allowedActions'] = []
  if (row.status === 'READY') allowed.push('quarantine-resource')
  if (row.status === 'QUARANTINED') allowed.push('restore-resource')
  return { ...row, fileId: row.assetId, mockOnly: true, allowedActions: allowed }
}

function withTask(row: TraceTask): TraceTask {
  return {
    ...row,
    mockOnly: true,
    allowedActions: row.status === 'FAILED' ? ['retry-task'] : [],
  }
}

function seedResources(): UploadResource[] {
  return [
    withResource({
      assetId: 'ast-avatar-001',
      fileId: 'ast-avatar-001',
      purpose: 'profile-avatar',
      mimeType: 'image/jpeg',
      fileName: 'avatar.jpg',
      sizeBytes: 128_000,
      status: 'READY',
      ownerAccountId: 'account-1',
      ownerName: '张家长',
      previewUrl: 'https://picsum.photos/seed/ast-avatar/200/200',
      boundHint: '资料头像',
      createdAt: stamp(60 * 24),
      updatedAt: stamp(60 * 20),
      version: 2,
      mockOnly: true,
      allowedActions: [],
    }),
    withResource({
      assetId: 'ast-storefront-002',
      fileId: 'ast-storefront-002',
      purpose: 'storefront-photo',
      mimeType: 'image/jpeg',
      fileName: 'door.jpg',
      sizeBytes: 890_000,
      status: 'READY',
      ownerAccountId: 'account-2',
      ownerName: '李联创',
      previewUrl: 'https://picsum.photos/seed/ast-door/400/300',
      boundHint: '合店/代理申请门头照',
      createdAt: stamp(200),
      updatedAt: stamp(180),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withResource({
      assetId: 'ast-feedback-003',
      fileId: 'ast-feedback-003',
      purpose: 'support-feedback',
      mimeType: 'image/png',
      fileName: 'shot.png',
      sizeBytes: 220_000,
      status: 'READY',
      ownerAccountId: 'account-1',
      ownerName: '张家长',
      previewUrl: 'https://picsum.photos/seed/ast-fb/300/300',
      boundHint: '意见反馈附图',
      createdAt: stamp(90),
      updatedAt: stamp(90),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withResource({
      assetId: 'ast-qr-004',
      fileId: 'ast-qr-004',
      purpose: 'partner-invite-qr',
      mimeType: 'image/png',
      fileName: 'my-qr.png',
      sizeBytes: 45_000,
      status: 'PENDING',
      ownerAccountId: 'account-3',
      ownerName: '王店长',
      previewUrl: null,
      boundHint: '邀请二维码（待 completions）',
      createdAt: stamp(15),
      updatedAt: stamp(15),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withResource({
      assetId: 'ast-train-005',
      fileId: 'ast-train-005',
      purpose: 'training-file',
      mimeType: 'application/pdf',
      fileName: 'report.pdf',
      sizeBytes: 1_200_000,
      status: 'FAILED',
      ownerAccountId: 'account-4',
      ownerName: '赵教练',
      previewUrl: null,
      boundHint: '训练反馈附件',
      createdAt: stamp(40),
      updatedAt: stamp(35),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withResource({
      assetId: 'ast-abuse-006',
      fileId: 'ast-abuse-006',
      purpose: 'support-feedback',
      mimeType: 'image/jpeg',
      fileName: 'spam.jpg',
      sizeBytes: 50_000,
      status: 'QUARANTINED',
      ownerAccountId: 'account-5',
      ownerName: '演示账号',
      previewUrl: null,
      boundHint: '已隔离样例',
      createdAt: stamp(60 * 48),
      updatedAt: stamp(60 * 47),
      version: 3,
      mockOnly: true,
      allowedActions: [],
    }),
  ]
}

function seedTasks(): TraceTask[] {
  return [
    withTask({
      jobId: 'job-compose-001',
      kind: 'MATERIAL_COMPOSE',
      title: '推广海报合成',
      relatedAssetId: 'ast-qr-004',
      relatedModule: 'materials',
      status: 'PROCESSING',
      resultSummary: '排队合成中（Mock，不产出终图 URL）',
      createdAt: stamp(12),
      completedAt: null,
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withTask({
      jobId: 'job-upload-002',
      kind: 'UPLOAD_PROCESS',
      title: '训练附件转码/病毒扫描',
      relatedAssetId: 'ast-train-005',
      relatedModule: 'training',
      status: 'FAILED',
      resultSummary: '处理失败：文件损坏（演示）',
      createdAt: stamp(40),
      completedAt: stamp(35),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withTask({
      jobId: 'job-export-003',
      kind: 'EXPORT',
      title: '支付对账导出',
      relatedAssetId: null,
      relatedModule: 'payments',
      status: 'SUCCEEDED',
      resultSummary: '导出完成（Mock 文件名 payment-2026-10-27.csv）',
      createdAt: stamp(60 * 10),
      completedAt: stamp(60 * 9),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
    withTask({
      jobId: 'job-other-004',
      kind: 'OTHER',
      title: '反馈图片压缩',
      relatedAssetId: 'ast-feedback-003',
      relatedModule: 'support',
      status: 'SUCCEEDED',
      resultSummary: '压缩完成',
      createdAt: stamp(88),
      completedAt: stamp(87),
      version: 1,
      mockOnly: true,
      allowedActions: [],
    }),
  ]
}

function seedAudits(): UnifiedAuditEntry[] {
  return [
    {
      entryId: 'ua-001',
      module: 'materials',
      action: 'publish',
      targetId: 'pm-image-poster-1',
      summary: '发布推广图片模板',
      before: 'DRAFT',
      after: 'PUBLISHED',
      reason: '活动物料上线',
      operatorId: 'HQ047',
      operatorName: '推广素材编辑演示账号',
      requestId: 'req-mat-demo-1',
      occurredAt: stamp(60 * 30),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
    {
      entryId: 'ua-002',
      module: 'support',
      action: 'publish-agreement',
      targetId: 'agr-user',
      summary: '发布用户协议',
      before: 'DRAFT',
      after: 'PUBLISHED',
      reason: '法务定稿',
      operatorId: 'HQ001',
      operatorName: '总部演示账号',
      requestId: 'req-sup-demo-1',
      occurredAt: stamp(60 * 24 * 10),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
    {
      entryId: 'ua-003',
      module: 'withdrawals',
      action: 'approve',
      targetId: 'wd-001',
      summary: '提现审核同意',
      before: 'PENDING_REVIEW',
      after: 'PROCESSING',
      reason: '资料齐全',
      operatorId: 'HQ045',
      operatorName: '提现审核演示账号',
      requestId: 'req-wd-demo-1',
      occurredAt: stamp(60 * 8),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
    {
      entryId: 'ua-004',
      module: 'users',
      action: 'freeze',
      targetId: 'account-9',
      summary: '冻结用户账号',
      before: 'active',
      after: 'frozen',
      reason: '风险排查',
      operatorId: 'HQ001',
      operatorName: '总部演示账号',
      requestId: 'req-user-demo-1',
      occurredAt: stamp(60 * 50),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
    {
      entryId: 'ua-005',
      module: 'assets',
      action: 'quarantine-resource',
      targetId: 'ast-abuse-006',
      summary: '隔离上传资源',
      before: 'READY',
      after: 'QUARANTINED',
      reason: '疑似违规内容',
      operatorId: 'HQ049',
      operatorName: '协议客服管理演示账号',
      requestId: 'req-ast-demo-1',
      occurredAt: stamp(60 * 47),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
    {
      entryId: 'ua-006',
      module: 'payments',
      action: 'reconcile',
      targetId: 'job-export-003',
      summary: '发起对账导出任务',
      before: '',
      after: 'SUCCEEDED',
      reason: '日终对账',
      operatorId: 'HQ022',
      operatorName: '查单对账演示账号',
      requestId: 'req-pay-demo-1',
      occurredAt: stamp(60 * 10),
      source: 'AGGREGATED_MOCK',
      mockOnly: true,
    },
  ]
}

function emptyStore(): StoreShape {
  return {
    resources: seedResources(),
    tasks: seedTasks(),
    audits: seedAudits(),
    idem: {},
  }
}

function load(): StoreShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StoreShape
    if (!Array.isArray(parsed.resources) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.audits)) return emptyStore()
    return {
      resources: parsed.resources.map((r) => withResource(r)),
      tasks: parsed.tasks.map((t) => withTask(t)),
      audits: parsed.audits.map((a) => ({ ...a, source: 'AGGREGATED_MOCK' as const, mockOnly: true as const })),
      idem: parsed.idem && typeof parsed.idem === 'object' ? parsed.idem : {},
    }
  } catch {
    return emptyStore()
  }
}

function save(state: StoreShape) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function buildCatalog(state: StoreShape): TraceCatalog {
  const resources = state.resources
  const tasks = state.tasks
  return {
    resourceSummary: {
      total: resources.length,
      pending: resources.filter((r) => r.status === 'PENDING').length,
      ready: resources.filter((r) => r.status === 'READY').length,
      failed: resources.filter((r) => r.status === 'FAILED').length,
      quarantined: resources.filter((r) => r.status === 'QUARANTINED').length,
    },
    taskSummary: {
      total: tasks.length,
      processing: tasks.filter((t) => t.status === 'PROCESSING').length,
      succeeded: tasks.filter((t) => t.status === 'SUCCEEDED').length,
      failed: tasks.filter((t) => t.status === 'FAILED').length,
    },
    auditSummary: { total: state.audits.length },
    uploadContractNote: UPLOAD_CONTRACT_NOTE,
    unifiedAuditGapNote: UNIFIED_AUDIT_GAP_NOTE,
    noTicketNote: NO_TICKET_NOTE,
    mockOnly: true,
  }
}

function pushAudit(
  state: StoreShape,
  input: Omit<UnifiedAuditEntry, 'entryId' | 'occurredAt' | 'source' | 'mockOnly'>,
) {
  state.audits.unshift({
    ...input,
    entryId: `ua-${crypto.randomUUID()}`,
    occurredAt: nowIso(),
    source: 'AGGREGATED_MOCK',
    mockOnly: true,
  })
}

export function mockTraceCatalog(): TraceCatalog {
  return buildCatalog(load())
}

export function mockTraceResourceList(query: TraceResourceQuery): TraceResourceList {
  const state = load()
  let rows = [...state.resources]
  if (query.status) rows = rows.filter((r) => r.status === query.status)
  if (query.purpose) rows = rows.filter((r) => r.purpose === query.purpose)
  const kw = query.keyword?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        r.assetId.toLowerCase().includes(kw) ||
        r.fileName.toLowerCase().includes(kw) ||
        r.ownerName.toLowerCase().includes(kw) ||
        r.purpose.toLowerCase().includes(kw) ||
        (r.boundHint ?? '').toLowerCase().includes(kw),
    )
  }
  rows.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const total = rows.length
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  return {
    items: rows.slice(start, start + query.pageSize).map((r) => withResource(r)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function mockTraceTaskList(query: TraceTaskQuery): TraceTaskList {
  const state = load()
  let rows = [...state.tasks]
  if (query.status) rows = rows.filter((r) => r.status === query.status)
  if (query.kind) rows = rows.filter((r) => r.kind === query.kind)
  const kw = query.keyword?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        r.jobId.toLowerCase().includes(kw) ||
        r.title.toLowerCase().includes(kw) ||
        (r.relatedAssetId ?? '').toLowerCase().includes(kw),
    )
  }
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const total = rows.length
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  return {
    items: rows.slice(start, start + query.pageSize).map((r) => withTask(r)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function mockTraceAuditList(query: TraceAuditQuery): TraceAuditList {
  const state = load()
  let rows = [...state.audits]
  if (query.module) rows = rows.filter((r) => r.module === query.module)
  const kw = query.keyword?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        r.entryId.toLowerCase().includes(kw) ||
        r.targetId.toLowerCase().includes(kw) ||
        r.summary.toLowerCase().includes(kw) ||
        r.operatorName.toLowerCase().includes(kw) ||
        r.action.toLowerCase().includes(kw) ||
        r.requestId.toLowerCase().includes(kw),
    )
  }
  rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  const total = rows.length
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  return {
    items: rows.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function mockTraceMutate(
  mutation: TraceMutation,
  operator: { operatorId: string; operatorName: string },
): TraceMutationResult {
  const state = load()
  const fingerprint = JSON.stringify(mutation)
  const prev = state.idem[mutation.idempotencyKey]
  if (prev) {
    if (prev.fingerprint === fingerprint) return prev.result
    throw new TraceError('IDEMPOTENCY_CONFLICT', '幂等键已用于其他操作')
  }
  if (!mutation.reason.trim()) throw new TraceError('INVALID_INPUT', '请填写原因')

  let result: TraceMutationResult

  if (mutation.action === 'quarantine-resource') {
    const row = state.resources.find((r) => r.assetId === mutation.assetId)
    if (!row) throw new TraceError('NOT_FOUND', '资源不存在')
    if (row.version !== mutation.version) throw new TraceError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'READY') throw new TraceError('INVALID_STATE', '仅 READY 资源可隔离')
    const beforeV = row.version
    const before = row.status
    row.status = 'QUARANTINED'
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withResource(row)
    const idx = state.resources.findIndex((r) => r.assetId === row.assetId)
    state.resources[idx] = updated
    pushAudit(state, {
      module: 'assets',
      action: 'quarantine-resource',
      targetId: row.assetId,
      summary: '隔离上传资源',
      before,
      after: 'QUARANTINED',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      requestId: mutation.idempotencyKey,
    })
    void beforeV
    result = {
      action: 'quarantine-resource',
      mockOnly: true,
      message: '已隔离资源（不可再绑定业务）',
      resource: updated,
      catalog: buildCatalog(state),
    }
  } else if (mutation.action === 'restore-resource') {
    const row = state.resources.find((r) => r.assetId === mutation.assetId)
    if (!row) throw new TraceError('NOT_FOUND', '资源不存在')
    if (row.version !== mutation.version) throw new TraceError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'QUARANTINED') throw new TraceError('INVALID_STATE', '仅已隔离资源可恢复')
    const before = row.status
    row.status = 'READY'
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withResource(row)
    const idx = state.resources.findIndex((r) => r.assetId === row.assetId)
    state.resources[idx] = updated
    pushAudit(state, {
      module: 'assets',
      action: 'restore-resource',
      targetId: row.assetId,
      summary: '恢复上传资源',
      before,
      after: 'READY',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      requestId: mutation.idempotencyKey,
    })
    result = {
      action: 'restore-resource',
      mockOnly: true,
      message: '已恢复为 READY',
      resource: updated,
      catalog: buildCatalog(state),
    }
  } else if (mutation.action === 'retry-task') {
    const row = state.tasks.find((t) => t.jobId === mutation.jobId)
    if (!row) throw new TraceError('NOT_FOUND', '任务不存在')
    if (row.version !== mutation.version) throw new TraceError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'FAILED') throw new TraceError('INVALID_STATE', '仅失败任务可重试')
    const before = row.status
    row.status = 'PROCESSING'
    row.resultSummary = '已重新入队（Mock，不保证真实处理完成）'
    row.completedAt = null
    row.version += 1
    const updated = withTask(row)
    const idx = state.tasks.findIndex((t) => t.jobId === row.jobId)
    state.tasks[idx] = updated
    pushAudit(state, {
      module: row.relatedModule,
      action: 'retry-task',
      targetId: row.jobId,
      summary: `重试异步任务：${row.title}`,
      before,
      after: 'PROCESSING',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      requestId: mutation.idempotencyKey,
    })
    result = {
      action: 'retry-task',
      mockOnly: true,
      message: '已重新入队（Mock）',
      task: updated,
      catalog: buildCatalog(state),
    }
  } else {
    throw new TraceError('INVALID_INPUT', '操作类型无效')
  }

  state.idem[mutation.idempotencyKey] = { fingerprint, result }
  save(state)
  return result
}

export function __resetTraceMockForTests() {
  sessionStorage.removeItem(STORAGE_KEY)
}
''', encoding='utf-8')
print('mock', (root/'src/services/mock/trace.ts').stat().st_size)
