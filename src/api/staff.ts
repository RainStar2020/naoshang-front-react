/** HQ-18 员工与角色（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { StaffEndpoints } from '../types/hq/staff'

/**
 * 员工分页列表。
 * @see GET /api/hq/staff
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStaff(query?: StaffEndpoints['GET /staff']['query'], options: RequestOptions = {}): Promise<StaffEndpoints['GET /staff']['response']> {
  const response = await apiClient.get<StaffEndpoints['GET /staff']['response']>('/staff', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/staff/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStaffCatalog(query?: StaffEndpoints['GET /staff/catalog']['query'], options: RequestOptions = {}): Promise<StaffEndpoints['GET /staff/catalog']['response']> {
  const response = await apiClient.get<StaffEndpoints['GET /staff/catalog']['response']>('/staff/catalog', { ...options, params: query })
  return response.data
}

/**
 * 员工详情与归属门店。
 * @see GET /api/hq/staff/:staffId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getStaffByStaffId(path: StaffEndpoints['GET /staff/:staffId']['path'], query?: StaffEndpoints['GET /staff/:staffId']['query'], options: RequestOptions = {}): Promise<StaffEndpoints['GET /staff/:staffId']['response']> {
  const response = await apiClient.get<StaffEndpoints['GET /staff/:staffId']['response']>(`/staff/${encodeURIComponent(path.staffId)}`, { ...options, params: query })
  return response.data
}

/**
 * 新建员工。
 * @see POST /api/hq/staff/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postStaffMutate(request: StaffEndpoints['POST /staff/mutate']['request'], options: RequestOptions = {}): Promise<StaffEndpoints['POST /staff/mutate']['response']> {
  const response = await apiClient.post<StaffEndpoints['POST /staff/mutate']['response']>('/staff/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 员工写操作：改资料/停用/分配门店。
 * @see POST /api/hq/staff/:staffId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postStaffByStaffIdMutate(path: StaffEndpoints['POST /staff/:staffId/mutate']['path'], request: StaffEndpoints['POST /staff/:staffId/mutate']['request'], options: RequestOptions = {}): Promise<StaffEndpoints['POST /staff/:staffId/mutate']['response']> {
  const response = await apiClient.post<StaffEndpoints['POST /staff/:staffId/mutate']['response']>(`/staff/${encodeURIComponent(path.staffId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
