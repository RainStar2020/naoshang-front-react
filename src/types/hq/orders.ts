/** HQ-13 订单（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type OrdersAction = 'mark-paid' | 'refund' | 'cancel' | 'complete'
export type OrdersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: OrdersAction } & T>
export type OrdersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface OrdersListQuery extends PaginationQuery { }
export type OrdersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type OrdersDetailResponse<T = unknown> = ApiResponse<T>

export interface OrdersEndpoints {
  /** 订单分页列表。 */
  'GET /orders': Endpoint<never, OrdersListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /orders/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 订单详情（支付+履约双状态映射）。 */
  'GET /orders/:orderId': Endpoint<{ orderId: string }, UndocumentedFields, never, unknown>
  /** 订单写操作：标记已付/退款/取消/完结。 */
  'POST /orders/:orderId/mutate': Endpoint<{ orderId: string }, never, OrdersMutationRequest, MutationData>
}
