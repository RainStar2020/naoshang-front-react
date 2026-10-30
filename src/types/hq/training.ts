/** HQ-20 培训课时（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type TrainingAction = 'grant' | 'deduct' | 'freeze' | 'reset'
export type TrainingMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: TrainingAction } & T>
export type TrainingMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface TrainingListQuery extends PaginationQuery { }
export type TrainingListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type TrainingDetailResponse<T = unknown> = ApiResponse<T>

export interface TrainingEndpoints {
  /** 课时余额分页列表。 */
  'GET /training/balances': Endpoint<never, TrainingListQuery, never, PageData>
  /** 培训反馈列表。 */
  'GET /training/feedback': Endpoint<never, UndocumentedFields, never, unknown>
  /** 筛选项与汇总。 */
  'GET /training/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 单会员课时明细。 */
  'GET /training/members/:memberId': Endpoint<{ memberId: string }, UndocumentedFields, never, unknown>
  /** 课时写操作：发放/扣减/冻结/重置。 */
  'POST /training/mutate': Endpoint<never, never, TrainingMutationRequest, MutationData>
}
