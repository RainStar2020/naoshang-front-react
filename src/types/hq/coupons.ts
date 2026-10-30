/** HQ-14 优惠券（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type CouponsAction = 'create-template' | 'update-template' | 'issue' | 'revoke'
export type CouponsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: CouponsAction } & T>
export type CouponsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface CouponsListQuery extends PaginationQuery { }
export type CouponsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type CouponsDetailResponse<T = unknown> = ApiResponse<T>

export interface CouponsEndpoints {
  /** 筛选项与汇总。 */
  'GET /coupons/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 优惠券模板列表。 */
  'GET /coupons/templates': Endpoint<never, UndocumentedFields, never, unknown>
  /** 已发放优惠券分页列表。 */
  'GET /coupons': Endpoint<never, CouponsListQuery, never, PageData>
  /** 优惠券写操作：建模板/改模板/发放/撤回。 */
  'POST /coupons/mutate': Endpoint<never, never, CouponsMutationRequest, MutationData>
}
