/** HQ-03 会员档案（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { MembersEndpoints } from '../types/hq/members'

/**
 * 会员分页列表。
 * @see GET /api/hq/members
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMembers(query?: MembersEndpoints['GET /members']['query'], options: RequestOptions = {}): Promise<MembersEndpoints['GET /members']['response']> {
  const response = await apiClient.get<MembersEndpoints['GET /members']['response']>('/members', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/members/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMembersCatalog(query?: MembersEndpoints['GET /members/catalog']['query'], options: RequestOptions = {}): Promise<MembersEndpoints['GET /members/catalog']['response']> {
  const response = await apiClient.get<MembersEndpoints['GET /members/catalog']['response']>('/members/catalog', { ...options, params: query })
  return response.data
}

/**
 * 会员详情（含归属门店名）。
 * @see GET /api/hq/members/:memberId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getMembersByMemberId(path: MembersEndpoints['GET /members/:memberId']['path'], query?: MembersEndpoints['GET /members/:memberId']['query'], options: RequestOptions = {}): Promise<MembersEndpoints['GET /members/:memberId']['response']> {
  const response = await apiClient.get<MembersEndpoints['GET /members/:memberId']['response']>(`/members/${encodeURIComponent(path.memberId)}`, { ...options, params: query })
  return response.data
}

/**
 * 会员写操作：改资料/绑定或解绑门店/设状态。
 * @see POST /api/hq/members/:memberId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postMembersByMemberIdMutate(path: MembersEndpoints['POST /members/:memberId/mutate']['path'], request: MembersEndpoints['POST /members/:memberId/mutate']['request'], options: RequestOptions = {}): Promise<MembersEndpoints['POST /members/:memberId/mutate']['response']> {
  const response = await apiClient.post<MembersEndpoints['POST /members/:memberId/mutate']['response']>(`/members/${encodeURIComponent(path.memberId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
