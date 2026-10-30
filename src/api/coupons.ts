/** HQ-14 优惠券（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { CouponsEndpoints } from '../types/hq/coupons'

/**
 * 筛选项与汇总。
 * @see GET /api/hq/coupons/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCouponsCatalog(query?: CouponsEndpoints['GET /coupons/catalog']['query'], options: RequestOptions = {}): Promise<CouponsEndpoints['GET /coupons/catalog']['response']> {
  const response = await apiClient.get<CouponsEndpoints['GET /coupons/catalog']['response']>('/coupons/catalog', { ...options, params: query })
  return response.data
}

/**
 * 优惠券模板列表。
 * @see GET /api/hq/coupons/templates
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCouponsTemplates(query?: CouponsEndpoints['GET /coupons/templates']['query'], options: RequestOptions = {}): Promise<CouponsEndpoints['GET /coupons/templates']['response']> {
  const response = await apiClient.get<CouponsEndpoints['GET /coupons/templates']['response']>('/coupons/templates', { ...options, params: query })
  return response.data
}

/**
 * 已发放优惠券分页列表。
 * @see GET /api/hq/coupons
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getCoupons(query?: CouponsEndpoints['GET /coupons']['query'], options: RequestOptions = {}): Promise<CouponsEndpoints['GET /coupons']['response']> {
  const response = await apiClient.get<CouponsEndpoints['GET /coupons']['response']>('/coupons', { ...options, params: query })
  return response.data
}

/**
 * 优惠券写操作：建模板/改模板/发放/撤回。
 * @see POST /api/hq/coupons/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postCouponsMutate(request: CouponsEndpoints['POST /coupons/mutate']['request'], options: RequestOptions = {}): Promise<CouponsEndpoints['POST /coupons/mutate']['response']> {
  const response = await apiClient.post<CouponsEndpoints['POST /coupons/mutate']['response']>('/coupons/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
