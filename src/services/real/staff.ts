import * as api from '../../api'
import {
  StaffError,
  storeCapabilityCodes,
  storeCapabilityLabels,
  storeRoleLabels,
  type StaffAssignment,
  type StaffCatalog,
  type StaffDetail,
  type StaffList,
  type StaffMutation,
  type StaffQuery,
  type StaffStatus,
  type StoreCapability,
  type StoreRole,
  type StoreRoleDefinition,
} from '../../types/staff'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unwrapData } from './bridge'

function roleCodeOf(raw: unknown): StoreRole {
  const value = str(raw, 'COACH').toUpperCase()
  if (value === 'STORE_OWNER' || value === 'STORE_MANAGER' || value === 'COACH') return value
  if (/owner|老板/i.test(value)) return 'STORE_OWNER'
  if (/manager|店长/i.test(value)) return 'STORE_MANAGER'
  return 'COACH'
}

function capsOf(raw: unknown): StoreCapability[] {
  const allowed = new Set<string>(storeCapabilityCodes)
  return stringList(raw).filter((code): code is StoreCapability => allowed.has(code))
}

export function mapStaffAssignment(raw: unknown): StaffAssignment {
  const r = record(raw)
  const roleCode = roleCodeOf(r.roleCode || r.role)
  const statusRaw = str(r.status, 'ACTIVE').toUpperCase()
  const status = (statusRaw === 'FROZEN' || statusRaw === 'LEFT' ? statusRaw : 'ACTIVE') as StaffStatus
  const inv = str(r.invitationStatus, 'ACTIVE').toUpperCase()
  const invitationStatus = (inv === 'PENDING' || inv === 'REVOKED' ? inv : 'ACTIVE') as StaffAssignment['invitationStatus']
  return {
    assignmentId: str(r.assignmentId || r.staffId || r.id),
    storeId: str(r.storeId),
    storeName: str(r.storeName),
    storeNumber: str(r.storeNumber || r.storeNo),
    linkedAccountId: nullableStr(r.linkedAccountId || r.accountId),
    displayName: str(r.displayName || r.name, '未命名'),
    loginAccount: str(r.loginAccount || r.username || r.account),
    roleCode,
    roleTitle: str(r.roleTitle || storeRoleLabels[roleCode] || roleCode),
    status,
    invitationStatus,
    credentialSet: bool(r.credentialSet ?? r.hasCredential, true),
    allowCrossStore: bool(r.allowCrossStore),
    effectiveCapabilities: capsOf(r.effectiveCapabilities ?? r.capabilities ?? r.perms),
    version: num(r.version, 1),
    effectiveAt: str(r.effectiveAt || r.createdAt),
    leftAt: nullableStr(r.leftAt),
    mockOnly: false,
  }
}

