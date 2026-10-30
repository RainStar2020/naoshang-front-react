/** HQ-04 课程权益（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { CourseEndpoints } from '../types/hq/course'

/**
 * 课程权益分页列表。
 * @see GET /api/hq/course/entitlements
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCourseEntitlements(query?: CourseEndpoints['GET /course/entitlements']['query'], options: RequestOptions = {}): Promise<CourseEndpoints['GET /course/entitlements']['response']> {
  const response = await apiClient.get<CourseEndpoints['GET /course/entitlements']['response']>('/course/entitlements', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/course/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCourseCatalog(query?: CourseEndpoints['GET /course/catalog']['query'], options: RequestOptions = {}): Promise<CourseEndpoints['GET /course/catalog']['response']> {
  const response = await apiClient.get<CourseEndpoints['GET /course/catalog']['response']>('/course/catalog', { ...options, params: query })
  return response.data
}

/**
 * 单条权益详情。
 * @see GET /api/hq/course/entitlements/:entitlementId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCourseEntitlementsByEntitlementId(path: CourseEndpoints['GET /course/entitlements/:entitlementId']['path'], query?: CourseEndpoints['GET /course/entitlements/:entitlementId']['query'], options: RequestOptions = {}): Promise<CourseEndpoints['GET /course/entitlements/:entitlementId']['response']> {
  const response = await apiClient.get<CourseEndpoints['GET /course/entitlements/:entitlementId']['response']>(`/course/entitlements/${encodeURIComponent(path.entitlementId)}`, { ...options, params: query })
  return response.data
}

/**
 * 权益写操作：发放/撤回/延期/改属性。
 * @see POST /api/hq/course/entitlements/:entitlementId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postCourseEntitlementsByEntitlementIdMutate(path: CourseEndpoints['POST /course/entitlements/:entitlementId/mutate']['path'], request: CourseEndpoints['POST /course/entitlements/:entitlementId/mutate']['request'], options: RequestOptions = {}): Promise<CourseEndpoints['POST /course/entitlements/:entitlementId/mutate']['response']> {
  const response = await apiClient.post<CourseEndpoints['POST /course/entitlements/:entitlementId/mutate']['response']>(`/course/entitlements/${encodeURIComponent(path.entitlementId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 新建课程权益发放记录。
 * @see POST /api/hq/course/entitlements
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postCourseEntitlements(request: CourseEndpoints['POST /course/entitlements']['request'], options: RequestOptions = {}): Promise<CourseEndpoints['POST /course/entitlements']['response']> {
  const response = await apiClient.post<CourseEndpoints['POST /course/entitlements']['response']>('/course/entitlements', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
