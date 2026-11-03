/** HQ redemptions 兑换/核销（3 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { RedemptionsEndpoints } from '../types/hq/redemptions'

/** @see GET /api/hq/redemptions/catalog */
export async function getRedemptionsCatalog(query?: RedemptionsEndpoints['GET /redemptions/catalog']['query'], options: RequestOptions = {}): Promise<RedemptionsEndpoints['GET /redemptions/catalog']['response']> {
  const response = await apiClient.get<RedemptionsEndpoints['GET /redemptions/catalog']['response']>('/redemptions/catalog', { ...options, params: query })
  return response.data
}

/** @see GET /api/hq/redemptions/:redemptionId */
export async function getRedemptionsByRedemptionId(path: RedemptionsEndpoints['GET /redemptions/:redemptionId']['path'], query?: RedemptionsEndpoints['GET /redemptions/:redemptionId']['query'], options: RequestOptions = {}): Promise<RedemptionsEndpoints['GET /redemptions/:redemptionId']['response']> {
  const response = await apiClient.get<RedemptionsEndpoints['GET /redemptions/:redemptionId']['response']>(`/redemptions/${encodeURIComponent(path.redemptionId)}`, { ...options, params: query })
  return response.data
}

/** @see POST /api/hq/redemptions/:redemptionId/mutate */
export async function postRedemptionsByRedemptionIdMutate(path: RedemptionsEndpoints['POST /redemptions/:redemptionId/mutate']['path'], request: RedemptionsEndpoints['POST /redemptions/:redemptionId/mutate']['request'], options: RequestOptions = {}): Promise<RedemptionsEndpoints['POST /redemptions/:redemptionId/mutate']['response']> {
  const response = await apiClient.post<RedemptionsEndpoints['POST /redemptions/:redemptionId/mutate']['response']>(`/redemptions/${encodeURIComponent(path.redemptionId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
