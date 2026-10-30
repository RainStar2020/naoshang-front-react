/** HQ-23 邀请关系（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { InvitationsEndpoints } from '../types/hq/invitations'

/**
 * 邀请关系分页列表。
 * @see GET /api/hq/invitations
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getInvitations(query?: InvitationsEndpoints['GET /invitations']['query'], options: RequestOptions = {}): Promise<InvitationsEndpoints['GET /invitations']['response']> {
  const response = await apiClient.get<InvitationsEndpoints['GET /invitations']['response']>('/invitations', { ...options, params: query })
  return response.data
}

/**
 * 单账号邀请关系。
 * @see GET /api/hq/invitations/:accountId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getInvitationsByAccountId(path: InvitationsEndpoints['GET /invitations/:accountId']['path'], query?: InvitationsEndpoints['GET /invitations/:accountId']['query'], options: RequestOptions = {}): Promise<InvitationsEndpoints['GET /invitations/:accountId']['response']> {
  const response = await apiClient.get<InvitationsEndpoints['GET /invitations/:accountId']['response']>(`/invitations/${encodeURIComponent(path.accountId)}`, { ...options, params: query })
  return response.data
}

/**
 * 团队树（含 `graphVersion`）。
 * @see GET /api/hq/invitations/:accountId/team
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getInvitationsByAccountIdTeam(path: InvitationsEndpoints['GET /invitations/:accountId/team']['path'], query?: InvitationsEndpoints['GET /invitations/:accountId/team']['query'], options: RequestOptions = {}): Promise<InvitationsEndpoints['GET /invitations/:accountId/team']['response']> {
  const response = await apiClient.get<InvitationsEndpoints['GET /invitations/:accountId/team']['response']>(`/invitations/${encodeURIComponent(path.accountId)}/team`, { ...options, params: query })
  return response.data
}

/**
 * 邀请写操作：绑定/解绑/重建/纠错。
 * @see POST /api/hq/invitations/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postInvitationsMutate(request: InvitationsEndpoints['POST /invitations/mutate']['request'], options: RequestOptions = {}): Promise<InvitationsEndpoints['POST /invitations/mutate']['response']> {
  const response = await apiClient.post<InvitationsEndpoints['POST /invitations/mutate']['response']>('/invitations/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
