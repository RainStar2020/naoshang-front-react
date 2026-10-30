/** HQ-15 支付对账（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { ApiResponse, Endpoint, PaginationQuery, PageData, UndocumentedFields, MutationRequest, MutationData, AuditLog } from './common'

export type PaymentsAction = 'reconcile' | 'mark-settled' | 'flag-exception' | 'ignore'
export type PaymentsMutationRequest<T extends object = UndocumentedFields> = MutationRequest<{ action: PaymentsAction } & T>
export type PaymentsMutationResponse<T extends object = UndocumentedFields> = ApiResponse<MutationData<T>>

export interface PaymentsListQuery extends PaginationQuery { }
export type PaymentsListResponse<T = unknown, S = unknown> = ApiResponse<PageData<T, S>>
export type PaymentsDetailResponse<T = unknown> = ApiResponse<T>

/** /payments/export 局域网服务实测返回：CSV 内容位于 JSON 信封内。 */
export interface PaymentsExportData { fileName: string; contentType: string; rowCount: number; csv: string }

export interface PaymentsEndpoints {
  /** 筛选项与汇总。 */
  'GET /payments/catalog': Endpoint<never, UndocumentedFields, never, unknown>
  /** 支付流水分页列表。 */
  'GET /payments': Endpoint<never, PaymentsListQuery, never, PageData>
  /** 单笔支付详情。 */
  'GET /payments/:paymentId': Endpoint<{ paymentId: string }, UndocumentedFields, never, unknown>
  /** 对账任务详情。 */
  'GET /payments/jobs/:jobId': Endpoint<{ jobId: string }, UndocumentedFields, never, unknown>
  /** 导出对账 CSV。 */
  'GET /payments/export': Endpoint<never, UndocumentedFields, never, PaymentsExportData>
  /** 支付写操作：触发对账/标记已结算/标异常/忽略。 */
  'POST /payments/mutate': Endpoint<never, never, PaymentsMutationRequest, MutationData>
}
