/** HQ-26 追踪溯源（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export interface TraceListQuery extends PaginationQuery { }

export interface TraceQuery extends PaginationQuery { module?: string; action?: string }
/** 操作人和时间筛选参数的准确键名未定义。 */
/** 追踪接口将底层审计 id 以 traceId 返回（局域网服务实测）。 */
export interface TraceRecord extends Omit<AuditLog, 'id'> { traceId: string }
export type TraceListResponse = ApiResponse<PageData<TraceRecord>>
export type TraceDetailResponse = ApiResponse<TraceRecord>

export interface TraceEndpoints {
  /** 全量审计轨迹分页（只读）。 */
  'GET /trace': Endpoint<never, TraceQuery, never, PageData<TraceRecord>>
  /** 筛选项与汇总。 */
  'GET /trace/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 单条审计详情。 */
  'GET /trace/:traceId': Endpoint<{ traceId: string }, UndocumentedFields, never, TraceRecord>
  /** 按请求 ID 追溯。 */
  'GET /trace/by-request/:requestId': Endpoint<{ requestId: string }, UndocumentedFields, never, unknown>
}
