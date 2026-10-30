/** HQ-18 员工与角色（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type StaffAction = 'create' | 'update' | 'disable' | 'assign-store'
export type StaffMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: StaffAction } & T>
export type StaffMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface StaffListQuery extends PaginationQuery { }
export type StaffListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type StaffDetailResponse<T = unknown> = ApiResponse<T>

export interface StaffEndpoints {
  /** 员工分页列表。 */
  'GET /staff': Endpoint<never, StaffListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /staff/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 员工详情与归属门店。 */
  'GET /staff/:staffId': Endpoint<{ staffId: string }, UndocumentedFields, never, unknown>
  /** 新建员工。 */
  'POST /staff/mutate': Endpoint<never, never, StaffMutationRequest, MutationData>
  /** 员工写操作：改资料/停用/分配门店。 */
  'POST /staff/:staffId/mutate': Endpoint<{ staffId: string }, never, StaffMutationRequest, MutationData>
}
