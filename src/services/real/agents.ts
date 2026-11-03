import * as api from '../../api'
import {
  AgentError,
  type AgentAudit,
  type AgentCatalog,
  type AgentDetail,
  type AgentList,
  type AgentMutation,
  type AgentQuery,
  type AgentTerritory,
  type RegionAgent,
  type TerritoryLevel,
} from '../../types/agents'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, record, str, unwrapData } from './bridge'

function asStatus(value: unknown): RegionAgent['status'] {
  const raw = str(value, 'ACTIVE').toUpperCase()
  if (raw === 'SUSPENDED' || raw === 'EXITED') return raw
  return 'ACTIVE'
}

function asLevel(value: unknown): TerritoryLevel {
  const raw = str(value, 'DISTRICT').toUpperCase()
  if (raw === 'PROVINCE' || raw === 'CITY') return raw
  return 'DISTRICT'
}

function mapTerritory(raw: unknown): AgentTerritory {
  const r = record(raw)
  return {
    territoryId: str(r.territoryId || r.id),
    level: asLevel(r.level),
    name: str(r.name || r.label || r.title),
    exclusive: bool(r.exclusive, false),
    holderAgentId: r.holderAgentId == null || r.holderAgentId === '' ? null : str(r.holderAgentId),
    version: num(r.version, 1),
  }
}

function mapAgent(raw: unknown): RegionAgent {
  const r = record(raw)
  const status = asStatus(r.status)
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((a) => a === 'suspend' || a === 'resume' || a === 'set-exclusivity')
    : status === 'EXITED'
      ? []
      : status === 'SUSPENDED'
        ? ['resume', 'set-exclusivity']
        : ['suspend', 'set-exclusivity']) as RegionAgent['allowedActions']
  const territoryIds = arr(r.territoryIds).map((item) => str(item)).filter(Boolean)
  if (!territoryIds.length && r.territoryId) territoryIds.push(str(r.territoryId))
  return {
    agentId: str(r.agentId || r.id),
    accountId: str(r.accountId || r.ownerAccountId),
    name: str(r.name || r.displayName),
    phone: str(r.phone || r.mobile),
    partnerAccountId: r.partnerAccountId == null || r.partnerAccountId === '' ? null : str(r.partnerAccountId),
    partnerName: r.partnerName == null || r.partnerName === '' ? null : str(r.partnerName),
    levelLabel: str(r.levelLabel || r.levelName || r.agentLevel || '区县代理'),
    territoryIds,
    storeCount: num(r.storeCount),
    status,
    commissionSnapshotCents: num(r.commissionSnapshotCents ?? r.commissionCents ?? r.commissionSnapshot),
    version: num(r.version, 1),
    allowedActions,
  }
}

function mapAudit(raw: unknown): AgentAudit {
  const r = record(raw)
  const actionRaw = str(r.action, 'suspend')
  const action = (actionRaw === 'resume' || actionRaw === 'set-exclusivity' ? actionRaw : 'suspend') as AgentAudit['action']
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action,
    targetId: str(r.targetId || r.agentId || r.territoryId),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    reason: str(r.reason),
    before: str(r.before),
    after: str(r.after),
    occurredAt: str(r.occurredAt || r.createdAt),
  }
}

function mapPlanGroups(raw: unknown) {
  return arr(raw).map((group) => {
    const g = record(group)
    return {
      id: str(g.id || g.groupId),
      label: str(g.label || g.name || g.title),
      rows: arr(g.rows || g.items).map((row) => {
        const r = record(row)
        const fee = record(r.fee)
        return {
          id: str(r.id),
          positioning: str(r.positioning),
          name: str(r.name || r.title),
          population: r.population == null ? undefined : str(r.population),
          fee: {
            tech: num(fee.tech),
            device: num(fee.device),
            deposit: num(fee.deposit),
            total: num(fee.total ?? (num(fee.tech) + num(fee.device) + num(fee.deposit))),
          },
          vipPartner: str(r.vipPartner),
          regionCommission: str(r.regionCommission),
          virtualProduct: str(r.virtualProduct),
          physicalProduct: str(r.physicalProduct),
        }
      }),
    }
  })
}

function mapCatalog(raw: unknown): AgentCatalog {
  const r = record(raw)
  const agents = arr(r.agents || r.items).map(mapAgent)
  const territories = arr(r.territories).map(mapTerritory)
  return {
    planGroups: mapPlanGroups(r.planGroups || r.plans),
    planNotes: arr(r.planNotes).map((note) => {
      const n = record(note)
      return { title: str(n.title), items: arr(n.items).map((item) => str(item)) }
    }),
    territories,
    agents,
  }
}

