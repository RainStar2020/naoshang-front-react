/** 后台API.md v1.0。金额单位为元；小数位、整数与分页上限须在运行时校验。 */
export type MoneyYuan = number
export type Integer = number
export type ISODateTime = string
export type ApiErrorCode = 40100 | 40300 | 40400 | 40000 | 40900 | 40901 | 40902 | 40903 | 50000
export interface ApiSuccess<T> { code: 0; message: string; data: T }
export interface ApiFailure {
  code: ApiErrorCode
  message: string
  data: null
  currentVersion?: number
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure
export interface PaginationQuery { /** 默认 1 */ page?: number; /** 默认 20，上限 100 */ pageSize?: number }
export interface PageData<T = unknown, S = unknown> { items: T[]; total: number; page: number; pageSize: number; summary?: S }
/** 未逐字段定义的数据使用 unknown；接入完整契约后通过泛型细化。 */
export type UndocumentedFields = Record<string, unknown>
export interface MutationFields { idempotencyKey?: string; version?: number }
/** reason 可放在 body 或 X-Reason；至少提供一处。 */
export type MutationRequest<B = UndocumentedFields> = (
  | { body: B & MutationFields & { reason: string }; headers?: MutationHeaders }
  | { body: B & MutationFields & { reason?: string }; headers: MutationHeaders & { 'X-Reason': string } }
)
export interface MutationHeaders { 'X-Reason'?: string; 'Idempotency-Key'?: string }
export interface MutationReceipt { operationId: string }
export type MutationData<T extends object = UndocumentedFields> = T & MutationReceipt
/** 请求描述类型；body、headers 分开，避免把审计请求头误发到 JSON 中。 */
export interface Endpoint<P = never, Q = never, B = never, D = unknown> {
  /** 完整请求输入，保留 body 与 headers 之间的联合类型约束。 */
  request: B
  path: P
  query: Q
  body: B extends { body: unknown } ? B['body'] : B
  headers: B extends { body: unknown } ? MutationHeaders : never
  response: ApiResponse<D>
}
export interface AuditLog<TBefore = unknown, TAfter = unknown> {
  id: string
  module: string
  action: string
  targetId: string | null
  operatorId: string
  operatorName: string
  reason: string | null
  before: TBefore | null
  after: TAfter | null
  occurredAt: ISODateTime | null
  requestId: string | null
}
