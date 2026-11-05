import * as api from '../../api'
import { UserServiceError, type BusinessIdentity, type TierOption, type UserAccount, type UserAuditEntry, type UserDetail, type UserFilterOptions, type UserListQuery, type UserListResult, type UserMutation, type UserMutationResult, type UserStoreBindInput, type UserStoreBindingResult, type UserStoreBindingState, type UserStoreBindingView, type UserStoreUnbindInput } from '../../types/users'
import { arr, asPage, bool, cast, mapHqError, mutationBody, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

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


/** Flatten API scalars/objects (e.g. {frozen, note}) into table-safe display text. */
export function displayValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value.map((item) => displayValue(item)).filter((item) => item && item !== '—')
    return parts.length ? parts.join('、') : '—'
  }
  const row = record(value)
  if ('frozen' in row || 'note' in row) {
    const parts: string[] = []
    if ('frozen' in row) parts.push(bool(row.frozen) ? '冻结' : '正常')
    const note = str(row.note)
    if (note) parts.push(`备注：${note}`)
    for (const [key, nested] of Object.entries(row)) {
      if (key === 'frozen' || key === 'note') continue
      const text = displayValue(nested)
      if (text && text !== '—') parts.push(`${key}：${text}`)
    }
    return parts.join('；') || '—'
  }
  const parts = Object.entries(row).map(([key, nested]) => {
    const text = displayValue(nested)
    return text && text !== '—' ? `${key}：${text}` : ''
  }).filter(Boolean)
  return parts.length ? parts.join('；') : '—'
}

function frozenFlag(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'frozen' in (raw as object)) {
    return bool((raw as Record<string, unknown>).frozen)
  }
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase()
    if (upper === 'FROZEN' || upper === 'INACTIVE' || upper === 'DISABLED') return true
    if (upper === 'ACTIVE' || upper === 'NORMAL' || upper === 'UNFROZEN') return false
  }
  if (raw === 1 || raw === '1') return true
  if (raw === 0 || raw === '0') return false
  return null
}

function mapAuditAction(raw: unknown): UserMutation['action'] {
  const value = str(raw).toLowerCase()
  if (value === 'change-store' || value === 'change_store' || value === 'bind-store') return 'change-store'
  if (value === 'reset-password' || value === 'reset_password') return 'reset-password'
  if (value === 'change-display-id' || value === 'change_display_id' || value === 'update-display-id') return 'change-display-id'
  return 'freeze'
}

