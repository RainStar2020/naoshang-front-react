import type { HqAccount } from '../../types/auth'
import {
  StaffError,
  storeCapabilityCodes,
  storeCapabilityLabels,
  storeRoleLabels,
  storeRoles,
  type StaffAssignment,
  type StaffAudit,
  type StaffCatalog,
  type StaffDetail,
  type StaffList,
  type StaffMutation,
  type StaffQuery,
  type StaffStatus,
  type StaffStoreOption,
  type StoreCapability,
  type StoreRole,
  type StoreRoleDefinition,
} from '../../types/staff'
import { mockUserOptions } from './users'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: StaffError['code'], message: string): never => { throw new StaffError(code, message) }
const now = () => new Date().toISOString()
const loginOk = (value: string) => /^[a-zA-Z0-9_-]{4,32}$/.test(value)
const nameOk = (value: string) => {
  const text = value.trim()
  const len = Array.from(text).length
  return len >= 1 && len <= 24
}

const stores: StaffStoreOption[] = mockUserOptions().stores.map(store => ({
  storeId: store.storeId,
  name: store.name,
  number: store.number,
  active: store.active,
}))

function storeOf(storeId: string) {
  return stores.find(item => item.storeId === storeId) ?? fail('INVALID_INPUT', '请选择有效门店')
}

const roles = new Map<StoreRole, StoreRoleDefinition>([
  ['STORE_OWNER', {
    roleCode: 'STORE_OWNER',
    title: '合店老板',
    summary: '合店经营身份任职；可查看门店与审批，不可由总部页面推导收益权限。',
    capabilities: ['store:profile:read', 'store:profile:edit', 'members:read', 'approvals:decide', 'coaches:manage'],
    allowCrossStore: false,
    version: 1,
  }],
  ['STORE_MANAGER', {
    roleCode: 'STORE_MANAGER',
    title: '店长',
    summary: '门店日常管理；默认可管理学员与健脑官，跨店默认关闭。',
    capabilities: ['store:profile:read', 'store:profile:edit', 'members:read', 'members:manage', 'feedback:read', 'orders:verify', 'approvals:decide', 'coaches:manage'],
    allowCrossStore: false,
    version: 1,
  }],
  ['COACH', {
    roleCode: 'COACH',
    title: '健脑官',
    summary: '使用 coach 登录通道；密码只存 credentialSet，不得从家长角色推导任职。',
    capabilities: ['store:profile:read', 'members:read', 'members:manage', 'feedback:read', 'feedback:write', 'orders:verify'],
    allowCrossStore: false,
    version: 1,
  }],
])

function roleOf(code: StoreRole) {
  return roles.get(code) ?? fail('NOT_FOUND', '门店角色不存在')
}

function viewRole(code: StoreRole): StoreRoleDefinition {
  const role = roleOf(code)
  return copy({ ...role, capabilities: [...role.capabilities] })
}

function buildAssignment(row: Omit<StaffAssignment, 'roleTitle' | 'effectiveCapabilities' | 'storeName' | 'storeNumber' | 'mockOnly'> & { storeId: string }): StaffAssignment {
  const store = storeOf(row.storeId)
  const role = roleOf(row.roleCode)
  return {
    ...row,
    storeName: store.name,
    storeNumber: store.number,
    roleTitle: role.title,
    effectiveCapabilities: [...role.capabilities],
    mockOnly: true,
  }
}

