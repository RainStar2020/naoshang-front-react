import * as api from '../../api'
import { InvitationError, type InvitationMutation, type InvitationQuery, type InvitationTeamQuery } from '../../types/invitations'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, record, str, unwrapData } from './bridge'

function mapAccount(raw: unknown) {
  const r = record(raw)
  const accountId = str(r.accountId || r.id)
  const phone = str(r.phone || r.mobile)
  return {
    accountId,
    displayId: str(r.displayId || r.userNo || accountId),
    name: str(r.name || r.nickname || phone || accountId || '未命名'),
    phone,
    frozen: bool(r.frozen ?? r.isFrozen ?? (str(r.status).toUpperCase() === 'FROZEN')),
  }
}

function mapAccountOrNull(raw: unknown) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const id = raw.trim()
    if (!id) return null
    return { accountId: id, displayId: id, name: id, phone: '', frozen: false }
  }
  const mapped = mapAccount(raw)
  return mapped.accountId ? mapped : null
}

function mapInitialBinding(raw: unknown, superior: ReturnType<typeof mapAccountOrNull>) {
  const r = record(raw)
  const inviteCode = r.inviteCode == null || r.inviteCode === '' ? null : str(r.inviteCode)
  const source = str(r.source, inviteCode || superior ? 'REGISTRATION_INVITE' : 'NO_INVITE')
  return {
    source: (source === 'REGISTRATION_INVITE' ? 'REGISTRATION_INVITE' : 'NO_INVITE') as 'REGISTRATION_INVITE' | 'NO_INVITE',
    inviteCode,
    superior: mapAccountOrNull(r.superior) ?? superior,
    boundAt: str(r.boundAt || r.createdAt || r.effectiveAt),
    mockOnly: false,
  }
}

function mapRelation(raw: unknown) {
  const r = record(raw)
  const account = mapAccount(r.account ?? r)
  const superior = mapAccountOrNull(r.superior ?? r.parent ?? r.inviter)
  const inviteCode = str(r.inviteCode || r.code)
  const allowedRaw = arr(r.allowedActions).map((item) => str(item))
  const allowedActions = (allowedRaw.length
    ? allowedRaw.filter((item): item is 'rebind' | 'unbind' => item === 'rebind' || item === 'unbind')
    : (['rebind', 'unbind'] as const)
  ) as ('rebind' | 'unbind')[]
  return {
    account,
    superior,
    inviteCode,
    initialBinding: mapInitialBinding(r.initialBinding ?? r.binding, superior),
    version: num(r.version, 1),
    graphVersion: num(r.graphVersion ?? r.relationVersion, 1),
    effectiveAt: str(r.effectiveAt || r.updatedAt || r.createdAt),
    directCount: num(r.directCount ?? r.directInviteCount),
    teamCount: num(r.teamCount ?? r.teamInviteCount),
    allowedActions,
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  const actionRaw = str(r.action, 'rebind')
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    account: mapAccount(r.account ?? r),
    action: (actionRaw === 'unbind' ? 'unbind' : 'rebind') as 'rebind' | 'unbind',
    before: mapAccountOrNull(r.before),
    after: mapAccountOrNull(r.after),
    reason: str(r.reason),
    operatorName: str(r.operatorName || r.operator),
    effectiveAt: str(r.effectiveAt || r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version, 1),
    graphVersion: num(r.graphVersion, 1),
  }
}

function mapDetail(raw: unknown) {
  const r = record(raw)
  const relation = mapRelation(r.relation ?? r)
  return {
    relation,
    ancestors: arr(r.ancestors ?? r.parents).map(mapAccount).filter((item) => item.accountId),
    history: arr(r.history ?? r.audit ?? r.audits).map(mapAudit),
  }
}

function mapTeam(raw: unknown, query: InvitationTeamQuery) {
  const page = asPage(raw, query.page, query.pageSize)
  const summary = record(page.summary)
  const items = page.items.map((item) => {
    const row = record(item)
    return {
      account: mapAccount(row.account ?? row),
      superior: mapAccountOrNull(row.superior),
      depth: num(row.depth, query.scope === 'DIRECT' ? 1 : 1),
    }
  })
  return {
    items,
    total: page.total,
    directCount: num(summary.directCount ?? page.raw.directCount, items.filter((i) => i.depth === 1).length),
    teamCount: num(summary.teamCount ?? page.raw.teamCount, page.total),
    graphVersion: num(summary.graphVersion ?? page.raw.graphVersion, 1),
  }
}

export async function realInvitationList(query: InvitationQuery) {
  try {
    const page = asPage(await unwrapData(await api.getInvitations({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapRelation)
    const summary = record(page.summary)
    return cast({
      items,
      total: page.total,
      summary: {
        accounts: num(summary.accounts, page.total),
        bound: num(summary.bound, items.filter((i) => !!i.superior).length),
        unbound: num(summary.unbound, items.filter((i) => !i.superior).length),
      },
    })
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationDetail(accountId: string) {
  try { return cast(mapDetail(await unwrapData(await api.getInvitationsByAccountId({ accountId })))) }
  catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationTeam(query: InvitationTeamQuery) {
  try {
    return cast(mapTeam(await unwrapData(await api.getInvitationsByAccountIdTeam({ accountId: query.accountId }, { ...query } as never)), query))
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationCandidates(accountId: string, keyword = '') {
  try {
    const page = asPage(await unwrapData(await api.getInvitations({ keyword, page: 1, pageSize: 50 } as never)))
    return cast(page.items.map(mapRelation).filter((i) => i.account.accountId !== accountId).map((i) => i.account))
  } catch (error) { return mapHqError(error, InvitationError) }
}

export async function realInvitationMutate(input: InvitationMutation) {
  try {
    const body = mutationBody({ ...record(input as never), action: str((input as { action?: string }).action, 'bind'), reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    await unwrapData(await api.postInvitationsMutate(body as never))
    const accountId = str((input as { accountId?: string }).accountId)
    return accountId ? realInvitationDetail(accountId) : realInvitationList({ page: 1, pageSize: 20 } as InvitationQuery)
  } catch (error) { return mapHqError(error, InvitationError) }
}
