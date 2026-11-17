import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { ApiResponse } from '../types/hq/common'
import type { AgentBenefitLevel, AgentBenefitsCatalog, AgentBenefitMutationReceipt } from '../types/agentBenefits'

/** GET /api/hq/agent-benefits — fixed-order descriptions for all five agent levels. */
export function getAgentBenefits(options: RequestOptions = {}) {
  return apiClient.get<ApiResponse<AgentBenefitsCatalog>>('/agent-benefits', options).then((response) => response.data)
}

/** POST /api/hq/agent-benefits/mutate — optimistic-lock update for one level. */
export function mutateAgentBenefit(
  input: { agentLevel: AgentBenefitLevel; content: string; version: number; reason: string },
  idempotencyKey: string,
  options: RequestOptions = {},
) {
  return apiClient.post<ApiResponse<AgentBenefitMutationReceipt>>('/agent-benefits/mutate', input, {
    ...options,
    headers: mergeRequestHeaders(options, { 'Idempotency-Key': idempotencyKey }),
  }).then((response) => response.data)
}