const assignments = new Map<string, StaffAssignment>([
  ['staff-1', buildAssignment({
    assignmentId: 'staff-1', storeId: 'shop-1', linkedAccountId: 'account-1', displayName: '李店长', loginAccount: 'manager-wutong',
    roleCode: 'STORE_MANAGER', status: 'ACTIVE', invitationStatus: 'ACTIVE', credentialSet: true, allowCrossStore: false, version: 1,
    effectiveAt: '2026-01-08T10:00:00.000Z', leftAt: null,
  })],
  ['staff-2', buildAssignment({
    assignmentId: 'staff-2', storeId: 'shop-1', linkedAccountId: null, displayName: '王老师', loginAccount: 'demo-coach',
    roleCode: 'COACH', status: 'ACTIVE', invitationStatus: 'ACTIVE', credentialSet: true, allowCrossStore: false, version: 1,
    effectiveAt: '2026-02-12T08:00:00.000Z', leftAt: null,
  })],
  ['staff-3', buildAssignment({
    assignmentId: 'staff-3', storeId: 'shop-2', linkedAccountId: null, displayName: '赵健脑', loginAccount: 'coach-tongbai',
    roleCode: 'COACH', status: 'ACTIVE', invitationStatus: 'PENDING', credentialSet: false, allowCrossStore: false, version: 1,
    effectiveAt: '2026-03-01T09:30:00.000Z', leftAt: null,
  })],
  ['staff-4', buildAssignment({
    assignmentId: 'staff-4', storeId: 'shop-1', linkedAccountId: 'account-3', displayName: '合店陈老板', loginAccount: 'owner-wutong',
    roleCode: 'STORE_OWNER', status: 'ACTIVE', invitationStatus: 'ACTIVE', credentialSet: true, allowCrossStore: false, version: 1,
    effectiveAt: '2025-11-20T04:00:00.000Z', leftAt: null,
  })],
  ['staff-5', buildAssignment({
    assignmentId: 'staff-5', storeId: 'shop-2', linkedAccountId: null, displayName: '冻结健脑官', loginAccount: 'coach-frozen',
    roleCode: 'COACH', status: 'FROZEN', invitationStatus: 'ACTIVE', credentialSet: true, allowCrossStore: false, version: 1,
    effectiveAt: '2026-04-15T02:00:00.000Z', leftAt: null,
  })],
  ['staff-6', buildAssignment({
    assignmentId: 'staff-6', storeId: 'shop-3', linkedAccountId: null, displayName: '已离职店长', loginAccount: 'manager-left',
    roleCode: 'STORE_MANAGER', status: 'LEFT', invitationStatus: 'REVOKED', credentialSet: true, allowCrossStore: false, version: 2,
    effectiveAt: '2025-08-01T01:00:00.000Z', leftAt: '2026-05-01T06:00:00.000Z',
  })],
  ['staff-7', buildAssignment({
    assignmentId: 'staff-7', storeId: 'shop-3', linkedAccountId: null, displayName: '跨店演示健脑官', loginAccount: 'coach-cross',
    roleCode: 'COACH', status: 'ACTIVE', invitationStatus: 'ACTIVE', credentialSet: true, allowCrossStore: false, version: 1,
    effectiveAt: '2026-06-10T03:00:00.000Z', leftAt: null,
  })],
])

const audit: StaffAudit[] = []
const operations = new Map<string, { payload: string; result: unknown }>()

function assignment(id: string) {
  return assignments.get(id) ?? fail('NOT_FOUND', '员工任职不存在')
}

function paginate(page: number, pageSize: number) {
  if (!Number.isInteger(page) || page < 1 || ![5, 10, 20].includes(pageSize)) fail('INVALID_INPUT', '分页参数无效')
}

function matches(row: StaffAssignment, keyword = '') {
  const text = `${row.assignmentId} ${row.displayName} ${row.loginAccount} ${row.storeName} ${row.storeNumber} ${row.linkedAccountId ?? ''}`.toLowerCase()
  return text.includes(keyword.trim().toLowerCase())
}

function ensureCapabilities(list: StoreCapability[]) {
  if (!Array.isArray(list) || list.length === 0) fail('INVALID_INPUT', '请至少配置一项门店能力')
  const unique = [...new Set(list)]
  if (unique.some(item => !storeCapabilityCodes.includes(item))) fail('INVALID_INPUT', '存在未知或禁止的能力码')
  const banned = ['revenue', 'settle', 'withdraw', 'commission', 'rate', 'bps', 'income']
  if (unique.some(code => banned.some(word => code.includes(word)))) fail('INVALID_INPUT', '不可配置收益/结算类权限')
  return unique
}