function summarize(agents: RegionAgent[], territories: AgentTerritory[]) {
  return {
    activeCount: agents.filter((a) => a.status === 'ACTIVE').length,
    suspendedCount: agents.filter((a) => a.status === 'SUSPENDED').length,
    exclusiveTerritoryCount: territories.filter((t) => t.exclusive).length,
  }
}

export async function realAgentCatalog(): Promise<AgentCatalog> {
  try {
    return cast(mapCatalog(await unwrapData(await api.getRegionAgentsCatalog())))
  } catch (error) {
    return mapHqError(error, AgentError)
  }
}

export async function realAgentList(query: AgentQuery): Promise<AgentList> {
  try {
    const catalog = mapCatalog(await unwrapData(await api.getRegionAgentsCatalog({
      keyword: query.keyword,
      status: query.status,
      territoryId: query.territoryId,
      page: query.page,
      pageSize: query.pageSize,
    } as never)))
    let items = catalog.agents
    if (query.status) items = items.filter((a) => a.status === query.status)
    if (query.territoryId) items = items.filter((a) => a.territoryIds.includes(query.territoryId!))
    if (query.keyword) {
      const kw = query.keyword.trim().toLowerCase()
      const terrNames = new Map(catalog.territories.map((t) => [t.territoryId, t.name.toLowerCase()]))
      items = items.filter((a) => {
        const hit = `${a.name}${a.phone}${a.agentId}${a.accountId}`.toLowerCase().includes(kw)
        const terrHit = a.territoryIds.some((id) => (terrNames.get(id) || '').includes(kw))
        return hit || terrHit
      })
    }
    const total = items.length
    const start = Math.max(0, (query.page - 1) * query.pageSize)
    const pageItems = items.slice(start, start + query.pageSize)
    return {
      items: pageItems,
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: summarize(catalog.agents, catalog.territories),
    }
  } catch (error) {
    return mapHqError(error, AgentError)
  }
}

export async function realAgentDetail(agentId: string): Promise<AgentDetail> {
  try {
    const raw = record(await unwrapData(await api.getRegionAgentsByAgentId({ agentId })))
    const agent = mapAgent(raw.agent ?? raw)
    const territories = arr(raw.territories).map(mapTerritory)
    const audit = arr(raw.audit).map(mapAudit)
    // Best-effort commission snapshot from agents commission ledger when present.
    try {
      const ledger = record(await unwrapData(await api.getAgentsByAgentIdCommission({ agentId })))
      if (ledger.commissionSnapshotCents != null || ledger.totalCents != null || ledger.balanceCents != null) {
        agent.commissionSnapshotCents = num(ledger.commissionSnapshotCents ?? ledger.totalCents ?? ledger.balanceCents, agent.commissionSnapshotCents)
      }
    } catch {
      /* commission module optional for region-agent detail */
    }
    return { agent, territories: territories.length ? territories : [], audit }
  } catch (error) {
    return mapHqError(error, AgentError)
  }
}

export async function realAgentMutate(input: AgentMutation) {
  try {
    if (input.action === 'set-exclusivity') {
      const body = mutationBody({
        action: 'set-exclusivity',
        exclusive: input.exclusive,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        version: input.version,
      })
      await unwrapData(await api.postRegionAgentsTerritoriesByTerritoryIdMutate({ territoryId: input.territoryId }, body as never))
    } else {
      const body = mutationBody({
        action: input.action,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        version: input.version,
      })
      await unwrapData(await api.postRegionAgentsByAgentIdMutate({ agentId: input.agentId }, body as never))
    }
    if (input.action === 'set-exclusivity') {
      const catalog = await realAgentCatalog()
      const holder = catalog.territories.find((t) => t.territoryId === input.territoryId)?.holderAgentId
      if (holder) return realAgentDetail(holder)
      return {
        agent: catalog.agents[0] ?? mapAgent({ agentId: 'unknown', status: 'ACTIVE' }),
        territories: catalog.territories.filter((t) => t.territoryId === input.territoryId),
        audit: [],
      }
    }
    return realAgentDetail(input.agentId)
  } catch (error) {
    return mapHqError(error, AgentError)
  }
}

void asPage
