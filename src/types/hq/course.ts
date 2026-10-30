/** HQ-04 课程权益（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type CourseAction = 'grant' | 'revoke' | 'extend' | 'update'
export type CourseMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: CourseAction } & T>
export type CourseMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface CourseListQuery extends PaginationQuery { }
export type CourseListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type CourseDetailResponse<T = unknown> = ApiResponse<T>

export interface CourseEndpoints {
  /** 课程权益分页列表。 */
  'GET /course/entitlements': Endpoint<never, CourseListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /course/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 单条权益详情。 */
  'GET /course/entitlements/:entitlementId': Endpoint<{ entitlementId: string }, UndocumentedFields, never, unknown>
  /** 权益写操作：发放/撤回/延期/改属性。 */
  'POST /course/entitlements/:entitlementId/mutate': Endpoint<{ entitlementId: string }, never, CourseMutationRequest, MutationData>
  /** 新建课程权益发放记录。 */
  'POST /course/entitlements': Endpoint<never, never, MutationRequest, MutationData>
}
