/** HQ-06 公告（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type AnnouncementsAction = 'publish' | 'unpublish' | 'update' | 'delete'
export type AnnouncementsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: AnnouncementsAction } & T>
export type AnnouncementsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface AnnouncementsListQuery extends PaginationQuery { }
export type AnnouncementsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type AnnouncementsDetailResponse<T = unknown> = ApiResponse<T>

export interface AnnouncementsEndpoints {
  /** 公告分页列表。 */
  'GET /announcements': Endpoint<never, AnnouncementsListQuery, never, PageData>
  /** 筛选项与汇总。 */
  'GET /announcements/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 公告详情。 */
  'GET /announcements/:announcementId': Endpoint<{ announcementId: string }, UndocumentedFields, never, unknown>
  /** 新建公告。 */
  'POST /announcements/mutate': Endpoint<never, never, AnnouncementsMutationRequest, MutationData>
  /** 公告写操作：发布/撤回/更新/删除。 */
  'POST /announcements/:announcementId/mutate': Endpoint<{ announcementId: string }, never, AnnouncementsMutationRequest, MutationData>
}
