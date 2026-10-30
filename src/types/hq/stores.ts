/** HQ-19 门店（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type StoresAction = 'create' | 'update' | 'disable' | 'enable' | 'change-owner' | 'assign-owner'
export type StoresMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: StoresAction } & T>
export type StoresMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface StoresListQuery extends PaginationQuery { }
export type StoresListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type StoresDetailResponse<T = unknown> = ApiResponse<T>

export interface StoresEndpoints {
  /** 门店分页列表（合并视图）。 */
  'GET /stores': Endpoint<never, StoresListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /stores/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 门店详情与负责人。 */
  'GET /stores/:storeId': Endpoint<{ storeId: string }, UndocumentedFields, never, unknown>
  /** 新建门店。 */
  'POST /stores/mutate': Endpoint<never, never, StoresMutationRequest, MutationData>
  /** 门店写操作：改资料/停用/启用/更换店主。 */
  'POST /stores/:storeId/mutate': Endpoint<{ storeId: string }, never, StoresMutationRequest, MutationData>
}
