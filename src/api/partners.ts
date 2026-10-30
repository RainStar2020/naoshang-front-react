/** HQ-22 合伙人（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { PartnersEndpoints } from '../types/hq/partners'

/**
 * 合伙人分页列表。
 * @see GET /api/hq/partners
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPartners(query?: PartnersEndpoints['GET /partners']['query'], options: RequestOptions = {}): Promise<PartnersEndpoints['GET /partners']['response']> {
  const response = await apiClient.get<PartnersEndpoints['GET /partners']['response']>('/partners', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/partners/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPartnersCatalog(query?: PartnersEndpoints['GET /partners/catalog']['query'], options: RequestOptions = {}): Promise<PartnersEndpoints['GET /partners/catalog']['response']> {
  const response = await apiClient.get<PartnersEndpoints['GET /partners/catalog']['response']>('/partners/catalog', { ...options, params: query })
  return response.data
}

/**
 * 合伙人档案详情（含权益，手机号脱敏）。
 * @see GET /api/hq/partners/:contextId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getPartnersByContextId(path: PartnersEndpoints['GET /partners/:contextId']['path'], query?: PartnersEndpoints['GET /partners/:contextId']['query'], options: RequestOptions = {}): Promise<PartnersEndpoints['GET /partners/:contextId']['response']> {
  const response = await apiClient.get<PartnersEndpoints['GET /partners/:contextId']['response']>(`/partners/${encodeURIComponent(path.contextId)}`, { ...options, params: query })
  return response.data
}

/**
 * 合伙人写操作：存档案/存权益/升级/降级。
 * @see POST /api/hq/partners/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postPartnersMutate(request: PartnersEndpoints['POST /partners/mutate']['request'], options: RequestOptions = {}): Promise<PartnersEndpoints['POST /partners/mutate']['response']> {
  const response = await apiClient.post<PartnersEndpoints['POST /partners/mutate']['response']>('/partners/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
