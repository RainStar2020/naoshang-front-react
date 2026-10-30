/** HQ-25 客服工单（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type SupportAction = 'reply' | 'close' | 'reopen' | 'assign' | 'escalate'
export type SupportMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: SupportAction } & T>
export type SupportMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface SupportListQuery extends PaginationQuery { }
export type SupportListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type SupportDetailResponse<T = unknown> = ApiResponse<T>

export interface SupportEndpoints {
  /** 工单分页列表。 */
  'GET /support/tickets': Endpoint<never, SupportListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /support/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 工单详情与对话。 */
  'GET /support/tickets/:ticketId': Endpoint<{ ticketId: string }, UndocumentedFields, never, unknown>
  /** 工单写操作：回复/关闭/重开/分派/升级。 */
  'POST /support/tickets/:ticketId/mutate': Endpoint<{ ticketId: string }, never, SupportMutationRequest, MutationData>
  /** 新建工单。 */
  'POST /support/tickets': Endpoint<never, never, MutationRequest, MutationData>
}
