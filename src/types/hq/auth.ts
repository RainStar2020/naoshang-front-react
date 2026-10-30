/** HQ-01 登录与会话（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export interface AuthListQuery extends PaginationQuery { }
export type AuthListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type AuthDetailResponse<T = unknown> = ApiResponse<T>

export interface Admin { adminId: string; username: string; displayName: string; role: 'admin' }
/** 局域网服务 /auth/me 实测返回，2026-10-28。 */
export interface CurrentAdmin extends Admin {
  hqPermissions: string[]
  status: string
  version: number
  tokenExpiresAt: string
}
export interface LoginRequest { username: string; password: string }
export interface LoginData { token: string; admin: Admin; expiresAt: string }
export type LoginResponse = ApiResponse<LoginData>
/** password 的字段仍待补充；me 已按真实响应补齐。 */

export interface AuthEndpoints {
  /** 管理员登录，校验口令并签发 `hq-admin-` 会话 token。 */
  'POST /auth/login': Endpoint<never, never, LoginRequest, LoginData>
  /** 注销当前会话，使 token 立即失效。 */
  'POST /auth/logout': Endpoint<never, never, UndocumentedFields, { ok: boolean }>
  /** 返回当前管理员资料与 token 过期时间。 */
  'GET /auth/me': Endpoint<never, UndocumentedFields, never, CurrentAdmin>
  /** 修改当前管理员口令（校验原口令；改密后强制重登）。 */
  'POST /auth/password': Endpoint<never, never, UndocumentedFields, unknown>
}
