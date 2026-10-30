import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { AgentError, type AgentMutation, type AgentQuery } from '../types/agents'
import { mockAgentCatalog, mockAgentDetail, mockAgentList, mockAgentMutate } from './mock/agents'
import * as real from './real/agents'

async function authorize(token: string, permission: HqPermission = 'agents:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'agents:access') || !hasPermission(account, permission)) {
    throw new AgentError('FORBIDDEN', '没有区域代理查询或此操作权限')
  }
  return account
}

/** HQ-18 区域代理：mock 演示可用；api 模式因后端无 agents 模块会明确报错。 */
export const agentsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockAgentCatalog()
    return (await real.realAgentCatalog()) as Awaited<ReturnType<typeof mockAgentCatalog>>
  },
  async list(token: string, query: AgentQuery) {
    await authorize(token)
    if (isMockAuth) return mockAgentList(query)
    return (await real.realAgentList(query)) as Awaited<ReturnType<typeof mockAgentList>>
  },
  async detail(token: string, agentId: string) {
    await authorize(token)
    if (isMockAuth) return mockAgentDetail(agentId)
    return (await real.realAgentDetail(agentId)) as Awaited<ReturnType<typeof mockAgentDetail>>
  },
  async mutate(token: string, input: AgentMutation) {
    if (!['suspend', 'resume', 'set-exclusivity'].includes(input.action)) {
      throw new AgentError('INVALID_INPUT', '区域代理操作类型无效')
    }
    const account = await authorize(token, 'agents:manage')
    if (isMockAuth) return mockAgentMutate(input, account)
    return (await real.realAgentMutate(input)) as Awaited<ReturnType<typeof mockAgentMutate>>
  },
}
