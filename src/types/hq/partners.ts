/** HQ-22 合伙人（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type PartnersAction = 'save-context' | 'save-benefits' | 'promote' | 'demote'
export type PartnersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: PartnersAction } & T>
export type PartnersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface PartnersListQuery extends PaginationQuery { }
export type PartnersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type PartnersDetailResponse<T = unknown> = ApiResponse<T>

export interface PartnersEndpoints {
  /** 合伙人分页列表。 */
  'GET /partners': Endpoint<never, PartnersListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /partners/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 合伙人档案详情（含权益，手机号脱敏）。 */
  'GET /partners/:contextId': Endpoint<{ contextId: string }, UndocumentedFields, never, unknown>
  /** 合伙人写操作：存档案/存权益/升级/降级。 */
  'POST /partners/mutate': Endpoint<never, never, PartnersMutationRequest, MutationData>
}
