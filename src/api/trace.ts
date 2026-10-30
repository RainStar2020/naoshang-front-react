/** HQ-26 追踪溯源（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { TraceEndpoints } from '../types/hq/trace'

/**
 * 全量审计轨迹分页（只读）。
 * @see GET /api/hq/trace
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTrace(query?: TraceEndpoints['GET /trace']['query'], options: RequestOptions = {}): Promise<TraceEndpoints['GET /trace']['response']> {
  const response = await apiClient.get<TraceEndpoints['GET /trace']['response']>('/trace', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/trace/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTraceCatalog(query?: TraceEndpoints['GET /trace/catalog']['query'], options: RequestOptions = {}): Promise<TraceEndpoints['GET /trace/catalog']['response']> {
  const response = await apiClient.get<TraceEndpoints['GET /trace/catalog']['response']>('/trace/catalog', { ...options, params: query })
  return response.data
}

/**
 * 单条审计详情。
 * @see GET /api/hq/trace/:traceId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTraceByTraceId(path: TraceEndpoints['GET /trace/:traceId']['path'], query?: TraceEndpoints['GET /trace/:traceId']['query'], options: RequestOptions = {}): Promise<TraceEndpoints['GET /trace/:traceId']['response']> {
  const response = await apiClient.get<TraceEndpoints['GET /trace/:traceId']['response']>(`/trace/${encodeURIComponent(path.traceId)}`, { ...options, params: query })
  return response.data
}

/**
 * 按请求 ID 追溯。
 * @see GET /api/hq/trace/by-request/:requestId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTraceByRequestByRequestId(path: TraceEndpoints['GET /trace/by-request/:requestId']['path'], query?: TraceEndpoints['GET /trace/by-request/:requestId']['query'], options: RequestOptions = {}): Promise<TraceEndpoints['GET /trace/by-request/:requestId']['response']> {
  const response = await apiClient.get<TraceEndpoints['GET /trace/by-request/:requestId']['response']>(`/trace/by-request/${encodeURIComponent(path.requestId)}`, { ...options, params: query })
  return response.data
}
