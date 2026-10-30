/** HQ-10 配额（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { QuotasEndpoints } from '../types/hq/quotas'

/**
 * 配额账户分页列表。
 * @see GET /api/hq/quotas
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getQuotas(query?: QuotasEndpoints['GET /quotas']['query'], options: RequestOptions = {}): Promise<QuotasEndpoints['GET /quotas']['response']> {
  const response = await apiClient.get<QuotasEndpoints['GET /quotas']['response']>('/quotas', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/quotas/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getQuotasCatalog(query?: QuotasEndpoints['GET /quotas/catalog']['query'], options: RequestOptions = {}): Promise<QuotasEndpoints['GET /quotas/catalog']['response']> {
  const response = await apiClient.get<QuotasEndpoints['GET /quotas/catalog']['response']>('/quotas/catalog', { ...options, params: query })
  return response.data
}

/**
 * 配额账户详情与流水。
 * @see GET /api/hq/quotas/:quotaId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getQuotasByQuotaId(path: QuotasEndpoints['GET /quotas/:quotaId']['path'], query?: QuotasEndpoints['GET /quotas/:quotaId']['query'], options: RequestOptions = {}): Promise<QuotasEndpoints['GET /quotas/:quotaId']['response']> {
  const response = await apiClient.get<QuotasEndpoints['GET /quotas/:quotaId']['response']>(`/quotas/${encodeURIComponent(path.quotaId)}`, { ...options, params: query })
  return response.data
}

/**
 * 配额写操作：调整/冻结/解冻/重置。
 * @see POST /api/hq/quotas/:quotaId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postQuotasByQuotaIdMutate(path: QuotasEndpoints['POST /quotas/:quotaId/mutate']['path'], request: QuotasEndpoints['POST /quotas/:quotaId/mutate']['request'], options: RequestOptions = {}): Promise<QuotasEndpoints['POST /quotas/:quotaId/mutate']['response']> {
  const response = await apiClient.post<QuotasEndpoints['POST /quotas/:quotaId/mutate']['response']>(`/quotas/${encodeURIComponent(path.quotaId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
