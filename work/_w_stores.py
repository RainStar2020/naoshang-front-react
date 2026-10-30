from pathlib import Path
Path(r"E:\project\react-web\naoshang-front-react\src\services\real\stores.ts").write_text(r"""import * as api from '../../api'
import {
  StoreError,
  type StoreCatalog,
  type StoreCoach,
  type StoreDetail,
  type StoreList,
  type StoreMutation,
  type StoreProfile,
  type StoreQuery,
  type StoreStaffBrief,
  type StoreStatus,
} from '../../types/stores'
import { arr, asPage, bool, mapHqError, moneyToFen, mutationBody, num, record, str, stringList, nullableStr, unwrapData } from './bridge'

function regionTriple(raw: Record<string, unknown>, kind: 'Names' | 'Codes'): [string, string, string] {
  const key = kind === 'Names' ? 'regionNames' : 'regionCodes'
  const direct = stringList(raw[key])
  if (direct.length >= 3) return [direct[0], direct[1], direct[2]]
  if (kind === 'Names') {
    const parts = [
      str(raw.provinceName || raw.province),
      str(raw.cityName || raw.city),
      str(raw.districtName || raw.district || raw.areaName),
    ].filter(Boolean)
    while (parts.length < 3) parts.push('')
    return [parts[0], parts[1], parts[2]]
  }
  const parts = [str(raw.provinceCode), str(raw.cityCode), str(raw.districtCode || raw.areaCode)].filter(Boolean)
  while (parts.length < 3) parts.push('')
  return [parts[0], parts[1], parts[2]]
}

function statusOf(raw: Record<string, unknown>): StoreStatus {
  const s = str(raw.status || raw.storeStatus, 'ACTIVE').toUpperCase()
  if (s === 'FROZEN' || s === 'CLOSED' || s === 'ACTIVE') return s
  if (raw.active === false || raw.closed === true) return 'CLOSED'
  return 'ACTIVE'
}

export function mapStoreProfile(raw: unknown): StoreProfile {
  const r = record(raw)
  return {
    storeId: str(r.storeId || r.id),
    number: str(r.number || r.code || r.storeNo),
    name: str(r.name || r.storeName, '未命名门店'),
    status: statusOf(r),
    managerName: str(r.managerName || r.manager || r.ownerName),
    contact: str(r.contact || r.phone || r.mobile),
    address: str(r.address || r.detailAddress),
    regionNames: regionTriple(r, 'Names'),
    regionCodes: regionTriple(r, 'Codes'),
    feeAmount: moneyToFen(r.feeAmount ?? r.fee ?? r.costoreFee),
    minimumFeeAmount: moneyToFen(r.minimumFeeAmount ?? r.minFeeAmount ?? 698),
    storefrontAssetId: nullableStr(r.storefrontAssetId ?? r.storefrontId),
    storefrontUrl: nullableStr(r.storefrontUrl ?? r.coverUrl),
    agentId: nullableStr(r.agentId),
    agentName: nullableStr(r.agentName),
    ownerCount: num(r.ownerCount),
    coachActive: num(r.coachActive ?? r.activeCoachCount),
    coachFrozen: num(r.coachFrozen ?? r.frozenCoachCount),
    staffTotal: num(r.staffTotal ?? r.staffCount),
    version: num(r.version, 1),
    openedAt: str(r.openedAt || r.createdAt),
    mockOnly: false,
  }
}

function mapCoach(raw: unknown): StoreCoach {
  const r = record(raw)
  const statusRaw = str(r.status, 'ACTIVE').toUpperCase()
  const status = (statusRaw === 'FROZEN' || statusRaw === 'LEFT' ? statusRaw : 'ACTIVE') as StoreCoach['status']
  const inv = str(r.invitationStatus, 'ACTIVE').toUpperCase()
  const invitationStatus = (inv === 'PENDING' || inv === 'REVOKED' ? inv : 'ACTIVE') as StoreCoach['invitationStatus']
  return {
    coachId: str(r.coachId || r.assignmentId || r.staffId || r.id),
    storeId: str(r.storeId),
    displayName: str(r.displayName || r.name),
    loginAccount: str(r.loginAccount || r.username || r.account),
    status,
    invitationStatus,
    credentialSet: bool(r.credentialSet ?? r.hasCredential, true),
    version: num(r.version, 1),
    effectiveAt: str(r.effectiveAt || r.createdAt),
    leftAt: nullableStr(r.leftAt),
  }
}

function mapStaffBrief(raw: unknown): StoreStaffBrief {
  const r = record(raw)
  return {
    assignmentId: str(r.assignmentId || r.staffId || r.id),
    displayName: str(r.displayName || r.name),
    loginAccount: str(r.loginAccount || r.username),
    roleCode: str(r.roleCode || r.role),
    roleTitle: str(r.roleTitle || r.roleName || r.roleCode || r.role),
    status: str(r.status, 'ACTIVE'),
    credentialSet: bool(r.credentialSet, true),
    version: num(r.version, 1),
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId || r.idempotencyKey),
    action: str(r.action, 'save-profile') as never,
    targetId: str(r.targetId || r.storeId),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    reason: str(r.reason),
    before: str(r.before),
    after: str(r.after),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version),
    occurredAt: str(r.occurredAt || r.createdAt),
  }
}

function mapRegionOption(raw: unknown): StoreCatalog['regionOptions'][number] {
  const r = record(raw)
  const children = arr(r.children).map(mapRegionOption)
  return { value: str(r.value || r.code || r.id), label: str(r.label || r.name), ...(children.length ? { children } : {}) }
}

export function mapStoreCatalog(raw: unknown): StoreCatalog {
  const r = record(raw)
  return {
    agents: arr(r.agents).map((item) => {
      const row = record(item)
      return { agentId: str(row.agentId || row.id), name: str(row.name), regionLabel: str(row.regionLabel || row.regionName || row.region) }
    }),
    regionOptions: arr(r.regionOptions ?? r.regions).map(mapRegionOption),
    audit: arr(r.audit).map(mapAudit),
    mockOnly: false,
  }
}

export function mapStoreDetail(raw: unknown): StoreDetail {
  const r = record(raw)
  return {
    store: mapStoreProfile(r.store ?? r.profile ?? r),
    coaches: arr(r.coaches).map(mapCoach),
    staff: arr(r.staff ?? r.assignments).map(mapStaffBrief),
    audit: arr(r.audit).map(mapAudit),
  }
}

function mapListSummary(raw: unknown, items: StoreProfile[]) {
  const r = record(raw)
  return {
    stores: num(r.stores, items.length),
    active: num(r.active, items.filter((i) => i.status === 'ACTIVE').length),
    frozen: num(r.frozen, items.filter((i) => i.status === 'FROZEN').length),
    closed: num(r.closed, items.filter((i) => i.status === 'CLOSED').length),
    coachesActive: num(r.coachesActive, items.reduce((sum, i) => sum + i.coachActive, 0)),
  }
}

export async function realStoreCatalog(): Promise<StoreCatalog> {
  try { return mapStoreCatalog(await unwrapData(await api.getStoresCatalog())) }
  catch (error) { return mapHqError(error, StoreError) }
}

export async function realStoreList(query: StoreQuery): Promise<StoreList> {
  try {
    const page = asPage(await unwrapData(await api.getStores({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapStoreProfile)
    return { items, total: page.total, page: page.page, pageSize: page.pageSize, summary: mapListSummary(page.summary, items) }
  } catch (error) { return mapHqError(error, StoreError) }
}

export async function realStoreDetail(storeId: string): Promise<StoreDetail> {
  try { return mapStoreDetail(await unwrapData(await api.getStoresByStoreId({ storeId }))) }
  catch (error) { return mapHqError(error, StoreError) }
}

export async function realStoreMutate(input: StoreMutation): Promise<StoreDetail | StoreCatalog> {
  try {
    const action = str((input as { action?: string }).action, 'update')
    const storeId = str((input as { storeId?: string }).storeId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    if (action === 'create' || !storeId) {
      await unwrapData(await api.postStoresMutate(body as never))
      return realStoreCatalog()
    }
    await unwrapData(await api.postStoresByStoreIdMutate({ storeId }, body as never))
    return realStoreDetail(storeId)
  } catch (error) { return mapHqError(error, StoreError) }
}
""", encoding="utf-8")
print("stores ok")