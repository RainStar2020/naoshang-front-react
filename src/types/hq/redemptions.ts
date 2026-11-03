/** HQ redemptions 兑换/核销（3 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { Endpoint, PaginationQuery, UndocumentedFields, MutationRequest, MutationData } from './common'

export type RedemptionsAction = 'approve' | 'reject' | 'fulfill' | 'cancel' | 'note'
export type RedemptionsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: RedemptionsAction } & T>

export interface RedemptionsListQuery extends PaginationQuery {
  keyword?: string
  status?: string
}

export interface RedemptionsEndpoints {
  /** 兑换目录/筛选项与汇总。 */
  'GET /redemptions/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 兑换详情。 */
  'GET /redemptions/:redemptionId': Endpoint<{ redemptionId: string }, UndocumentedFields, never, unknown>
  /** 兑换写操作。 */
  'POST /redemptions/:redemptionId/mutate': Endpoint<{ redemptionId: string }, never, RedemptionsMutationRequest, MutationData>
}
