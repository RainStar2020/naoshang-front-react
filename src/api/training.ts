/** HQ-20 培训课时（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { TrainingEndpoints } from '../types/hq/training'

/**
 * 课时余额分页列表。
 * @see GET /api/hq/training/balances
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTrainingBalances(query?: TrainingEndpoints['GET /training/balances']['query'], options: RequestOptions = {}): Promise<TrainingEndpoints['GET /training/balances']['response']> {
  const response = await apiClient.get<TrainingEndpoints['GET /training/balances']['response']>('/training/balances', { ...options, params: query })
  return response.data
}

/**
 * 培训反馈列表。
 * @see GET /api/hq/training/feedback
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTrainingFeedback(query?: TrainingEndpoints['GET /training/feedback']['query'], options: RequestOptions = {}): Promise<TrainingEndpoints['GET /training/feedback']['response']> {
  const response = await apiClient.get<TrainingEndpoints['GET /training/feedback']['response']>('/training/feedback', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/training/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTrainingCatalog(query?: TrainingEndpoints['GET /training/catalog']['query'], options: RequestOptions = {}): Promise<TrainingEndpoints['GET /training/catalog']['response']> {
  const response = await apiClient.get<TrainingEndpoints['GET /training/catalog']['response']>('/training/catalog', { ...options, params: query })
  return response.data
}

/**
 * 单会员课时明细。
 * @see GET /api/hq/training/members/:memberId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getTrainingMembersByMemberId(path: TrainingEndpoints['GET /training/members/:memberId']['path'], query?: TrainingEndpoints['GET /training/members/:memberId']['query'], options: RequestOptions = {}): Promise<TrainingEndpoints['GET /training/members/:memberId']['response']> {
  const response = await apiClient.get<TrainingEndpoints['GET /training/members/:memberId']['response']>(`/training/members/${encodeURIComponent(path.memberId)}`, { ...options, params: query })
  return response.data
}

/**
 * 课时写操作：发放/扣减/冻结/重置。
 * @see POST /api/hq/training/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postTrainingMutate(request: TrainingEndpoints['POST /training/mutate']['request'], options: RequestOptions = {}): Promise<TrainingEndpoints['POST /training/mutate']['response']> {
  const response = await apiClient.post<TrainingEndpoints['POST /training/mutate']['response']>('/training/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
