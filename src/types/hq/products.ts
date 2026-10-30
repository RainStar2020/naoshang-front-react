/** HQ-11 商品（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type ProductsAction = 'create' | 'update' | 'on-shelf' | 'off-shelf' | 'update-price'
export type ProductsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: ProductsAction } & T>
export type ProductsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface ProductsListQuery extends PaginationQuery { }
export type ProductsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type ProductsDetailResponse<T = unknown> = ApiResponse<T>

export interface ProductsEndpoints {
  /** 商品分页列表。 */
  'GET /products': Endpoint<never, ProductsListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /products/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 商品详情（含 SKU 与价格，两位小数）。 */
  'GET /products/:productId': Endpoint<{ productId: string }, UndocumentedFields, never, unknown>
  /** 新建商品（含 SKU）。 */
  'POST /products/mutate': Endpoint<never, never, ProductsMutationRequest, MutationData>
  /** 商品写操作：改资料/上下架/改价。 */
  'POST /products/:productId/mutate': Endpoint<{ productId: string }, never, ProductsMutationRequest, MutationData>
}
