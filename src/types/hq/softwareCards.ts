/** HQ-09 软件卡（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type SoftwareCardsAction = 'activate' | 'deactivate' | 'revoke' | 'bind'
export type SoftwareCardsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: SoftwareCardsAction } & T>
export type SoftwareCardsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface SoftwareCardsListQuery extends PaginationQuery { }
export type SoftwareCardsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type SoftwareCardsDetailResponse<T = unknown> = ApiResponse<T>

export interface SoftwareCardsEndpoints {
  /** 软件卡分页列表。 */
  'GET /software-cards': Endpoint<never, SoftwareCardsListQuery, never, PageData>
  /** 软件卡批次列表。 */
  'GET /software-cards/batches': Endpoint<never, UndocumentedFields, never, unknown>
  /** 筛选项与汇总。 */
  'GET /software-cards/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 新建软件卡批次。 */
  'POST /software-cards/batches': Endpoint<never, never, MutationRequest, MutationData>
  /** 软件卡写操作：激活/停用/作废/绑定用户。 */
  'POST /software-cards/mutate': Endpoint<never, never, SoftwareCardsMutationRequest, MutationData>
}
