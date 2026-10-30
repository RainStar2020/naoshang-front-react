/** HQ-05 专栏内容（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type ColumnsAction = 'publish' | 'unpublish' | 'update' | 'archive'
export type ColumnsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: ColumnsAction } & T>
export type ColumnsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface ColumnsListQuery extends PaginationQuery { }
export type ColumnsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type ColumnsDetailResponse<T = unknown> = ApiResponse<T>

export interface ColumnsEndpoints {
  /** 专栏筛选项与汇总。 */
  'GET /columns/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 专栏详情（含已发布章节）。 */
  'GET /columns/:columnId': Endpoint<{ columnId: string }, UndocumentedFields, never, unknown>
  /** 专栏下的学习/购买记录。 */
  'GET /columns/:columnId/records': Endpoint<{ columnId: string }, UndocumentedFields, never, unknown>
  /** 专栏写操作：发布/下架/更新/归档。 */
  'POST /columns/:columnId/mutate': Endpoint<{ columnId: string }, never, ColumnsMutationRequest, MutationData>
  /** 上传/关联专栏素材资源。 */
  'POST /columns/assets': Endpoint<never, never, MutationRequest, MutationData>
}
