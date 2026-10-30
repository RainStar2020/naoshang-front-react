/** HQ-12 履约发货（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type DeliveryAction = 'ship' | 'deliver' | 'cancel' | 'update-tracking'
export type DeliveryMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: DeliveryAction } & T>
export type DeliveryMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface DeliveryListQuery extends PaginationQuery { }
export type DeliveryListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type DeliveryDetailResponse<T = unknown> = ApiResponse<T>

export interface DeliveryEndpoints {
  /** 发货单分页列表。 */
  'GET /delivery/shipments': Endpoint<never, DeliveryListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /delivery/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 发货单详情。 */
  'GET /delivery/shipments/:shipmentId': Endpoint<{ shipmentId: string }, UndocumentedFields, never, unknown>
  /** 发货单写操作：发货/妥投/取消/更新物流。 */
  'POST /delivery/shipments/:shipmentId/mutate': Endpoint<{ shipmentId: string }, never, DeliveryMutationRequest, MutationData>
  /** 新建发货单。 */
  'POST /delivery/shipments': Endpoint<never, never, MutationRequest, MutationData>
}
