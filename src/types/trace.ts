/** HQ-26 通用资源、异步任务与统一操作追溯。对齐上传三步契约与 /jobs；不做业务工单系统；跨模块审计为聚合只读台（Mock 种子，不改写 HQ-01～25 各模块存储）。 */
export type AssetStatus = 'PENDING' | 'READY' | 'FAILED' | 'QUARANTINED'
export type TraceTaskStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
export type TraceTaskKind = 'UPLOAD_PROCESS' | 'MATERIAL_COMPOSE' | 'EXPORT' | 'OTHER'
export type TraceModule =
  | 'users'
  | 'members'
  | 'materials'
  | 'support'
  | 'withdrawals'
  | 'payments'
  | 'orders'
  | 'training'
  | 'assets'
  | 'other'

export type TraceAction =
  | 'quarantine-resource'
  | 'restore-resource'
  | 'retry-task'

export interface UploadResource {
  assetId: string
  /** 与 assetId 同值，对齐小程序 fileId === assetId */
  fileId: string
  purpose: string
  mimeType: string
  fileName: string
  sizeBytes: number
  status: AssetStatus
  ownerAccountId: string
  ownerName: string
  previewUrl: string | null
  boundHint: string | null
  createdAt: string
  updatedAt: string
  version: number
  mockOnly: boolean
  allowedActions: ('quarantine-resource' | 'restore-resource')[]
}

export interface TraceTask {
  jobId: string
  kind: TraceTaskKind
  title: string
  relatedAssetId: string | null
  relatedModule: TraceModule
  status: TraceTaskStatus
  resultSummary: string
  createdAt: string
  completedAt: string | null
  version: number
  mockOnly: boolean
  allowedActions: ('retry-task')[]
}

export interface UnifiedAuditEntry {
  entryId: string
  module: TraceModule
  action: string
  targetId: string
  summary: string
  before: string
  after: string
  reason: string
  operatorId: string
  operatorName: string
  requestId: string
  occurredAt: string
  /** 标明来自 Mock 聚合种子，非实时读取各模块 sessionStorage */
  source: 'AGGREGATED_MOCK'
  mockOnly: boolean
}

export interface TraceCatalog {
  resourceSummary: { total: number; pending: number; ready: number; failed: number; quarantined: number }
  taskSummary: { total: number; processing: number; succeeded: number; failed: number }
  auditSummary: { total: number }
  uploadContractNote: string
  unifiedAuditGapNote: string
  noTicketNote: string
  mockOnly: boolean
}

export interface TraceResourceList {
  items: UploadResource[]
  total: number
  page: number
  pageSize: number
}

export interface TraceTaskList {
  items: TraceTask[]
  total: number
  page: number
  pageSize: number
}

export interface TraceAuditList {
  items: UnifiedAuditEntry[]
  total: number
  page: number
  pageSize: number
}

export interface TraceResourceQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: AssetStatus
  purpose?: string
}

export interface TraceTaskQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: TraceTaskStatus
  kind?: TraceTaskKind
}

export interface TraceAuditQuery {
  page: number
  pageSize: number
  keyword?: string
  module?: TraceModule
}

export type TraceMutation =
  | {
      action: 'quarantine-resource' | 'restore-resource'
      assetId: string
      version: number
      reason: string
      idempotencyKey: string
    }
  | {
      action: 'retry-task'
      jobId: string
      version: number
      reason: string
      idempotencyKey: string
    }

export interface TraceMutationResult {
  action: TraceAction
  mockOnly: boolean
  message: string
  catalog?: TraceCatalog
  resource?: UploadResource
  task?: TraceTask
}

export type TraceErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'

export class TraceError extends Error {
  constructor(public code: TraceErrorCode, message: string) {
    super(message)
    this.name = 'TraceError'
  }
}
