/** HQ region-agents 区域代理（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { Endpoint, PaginationQuery, UndocumentedFields, MutationRequest, MutationData } from './common'

export type RegionAgentsAction = 'suspend' | 'resume' | 'update' | 'set-exclusivity' | 'appoint' | 'revoke'
export type RegionAgentsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: RegionAgentsAction } & T>

export interface RegionAgentsListQuery extends PaginationQuery {
  keyword?: string
  status?: string
  territoryId?: string
}

export interface RegionAgentsEndpoints {
  /** 区域代理目录与辖区汇总。 */
  'GET /region-agents/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 区域代理详情。 */
  'GET /region-agents/:agentId': Endpoint<{ agentId: string }, UndocumentedFields, never, unknown>
  /** 区域代理写操作：停用/恢复/更新等。 */
  'POST /region-agents/:agentId/mutate': Endpoint<{ agentId: string }, never, RegionAgentsMutationRequest, MutationData>
  /** 辖区写操作：独占开关等。 */
  'POST /region-agents/territories/:territoryId/mutate': Endpoint<{ territoryId: string }, never, RegionAgentsMutationRequest, MutationData>
}
