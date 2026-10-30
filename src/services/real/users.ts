import * as api from '../../api'
import { UserServiceError, type BusinessIdentity, type UserAccount, type UserDetail, type UserFilterOptions, type UserListQuery, type UserListResult, type UserMutation, type UserMutationResult } from '../../types/users'
import { arr, asPage, bool, cast, mapHqError, mutationBody, num, record, str, unsupported, unwrapData } from './bridge'

function stringList(value: unknown): string[] {
  return arr(value).map((item) => str(item)).filter(Boolean)
}

function regionCodesOf(r: Record<string, unknown>, profile: Record<string, unknown>): string[] {
  const direct = stringList(r.regionCodes ?? profile.regionCodes)
  if (direct.length) return direct
  const nested = arr(r.regions ?? profile.regions).map((item) => {
    const row = record(item)
    return str(row.code || row.value || row.id || row.regionCode)
  }).filter(Boolean)
  if (nested.length) return nested
  return [str(r.provinceCode || profile.provinceCode), str(r.cityCode || profile.cityCode), str(r.districtCode || profile.districtCode || r.areaCode || profile.areaCode)].filter(Boolean)
}

function regionNamesOf(r: Record<string, unknown>, profile: Record<string, unknown>): string[] {
  const direct = stringList(r.regionNames ?? profile.regionNames)
  if (direct.length) return direct
  if (typeof r.regionName === 'string' && r.regionName.trim()) return r.regionName.split(/[\/\s>]+/).map((part) => part.trim()).filter(Boolean)
  if (typeof profile.regionName === 'string' && profile.regionName.trim()) return profile.regionName.split(/[\/\s>]+/).map((part) => part.trim()).filter(Boolean)
  const nested = arr(r.regions ?? profile.regions).map((item) => {
    const row = record(item)
    return str(row.name || row.label || row.regionName)
  }).filter(Boolean)
  if (nested.length) return nested
  return [
    str(r.provinceName || profile.provinceName || r.province || profile.province),
    str(r.cityName || profile.cityName || r.city || profile.city),
    str(r.districtName || profile.districtName || r.district || profile.district || r.areaName || profile.areaName),
  ].filter(Boolean)
}

function mapBusinessContext(raw: unknown, index: number, accountId: string): BusinessIdentity | null {
  if (typeof raw === 'string') {
    const label = raw.trim()
    if (!label) return null
    const module = /agency|代理|区代|市代|县代/i.test(label) ? 'agency' : /costore|合店/i.test(label) ? 'costore' : 'partner'
    return { contextId: `${module}:${accountId}:${index}`, module, label }
  }
  const row = record(raw)
  const label = str(row.label || row.name || row.title || row.roleName || row.role)
  const moduleRaw = str(row.module || row.type || row.kind, 'partner').toLowerCase()
  const module: BusinessIdentity['module'] = moduleRaw.includes('agency') || moduleRaw.includes('agent')
    ? 'agency'
    : moduleRaw.includes('costore') || moduleRaw.includes('co-store') || moduleRaw.includes('store')
      ? 'costore'
      : 'partner'
  const contextId = str(row.contextId || row.id || `${module}:${accountId}:${index}`)
  if (!label && !contextId) return null
  return {
    contextId: contextId || `${module}:${accountId}:${index}`,
    module,
    label: label || contextId,
    ...(row.assignmentId ? { assignmentId: str(row.assignmentId) } : {}),
    ...(row.contractId ? { contractId: str(row.contractId) } : {}),
  }
}

function businessContextsOf(r: Record<string, unknown>, profile: Record<string, unknown>, accountId: string): BusinessIdentity[] {
  const sources = [
    ...arr(r.businessContexts),
    ...arr(profile.businessContexts),
    ...arr(r.identities),
    ...arr(profile.identities),
    ...arr(r.roles),
    ...arr(profile.roles),
  ]
  const mapped = sources.map((item, index) => mapBusinessContext(item, index, accountId)).filter((item): item is BusinessIdentity => !!item)
  const seen = new Set<string>()
  return mapped.filter((item) => {
    if (seen.has(item.contextId)) return false
    seen.add(item.contextId)
    return true
  })
}

