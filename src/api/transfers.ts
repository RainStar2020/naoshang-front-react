/** HQ-21 转店（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { TransfersEndpoints } from '../types/hq/transfers'

/**
 * 转店申请分页列表。
 * @see GET /api/hq/transfers
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTransfers(query?: TransfersEndpoints['GET /transfers']['query'], options: RequestOptions = {}): Promise<TransfersEndpoints['GET /transfers']['response']> {
  const response = await apiClient.get<TransfersEndpoints['GET /transfers']['response']>('/transfers', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/transfers/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTransfersCatalog(query?: TransfersEndpoints['GET /transfers/catalog']['query'], options: RequestOptions = {}): Promise<TransfersEndpoints['GET /transfers/catalog']['response']> {
  const response = await apiClient.get<TransfersEndpoints['GET /transfers/catalog']['response']>('/transfers/catalog', { ...options, params: query })
  return response.data
}

/**
 * 转店申请详情（含双方同意态）。
 * @see GET /api/hq/transfers/:applicationId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTransfersByApplicationId(path: TransfersEndpoints['GET /transfers/:applicationId']['path'], query?: TransfersEndpoints['GET /transfers/:applicationId']['query'], options: RequestOptions = {}): Promise<TransfersEndpoints['GET /transfers/:applicationId']['response']> {
  const response = await apiClient.get<TransfersEndpoints['GET /transfers/:applicationId']['response']>(`/transfers/${encodeURIComponent(path.applicationId)}`, { ...options, params: query })
  return response.data
}

/**
 * 转店写操作：通过/驳回/完成/取消。
 * @see POST /api/hq/transfers/:applicationId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postTransfersByApplicationIdMutate(path: TransfersEndpoints['POST /transfers/:applicationId/mutate']['path'], request: TransfersEndpoints['POST /transfers/:applicationId/mutate']['request'], options: RequestOptions = {}): Promise<TransfersEndpoints['POST /transfers/:applicationId/mutate']['response']> {
  const response = await apiClient.post<TransfersEndpoints['POST /transfers/:applicationId/mutate']['response']>(`/transfers/${encodeURIComponent(path.applicationId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
