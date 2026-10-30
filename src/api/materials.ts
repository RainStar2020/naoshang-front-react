/** HQ-07 资料中心（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { MaterialsEndpoints } from '../types/hq/materials'

/**
 * 资料分页列表。
 * @see GET /api/hq/materials
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMaterials(query?: MaterialsEndpoints['GET /materials']['query'], options: RequestOptions = {}): Promise<MaterialsEndpoints['GET /materials']['response']> {
  const response = await apiClient.get<MaterialsEndpoints['GET /materials']['response']>('/materials', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/materials/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMaterialsCatalog(query?: MaterialsEndpoints['GET /materials/catalog']['query'], options: RequestOptions = {}): Promise<MaterialsEndpoints['GET /materials/catalog']['response']> {
  const response = await apiClient.get<MaterialsEndpoints['GET /materials/catalog']['response']>('/materials/catalog', { ...options, params: query })
  return response.data
}

/**
 * 资料详情与下载信息。
 * @see GET /api/hq/materials/:materialId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMaterialsByMaterialId(path: MaterialsEndpoints['GET /materials/:materialId']['path'], query?: MaterialsEndpoints['GET /materials/:materialId']['query'], options: RequestOptions = {}): Promise<MaterialsEndpoints['GET /materials/:materialId']['response']> {
  const response = await apiClient.get<MaterialsEndpoints['GET /materials/:materialId']['response']>(`/materials/${encodeURIComponent(path.materialId)}`, { ...options, params: query })
  return response.data
}

/**
 * 新建资料。
 * @see POST /api/hq/materials/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postMaterialsMutate(request: MaterialsEndpoints['POST /materials/mutate']['request'], options: RequestOptions = {}): Promise<MaterialsEndpoints['POST /materials/mutate']['response']> {
  const response = await apiClient.post<MaterialsEndpoints['POST /materials/mutate']['response']>('/materials/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 上传资料素材文件。
 * @see POST /api/hq/materials/assets
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postMaterialsAssets(request: MaterialsEndpoints['POST /materials/assets']['request'], options: RequestOptions = {}): Promise<MaterialsEndpoints['POST /materials/assets']['response']> {
  const response = await apiClient.post<MaterialsEndpoints['POST /materials/assets']['response']>('/materials/assets', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
