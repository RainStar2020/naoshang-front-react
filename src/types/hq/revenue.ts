/** HQ-16 收益（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type RevenueAction = 'adjust' | 'freeze' | 'unfreeze' | 'settle'
export type RevenueMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: RevenueAction } & T>
export type RevenueMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface RevenueListQuery extends PaginationQuery { }
export type RevenueListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type RevenueDetailResponse<T = unknown> = ApiResponse<T>

export interface RevenueEndpoints {
  /** 收益账户分页列表。 */
  'GET /revenue/accounts': Endpoint<never, RevenueListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /revenue/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 收益明细流水。 */
  'GET /revenue/ledgers': Endpoint<never, UndocumentedFields, never, unknown>
  /** 单账户收益详情。 */
  'GET /revenue/accounts/:accountId': Endpoint<{ accountId: string }, UndocumentedFields, never, unknown>
  /** 收益写操作：调整/冻结/解冻/结算。 */
  'POST /revenue/mutate': Endpoint<never, never, RevenueMutationRequest, MutationData>
}
