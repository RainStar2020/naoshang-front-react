/** HQ-24 共创店（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type CostoreAction = 'approve' | 'reject' | 'activate' | 'terminate'
export type CostoreMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: CostoreAction } & T>
export type CostoreMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface CostoreListQuery extends PaginationQuery { }
export type CostoreListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type CostoreDetailResponse<T = unknown> = ApiResponse<T>

export interface CostoreEndpoints {
  /** 共创店申请分页列表。 */
  'GET /costore/applications': Endpoint<never, CostoreListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /costore/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 申请详情与方案。 */
  'GET /costore/applications/:applicationId': Endpoint<{ applicationId: string }, UndocumentedFields, never, unknown>
  /** 共创店写操作：通过/驳回/激活/终止。 */
  'POST /costore/mutate': Endpoint<never, never, CostoreMutationRequest, MutationData>
}
