/** HQ-12 履约发货（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { DeliveryEndpoints } from '../types/hq/delivery'

/**
 * 发货单分页列表。
 * @see GET /api/hq/delivery/shipments
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getDeliveryShipments(query?: DeliveryEndpoints['GET /delivery/shipments']['query'], options: RequestOptions = {}): Promise<DeliveryEndpoints['GET /delivery/shipments']['response']> {
  const response = await apiClient.get<DeliveryEndpoints['GET /delivery/shipments']['response']>('/delivery/shipments', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/delivery/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getDeliveryCatalog(query?: DeliveryEndpoints['GET /delivery/catalog']['query'], options: RequestOptions = {}): Promise<DeliveryEndpoints['GET /delivery/catalog']['response']> {
  const response = await apiClient.get<DeliveryEndpoints['GET /delivery/catalog']['response']>('/delivery/catalog', { ...options, params: query })
  return response.data
}

/**
 * 发货单详情。
 * @see GET /api/hq/delivery/shipments/:shipmentId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getDeliveryShipmentsByShipmentId(path: DeliveryEndpoints['GET /delivery/shipments/:shipmentId']['path'], query?: DeliveryEndpoints['GET /delivery/shipments/:shipmentId']['query'], options: RequestOptions = {}): Promise<DeliveryEndpoints['GET /delivery/shipments/:shipmentId']['response']> {
  const response = await apiClient.get<DeliveryEndpoints['GET /delivery/shipments/:shipmentId']['response']>(`/delivery/shipments/${encodeURIComponent(path.shipmentId)}`, { ...options, params: query })
  return response.data
}

/**
 * 发货单写操作：发货/妥投/取消/更新物流。
 * @see POST /api/hq/delivery/shipments/:shipmentId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postDeliveryShipmentsByShipmentIdMutate(path: DeliveryEndpoints['POST /delivery/shipments/:shipmentId/mutate']['path'], request: DeliveryEndpoints['POST /delivery/shipments/:shipmentId/mutate']['request'], options: RequestOptions = {}): Promise<DeliveryEndpoints['POST /delivery/shipments/:shipmentId/mutate']['response']> {
  const response = await apiClient.post<DeliveryEndpoints['POST /delivery/shipments/:shipmentId/mutate']['response']>(`/delivery/shipments/${encodeURIComponent(path.shipmentId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 新建发货单。
 * @see POST /api/hq/delivery/shipments
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postDeliveryShipments(request: DeliveryEndpoints['POST /delivery/shipments']['request'], options: RequestOptions = {}): Promise<DeliveryEndpoints['POST /delivery/shipments']['response']> {
  const response = await apiClient.post<DeliveryEndpoints['POST /delivery/shipments']['response']>('/delivery/shipments', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
