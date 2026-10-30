/** HQ-19 门店主档与健脑官账号监管。字段对齐小程序 business-store / store/index；任职角色字典与完整 CRUD 在 HQ-18，本模块聚焦门店实体与健脑官监管动作。 */
export type StoreStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'

export interface StoreAgentOption {
  agentId: string
  name: string
  regionLabel: string
}

export interface StoreProfile {
  storeId: string
  number: string
  name: string
  status: StoreStatus
  managerName: string
  contact: string
  address: string
  regionNames: [string, string, string]
  regionCodes: [string, string, string]
  /** 合店费用，单位：分 */
  feeAmount: number
  /** 合店费用下限边界，单位：分；总部改价不得低于此值 */
  minimumFeeAmount: number
  storefrontAssetId: string | null
  storefrontUrl: string | null
  agentId: string | null
  agentName: string | null
  /** 合店老板 / 店主账号（HQ create/change-owner） */
  ownerAccountId: string | null
  ownerCount: number
  coachActive: number
  coachFrozen: number
  staffTotal: number
  version: number
  openedAt: string
  mockOnly: boolean
}

export interface StoreCoach {
  coachId: string
  storeId: string
  displayName: string
  loginAccount: string
  status: 'ACTIVE' | 'FROZEN' | 'LEFT'
  invitationStatus: 'PENDING' | 'ACTIVE' | 'REVOKED'
  credentialSet: boolean
  version: number
  effectiveAt: string
  leftAt: string | null
}

export interface StoreStaffBrief {
  assignmentId: string
  displayName: string
  loginAccount: string
  roleCode: string
  roleTitle: string
  status: string
  credentialSet: boolean
  version: number
}

export interface StoreQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: StoreStatus
  agentId?: string
}

export interface StoreList {
  items: StoreProfile[]
  total: number
  page: number
  pageSize: number
  summary: {
    stores: number
    active: number
    frozen: number
    closed: number
    coachesActive: number
  }
}

export interface StoreCatalog {
  agents: StoreAgentOption[]
  regionOptions: { value: string; label: string; children?: StoreCatalog['regionOptions'] }[]
  audit: StoreAudit[]
  mockOnly: boolean
}

export interface StoreDetail {
  store: StoreProfile
  coaches: StoreCoach[]
  /** 本店任职只读摘要；完整角色/任职维护见 HQ-18 /staff-roles */
  staff: StoreStaffBrief[]
  audit: StoreAudit[]
}

export interface StoreAudit {
  operationId: string
  requestId: string
  action: StoreMutation['action']
  targetId: string
  operatorId: string
  operatorName: string
  reason: string
  before: string
  after: string
  beforeVersion: number
  afterVersion: number
  occurredAt: string
}

export type StoreMutation = { reason: string; idempotencyKey: string; version: number } & (
  | {
      action: 'create'
      name: string
      storeId?: string
      code?: string
      address?: string
      managerName?: string
      managerPhone?: string
      ownerAccountId?: string
    }
  | {
      action: 'save-profile'
      storeId: string
      name: string
      managerName: string
      contact: string
      address: string
      regionNames: [string, string, string]
      regionCodes: [string, string, string]
      feeAmount: number
      minimumFeeAmount: number
      storefrontAssetId: string | null
      storefrontUrl: string | null
      agentId: string | null
    }
  | { action: 'change-owner'; storeId: string; ownerAccountId: string }
  | { action: 'set-status'; storeId: string; status: StoreStatus }
  | { action: 'set-coach-status'; storeId: string; coachId: string; status: 'ACTIVE' | 'FROZEN' }
  | { action: 'mark-coach-credential-reset'; storeId: string; coachId: string }
)

export type StoreErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT'

export class StoreError extends Error {
  constructor(public code: StoreErrorCode, message: string) {
    super(message)
    this.name = 'StoreError'
  }
}

export const storeStatusLabels: Record<StoreStatus, string> = {
  ACTIVE: '营业中',
  FROZEN: '已冻结',
  CLOSED: '已停业',
}
