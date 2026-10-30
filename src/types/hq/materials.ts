/** HQ-07 资料中心（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type MaterialsAction = 'publish' | 'unpublish' | 'update' | 'delete'
export type MaterialsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: MaterialsAction } & T>
export type MaterialsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface MaterialsListQuery extends PaginationQuery { }
export type MaterialsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type MaterialsDetailResponse<T = unknown> = ApiResponse<T>

export interface MaterialsEndpoints {
  /** 资料分页列表。 */
  'GET /materials': Endpoint<never, MaterialsListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /materials/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 资料详情与下载信息。 */
  'GET /materials/:materialId': Endpoint<{ materialId: string }, UndocumentedFields, never, unknown>
  /** 新建资料。 */
  'POST /materials/mutate': Endpoint<never, never, MaterialsMutationRequest, MutationData>
  /** 上传资料素材文件。 */
  'POST /materials/assets': Endpoint<never, never, MutationRequest, MutationData>
}
