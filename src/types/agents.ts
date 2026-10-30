import type { HqAccount } from './auth'

export type AgentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXITED'
export type TerritoryLevel = 'PROVINCE' | 'CITY' | 'DISTRICT'

export class AgentError extends Error {
  code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'EXCLUSIVITY_CONFLICT'
  constructor(code: AgentError['code'], message: string) {
    super(message)
    this.code = code
  }
}

/** 区域档位方案参考（万元展示字段，非结算回执）。 */
export interface AgentPlanRow {
  id: string
  positioning: string
  name: string
  population?: string
  fee: { tech: number; device: number; deposit: number; total: number }
  vipPartner: string
  regionCommission: string
  virtualProduct: string
  physicalProduct: string
}

export interface AgentPlanGroup {
  id: string
  label: string
  rows: AgentPlanRow[]
}

export interface AgentTerritory {
  territoryId: string
  level: TerritoryLevel
  name: string
  /** 独占：同级同名区域仅允许一名生效代理 */
  exclusive: boolean
  holderAgentId: string | null
  version: number
}

export interface RegionAgent {
  agentId: string
  accountId: string
  name: string
  phone: string
  partnerAccountId: string | null
  partnerName: string | null
  levelLabel: string
  territoryIds: string[]
  storeCount: number
  status: AgentStatus
  /** 累计佣金仅为演示快照（分），禁止当作结算终态 */
  commissionSnapshotCents: number
  version: number
  allowedActions: ('suspend' | 'resume' | 'set-exclusivity')[]
}

export interface AgentAudit {
  operationId: string
  requestId: string
  action: 'suspend' | 'resume' | 'set-exclusivity'
  targetId: string
  operatorId: string
  operatorName: string
  reason: string
  before: string
  after: string
  occurredAt: string
}

export interface AgentQuery {
  keyword?: string
  status?: AgentStatus
  territoryId?: string
  page: number
  pageSize: number
}

export interface AgentList {
  items: RegionAgent[]
  total: number
  page: number
  pageSize: number
  summary: { activeCount: number; suspendedCount: number; exclusiveTerritoryCount: number }
}

export interface AgentCatalog {
  planGroups: AgentPlanGroup[]
  planNotes: { title: string; items: string[] }[]
  territories: AgentTerritory[]
  agents: RegionAgent[]
}

export interface AgentDetail {
  agent: RegionAgent
  territories: AgentTerritory[]
  audit: AgentAudit[]
}

export type AgentMutation =
  | { action: 'suspend' | 'resume'; agentId: string; reason: string; version: number; idempotencyKey: string }
  | { action: 'set-exclusivity'; territoryId: string; exclusive: boolean; reason: string; version: number; idempotencyKey: string }

export type AgentOperator = Pick<HqAccount, 'accountId' | 'nickname'>