function ensureReason(reason: string, key: string) {
  if (!key?.trim() || !reason?.trim() || reason.trim().length > 200) fail('INVALID_INPUT', '请填写1至200字原因并提供请求号')
}

function refreshAssignment(row: StaffAssignment) {
  const role = roleOf(row.roleCode)
  row.roleTitle = role.title
  row.effectiveCapabilities = [...role.capabilities]
  const store = storeOf(row.storeId)
  row.storeName = store.name
  row.storeNumber = store.number
}

function assertCrossStore(loginAccount: string, storeId: string, allowCrossStore: boolean, roleCode: StoreRole, exceptId?: string) {
  const role = roleOf(roleCode)
  const effectiveCross = allowCrossStore && role.allowCrossStore
  const others = [...assignments.values()].filter(item => item.loginAccount === loginAccount && item.assignmentId !== exceptId && item.status !== 'LEFT')
  if (!others.length) return
  if (!effectiveCross || others.some(item => !(item.allowCrossStore && roleOf(item.roleCode).allowCrossStore))) {
    fail('INVALID_STATE', '该登录账号已有其他门店在职/冻结任职，且未同时开放跨店')
  }
  if (others.some(item => item.storeId === storeId)) fail('INVALID_STATE', '同一门店下登录账号已有在职或冻结任职')
}

function pushAudit(entry: Omit<StaffAudit, 'operationId' | 'occurredAt'>): StaffAudit {
  const row: StaffAudit = { ...entry, operationId: crypto.randomUUID(), occurredAt: now() }
  audit.unshift(row)
  return row
}

