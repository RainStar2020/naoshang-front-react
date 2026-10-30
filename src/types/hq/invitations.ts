/** HQ-23 邀请关系（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type InvitationsAction = 'bind' | 'unbind' | 'rebuild' | 'correct'
export type InvitationsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: InvitationsAction } & T>
export type InvitationsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface InvitationsListQuery extends PaginationQuery { }
export type InvitationsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type InvitationsDetailResponse<T = unknown> = ApiResponse<T>

/** 邀请关系同时校验 version 与 graphVersion；后者的数据类型文档未定义。 */
export interface InvitationGraphVersion { graphVersion: unknown }

export interface InvitationsEndpoints {
  /** 邀请关系分页列表。 */
  'GET /invitations': Endpoint<never, InvitationsListQuery, never, PageData>
  /** 单账号邀请关系。 */
  'GET /invitations/:accountId': Endpoint<{ accountId: string }, UndocumentedFields, never, unknown>
  /** 团队树（含 `graphVersion`）。 */
  'GET /invitations/:accountId/team': Endpoint<{ accountId: string }, UndocumentedFields, never, unknown>
  /** 邀请写操作：绑定/解绑/重建/纠错。 */
  'POST /invitations/mutate': Endpoint<never, never, InvitationsMutationRequest, MutationData>
}
