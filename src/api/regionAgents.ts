/** HQ region-agents 区域代理（4 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { RegionAgentsEndpoints } from '../types/hq/regionAgents'

/** @see GET /api/hq/region-agents/catalog */
export async function getRegionAgentsCatalog(query?: RegionAgentsEndpoints['GET /region-agents/catalog']['query'], options: RequestOptions = {}): Promise<RegionAgentsEndpoints['GET /region-agents/catalog']['response']> {
  const response = await apiClient.get<RegionAgentsEndpoints['GET /region-agents/catalog']['response']>('/region-agents/catalog', { ...options, params: query })
  return response.data
}

/** @see GET /api/hq/region-agents/:agentId */
export async function getRegionAgentsByAgentId(path: RegionAgentsEndpoints['GET /region-agents/:agentId']['path'], query?: RegionAgentsEndpoints['GET /region-agents/:agentId']['query'], options: RequestOptions = {}): Promise<RegionAgentsEndpoints['GET /region-agents/:agentId']['response']> {
  const response = await apiClient.get<RegionAgentsEndpoints['GET /region-agents/:agentId']['response']>(`/region-agents/${encodeURIComponent(path.agentId)}`, { ...options, params: query })
  return response.data
}

/** @see POST /api/hq/region-agents/:agentId/mutate */
export async function postRegionAgentsByAgentIdMutate(path: RegionAgentsEndpoints['POST /region-agents/:agentId/mutate']['path'], request: RegionAgentsEndpoints['POST /region-agents/:agentId/mutate']['request'], options: RequestOptions = {}): Promise<RegionAgentsEndpoints['POST /region-agents/:agentId/mutate']['response']> {
  const response = await apiClient.post<RegionAgentsEndpoints['POST /region-agents/:agentId/mutate']['response']>(`/region-agents/${encodeURIComponent(path.agentId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/** @see POST /api/hq/region-agents/territories/:territoryId/mutate */
export async function postRegionAgentsTerritoriesByTerritoryIdMutate(path: RegionAgentsEndpoints['POST /region-agents/territories/:territoryId/mutate']['path'], request: RegionAgentsEndpoints['POST /region-agents/territories/:territoryId/mutate']['request'], options: RequestOptions = {}): Promise<RegionAgentsEndpoints['POST /region-agents/territories/:territoryId/mutate']['response']> {
  const response = await apiClient.post<RegionAgentsEndpoints['POST /region-agents/territories/:territoryId/mutate']['response']>(`/region-agents/territories/${encodeURIComponent(path.territoryId)}/mutate`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
