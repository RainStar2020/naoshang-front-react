import { AgentError, type AgentMutation, type AgentQuery } from '../../types/agents'
import { unsupported } from './bridge'

/** HQ 契约未提供区域代理独立模块；api 模式下明确报错，避免静默回落 Mock。 */
export async function realAgentCatalog() {
  return unsupported(AgentError, 'catalog', '后端尚无 /api/hq/agents 模块')
}

export async function realAgentList(_query: AgentQuery) {
  return unsupported(AgentError, 'list', '后端尚无 /api/hq/agents 模块')
}

export async function realAgentDetail(_agentId: string) {
  return unsupported(AgentError, 'detail', '后端尚无 /api/hq/agents 模块')
}

export async function realAgentMutate(_input: AgentMutation) {
  return unsupported(AgentError, 'mutate', '后端尚无 /api/hq/agents 模块')
}
