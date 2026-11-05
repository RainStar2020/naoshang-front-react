/** HQ-02 账号管理（含门店绑定）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type UsersAction = 'freeze' | 'unfreeze' | 'update-note'
export type UsersMutationRequest<T extends object = UndocumentedFields> = MutationRequest<({ action: 'freeze' | 'unfreeze' } | { action: 'update-note'; note: string }) & T>
export type UsersMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface UsersListQuery extends PaginationQuery { keyword?: string; frozen?: boolean; tier?: string }
export type UsersListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type UsersDetailResponse<T = unknown> = ApiResponse<T>

/** §5.1 GET /users/:accountId/store-binding */
export interface HqStoreBindingState {
  bound: boolean
  storeId?: string | null
  storeName?: string | null
  storeNo?: string | null
  storeCode?: string | null
  label?: string | null
}

export interface HqStoreBindingOption {
  id: string
  storeNo?: string
  name: string
  address?: string
  isHeadquarters?: boolean
}

export interface HqStoreBindingData {
  profile?: UndocumentedFields
  binding: HqStoreBindingState
  stores: HqStoreBindingOption[]
}

export interface HqStoreBindingPostBody {
  storeId: string
  reason?: string
}

export interface HqStoreBindingPostData {
  binding: HqStoreBindingState
  operationId: string
}

export interface HqStoreBindingDeleteBody {
  reason?: string
}

export interface HqStoreBindingDeleteData {
  removed: number
  binding: HqStoreBindingState
  operationId: string
}

export interface UsersEndpoints {
  /** 账号分页列表，支持 `keyword` / `frozen` / `tier` 过滤。 */
  'GET /users': Endpoint<never, UsersListQuery, never, PageData>
  /** 筛选项与汇总（总数/冻结数/活跃数）。 */
  'GET /users/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 账号详情：profile + 关联会员 + 审计摘要（手机号完整）。 */
  'GET /users/:accountId': Endpoint<{ accountId: string }, UndocumentedFields, never, unknown>
  /** 账号写操作：冻结/解冻/备注（reason + version + 幂等）。 */
  'POST /users/:accountId/mutate': Endpoint<{ accountId: string }, never, UsersMutationRequest, MutationData>
  /** 查询指定用户门店绑定与可选门店列表（含 HQ）。 */
  'GET /users/:accountId/store-binding': Endpoint<{ accountId: string }, never, never, HqStoreBindingData>
  /** 绑定/更换门店；一人一店，重复绑定覆盖。 */
  'POST /users/:accountId/store-binding': Endpoint<{ accountId: string }, never, { body: HqStoreBindingPostBody }, HqStoreBindingPostData>
  /** 解绑门店。 */
  'DELETE /users/:accountId/store-binding': Endpoint<{ accountId: string }, never, { body: HqStoreBindingDeleteBody }, HqStoreBindingDeleteData>
}
