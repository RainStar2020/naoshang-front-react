/** HQ-03 会员档案（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type MembersAction = 'update-profile' | 'bind-store' | 'unbind-store' | 'set-status'
export type MembersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: MembersAction } & T>
export type MembersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface MembersListQuery extends PaginationQuery { }
export type MembersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type MembersDetailResponse<T = unknown> = ApiResponse<T>

export interface MembersEndpoints {
  /** 会员分页列表。 */
  'GET /members': Endpoint<never, MembersListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /members/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 会员详情（含归属门店名）。 */
  'GET /members/:memberId': Endpoint<{ memberId: string }, UndocumentedFields, never, unknown>
  /** 会员写操作：改资料/绑定或解绑门店/设状态。 */
  'POST /members/:memberId/mutate': Endpoint<{ memberId: string }, never, MembersMutationRequest, MutationData>
}
