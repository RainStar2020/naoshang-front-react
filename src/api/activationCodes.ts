/** HQ-08 激活码（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { ActivationCodesEndpoints } from '../types/hq/activationCodes'

/**
 * 激活码批次列表。
 * @see GET /api/hq/activation-codes/batches
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getActivationCodesBatches(query?: ActivationCodesEndpoints['GET /activation-codes/batches']['query'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['GET /activation-codes/batches']['response']> {
  const response = await apiClient.get<ActivationCodesEndpoints['GET /activation-codes/batches']['response']>('/activation-codes/batches', { ...options, params: query })
  return response.data
}

/**
 * 批次详情与统计。
 * @see GET /api/hq/activation-codes/batches/:batchId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getActivationCodesBatchesByBatchId(path: ActivationCodesEndpoints['GET /activation-codes/batches/:batchId']['path'], query?: ActivationCodesEndpoints['GET /activation-codes/batches/:batchId']['query'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['GET /activation-codes/batches/:batchId']['response']> {
  const response = await apiClient.get<ActivationCodesEndpoints['GET /activation-codes/batches/:batchId']['response']>(`/activation-codes/batches/${encodeURIComponent(path.batchId)}`, { ...options, params: query })
  return response.data
}

/**
 * 激活码分页列表（码面脱敏）。
 * @see GET /api/hq/activation-codes
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getActivationCodes(query?: ActivationCodesEndpoints['GET /activation-codes']['query'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['GET /activation-codes']['response']> {
  const response = await apiClient.get<ActivationCodesEndpoints['GET /activation-codes']['response']>('/activation-codes', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/activation-codes/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getActivationCodesCatalog(query?: ActivationCodesEndpoints['GET /activation-codes/catalog']['query'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['GET /activation-codes/catalog']['response']> {
  const response = await apiClient.get<ActivationCodesEndpoints['GET /activation-codes/catalog']['response']>('/activation-codes/catalog', { ...options, params: query })
  return response.data
}

/**
 * 新建激活码批次（生成 N 个码）。
 * @see POST /api/hq/activation-codes/batches
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postActivationCodesBatches(request: ActivationCodesEndpoints['POST /activation-codes/batches']['request'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['POST /activation-codes/batches']['response']> {
  const response = await apiClient.post<ActivationCodesEndpoints['POST /activation-codes/batches']['response']>('/activation-codes/batches', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 激活码写操作：启用/停用/作废/改归属。
 * @see POST /api/hq/activation-codes/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postActivationCodesMutate(request: ActivationCodesEndpoints['POST /activation-codes/mutate']['request'], options: RequestOptions = {}): Promise<ActivationCodesEndpoints['POST /activation-codes/mutate']['response']> {
  const response = await apiClient.post<ActivationCodesEndpoints['POST /activation-codes/mutate']['response']>('/activation-codes/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
