/** HQ-02 账号管理（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { UsersEndpoints } from '../types/hq/users'

/**
 * 账号分页列表，支持 `keyword` / `frozen` / `tier` 过滤。
 * @see GET /api/hq/users
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getUsers(query?: UsersEndpoints['GET /users']['query'], options: RequestOptions = {}): Promise<UsersEndpoints['GET /users']['response']> {
  const response = await apiClient.get<UsersEndpoints['GET /users']['response']>('/users', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总（总数/冻结数/活跃数）。
 * @see GET /api/hq/users/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getUsersCatalog(query?: UsersEndpoints['GET /users/catalog']['query'], options: RequestOptions = {}): Promise<UsersEndpoints['GET /users/catalog']['response']> {
  const response = await apiClient.get<UsersEndpoints['GET /users/catalog']['response']>('/users/catalog', { ...options, params: query })
  return response.data
}

/**
 * 账号详情：profile + 关联会员 + 审计摘要（手机号完整）。
 * @see GET /api/hq/users/:accountId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getUsersByAccountId(path: UsersEndpoints['GET /users/:accountId']['path'], query?: UsersEndpoints['GET /users/:accountId']['query'], options: RequestOptions = {}): Promise<UsersEndpoints['GET /users/:accountId']['response']> {
  const response = await apiClient.get<UsersEndpoints['GET /users/:accountId']['response']>(`/users/${encodeURIComponent(path.accountId)}`, { ...options, params: query })
  return response.data
}

/**
 * 账号写操作：冻结/解冻/备注（reason + version + 幂等）。
 * @see POST /api/hq/users/:accountId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postUsersByAccountIdMutate(path: UsersEndpoints['POST /users/:accountId/mutate']['path'], request: UsersEndpoints['POST /users/:accountId/mutate']['request'], options: RequestOptions = {}): Promise<UsersEndpoints['POST /users/:accountId/mutate']['response']> {
  const response = await apiClient.post<UsersEndpoints['POST /users/:accountId/mutate']['response']>(`/users/${encodeURIComponent(path.accountId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
