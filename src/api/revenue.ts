/** HQ-16 收益（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { RevenueEndpoints } from '../types/hq/revenue'

/**
 * 收益账户分页列表。
 * @see GET /api/hq/revenue/accounts
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getRevenueAccounts(query?: RevenueEndpoints['GET /revenue/accounts']['query'], options: RequestOptions = {}): Promise<RevenueEndpoints['GET /revenue/accounts']['response']> {
  const response = await apiClient.get<RevenueEndpoints['GET /revenue/accounts']['response']>('/revenue/accounts', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/revenue/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getRevenueCatalog(query?: RevenueEndpoints['GET /revenue/catalog']['query'], options: RequestOptions = {}): Promise<RevenueEndpoints['GET /revenue/catalog']['response']> {
  const response = await apiClient.get<RevenueEndpoints['GET /revenue/catalog']['response']>('/revenue/catalog', { ...options, params: query })
  return response.data
}

/**
 * 收益明细流水。
 * @see GET /api/hq/revenue/ledgers
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getRevenueLedgers(query?: RevenueEndpoints['GET /revenue/ledgers']['query'], options: RequestOptions = {}): Promise<RevenueEndpoints['GET /revenue/ledgers']['response']> {
  const response = await apiClient.get<RevenueEndpoints['GET /revenue/ledgers']['response']>('/revenue/ledgers', { ...options, params: query })
  return response.data
}

/**
 * 单账户收益详情。
 * @see GET /api/hq/revenue/accounts/:accountId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getRevenueAccountsByAccountId(path: RevenueEndpoints['GET /revenue/accounts/:accountId']['path'], query?: RevenueEndpoints['GET /revenue/accounts/:accountId']['query'], options: RequestOptions = {}): Promise<RevenueEndpoints['GET /revenue/accounts/:accountId']['response']> {
  const response = await apiClient.get<RevenueEndpoints['GET /revenue/accounts/:accountId']['response']>(`/revenue/accounts/${encodeURIComponent(path.accountId)}`, { ...options, params: query })
  return response.data
}

/**
 * 收益写操作：调整/冻结/解冻/结算。
 * @see POST /api/hq/revenue/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postRevenueMutate(request: RevenueEndpoints['POST /revenue/mutate']['request'], options: RequestOptions = {}): Promise<RevenueEndpoints['POST /revenue/mutate']['response']> {
  const response = await apiClient.post<RevenueEndpoints['POST /revenue/mutate']['response']>('/revenue/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
