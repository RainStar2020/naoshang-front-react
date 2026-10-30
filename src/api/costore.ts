/** HQ-24 共创店（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { CostoreEndpoints } from '../types/hq/costore'

/**
 * 共创店申请分页列表。
 * @see GET /api/hq/costore/applications
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCostoreApplications(query?: CostoreEndpoints['GET /costore/applications']['query'], options: RequestOptions = {}): Promise<CostoreEndpoints['GET /costore/applications']['response']> {
  const response = await apiClient.get<CostoreEndpoints['GET /costore/applications']['response']>('/costore/applications', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/costore/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCostoreCatalog(query?: CostoreEndpoints['GET /costore/catalog']['query'], options: RequestOptions = {}): Promise<CostoreEndpoints['GET /costore/catalog']['response']> {
  const response = await apiClient.get<CostoreEndpoints['GET /costore/catalog']['response']>('/costore/catalog', { ...options, params: query })
  return response.data
}

/**
 * 申请详情与方案。
 * @see GET /api/hq/costore/applications/:applicationId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCostoreApplicationsByApplicationId(path: CostoreEndpoints['GET /costore/applications/:applicationId']['path'], query?: CostoreEndpoints['GET /costore/applications/:applicationId']['query'], options: RequestOptions = {}): Promise<CostoreEndpoints['GET /costore/applications/:applicationId']['response']> {
  const response = await apiClient.get<CostoreEndpoints['GET /costore/applications/:applicationId']['response']>(`/costore/applications/${encodeURIComponent(path.applicationId)}`, { ...options, params: query })
  return response.data
}

/**
 * 共创店写操作：通过/驳回/激活/终止。
 * @see POST /api/hq/costore/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postCostoreMutate(request: CostoreEndpoints['POST /costore/mutate']['request'], options: RequestOptions = {}): Promise<CostoreEndpoints['POST /costore/mutate']['response']> {
  const response = await apiClient.post<CostoreEndpoints['POST /costore/mutate']['response']>('/costore/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
