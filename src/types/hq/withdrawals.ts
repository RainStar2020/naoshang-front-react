/** HQ-17 提现（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type WithdrawalsAction = 'approve' | 'reject' | 'paid' | 'reverse'
export type WithdrawalsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: WithdrawalsAction } & T>
export type WithdrawalsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface WithdrawalsListQuery extends PaginationQuery { }
export type WithdrawalsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type WithdrawalsDetailResponse<T = unknown> = ApiResponse<T>

export interface WithdrawalsEndpoints {
  /** 提现申请分页列表。 */
  'GET /withdrawals': Endpoint<never, WithdrawalsListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /withdrawals/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 提现详情（含手续费）。 */
  'GET /withdrawals/:withdrawalId': Endpoint<{ withdrawalId: string }, UndocumentedFields, never, unknown>
  /** 提现写操作：通过/驳回/已打款/冲正。 */
  'POST /withdrawals/:withdrawalId/mutate': Endpoint<{ withdrawalId: string }, never, WithdrawalsMutationRequest, MutationData>
}
