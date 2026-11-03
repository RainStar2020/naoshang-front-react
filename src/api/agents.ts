/** HQ agents 代理商/联创（6 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { AgentsEndpoints } from '../types/hq/agents'

/** @see GET /api/hq/agents/catalog */
export async function getAgentsCatalog(query?: AgentsEndpoints['GET /agents/catalog']['query'], options: RequestOptions = {}): Promise<AgentsEndpoints['GET /agents/catalog']['response']> {
  const response = await apiClient.get<AgentsEndpoints['GET /agents/catalog']['response']>('/agents/catalog', { ...options, params: query })
  return response.data
}

/** @see GET /api/hq/agents/:agentId */
export async function getAgentsByAgentId(path: AgentsEndpoints['GET /agents/:agentId']['path'], query?: AgentsEndpoints['GET /agents/:agentId']['query'], options: RequestOptions = {}): Promise<AgentsEndpoints['GET /agents/:agentId']['response']> {
  const response = await apiClient.get<AgentsEndpoints['GET /agents/:agentId']['response']>(`/agents/${encodeURIComponent(path.agentId)}`, { ...options, params: query })
  return response.data
}

/** @see POST /api/hq/agents/mutate */
export async function postAgentsMutate(request: AgentsEndpoints['POST /agents/mutate']['request'], options: RequestOptions = {}): Promise<AgentsEndpoints['POST /agents/mutate']['response']> {
  const response = await apiClient.post<AgentsEndpoints['POST /agents/mutate']['response']>('/agents/mutate', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/** @see POST /api/hq/agents/:agentId/commission/preview */
export async function postAgentsByAgentIdCommissionPreview(path: AgentsEndpoints['POST /agents/:agentId/commission/preview']['path'], request: AgentsEndpoints['POST /agents/:agentId/commission/preview']['request'], options: RequestOptions = {}): Promise<AgentsEndpoints['POST /agents/:agentId/commission/preview']['response']> {
  const response = await apiClient.post<AgentsEndpoints['POST /agents/:agentId/commission/preview']['response']>(`/agents/${encodeURIComponent(path.agentId)}/commission/preview`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/** @see POST /api/hq/agents/:agentId/commission/settle */
export async function postAgentsByAgentIdCommissionSettle(path: AgentsEndpoints['POST /agents/:agentId/commission/settle']['path'], request: AgentsEndpoints['POST /agents/:agentId/commission/settle']['request'], options: RequestOptions = {}): Promise<AgentsEndpoints['POST /agents/:agentId/commission/settle']['response']> {
  const response = await apiClient.post<AgentsEndpoints['POST /agents/:agentId/commission/settle']['response']>(`/agents/${encodeURIComponent(path.agentId)}/commission/settle`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/** @see GET /api/hq/agents/:agentId/commission */
export async function getAgentsByAgentIdCommission(path: AgentsEndpoints['GET /agents/:agentId/commission']['path'], query?: AgentsEndpoints['GET /agents/:agentId/commission']['query'], options: RequestOptions = {}): Promise<AgentsEndpoints['GET /agents/:agentId/commission']['response']> {
  const response = await apiClient.get<AgentsEndpoints['GET /agents/:agentId/commission']['response']>(`/agents/${encodeURIComponent(path.agentId)}/commission`, { ...options, params: query })
  return response.data
}
