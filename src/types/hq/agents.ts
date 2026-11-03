/** HQ agents 代理商/联创（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { Endpoint, PaginationQuery, UndocumentedFields, MutationRequest, MutationData } from './common'

export type AgentsAction = 'create' | 'update' | 'suspend' | 'resume' | 'appoint' | 'revoke'
export type AgentsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: AgentsAction } & T>

export interface AgentsListQuery extends PaginationQuery {}

export interface AgentsEndpoints {
  /** 代理商目录/筛选项与汇总。 */
  'GET /agents/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 代理商详情预览。 */
  'GET /agents/:agentId': Endpoint<{ agentId: string }, UndocumentedFields, never, unknown>
  /** 代理商写操作：创建/更新/停用等。 */
  'POST /agents/mutate': Endpoint<never, never, AgentsMutationRequest, MutationData>
  /** 佣金预览。 */
  'POST /agents/:agentId/commission/preview': Endpoint<{ agentId: string }, never, MutationRequest, unknown>
  /** 佣金结算。 */
  'POST /agents/:agentId/commission/settle': Endpoint<{ agentId: string }, never, MutationRequest, MutationData>
  /** 佣金台账查询。 */
  'GET /agents/:agentId/commission': Endpoint<{ agentId: string }, UndocumentedFields, never, unknown>
}
