import { agentGroups, agentNotes } from '../../mock/plan'
import {
  AgentError,
  type AgentAudit,
  type AgentCatalog,
  type AgentDetail,
  type AgentList,
  type AgentMutation,
  type AgentOperator,
  type AgentQuery,
  type AgentTerritory,
  type RegionAgent,
} from '../../types/agents'

const fail = (code: AgentError['code'], message: string): never => { throw new AgentError(code, message) }
const copy = <T,>(value: T): T => structuredClone(value)

const territories: AgentTerritory[] = [
  { territoryId: 'terr-sh-pj', level: 'DISTRICT', name: '上海 · 浦江', exclusive: true, holderAgentId: 'AG001', version: 1 },
  { territoryId: 'terr-xx-my', level: 'DISTRICT', name: '新乡 · 牧野', exclusive: true, holderAgentId: 'AG002', version: 1 },
  { territoryId: 'terr-hz-bj', level: 'DISTRICT', name: '杭州 · 滨江', exclusive: false, holderAgentId: 'AG003', version: 1 },
  { territoryId: 'terr-zz-js', level: 'DISTRICT', name: '郑州 · 金水', exclusive: true, holderAgentId: 'AG004', version: 1 },
  { territoryId: 'terr-hz-city', level: 'CITY', name: '杭州市', exclusive: true, holderAgentId: null, version: 1 },
]

const agents: RegionAgent[] = [
  { agentId: 'AG001', accountId: 'ACC-AG-001', name: '吴迪', phone: '137****4456', partnerAccountId: 'ACC-P-001', partnerName: '刘洋', levelLabel: '区县代理', territoryIds: ['terr-sh-pj'], storeCount: 3, status: 'ACTIVE', commissionSnapshotCents: 3120000, version: 1, allowedActions: ['suspend', 'set-exclusivity'] },
  { agentId: 'AG002', accountId: 'ACC-AG-002', name: '郑楠', phone: '150****7823', partnerAccountId: 'ACC-P-002', partnerName: '王建国', levelLabel: '区县代理', territoryIds: ['terr-xx-my'], storeCount: 2, status: 'ACTIVE', commissionSnapshotCents: 1286000, version: 1, allowedActions: ['suspend', 'set-exclusivity'] },
  { agentId: 'AG003', accountId: 'ACC-AG-003', name: '冯涛', phone: '186****3319', partnerAccountId: 'ACC-P-003', partnerName: '钱峰', levelLabel: '区县代理', territoryIds: ['terr-hz-bj'], storeCount: 1, status: 'EXITED', commissionSnapshotCents: 420000, version: 1, allowedActions: [] },
  { agentId: 'AG004', accountId: 'ACC-AG-004', name: '许晴', phone: '158****9910', partnerAccountId: 'ACC-P-002', partnerName: '王建国', levelLabel: '区县代理', territoryIds: ['terr-zz-js'], storeCount: 4, status: 'ACTIVE', commissionSnapshotCents: 1875050, version: 1, allowedActions: ['suspend', 'set-exclusivity'] },
]

const audit: AgentAudit[] = []
const operations = new Map<string, { payload: string; result: AgentDetail }>()

function refreshActions(agent: RegionAgent) {
  if (agent.status === 'EXITED') agent.allowedActions = []
  else if (agent.status === 'SUSPENDED') agent.allowedActions = ['resume', 'set-exclusivity']
  else agent.allowedActions = ['suspend', 'set-exclusivity']
}

function syncHolders() {
  for (const terr of territories) {
    const holders = agents.filter((a) => a.status === 'ACTIVE' && a.territoryIds.includes(terr.territoryId))
    terr.holderAgentId = holders[0]?.agentId ?? null
  }
}

function findAgent(agentId: string) {
  return agents.find((row) => row.agentId === agentId) ?? fail('NOT_FOUND', '区域代理不存在')
}

function findTerritory(territoryId: string) {
  return territories.find((row) => row.territoryId === territoryId) ?? fail('NOT_FOUND', '区域档位不存在')
}

function detailOf(agentId: string): AgentDetail {
  const agent = copy(findAgent(agentId))
  return {
    agent,
    territories: copy(territories.filter((t) => agent.territoryIds.includes(t.territoryId) || t.territoryId === agent.territoryIds[0])),
    audit: copy(audit.filter((row) => row.targetId === agentId || agent.territoryIds.includes(row.targetId)).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))),
  }
}

function territoryDetail(territoryId: string): AgentDetail {
  const terr = findTerritory(territoryId)
  const holderId = terr.holderAgentId ?? agents.find((a) => a.territoryIds.includes(territoryId))?.agentId
  if (holderId) {
    const d = detailOf(holderId)
    if (!d.territories.some((t) => t.territoryId === territoryId)) d.territories = [copy(terr), ...d.territories]
    return d
  }
  // 无关联代理时仍返回可审计快照（用占位 agent 字段不安全）；要求至少有历史代理
  const any = agents.find((a) => a.territoryIds.includes(territoryId)) ?? agents[0]
  return {
    agent: copy(any),
    territories: copy([terr]),
    audit: copy(audit.filter((row) => row.targetId === territoryId)),
  }
}

