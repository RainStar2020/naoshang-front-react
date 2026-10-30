/** HQ-21 转店（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type TransfersAction = 'approve' | 'reject' | 'complete' | 'cancel'
export type TransfersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: TransfersAction } & T>
export type TransfersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface TransfersListQuery extends PaginationQuery { }
export type TransfersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type TransfersDetailResponse<T = unknown> = ApiResponse<T>

export interface TransfersEndpoints {
  /** 转店申请分页列表。 */
  'GET /transfers': Endpoint<never, TransfersListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /transfers/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 转店申请详情（含双方同意态）。 */
  'GET /transfers/:applicationId': Endpoint<{ applicationId: string }, UndocumentedFields, never, unknown>
  /** 转店写操作：通过/驳回/完成/取消。 */
  'POST /transfers/:applicationId/mutate': Endpoint<{ applicationId: string }, never, TransfersMutationRequest, MutationData>
}
