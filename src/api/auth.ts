/** HQ-01 登录与会话（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { AuthEndpoints } from '../types/hq/auth'

/**
 * 管理员登录，校验口令并签发 `hq-admin-` 会话 token。
 * @see POST /api/hq/auth/login
 * @param request JSON 请求体。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postAuthLogin(request: AuthEndpoints['POST /auth/login']['request'], options: RequestOptions = {}): Promise<AuthEndpoints['POST /auth/login']['response']> {
  const response = await apiClient.post<AuthEndpoints['POST /auth/login']['response']>('/auth/login', request, options)
  return response.data
}

/**
 * 注销当前会话，使 token 立即失效。
 * @see POST /api/hq/auth/logout
 * @param request JSON 请求体。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postAuthLogout(request: AuthEndpoints['POST /auth/logout']['request'], options: RequestOptions = {}): Promise<AuthEndpoints['POST /auth/logout']['response']> {
  const response = await apiClient.post<AuthEndpoints['POST /auth/logout']['response']>('/auth/logout', request, options)
  return response.data
}

/**
 * 返回当前管理员资料与 token 过期时间。
 * @see GET /api/hq/auth/me
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getAuthMe(query?: AuthEndpoints['GET /auth/me']['query'], options: RequestOptions = {}): Promise<AuthEndpoints['GET /auth/me']['response']> {
  const response = await apiClient.get<AuthEndpoints['GET /auth/me']['response']>('/auth/me', { ...options, params: query })
  return response.data
}

/**
 * 修改当前管理员口令（校验原口令；改密后强制重登）。
 * @see POST /api/hq/auth/password
 * @param request JSON 请求体。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postAuthPassword(request: AuthEndpoints['POST /auth/password']['request'], options: RequestOptions = {}): Promise<AuthEndpoints['POST /auth/password']['response']> {
  const response = await apiClient.post<AuthEndpoints['POST /auth/password']['response']>('/auth/password', request, options)
  return response.data
}
