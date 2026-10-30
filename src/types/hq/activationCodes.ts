/** HQ-08 激活码（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type ActivationCodesAction = 'activate' | 'deactivate' | 'revoke' | 'reassign'
export type ActivationCodesMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: ActivationCodesAction } & T>
export type ActivationCodesMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface ActivationCodesListQuery extends PaginationQuery { }
export type ActivationCodesListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type ActivationCodesDetailResponse<T = unknown> = ApiResponse<T>

export interface ActivationCodesEndpoints {
  /** 激活码批次列表。 */
  'GET /activation-codes/batches': Endpoint<never, UndocumentedFields, never, unknown>
  /** 批次详情与统计。 */
  'GET /activation-codes/batches/:batchId': Endpoint<{ batchId: string }, UndocumentedFields, never, unknown>
  /** 激活码分页列表（码面脱敏）。 */
  'GET /activation-codes': Endpoint<never, ActivationCodesListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /activation-codes/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 新建激活码批次（生成 N 个码）。 */
  'POST /activation-codes/batches': Endpoint<never, never, MutationRequest, MutationData>
  /** 激活码写操作：启用/停用/作废/改归属。 */
  'POST /activation-codes/mutate': Endpoint<never, never, ActivationCodesMutationRequest, MutationData>
}