function idempotent<T>(operatorId: string, key: string, input: StaffMutation, run: () => T): T {
  const cacheKey = `${operatorId}:${key}`
  const payload = JSON.stringify(input)
  const old = operations.get(cacheKey)
  if (old) {
    if (old.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变')
    return copy(old.result as T)
  }
  const result = run()
  operations.set(cacheKey, { payload, result: copy(result) })
  return copy(result)
}

export function mockStaffCatalog(): StaffCatalog {
  return copy({
    roles: storeRoles.map(viewRole),
    capabilityDictionary: storeCapabilityCodes.map(code => ({ code, label: storeCapabilityLabels[code] })),
    stores: stores.filter(item => item.active),
    audit: audit.slice(0, 50),
    mockOnly: true,
  })
}

export function mockStaffList(query: StaffQuery): StaffList {
  paginate(query.page, query.pageSize)
  if (query.roleCode && !storeRoles.includes(query.roleCode)) fail('INVALID_INPUT', '角色筛选无效')
  if (query.status && !['ACTIVE', 'FROZEN', 'LEFT'].includes(query.status)) fail('INVALID_INPUT', '任职状态无效')
  if (query.storeId) storeOf(query.storeId)
  const rows = [...assignments.values()]
    .map(row => { refreshAssignment(row); return copy(row) })
    .filter(row =>
      matches(row, query.keyword) &&
      (!query.storeId || row.storeId === query.storeId) &&
      (!query.roleCode || row.roleCode === query.roleCode) &&
      (!query.status || row.status === query.status),
    )
    .sort((a, b) => a.assignmentId.localeCompare(b.assignmentId))
  const summary = {
    assignments: rows.length,
    active: rows.filter(item => item.status === 'ACTIVE').length,
    frozen: rows.filter(item => item.status === 'FROZEN').length,
    left: rows.filter(item => item.status === 'LEFT').length,
    crossStoreAllowed: rows.filter(item => item.allowCrossStore && roleOf(item.roleCode).allowCrossStore).length,
  }
  return copy({
    items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
    summary,
  })
}

export function mockStaffDetail(assignmentId: string): StaffDetail {
  const row = assignment(assignmentId)
  refreshAssignment(row)
  return copy({
    assignment: row,
    role: viewRole(row.roleCode),
    audit: audit.filter(item => item.targetId === assignmentId || item.targetId === row.roleCode),
  })
}

export function mockStaffMutate(input: StaffMutation, operator: HqAccount) {
  ensureReason(input.reason, input.idempotencyKey)
  return idempotent(operator.accountId, input.idempotencyKey, input, () => {
    if (input.action === 'save-role') {
      if (!storeRoles.includes(input.roleCode)) fail('INVALID_INPUT', '角色无效')
      const title = input.title.trim(), summary = input.summary.trim()
      if (!title || Array.from(title).length > 24 || !summary || Array.from(summary).length > 200) fail('INVALID_INPUT', '标题1—24字、说明1—200字')
      const role = roleOf(input.roleCode)
      if (role.version !== input.version) fail('VERSION_CONFLICT', '角色配置已变化，请刷新后重试')
      const capabilities = ensureCapabilities(input.capabilities)
      const before = `${role.title}/跨店${role.allowCrossStore ? '开' : '关'}/能力${role.capabilities.length}`
      role.title = title
      role.summary = summary
      role.capabilities = capabilities
      role.allowCrossStore = !!input.allowCrossStore
      role.version += 1
      for (const row of assignments.values()) {
        if (row.roleCode === role.roleCode) refreshAssignment(row)
      }
      const entry = pushAudit({
        requestId: input.idempotencyKey, action: 'save-role', targetId: role.roleCode,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: `${role.title}/跨店${role.allowCrossStore ? '开' : '关'}/能力${role.capabilities.length}`,
        beforeVersion: input.version, afterVersion: role.version,
      })
      return { catalog: mockStaffCatalog(), operation: entry }
    }

    if (input.action === 'create-assignment') {
      if (input.version !== 0) fail('INVALID_INPUT', '新建任职 version 须为 0')
      if (!nameOk(input.displayName) || !loginOk(input.loginAccount)) fail('INVALID_INPUT', '姓名1—24字；登录账号4—32位字母数字_-')
      if (!storeRoles.includes(input.roleCode)) fail('INVALID_INPUT', '角色无效')
      const store = storeOf(input.storeId)
      if (!store.active) fail('INVALID_STATE', '停业门店不能新增任职')
      assertCrossStore(input.loginAccount, input.storeId, input.allowCrossStore, input.roleCode)
      if (input.allowCrossStore && !roleOf(input.roleCode).allowCrossStore) fail('INVALID_STATE', '当前角色字典未开放跨店，任职不能单独打开')
      const assignmentId = `staff-${crypto.randomUUID().slice(0, 8)}`
      const row = buildAssignment({
        assignmentId, storeId: input.storeId, linkedAccountId: input.linkedAccountId?.trim() || null,
        displayName: input.displayName.trim(), loginAccount: input.loginAccount.trim(),
        roleCode: input.roleCode, status: 'ACTIVE', invitationStatus: input.markCredentialSet ? 'ACTIVE' : 'PENDING',
        credentialSet: !!input.markCredentialSet, allowCrossStore: !!input.allowCrossStore, version: 1,
        effectiveAt: now(), leftAt: null,
      })
      assignments.set(assignmentId, row)
      const entry = pushAudit({
        requestId: input.idempotencyKey, action: 'create-assignment', targetId: assignmentId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before: '无', after: `${row.displayName}/${storeRoleLabels[row.roleCode]}/${row.storeName}/凭证${row.credentialSet ? '已设' : '未设'}`,
        beforeVersion: 0, afterVersion: 1,
      })
      return { detail: mockStaffDetail(assignmentId), operation: entry }
    }

    if (input.action === 'update-assignment') {
      const row = assignment(input.assignmentId)
      if (row.version !== input.version) fail('VERSION_CONFLICT', '任职资料已变化，请刷新后重试')
      if (row.status === 'LEFT') fail('INVALID_STATE', '已离职任职不可直接编辑，请复职或新建')
      if (!nameOk(input.displayName) || !loginOk(input.loginAccount)) fail('INVALID_INPUT', '姓名1—24字；登录账号4—32位字母数字_-')
      if (!storeRoles.includes(input.roleCode)) fail('INVALID_INPUT', '角色无效')
      if (input.allowCrossStore && !roleOf(input.roleCode).allowCrossStore) fail('INVALID_STATE', '当前角色字典未开放跨店，任职不能单独打开')
      assertCrossStore(input.loginAccount, row.storeId, input.allowCrossStore, input.roleCode, row.assignmentId)
      const before = `${row.displayName}/${row.loginAccount}/${storeRoleLabels[row.roleCode]}/跨店${row.allowCrossStore ? '开' : '关'}`
      row.displayName = input.displayName.trim()
      row.loginAccount = input.loginAccount.trim()
      row.roleCode = input.roleCode
      row.linkedAccountId = input.linkedAccountId?.trim() || null
      row.allowCrossStore = !!input.allowCrossStore
      row.version += 1
      refreshAssignment(row)
      const entry = pushAudit({
        requestId: input.idempotencyKey, action: 'update-assignment', targetId: row.assignmentId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: `${row.displayName}/${row.loginAccount}/${storeRoleLabels[row.roleCode]}/跨店${row.allowCrossStore ? '开' : '关'}`,
        beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStaffDetail(row.assignmentId), operation: entry }
    }

    if (input.action === 'set-status') {
      const row = assignment(input.assignmentId)
      if (row.version !== input.version) fail('VERSION_CONFLICT', '任职状态已变化，请刷新后重试')
      const next = input.status as StaffStatus
      if (!['ACTIVE', 'FROZEN', 'LEFT'].includes(next)) fail('INVALID_INPUT', '目标状态无效')
      if (row.status === next) fail('INVALID_STATE', '任职已是目标状态')
      if (row.status === 'LEFT' && next === 'FROZEN') fail('INVALID_STATE', '已离职任职只能复职为在职，不能直接冻结')
      if (next === 'ACTIVE' && row.status === 'LEFT') {
        assertCrossStore(row.loginAccount, row.storeId, row.allowCrossStore, row.roleCode, row.assignmentId)
      }
      const before = row.status
      row.status = next
      row.version += 1
      if (next === 'LEFT') {
        row.leftAt = now()
        row.invitationStatus = 'REVOKED'
      } else if (next === 'ACTIVE') {
        row.leftAt = null
        if (row.invitationStatus === 'REVOKED') row.invitationStatus = row.credentialSet ? 'ACTIVE' : 'PENDING'
      }
      const entry = pushAudit({
        requestId: input.idempotencyKey, action: 'set-status', targetId: row.assignmentId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: next, beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStaffDetail(row.assignmentId), operation: entry }
    }

    if (input.action === 'mark-credential-reset') {
      const row = assignment(input.assignmentId)
      if (row.version !== input.version) fail('VERSION_CONFLICT', '任职资料已变化，请刷新后重试')
      if (row.status === 'LEFT') fail('INVALID_STATE', '已离职任职不能标记重置凭证')
      if (!row.credentialSet) fail('INVALID_STATE', '当前尚未设置凭证，无需重置标记')
      const before = 'credentialSet=true'
      row.credentialSet = false
      row.invitationStatus = 'PENDING'
      row.version += 1
      const entry = pushAudit({
        requestId: input.idempotencyKey, action: 'mark-credential-reset', targetId: row.assignmentId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: 'credentialSet=false（密码不回显，正式改密走服务端/门店侧）',
        beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStaffDetail(row.assignmentId), operation: entry }
    }

    fail('INVALID_INPUT', '不支持的操作')
  })
}
