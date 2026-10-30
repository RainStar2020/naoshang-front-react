/** HQ-13 订单（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { OrdersEndpoints } from '../types/hq/orders'

/**
 * 订单分页列表。
 * @see GET /api/hq/orders
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getOrders(query?: OrdersEndpoints['GET /orders']['query'], options: RequestOptions = {}): Promise<OrdersEndpoints['GET /orders']['response']> {
  const response = await apiClient.get<OrdersEndpoints['GET /orders']['response']>('/orders', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/orders/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getOrdersCatalog(query?: OrdersEndpoints['GET /orders/catalog']['query'], options: RequestOptions = {}): Promise<OrdersEndpoints['GET /orders/catalog']['response']> {
  const response = await apiClient.get<OrdersEndpoints['GET /orders/catalog']['response']>('/orders/catalog', { ...options, params: query })
  return response.data
}

/**
 * 订单详情（支付+履约双状态映射）。
 * @see GET /api/hq/orders/:orderId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getOrdersByOrderId(path: OrdersEndpoints['GET /orders/:orderId']['path'], query?: OrdersEndpoints['GET /orders/:orderId']['query'], options: RequestOptions = {}): Promise<OrdersEndpoints['GET /orders/:orderId']['response']> {
  const response = await apiClient.get<OrdersEndpoints['GET /orders/:orderId']['response']>(`/orders/${encodeURIComponent(path.orderId)}`, { ...options, params: query })
  return response.data
}

/**
 * 订单写操作：标记已付/退款/取消/完结。
 * @see POST /api/hq/orders/:orderId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postOrdersByOrderIdMutate(path: OrdersEndpoints['POST /orders/:orderId/mutate']['path'], request: OrdersEndpoints['POST /orders/:orderId/mutate']['request'], options: RequestOptions = {}): Promise<OrdersEndpoints['POST /orders/:orderId/mutate']['response']> {
  const response = await apiClient.post<OrdersEndpoints['POST /orders/:orderId/mutate']['response']>(`/orders/${encodeURIComponent(path.orderId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