export function mapAuditEntry(raw: unknown, index = 0, fallbackAccountId = ''): UserAuditEntry {
  const row = record(raw)
  const operationId = str(row.operationId || row.id || row.requestId || `audit-${fallbackAccountId || 'unknown'}-${index}`)
  const requestId = str(row.requestId || row.idempotencyKey || operationId)
  const accountId = str(row.accountId || fallbackAccountId)
  return {
    operationId,
    requestId,
    accountId,
    action: mapAuditAction(row.action || row.type || row.op),
    operatorId: str(row.operatorId || row.operatorAccountId || row.adminId),
    operatorName: str(row.operatorName || row.operator || row.adminName || '总部操作'),
    reason: displayValue(row.reason ?? row.note ?? row.remark),
    before: displayValue(row.before ?? row.from ?? row.previous),
    after: displayValue(row.after ?? row.to ?? row.next ?? row.current),
    occurredAt: str(row.occurredAt || row.createdAt || row.time || row.operatedAt),
  }
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
    frozen: (() => {
      const flags = [
        frozenFlag(r.frozen),
        frozenFlag(r.isFrozen),
        frozenFlag(profile.frozen),
        frozenFlag(r.status),
        frozenFlag(profile.status),
      ]
      for (const flag of flags) {
        if (flag != null) return flag
      }
      return false
    })(),
    tier: (() => {
      const value = r.tier ?? profile.tier
      if (value == null || value === '') return null
      return str(value)
    })(),
    tierLabel: (() => {
      const value = r.tierLabel ?? profile.tierLabel ?? r.tier_name ?? profile.tier_name
      if (value == null || value === '') return null
      return str(value)
    })(),
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
      tier: query.tier || undefined,
    }))
    const page = asPage(data, query.page, query.pageSize)
    return { items: page.items.map(mapAccount), total: page.total, page: page.page, pageSize: page.pageSize }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export function mapTierOptions(rawCatalog: unknown): TierOption[] {
  const raw = record(rawCatalog)
  const sources = [
    ...arr(raw.tiers),
    ...arr(raw.vipTiers),
    ...arr(raw.partnerTiers),
    ...arr(raw.levels),
    ...arr(raw.partnerLevels),
  ]
  const seen = new Set<string>()
  const tiers: TierOption[] = []
  for (const item of sources) {
    if (typeof item === 'string') {
      const value = item.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      tiers.push({ value, label: value })
      continue
    }
    const row = record(item)
    const value = str(row.tier || row.value || row.code || row.id || row.partnerLevel || row.level)
    if (!value || seen.has(value)) continue
    const label = str(row.tierLabel || row.label || row.name || row.title || value) || value
    seen.add(value)
    tiers.push({ value, label })
  }
  return tiers
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
      tiers: mapTierOptions(raw),
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realUserDetail(accountId: string): Promise<UserDetail> {
  try {
    const data = await unwrapData(await api.getUsersByAccountId({ accountId }))
    const raw = record(data)
    const account = mapAccount(raw.account ?? raw.profile ?? raw)
    const auditSource = arr(raw.audit ?? raw.audits ?? raw.operations ?? raw.logs)
    return {
      account,
      audit: auditSource.map((item, index) => mapAuditEntry(item, index, account.accountId)),
    }
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
    const account = mapAccount(raw.account ?? raw.profile ?? raw)
    const operationRaw = raw.operation ?? {
      operationId: str(raw.operationId, input.idempotencyKey),
      requestId: input.idempotencyKey,
      accountId: input.accountId,
      action: input.action,
      operatorId: '',
      operatorName: '',
      reason: input.reason,
      before: raw.before,
      after: raw.after,
      occurredAt: new Date().toISOString(),
    }
    return {
      account,
      operation: mapAuditEntry(operationRaw, 0, account.accountId || input.accountId),
      mockOnly: false,
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}


function mapStoreBindingState(raw: unknown): UserStoreBindingState {
  const r = record(raw)
  const bound = bool(r.bound ?? !!(r.storeId))
  const storeId = nullableStr(r.storeId)
  const storeName = nullableStr(r.storeName ?? r.label)
  const storeNo = nullableStr(r.storeNo ?? r.storeCode)
  return {
    bound,
    storeId: bound ? storeId : null,
    storeName: bound ? storeName : null,
    storeNo: bound ? storeNo : null,
    label: nullableStr(r.label) ?? (bound ? storeName : '未绑定门店'),
  }
}

function mapStoreBindingOption(raw: unknown) {
  const r = record(raw)
  const storeId = str(r.id || r.storeId || r.shopId)
  return {
    storeId,
    storeNo: str(r.storeNo || r.number || r.code || storeId),
    name: str(r.name || r.storeName || storeId),
    isHeadquarters: bool(r.isHeadquarters) || storeId === 'HQ' || str(r.storeNo).toUpperCase() === 'HQ',
  }
}

/** Normalize GET /users/:accountId/store-binding payload. */
export function mapUserStoreBinding(accountId: string, raw: unknown): UserStoreBindingView {
  const r = record(raw)
  const profile = record(r.profile)
  const bindingRaw = r.binding ?? profile.storeBinding ?? r
  return {
    accountId: str(r.accountId || profile.id || profile.accountId || accountId, accountId),
    profileName: nullableStr(profile.name || profile.nickname || r.name),
    binding: mapStoreBindingState(bindingRaw),
    stores: arr(r.stores).map(mapStoreBindingOption).filter((s) => !!s.storeId),
  }
}

export async function realUserStoreBinding(accountId: string): Promise<UserStoreBindingView> {
  try {
    const data = await unwrapData(await api.getUsersByAccountIdStoreBinding({ accountId }))
    return mapUserStoreBinding(accountId, data)
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realBindUserStore(input: UserStoreBindInput): Promise<UserStoreBindingResult> {
  try {
    const data = await unwrapData(await api.postUsersByAccountIdStoreBinding(
      { accountId: input.accountId },
      { storeId: input.storeId, reason: input.reason?.trim() || undefined },
    ))
    const raw = record(data)
    return {
      binding: mapStoreBindingState(raw.binding ?? raw),
      operationId: str(raw.operationId, ''),
      mockOnly: false,
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

export async function realUnbindUserStore(input: UserStoreUnbindInput): Promise<UserStoreBindingResult> {
  try {
    const data = await unwrapData(await api.deleteUsersByAccountIdStoreBinding(
      { accountId: input.accountId },
      { reason: input.reason?.trim() || undefined },
    ))
    const raw = record(data)
    return {
      binding: mapStoreBindingState(raw.binding ?? { bound: false }),
      operationId: str(raw.operationId, ''),
      removed: num(raw.removed, 1),
      mockOnly: false,
    }
  } catch (error) {
    return mapHqError(error, UserServiceError)
  }
}