export function mockAgentCatalog(): AgentCatalog {
  syncHolders()
  agents.forEach(refreshActions)
  return {
    planGroups: copy(agentGroups.map((g) => ({
      id: g.id,
      label: g.label,
      rows: g.rows.map((r) => ({
        id: r.id,
        positioning: r.positioning,
        name: r.name,
        population: r.population,
        fee: { ...r.fee },
        vipPartner: r.vipPartner,
        regionCommission: r.regionCommission,
        virtualProduct: r.virtualProduct,
        physicalProduct: r.physicalProduct,
      })),
    }))),
    planNotes: copy(agentNotes),
    territories: copy(territories),
    agents: copy(agents),
  }
}

export function mockAgentList(query: AgentQuery): AgentList {
  if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  if (query.status && !['ACTIVE', 'SUSPENDED', 'EXITED'].includes(query.status)) fail('INVALID_INPUT', '状态筛选无效')
  syncHolders()
  agents.forEach(refreshActions)
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const rows = agents.filter((row) => {
    const territoryNames = row.territoryIds.map((id) => territories.find((t) => t.territoryId === id)?.name ?? '')
    const hay = [row.agentId, row.accountId, row.name, row.phone, row.partnerName ?? '', ...territoryNames].join(' ').toLowerCase()
    return (!keyword || hay.includes(keyword))
      && (!query.status || row.status === query.status)
      && (!query.territoryId || row.territoryIds.includes(query.territoryId))
  }).sort((a, b) => a.agentId.localeCompare(b.agentId))
  return {
    items: copy(rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)),
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      activeCount: agents.filter((a) => a.status === 'ACTIVE').length,
      suspendedCount: agents.filter((a) => a.status === 'SUSPENDED').length,
      exclusiveTerritoryCount: territories.filter((t) => t.exclusive).length,
    },
  }
}

export function mockAgentDetail(agentId: string): AgentDetail {
  syncHolders()
  agents.forEach(refreshActions)
  return detailOf(agentId)
}

export function mockAgentMutate(input: AgentMutation, operator: AgentOperator): AgentDetail {
  if (!input.reason?.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写 1 至 200 字操作原因')
  if (!input.idempotencyKey?.trim()) fail('INVALID_INPUT', '请求号不能为空')
  if (!Number.isInteger(input.version) || input.version < 1) fail('INVALID_INPUT', '版本无效')

  const key = `${operator.accountId}:${input.idempotencyKey}`
  const payload = JSON.stringify(input)
  const previous = operations.get(key)
  if (previous) {
    if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变')
    return copy(previous.result)
  }

  if (input.action === 'suspend' || input.action === 'resume') {
    const agent = findAgent(input.agentId)
    if (agent.version !== input.version) fail('VERSION_CONFLICT', '代理档案已更新，请刷新')
    const before = JSON.stringify(agent)
    if (input.action === 'suspend') {
      if (agent.status !== 'ACTIVE') fail('INVALID_STATE', '仅在职区域代理可暂停监管生效')
      agent.status = 'SUSPENDED'
    } else {
      if (agent.status !== 'SUSPENDED') fail('INVALID_STATE', '仅已暂停代理可恢复监管生效')
      for (const tid of agent.territoryIds) {
        const terr = findTerritory(tid)
        if (terr.exclusive) {
          const other = agents.find((a) => a.agentId !== agent.agentId && a.status === 'ACTIVE' && a.territoryIds.includes(tid))
          if (other) fail('EXCLUSIVITY_CONFLICT', `区域「${terr.name}」已被代理 ${other.name} 独占占用，不能恢复`)
        }
      }
      agent.status = 'ACTIVE'
    }
    agent.version++
    refreshActions(agent)
    syncHolders()
    audit.unshift({
      operationId: crypto.randomUUID(),
      requestId: input.idempotencyKey,
      action: input.action,
      targetId: agent.agentId,
      operatorId: operator.accountId,
      operatorName: operator.nickname,
      reason: input.reason.trim(),
      before,
      after: JSON.stringify(agent),
      occurredAt: new Date().toISOString(),
    })
    const result = detailOf(agent.agentId)
    operations.set(key, { payload, result })
    return copy(result)
  }

  if (input.action === 'set-exclusivity') {
    const terr = findTerritory(input.territoryId)
    if (terr.version !== input.version) fail('VERSION_CONFLICT', '区域配置已更新，请刷新')
    if (input.exclusive) {
      const holders = agents.filter((a) => a.status === 'ACTIVE' && a.territoryIds.includes(terr.territoryId))
      if (holders.length > 1) fail('EXCLUSIVITY_CONFLICT', '当前区域存在多名在职代理，无法开启独占')
    }
    const before = JSON.stringify(terr)
    terr.exclusive = input.exclusive
    terr.version++
    syncHolders()
    audit.unshift({
      operationId: crypto.randomUUID(),
      requestId: input.idempotencyKey,
      action: 'set-exclusivity',
      targetId: terr.territoryId,
      operatorId: operator.accountId,
      operatorName: operator.nickname,
      reason: input.reason.trim(),
      before,
      after: JSON.stringify(terr),
      occurredAt: new Date().toISOString(),
    })
    const result = territoryDetail(terr.territoryId)
    operations.set(key, { payload, result })
    return copy(result)
  }

  return fail('INVALID_INPUT', '未知监管操作')
}