function mapRole(raw: unknown): StoreRoleDefinition {
  const r = record(raw)
  const roleCode = roleCodeOf(r.roleCode || r.code || r.id)
  return {
    roleCode,
    title: str(r.title || r.name || storeRoleLabels[roleCode]),
    summary: str(r.summary || r.description),
    capabilities: capsOf(r.capabilities),
    allowCrossStore: bool(r.allowCrossStore),
    version: num(r.version, 1),
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action: str(r.action, 'update-assignment') as never,
    targetId: str(r.targetId || r.assignmentId || r.staffId),
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

export function mapStaffCatalog(raw: unknown): StaffCatalog {
  const r = record(raw)
  const roles = arr(r.roles).map(mapRole)
  const dictionary = arr(r.capabilityDictionary ?? r.capabilities).map((item) => {
    const row = record(item)
    const code = str(row.code || row.id) as StoreCapability
    return { code, label: str(row.label || storeCapabilityLabels[code] || code) }
  }).filter((item) => (storeCapabilityCodes as readonly string[]).includes(item.code))
  return {
    roles: roles.length ? roles : (['STORE_OWNER', 'STORE_MANAGER', 'COACH'] as StoreRole[]).map((roleCode) => ({
      roleCode, title: storeRoleLabels[roleCode], summary: '', capabilities: [], allowCrossStore: false, version: 1,
    })),
    capabilityDictionary: dictionary.length ? dictionary : storeCapabilityCodes.map((code) => ({ code, label: storeCapabilityLabels[code] })),
    stores: arr(r.stores).map((item) => {
      const row = record(item)
      return { storeId: str(row.storeId || row.id), name: str(row.name), number: str(row.number || row.code), active: row.active !== false }
    }),
    audit: arr(r.audit).map(mapAudit),
    mockOnly: false,
  }
}

export function mapStaffDetail(raw: unknown): StaffDetail {
  const r = record(raw)
  const assignment = mapStaffAssignment(r.assignment ?? r.staff ?? r)
  const role = r.role ? mapRole(r.role) : {
    roleCode: assignment.roleCode, title: assignment.roleTitle, summary: '',
    capabilities: [...assignment.effectiveCapabilities], allowCrossStore: assignment.allowCrossStore, version: 1,
  }
  return { assignment, role, audit: arr(r.audit).map(mapAudit) }
}

function mapListSummary(raw: unknown, items: StaffAssignment[]) {
  const r = record(raw)
  return {
    assignments: num(r.assignments, items.length),
    active: num(r.active, items.filter((i) => i.status === 'ACTIVE').length),
    frozen: num(r.frozen, items.filter((i) => i.status === 'FROZEN').length),
    left: num(r.left, items.filter((i) => i.status === 'LEFT').length),
    crossStoreAllowed: num(r.crossStoreAllowed, items.filter((i) => i.allowCrossStore).length),
  }
}

export async function realStaffCatalog() {
  try { return mapStaffCatalog(await unwrapData(await api.getStaffCatalog())) }
  catch (error) { return mapHqError(error, StaffError) }
}

export async function realStaffList(query: StaffQuery): Promise<StaffList> {
  try {
    const page = asPage(await unwrapData(await api.getStaff({ ...query } as never)), query.page, query.pageSize)
    const items = page.items.map(mapStaffAssignment)
    return { items, total: page.total, page: page.page, pageSize: page.pageSize, summary: mapListSummary(page.summary, items) }
  } catch (error) { return mapHqError(error, StaffError) }
}

export async function realStaffDetail(assignmentId: string): Promise<StaffDetail> {
  try { return mapStaffDetail(await unwrapData(await api.getStaffByStaffId({ staffId: assignmentId }))) }
  catch (error) { return mapHqError(error, StaffError) }
}

export async function realStaffMutate(input: StaffMutation) {
  try {
    const actionMap: Record<string, string> = { 'save-role': 'update', assign: 'assign-store', disable: 'disable', create: 'create', update: 'update', 'create-assignment': 'create', 'update-assignment': 'update', 'set-status': 'update', 'mark-credential-reset': 'update' }
    const uiAction = str((input as { action?: string }).action, 'update')
    const action = actionMap[uiAction] || 'update'
    const staffId = str((input as { staffId?: string }).staffId || (input as { assignmentId?: string }).assignmentId)
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    const operation = {
      operationId: '',
      requestId: input.idempotencyKey,
      action: uiAction as never,
      targetId: staffId,
      before: '',
      after: '',
      reason: input.reason,
      operatorId: '',
      operatorName: '',
      occurredAt: new Date().toISOString(),
      beforeVersion: num((input as { version?: number }).version),
      afterVersion: num((input as { version?: number }).version, 0) + 1,
    }
    if (!staffId || action === 'create' || uiAction === 'save-role') {
      await unwrapData(await api.postStaffMutate(body as never))
      return { catalog: await realStaffCatalog(), operation }
    }
    await unwrapData(await api.postStaffByStaffIdMutate({ staffId }, body as never))
    return { detail: await realStaffDetail(staffId), operation }
  } catch (error) { return mapHqError(error, StaffError) }
}
