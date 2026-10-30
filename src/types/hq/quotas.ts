/** HQ-10 配额（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type QuotasAction = 'adjust' | 'freeze' | 'unfreeze' | 'reset'
export type QuotasMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: QuotasAction } & T>
export type QuotasMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface QuotasListQuery extends PaginationQuery { }
export type QuotasListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type QuotasDetailResponse<T = unknown> = ApiResponse<T>

export interface QuotasEndpoints {
  /** 配额账户分页列表。 */
  'GET /quotas': Endpoint<never, QuotasListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /quotas/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 配额账户详情与流水。 */
  'GET /quotas/:quotaId': Endpoint<{ quotaId: string }, UndocumentedFields, never, unknown>
  /** 配额写操作：调整/冻结/解冻/重置。 */
  'POST /quotas/:quotaId/mutate': Endpoint<{ quotaId: string }, never, QuotasMutationRequest, MutationData>
}
