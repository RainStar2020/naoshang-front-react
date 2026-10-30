/** HQ-05 专栏内容（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { ColumnsEndpoints } from '../types/hq/columns'

/**
 * 专栏筛选项与汇总。
 * @see GET /api/hq/columns/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getColumnsCatalog(query?: ColumnsEndpoints['GET /columns/catalog']['query'], options: RequestOptions = {}): Promise<ColumnsEndpoints['GET /columns/catalog']['response']> {
  const response = await apiClient.get<ColumnsEndpoints['GET /columns/catalog']['response']>('/columns/catalog', { ...options, params: query })
  return response.data
}

/**
 * 专栏详情（含已发布章节）。
 * @see GET /api/hq/columns/:columnId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getColumnsByColumnId(path: ColumnsEndpoints['GET /columns/:columnId']['path'], query?: ColumnsEndpoints['GET /columns/:columnId']['query'], options: RequestOptions = {}): Promise<ColumnsEndpoints['GET /columns/:columnId']['response']> {
  const response = await apiClient.get<ColumnsEndpoints['GET /columns/:columnId']['response']>(`/columns/${encodeURIComponent(path.columnId)}`, { ...options, params: query })
  return response.data
}

/**
 * 专栏下的学习/购买记录。
 * @see GET /api/hq/columns/:columnId/records
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getColumnsByColumnIdRecords(path: ColumnsEndpoints['GET /columns/:columnId/records']['path'], query?: ColumnsEndpoints['GET /columns/:columnId/records']['query'], options: RequestOptions = {}): Promise<ColumnsEndpoints['GET /columns/:columnId/records']['response']> {
  const response = await apiClient.get<ColumnsEndpoints['GET /columns/:columnId/records']['response']>(`/columns/${encodeURIComponent(path.columnId)}/records`, { ...options, params: query })
  return response.data
}

/**
 * 专栏写操作：发布/下架/更新/归档。
 * @see POST /api/hq/columns/:columnId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postColumnsByColumnIdMutate(path: ColumnsEndpoints['POST /columns/:columnId/mutate']['path'], request: ColumnsEndpoints['POST /columns/:columnId/mutate']['request'], options: RequestOptions = {}): Promise<ColumnsEndpoints['POST /columns/:columnId/mutate']['response']> {
  const response = await apiClient.post<ColumnsEndpoints['POST /columns/:columnId/mutate']['response']>(`/columns/${encodeURIComponent(path.columnId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 上传/关联专栏素材资源。
 * @see POST /api/hq/columns/assets
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postColumnsAssets(request: ColumnsEndpoints['POST /columns/assets']['request'], options: RequestOptions = {}): Promise<ColumnsEndpoints['POST /columns/assets']['response']> {
  const response = await apiClient.post<ColumnsEndpoints['POST /columns/assets']['response']>('/columns/assets', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