/** Normalize HQ users payload (v1/v2) into dedicated UI UserAccount shape. */
export function mapAccount(raw: unknown): UserAccount {
  const r = record(raw)
  const profile = record(r.profile)
  const accountId = str(r.accountId || r.id || profile.accountId || profile.id)
  const phone = str(r.phone || r.mobile || profile.phone || profile.mobile)
  const nickname = str(r.nickname || profile.nickname || r.name || profile.name || phone || accountId || '未命名')
  const storeIdRaw = r.storeId ?? profile.storeId
  const storeNameRaw = r.storeName ?? profile.storeName
  const storeId = storeIdRaw == null || storeIdRaw === '' ? null : str(storeIdRaw)
  const storeName = storeNameRaw == null || storeNameRaw === '' ? null : str(storeNameRaw)
  const passwordResetAtRaw = r.passwordResetAt ?? profile.passwordResetAt
  return {
    accountId,
    displayId: str(r.displayId || r.userNo || profile.displayId || profile.userNo || accountId),
    nickname,
    avatarUrl: (() => {
      const value = r.avatarUrl ?? profile.avatarUrl ?? r.avatar ?? profile.avatar
      if (value == null || value === '') return null
      return str(value)
    })(),
    phone,
    regionCodes: regionCodesOf(r, profile),
    regionNames: regionNamesOf(r, profile),
    storeId,
    storeName,
    frozen: bool(r.frozen ?? r.isFrozen ?? profile.frozen ?? (str(r.status || profile.status).toUpperCase() === 'FROZEN')),
    version: num(r.version ?? profile.version, 1),
    businessContexts: businessContextsOf(r, profile, accountId || 'unknown'),
    createdAt: str(r.createdAt || profile.createdAt),
    passwordResetAt: passwordResetAtRaw == null || passwordResetAtRaw === '' ? null : str(passwordResetAtRaw),
  }
}

export async function realListUsers(query: UserListQuery): Promise<UserListResult> {
  try {
    const data = await unwrapData(await api.getUsers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      frozen: query.status === 'frozen' ? true : query.status === 'active' ? false : undefined,
      storeId: query.storeId || undefined,
    } as never))
    const page = asPage(data, query.page, query.pageSize)
    return { items: page.items.map(mapAccount), total: page.total, page: page.page, pageSize: page.pageSize }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realUserOptions(): Promise<UserFilterOptions> {
  try {
    const data = await unwrapData(await api.getUsersCatalog())
    const raw = record(data)
    return {
      stores: arr(raw.stores).map((s) => {
        const row = record(s)
        return { storeId: str(row.storeId || row.id), name: str(row.name), number: str(row.number || row.code), active: row.active !== false }
      }),
      regions: arr(raw.regions).map((r) => cast(r)),
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realUserDetail(accountId: string): Promise<UserDetail> {
  try {
    const data = await unwrapData(await api.getUsersByAccountId({ accountId }))
    const raw = record(data)
    return { account: mapAccount(raw.account ?? raw.profile ?? raw), audit: arr(raw.audit).map((a) => cast(a)) }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realMutateUser(input: UserMutation): Promise<UserMutationResult> {
  try {
    if (input.action === 'reset-password') {
      return unsupported(UserServiceError, 'reset-password', 'HQ users mutate 仅支持 freeze/unfreeze/update-note，重置密码需后端补接口')
    }
    if (input.action === 'change-display-id') {
      return unsupported(UserServiceError, 'change-display-id', 'HQ users mutate 仅支持 freeze/unfreeze/update-note')
    }
    let action: string
    let extra: Record<string, unknown> = {}
    if (input.action === 'freeze') {
      action = input.frozen ? 'freeze' : 'unfreeze'
    } else if (input.action === 'change-store') {
      action = 'update-note'
      extra = { note: `change-store:${input.storeId}`, storeId: input.storeId }
    } else {
      action = String((input as { action: string }).action)
    }
    const body = mutationBody({ action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version, ...extra })
    const data = await unwrapData(await api.postUsersByAccountIdMutate({ accountId: input.accountId }, body as never))
    const raw = record(data)
    return {
      account: mapAccount(raw.account ?? raw.profile ?? raw),
      operation: cast(raw.operation ?? {
        operationId: str(raw.operationId, input.idempotencyKey),
        requestId: input.idempotencyKey,
        accountId: input.accountId,
        action: input.action,
        operatorId: '',
        operatorName: '',
        reason: input.reason,
        before: '',
        after: '',
        occurredAt: new Date().toISOString(),
      }),
      mockOnly: false,
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}
