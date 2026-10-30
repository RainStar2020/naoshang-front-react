/** HQ-19 门店（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { StoresEndpoints } from '../types/hq/stores'

/**
 * 门店分页列表（合并视图）。
 * @see GET /api/hq/stores
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStores(query?: StoresEndpoints['GET /stores']['query'], options: RequestOptions = {}): Promise<StoresEndpoints['GET /stores']['response']> {
  const response = await apiClient.get<StoresEndpoints['GET /stores']['response']>('/stores', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/stores/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStoresCatalog(query?: StoresEndpoints['GET /stores/catalog']['query'], options: RequestOptions = {}): Promise<StoresEndpoints['GET /stores/catalog']['response']> {
  const response = await apiClient.get<StoresEndpoints['GET /stores/catalog']['response']>('/stores/catalog', { ...options, params: query })
  return response.data
}

/**
 * 门店详情与负责人。
 * @see GET /api/hq/stores/:storeId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStoresByStoreId(path: StoresEndpoints['GET /stores/:storeId']['path'], query?: StoresEndpoints['GET /stores/:storeId']['query'], options: RequestOptions = {}): Promise<StoresEndpoints['GET /stores/:storeId']['response']> {
  const response = await apiClient.get<StoresEndpoints['GET /stores/:storeId']['response']>(`/stores/${encodeURIComponent(path.storeId)}`, { ...options, params: query })
  return response.data
}

/**
 * 新建门店。
 * @see POST /api/hq/stores/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postStoresMutate(request: StoresEndpoints['POST /stores/mutate']['request'], options: RequestOptions = {}): Promise<StoresEndpoints['POST /stores/mutate']['response']> {
  const response = await apiClient.post<StoresEndpoints['POST /stores/mutate']['response']>('/stores/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 门店写操作：改资料/停用/分配店主。
 * @see POST /api/hq/stores/:storeId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postStoresByStoreIdMutate(path: StoresEndpoints['POST /stores/:storeId/mutate']['path'], request: StoresEndpoints['POST /stores/:storeId/mutate']['request'], options: RequestOptions = {}): Promise<StoresEndpoints['POST /stores/:storeId/mutate']['response']> {
  const response = await apiClient.post<StoresEndpoints['POST /stores/:storeId/mutate']['response']>(`/stores/${encodeURIComponent(path.storeId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
