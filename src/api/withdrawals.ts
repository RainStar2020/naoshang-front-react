/** HQ-17 提现（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { WithdrawalsEndpoints } from '../types/hq/withdrawals'

/**
 * 提现申请分页列表。
 * @see GET /api/hq/withdrawals
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getWithdrawals(query?: WithdrawalsEndpoints['GET /withdrawals']['query'], options: RequestOptions = {}): Promise<WithdrawalsEndpoints['GET /withdrawals']['response']> {
  const response = await apiClient.get<WithdrawalsEndpoints['GET /withdrawals']['response']>('/withdrawals', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/withdrawals/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getWithdrawalsCatalog(query?: WithdrawalsEndpoints['GET /withdrawals/catalog']['query'], options: RequestOptions = {}): Promise<WithdrawalsEndpoints['GET /withdrawals/catalog']['response']> {
  const response = await apiClient.get<WithdrawalsEndpoints['GET /withdrawals/catalog']['response']>('/withdrawals/catalog', { ...options, params: query })
  return response.data
}

/**
 * 提现详情（含手续费）。
 * @see GET /api/hq/withdrawals/:withdrawalId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getWithdrawalsByWithdrawalId(path: WithdrawalsEndpoints['GET /withdrawals/:withdrawalId']['path'], query?: WithdrawalsEndpoints['GET /withdrawals/:withdrawalId']['query'], options: RequestOptions = {}): Promise<WithdrawalsEndpoints['GET /withdrawals/:withdrawalId']['response']> {
  const response = await apiClient.get<WithdrawalsEndpoints['GET /withdrawals/:withdrawalId']['response']>(`/withdrawals/${encodeURIComponent(path.withdrawalId)}`, { ...options, params: query })
  return response.data
}

/**
 * 提现写操作：通过/驳回/已打款/冲正。
 * @see POST /api/hq/withdrawals/:withdrawalId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postWithdrawalsByWithdrawalIdMutate(path: WithdrawalsEndpoints['POST /withdrawals/:withdrawalId/mutate']['path'], request: WithdrawalsEndpoints['POST /withdrawals/:withdrawalId/mutate']['request'], options: RequestOptions = {}): Promise<WithdrawalsEndpoints['POST /withdrawals/:withdrawalId/mutate']['response']> {
  const response = await apiClient.post<WithdrawalsEndpoints['POST /withdrawals/:withdrawalId/mutate']['response']>(`/withdrawals/${encodeURIComponent(path.withdrawalId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
