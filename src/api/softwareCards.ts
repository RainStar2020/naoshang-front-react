/** HQ-09 软件卡（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { SoftwareCardsEndpoints } from '../types/hq/softwareCards'

/**
 * 软件卡分页列表。
 * @see GET /api/hq/software-cards
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSoftwareCards(query?: SoftwareCardsEndpoints['GET /software-cards']['query'], options: RequestOptions = {}): Promise<SoftwareCardsEndpoints['GET /software-cards']['response']> {
  const response = await apiClient.get<SoftwareCardsEndpoints['GET /software-cards']['response']>('/software-cards', { ...options, params: query })
  return response.data
}

/**
 * 软件卡批次列表。
 * @see GET /api/hq/software-cards/batches
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSoftwareCardsBatches(query?: SoftwareCardsEndpoints['GET /software-cards/batches']['query'], options: RequestOptions = {}): Promise<SoftwareCardsEndpoints['GET /software-cards/batches']['response']> {
  const response = await apiClient.get<SoftwareCardsEndpoints['GET /software-cards/batches']['response']>('/software-cards/batches', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/software-cards/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSoftwareCardsCatalog(query?: SoftwareCardsEndpoints['GET /software-cards/catalog']['query'], options: RequestOptions = {}): Promise<SoftwareCardsEndpoints['GET /software-cards/catalog']['response']> {
  const response = await apiClient.get<SoftwareCardsEndpoints['GET /software-cards/catalog']['response']>('/software-cards/catalog', { ...options, params: query })
  return response.data
}

/**
 * 新建软件卡批次。
 * @see POST /api/hq/software-cards/batches
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postSoftwareCardsBatches(request: SoftwareCardsEndpoints['POST /software-cards/batches']['request'], options: RequestOptions = {}): Promise<SoftwareCardsEndpoints['POST /software-cards/batches']['response']> {
  const response = await apiClient.post<SoftwareCardsEndpoints['POST /software-cards/batches']['response']>('/software-cards/batches', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 软件卡写操作：激活/停用/作废/绑定用户。
 * @see POST /api/hq/software-cards/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postSoftwareCardsMutate(request: SoftwareCardsEndpoints['POST /software-cards/mutate']['request'], options: RequestOptions = {}): Promise<SoftwareCardsEndpoints['POST /software-cards/mutate']['response']> {
  const response = await apiClient.post<SoftwareCardsEndpoints['POST /software-cards/mutate']['response']>('/software-cards/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
