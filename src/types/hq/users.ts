/** HQ-02 账号管理（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type UsersAction = 'freeze' | 'unfreeze' | 'update-note'
export type UsersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<({ action: 'freeze' | 'unfreeze' } | { action: 'update-note'; note: string }) & T>
export type UsersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface UsersListQuery extends PaginationQuery { keyword?: string; frozen?: boolean; tier?: string }
export type UsersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type UsersDetailResponse<T = unknown> = ApiResponse<T>

export interface UsersEndpoints {
  /** 账号分页列表，支持 `keyword` / `frozen` / `tier` 过滤。 */
  'GET /users': Endpoint<never, UsersListQuery, never, PageData>
  /** 筛选项与汇总（总数/冻结数/活跃数）。 */
  'GET /users/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 账号详情：profile + 关联会员 + 审计摘要（手机号完整）。 */
  'GET /users/:accountId': Endpoint<{ accountId: string }, UndocumentedFields, never, unknown>
  /** 账号写操作：冻结/解冻/备注（reason + version + 幂等）。 */
  'POST /users/:accountId/mutate': Endpoint<{ accountId: string }, never, UsersMutationRequest, MutationData>
}
