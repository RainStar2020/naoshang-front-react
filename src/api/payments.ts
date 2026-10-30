/** HQ-15 支付对账（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { PaymentsEndpoints } from '../types/hq/payments'

/**
 * 筛选项与汇总。
 * @see GET /api/hq/payments/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPaymentsCatalog(query?: PaymentsEndpoints['GET /payments/catalog']['query'], options: RequestOptions = {}): Promise<PaymentsEndpoints['GET /payments/catalog']['response']> {
  const response = await apiClient.get<PaymentsEndpoints['GET /payments/catalog']['response']>('/payments/catalog', { ...options, params: query })
  return response.data
}

/**
 * 支付流水分页列表。
 * @see GET /api/hq/payments
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPayments(query?: PaymentsEndpoints['GET /payments']['query'], options: RequestOptions = {}): Promise<PaymentsEndpoints['GET /payments']['response']> {
  const response = await apiClient.get<PaymentsEndpoints['GET /payments']['response']>('/payments', { ...options, params: query })
  return response.data
}

/**
 * 单笔支付详情。
 * @see GET /api/hq/payments/:paymentId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPaymentsByPaymentId(path: PaymentsEndpoints['GET /payments/:paymentId']['path'], query?: PaymentsEndpoints['GET /payments/:paymentId']['query'], options: RequestOptions = {}): Promise<PaymentsEndpoints['GET /payments/:paymentId']['response']> {
  const response = await apiClient.get<PaymentsEndpoints['GET /payments/:paymentId']['response']>(`/payments/${encodeURIComponent(path.paymentId)}`, { ...options, params: query })
  return response.data
}

/**
 * 对账任务详情。
 * @see GET /api/hq/payments/jobs/:jobId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPaymentsJobsByJobId(path: PaymentsEndpoints['GET /payments/jobs/:jobId']['path'], query?: PaymentsEndpoints['GET /payments/jobs/:jobId']['query'], options: RequestOptions = {}): Promise<PaymentsEndpoints['GET /payments/jobs/:jobId']['response']> {
  const response = await apiClient.get<PaymentsEndpoints['GET /payments/jobs/:jobId']['response']>(`/payments/jobs/${encodeURIComponent(path.jobId)}`, { ...options, params: query })
  return response.data
}

/**
 * 导出对账 CSV。
 * @see GET /api/hq/payments/export
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPaymentsExport(query?: PaymentsEndpoints['GET /payments/export']['query'], options: RequestOptions = {}): Promise<PaymentsEndpoints['GET /payments/export']['response']> {
  const response = await apiClient.get<PaymentsEndpoints['GET /payments/export']['response']>('/payments/export', { ...options, params: query })
  return response.data
}

/**
 * 支付写操作：触发对账/标记已结算/标异常/忽略。
 * @see POST /api/hq/payments/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postPaymentsMutate(request: PaymentsEndpoints['POST /payments/mutate']['request'], options: RequestOptions = {}): Promise<PaymentsEndpoints['POST /payments/mutate']['response']> {
  const response = await apiClient.post<PaymentsEndpoints['POST /payments/mutate']['response']>('/payments/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
