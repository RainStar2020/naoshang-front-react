/** HQ-11 商品（5 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { ProductsEndpoints } from '../types/hq/products'

/**
 * 商品分页列表。
 * @see GET /api/hq/products
 * @param query 查询参数；分页默认 page=1、pageSize=20，上限 100。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getProducts(query?: ProductsEndpoints['GET /products']['query'], options: RequestOptions = {}): Promise<ProductsEndpoints['GET /products']['response']> {
  const response = await apiClient.get<ProductsEndpoints['GET /products']['response']>('/products', { ...options, params: query })
  return response.data
}

/**
 * 筛选项与汇总。
 * @see GET /api/hq/products/catalog
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getProductsCatalog(query?: ProductsEndpoints['GET /products/catalog']['query'], options: RequestOptions = {}): Promise<ProductsEndpoints['GET /products/catalog']['response']> {
  const response = await apiClient.get<ProductsEndpoints['GET /products/catalog']['response']>('/products/catalog', { ...options, params: query })
  return response.data
}

/**
 * 商品详情（含 SKU 与价格，两位小数）。
 * @see GET /api/hq/products/:productId
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param query 查询参数；未在文档定义的字段保留 unknown。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function getProductsByProductId(path: ProductsEndpoints['GET /products/:productId']['path'], query?: ProductsEndpoints['GET /products/:productId']['query'], options: RequestOptions = {}): Promise<ProductsEndpoints['GET /products/:productId']['response']> {
  const response = await apiClient.get<ProductsEndpoints['GET /products/:productId']['response']>(`/products/${encodeURIComponent(path.productId)}`, { ...options, params: query })
  return response.data
}

/**
 * 新建商品（含 SKU）。
 * @see POST /api/hq/products/mutate
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postProductsMutate(request: ProductsEndpoints['POST /products/mutate']['request'], options: RequestOptions = {}): Promise<ProductsEndpoints['POST /products/mutate']['response']> {
  const response = await apiClient.post<ProductsEndpoints['POST /products/mutate']['response']>('/products/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/**
 * 商品写操作：改资料/上下架/改价。
 * @see POST /api/hq/products/:productId/mutate
 * @param path 路径参数；各 ID 会经过 URL 编码。
 * @param request 请求配置；reason 必须存在于 body 或 X-Reason 请求头。
 * @param options 取消信号、超时和额外请求头。
 * @returns 完整响应信封（code、message、data），未定义的业务字段为 unknown。
 * @throws {ApiError} 后端业务错误；网络、超时和取消保留 Axios 错误。
 */
export async function postProductsByProductIdMutate(path: ProductsEndpoints['POST /products/:productId/mutate']['path'], request: ProductsEndpoints['POST /products/:productId/mutate']['request'], options: RequestOptions = {}): Promise<ProductsEndpoints['POST /products/:productId/mutate']['response']> {
  const response = await apiClient.post<ProductsEndpoints['POST /products/:productId/mutate']['response']>(`/products/${encodeURIComponent(path.productId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
