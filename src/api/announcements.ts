/** HQ-06 公告（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { AnnouncementsEndpoints } from '../types/hq/announcements'

/**
 * 公告分页列表。
 * @see GET /api/hq/announcements
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getAnnouncements(query?: AnnouncementsEndpoints['GET /announcements']['query'], options: RequestOptions = {}): Promise<AnnouncementsEndpoints['GET /announcements']['response']> {
  const response = await apiClient.get<AnnouncementsEndpoints['GET /announcements']['response']>('/announcements', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/announcements/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getAnnouncementsCatalog(query?: AnnouncementsEndpoints['GET /announcements/catalog']['query'], options: RequestOptions = {}): Promise<AnnouncementsEndpoints['GET /announcements/catalog']['response']> {
  const response = await apiClient.get<AnnouncementsEndpoints['GET /announcements/catalog']['response']>('/announcements/catalog', { ...options, params: query })
  return response.data
}

/**
 * 公告详情。
 * @see GET /api/hq/announcements/:announcementId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getAnnouncementsByAnnouncementId(path: AnnouncementsEndpoints['GET /announcements/:announcementId']['path'], query?: AnnouncementsEndpoints['GET /announcements/:announcementId']['query'], options: RequestOptions = {}): Promise<AnnouncementsEndpoints['GET /announcements/:announcementId']['response']> {
  const response = await apiClient.get<AnnouncementsEndpoints['GET /announcements/:announcementId']['response']>(`/announcements/${encodeURIComponent(path.announcementId)}`, { ...options, params: query })
  return response.data
}

/**
 * 新建公告。
 * @see POST /api/hq/announcements/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postAnnouncementsMutate(request: AnnouncementsEndpoints['POST /announcements/mutate']['request'], options: RequestOptions = {}): Promise<AnnouncementsEndpoints['POST /announcements/mutate']['response']> {
  const response = await apiClient.post<AnnouncementsEndpoints['POST /announcements/mutate']['response']>('/announcements/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 公告写操作：发布/撤回/更新/删除。
 * @see POST /api/hq/announcements/:announcementId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postAnnouncementsByAnnouncementIdMutate(path: AnnouncementsEndpoints['POST /announcements/:announcementId/mutate']['path'], request: AnnouncementsEndpoints['POST /announcements/:announcementId/mutate']['request'], options: RequestOptions = {}): Promise<AnnouncementsEndpoints['POST /announcements/:announcementId/mutate']['response']> {
  const response = await apiClient.post<AnnouncementsEndpoints['POST /announcements/:announcementId/mutate']['response']>(`/announcements/${encodeURIComponent(path.announcementId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
