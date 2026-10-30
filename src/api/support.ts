/** HQ-25 客服工单（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { SupportEndpoints } from '../types/hq/support'

/**
 * 工单分页列表。
 * @see GET /api/hq/support/tickets
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSupportTickets(query?: SupportEndpoints['GET /support/tickets']['query'], options: RequestOptions = {}): Promise<SupportEndpoints['GET /support/tickets']['response']> {
  const response = await apiClient.get<SupportEndpoints['GET /support/tickets']['response']>('/support/tickets', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/support/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSupportCatalog(query?: SupportEndpoints['GET /support/catalog']['query'], options: RequestOptions = {}): Promise<SupportEndpoints['GET /support/catalog']['response']> {
  const response = await apiClient.get<SupportEndpoints['GET /support/catalog']['response']>('/support/catalog', { ...options, params: query })
  return response.data
}

/**
 * 工单详情与对话。
 * @see GET /api/hq/support/tickets/:ticketId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getSupportTicketsByTicketId(path: SupportEndpoints['GET /support/tickets/:ticketId']['path'], query?: SupportEndpoints['GET /support/tickets/:ticketId']['query'], options: RequestOptions = {}): Promise<SupportEndpoints['GET /support/tickets/:ticketId']['response']> {
  const response = await apiClient.get<SupportEndpoints['GET /support/tickets/:ticketId']['response']>(`/support/tickets/${encodeURIComponent(path.ticketId)}`, { ...options, params: query })
  return response.data
}

/**
 * 工单写操作：回复/关闭/重开/分派/升级。
 * @see POST /api/hq/support/tickets/:ticketId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postSupportTicketsByTicketIdMutate(path: SupportEndpoints['POST /support/tickets/:ticketId/mutate']['path'], request: SupportEndpoints['POST /support/tickets/:ticketId/mutate']['request'], options: RequestOptions = {}): Promise<SupportEndpoints['POST /support/tickets/:ticketId/mutate']['response']> {
  const response = await apiClient.post<SupportEndpoints['POST /support/tickets/:ticketId/mutate']['response']>(`/support/tickets/${encodeURIComponent(path.ticketId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 新建工单。
 * @see POST /api/hq/support/tickets
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postSupportTickets(request: SupportEndpoints['POST /support/tickets']['request'], options: RequestOptions = {}): Promise<SupportEndpoints['POST /support/tickets']['response']> {
  const response = await apiClient.post<SupportEndpoints['POST /support/tickets']['response']>('/support/tickets', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
