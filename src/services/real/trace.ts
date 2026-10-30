import * as api from '../../api'
import { TraceError, type TraceAuditQuery, type TraceMutation, type TraceResourceQuery, type TraceTaskQuery } from '../../types/trace'
import { arr, asPage, cast, mapHqError, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

function mapResource(raw: unknown) {
  const r = record(raw)
  const assetId = str(r.assetId || r.fileId || r.id)
  const statusRaw = str(r.status, 'PENDING').toUpperCase()
  const status = (['PENDING', 'READY', 'FAILED', 'QUARANTINED'].includes(statusRaw) ? statusRaw : 'PENDING') as 'PENDING' | 'READY' | 'FAILED' | 'QUARANTINED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'quarantine-resource' | 'restore-resource' => item === 'quarantine-resource' || item === 'restore-resource')
    : status === 'QUARANTINED' ? ['restore-resource'] : ['quarantine-resource']) as ('quarantine-resource' | 'restore-resource')[]
  return {
    assetId,
    fileId: str(r.fileId || assetId),
    purpose: str(r.purpose || r.bizType || r.scene),
    mimeType: str(r.mimeType || r.contentType || r.mime),
    fileName: str(r.fileName || r.name || r.originalName),
    sizeBytes: num(r.sizeBytes ?? r.size ?? r.fileSize),
    status,
    ownerAccountId: str(r.ownerAccountId || r.accountId || r.uploaderId),
    ownerName: str(r.ownerName || r.accountName || r.uploaderName),
    previewUrl: nullableStr(r.previewUrl ?? r.url ?? r.cdnUrl),
    boundHint: nullableStr(r.boundHint ?? r.bindHint ?? r.boundTo),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt || r.modifiedAt || r.createdAt),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapTask(raw: unknown) {
  const r = record(raw)
  const kindRaw = str(r.kind || r.type, 'OTHER').toUpperCase()
  const kind = (['UPLOAD_PROCESS', 'MATERIAL_COMPOSE', 'EXPORT', 'OTHER'].includes(kindRaw) ? kindRaw : 'OTHER') as 'UPLOAD_PROCESS' | 'MATERIAL_COMPOSE' | 'EXPORT' | 'OTHER'
  const statusRaw = str(r.status, 'PROCESSING').toUpperCase()
  const status = (statusRaw === 'SUCCEEDED' || statusRaw === 'SUCCESS' ? 'SUCCEEDED' : statusRaw === 'FAILED' || statusRaw === 'ERROR' ? 'FAILED' : 'PROCESSING') as 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'retry-task' => item === 'retry-task')
    : status === 'FAILED' ? ['retry-task'] : []) as ('retry-task')[]
  const moduleRaw = str(r.relatedModule || r.module, 'other').toLowerCase()
  const relatedModule = ([
    'users', 'members', 'materials', 'support', 'withdrawals', 'payments', 'orders', 'training', 'assets', 'other',
  ].includes(moduleRaw) ? moduleRaw : 'other') as never
  return {
    jobId: str(r.jobId || r.id || r.taskId),
    kind,
    title: str(r.title || r.name || kind),
    relatedAssetId: nullableStr(r.relatedAssetId ?? r.assetId),
    relatedModule,
    status,
    resultSummary: str(r.resultSummary || r.summary || r.result || r.message),
    createdAt: str(r.createdAt),
    completedAt: nullableStr(r.completedAt ?? r.finishedAt),
    version: num(r.version, 1),
    mockOnly: false,
    allowedActions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  const moduleRaw = str(r.module, 'other').toLowerCase()
  const module = ([
    'users', 'members', 'materials', 'support', 'withdrawals', 'payments', 'orders', 'training', 'assets', 'other',
  ].includes(moduleRaw) ? moduleRaw : 'other') as never
  return {
    entryId: str(r.entryId || r.id || r.operationId),
    module,
    action: str(r.action),
    targetId: str(r.targetId || r.resourceId || r.assetId),
    summary: str(r.summary || r.title || r.message),
    before: str(r.before),
    after: str(r.after),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    requestId: str(r.requestId),
    occurredAt: str(r.occurredAt || r.createdAt),
    source: 'AGGREGATED_MOCK' as const,
    mockOnly: boolish(r.mockOnly, true),
  }
}

function boolish(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return fallback
}

function mapCatalog(raw: unknown) {
  const r = record(raw)
  const resourceSummary = record(r.resourceSummary)
  const taskSummary = record(r.taskSummary)
  const auditSummary = record(r.auditSummary)
  return {
    resourceSummary: {
      total: num(resourceSummary.total),
      pending: num(resourceSummary.pending),
      ready: num(resourceSummary.ready),
      failed: num(resourceSummary.failed),
      quarantined: num(resourceSummary.quarantined),
    },
    taskSummary: {
      total: num(taskSummary.total),
      processing: num(taskSummary.processing),
      succeeded: num(taskSummary.succeeded),
      failed: num(taskSummary.failed),
    },
    auditSummary: { total: num(auditSummary.total) },
    uploadContractNote: str(r.uploadContractNote, '上传三步契约：申请上传 → 直传 → 确认；本台仅展示资源与任务状态。'),
    unifiedAuditGapNote: str(r.unifiedAuditGapNote, '统一审计为聚合只读台；不改写各业务模块存储。'),
    noTicketNote: str(r.noTicketNote, '本模块不做业务工单系统。'),
    mockOnly: false,
  }
}

export async function realTraceCatalog() {
  try { return cast(mapCatalog(await unwrapData(await api.getTraceCatalog()))) }
  catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceResourceList(query: TraceResourceQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query, kind: 'resource' } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapResource),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceTaskList(query: TraceTaskQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query, kind: 'task' } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapTask),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceAuditList(query: TraceAuditQuery) {
  try {
    const page = asPage(await unwrapData(await api.getTrace({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: page.items.map(mapAudit),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, TraceError) }
}

export async function realTraceMutate(_input: TraceMutation) {
  return unsupported(TraceError, 'mutate', 'HQ trace API 为只读审计，不支持写操作')
}
