import type { HqAccount } from '../../types/auth'
import {
  StoreError,
  type StoreAgentOption,
  type StoreAudit,
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
import { mockUserOptions } from './users'
import { mockStaffDetail, mockStaffList, mockStaffMutate } from './staff'

const fail = (code: ConstructorParameters<typeof StoreError>[0], message: string): never => {
  throw new StoreError(code, message)
}

const copy = <T,>(value: T): T => structuredClone(value)

const agents: StoreAgentOption[] = [
  { agentId: 'agent-hn-1', name: '河南区域代理（演示）', regionLabel: '河南省' },
  { agentId: 'agent-ah-1', name: '安徽区域代理（演示）', regionLabel: '安徽省' },
]

const seedMeta: Record<string, Omit<StoreProfile, 'coachActive' | 'coachFrozen' | 'staffTotal' | 'mockOnly' | 'agentName' | 'ownerCount' | 'ownerAccountId'> & { ownerCount: number; agentId: string | null; ownerAccountId: string | null }> = {
  'shop-1': {
    storeId: 'shop-1', number: 'NO.001', name: '脑商训练营梧桐街店', status: 'ACTIVE',
    managerName: '李店长', contact: '13800001001', address: '管城回族区梧桐街88号',
    regionNames: ['河南省', '郑州市', '管城回族区'], regionCodes: ['410000', '410100', '410104'],
    feeAmount: 418800, minimumFeeAmount: 69800, storefrontAssetId: 'asset-storefront-1',
    storefrontUrl: 'https://cdn.example.invalid/mock/storefront-wutong.jpg',
    agentId: 'agent-hn-1', ownerCount: 8, version: 1, openedAt: '2025-11-20T04:00:00.000Z',
    ownerAccountId: null,
  },
  'shop-2': {
    storeId: 'shop-2', number: 'NO.002', name: '脑商训练营桐柏路店', status: 'ACTIVE',
    managerName: '周店长', contact: '13800001002', address: '中原区桐柏路66号',
    regionNames: ['河南省', '郑州市', '中原区'], regionCodes: ['410000', '410100', '410102'],
    feeAmount: 298000, minimumFeeAmount: 69800, storefrontAssetId: 'asset-storefront-2',
    storefrontUrl: 'https://cdn.example.invalid/mock/storefront-tongbai.jpg',
    agentId: 'agent-hn-1', ownerCount: 3, version: 1, openedAt: '2026-01-15T02:00:00.000Z',
    ownerAccountId: null,
  },
  'shop-3': {
    storeId: 'shop-3', number: 'NO.003', name: '脑商训练营合肥店', status: 'ACTIVE',
    managerName: '赵教练', contact: '13800001003', address: '蜀山区潜山路128号',
    regionNames: ['安徽省', '合肥市', '蜀山区'], regionCodes: ['340000', '340100', '340104'],
    feeAmount: 198000, minimumFeeAmount: 69800, storefrontAssetId: null, storefrontUrl: null,
    agentId: 'agent-ah-1', ownerCount: 2, version: 1, openedAt: '2026-03-01T08:00:00.000Z',
    ownerAccountId: null,
  },
  'shop-closed': {
    storeId: 'shop-closed', number: 'NO.004', name: '脑商训练营旧门店（已停业）', status: 'CLOSED',
    managerName: '停业店长', contact: '13800001004', address: '管城回族区旧址1号',
    regionNames: ['河南省', '郑州市', '管城回族区'], regionCodes: ['410000', '410100', '410104'],
    feeAmount: 0, minimumFeeAmount: 69800, storefrontAssetId: null, storefrontUrl: null,
    agentId: null, ownerCount: 0, version: 2, openedAt: '2024-05-01T01:00:00.000Z',
    ownerAccountId: null,
  },
}

const profiles = new Map<string, typeof seedMeta[string]>()
for (const base of mockUserOptions().stores) {
  const meta = seedMeta[base.storeId] ?? {
    storeId: base.storeId, number: base.number, name: base.name, status: (base.active ? 'ACTIVE' : 'CLOSED') as StoreStatus,
    managerName: '待完善', contact: '13800000000', address: '待完善地址',
    regionNames: ['河南省', '郑州市', '管城回族区'] as [string, string, string],
    regionCodes: ['410000', '410100', '410104'] as [string, string, string],
    feeAmount: 69800, minimumFeeAmount: 69800, storefrontAssetId: null, storefrontUrl: null,
    agentId: null, ownerAccountId: null, ownerCount: 0, version: 1, openedAt: '2026-01-01T00:00:00.000Z',
  }
  profiles.set(base.storeId, { ...meta, name: base.name, number: base.number })
}

const audit: StoreAudit[] = []
const operations = new Map<string, { payload: string; result: unknown }>()

function agentNameOf(agentId: string | null) {
  if (!agentId) return null
  return agents.find(item => item.agentId === agentId)?.name ?? null
}

function staffForStore(storeId: string): StoreStaffBrief[] {
  try {
    return mockStaffList({ page: 1, pageSize: 20, storeId }).items.map(item => ({
      assignmentId: item.assignmentId,
      displayName: item.displayName,
      loginAccount: item.loginAccount,
      roleCode: item.roleCode,
      roleTitle: item.roleTitle,
      status: item.status,
      credentialSet: item.credentialSet,
      version: item.version,
    }))
  } catch {
    // HQ 新建门店尚未进入员工种子目录时，任职摘要为空
    return []
  }
}

function coachesForStore(storeId: string): StoreCoach[] {
  try {
    return mockStaffList({ page: 1, pageSize: 20, storeId, roleCode: 'COACH' }).items.map(item => ({
      coachId: item.assignmentId,
      storeId: item.storeId,
      displayName: item.displayName,
      loginAccount: item.loginAccount,
      status: item.status,
      invitationStatus: item.invitationStatus,
      credentialSet: item.credentialSet,
      version: item.version,
      effectiveAt: item.effectiveAt,
      leftAt: item.leftAt,
    }))
  } catch {
    return []
  }
}

function view(storeId: string): StoreProfile {
  const row = profiles.get(storeId) ?? fail('NOT_FOUND', '门店不存在')
  const staff = staffForStore(storeId)
  const coaches = coachesForStore(storeId)
  return copy({
    ...row,
    agentName: agentNameOf(row.agentId),
    coachActive: coaches.filter(item => item.status === 'ACTIVE').length,
    coachFrozen: coaches.filter(item => item.status === 'FROZEN').length,
    staffTotal: staff.length,
    mockOnly: true as const,
  })
}

function ensureReason(reason: string, key: string) {
  const text = reason.trim()
  if (!text || Array.from(text).length > 200) fail('INVALID_INPUT', '请填写1—200字操作原因')
  if (!key.trim()) fail('INVALID_INPUT', '缺少幂等请求号')
}

function ensureProfile(input: Extract<StoreMutation, { action: 'save-profile' }>) {
  const name = input.name.trim()
  const managerName = input.managerName.trim()
  const address = input.address.trim()
  const contact = input.contact.trim()
  if (!name || Array.from(name).length > 60) fail('INVALID_INPUT', '请填写1—60字门店名称')
  if (!managerName || Array.from(managerName).length > 30) fail('INVALID_INPUT', '请填写1—30字负责人姓名')
  if (!/^1\d{10}$/.test(contact)) fail('INVALID_INPUT', '请填写正确联系手机号')
  if (!address || Array.from(address).length > 200) fail('INVALID_INPUT', '请填写1—200字门店地址')
  if (!Array.isArray(input.regionNames) || input.regionNames.length !== 3 || !Array.isArray(input.regionCodes) || input.regionCodes.length !== 3) {
    fail('INVALID_INPUT', '请选择完整省市区')
  }
  if (!Number.isInteger(input.feeAmount) || input.feeAmount < 0) fail('INVALID_INPUT', '合店费用须为非负整数（分）')
  if (!Number.isInteger(input.minimumFeeAmount) || input.minimumFeeAmount < 0) fail('INVALID_INPUT', '费用下限须为非负整数（分）')
  if (input.feeAmount < input.minimumFeeAmount) fail('INVALID_INPUT', '合店费用不能低于费用下限边界')
  if (input.agentId && !agents.some(item => item.agentId === input.agentId)) fail('INVALID_INPUT', '归属代理无效')
  if (input.storefrontAssetId && !input.storefrontUrl) fail('INVALID_INPUT', '已选门头照资源时须提供可访问地址（Mock URL）')
  if (!input.storefrontAssetId && input.storefrontUrl) fail('INVALID_INPUT', '门头照地址须与资源编号同时提供或同时清空')
}

function pushAudit(entry: Omit<StoreAudit, 'operationId' | 'occurredAt'>): StoreAudit {
  const row: StoreAudit = { ...entry, operationId: `store-op-${audit.length + 1}`, occurredAt: new Date().toISOString() }
  audit.unshift(row)
  return row
}

function idempotent<T>(operatorId: string, key: string, input: StoreMutation, run: () => T): T {
  const payload = JSON.stringify(input)
  const hit = operations.get(`${operatorId}:${key}`)
  if (hit) {
    if (hit.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '相同请求号参数不一致，请更换请求号')
    return copy(hit.result) as T
  }
  const result = run()
  operations.set(`${operatorId}:${key}`, { payload, result: copy(result) })
  return result
}

export function mockStoreCatalog(): StoreCatalog {
  return copy({
    agents,
    regionOptions: mockUserOptions().regions,
    audit: [...audit],
    mockOnly: true,
  })
}

export function mockStoreList(query: StoreQuery): StoreList {
  if (!Number.isInteger(query.page) || query.page < 1 || ![5, 10, 20].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const all = [...profiles.keys()].map(view)
  const filtered = all.filter(row =>
    (!keyword || [row.storeId, row.number, row.name, row.managerName, row.contact, row.address, row.agentName ?? ''].some(text => text.toLowerCase().includes(keyword)))
    && (!query.status || row.status === query.status)
    && (!query.agentId || row.agentId === query.agentId),
  )
  const start = (query.page - 1) * query.pageSize
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      stores: filtered.length,
      active: filtered.filter(row => row.status === 'ACTIVE').length,
      frozen: filtered.filter(row => row.status === 'FROZEN').length,
      closed: filtered.filter(row => row.status === 'CLOSED').length,
      coachesActive: filtered.reduce((sum, row) => sum + row.coachActive, 0),
    },
  }
}

export function mockStoreDetail(storeId: string): StoreDetail {
  const store = view(storeId)
  return copy({
    store,
    coaches: coachesForStore(storeId),
    staff: staffForStore(storeId),
    audit: audit.filter(item => item.targetId === storeId || item.targetId.startsWith(`${storeId}:`)),
  })
}

export function mockStoreMutate(input: StoreMutation, operator: HqAccount) {
  ensureReason(input.reason, input.idempotencyKey)
  return idempotent(operator.accountId, input.idempotencyKey, input, () => {
    if (input.action === 'save-profile') {
      ensureProfile(input)
      const row = profiles.get(input.storeId) ?? fail('NOT_FOUND', '门店不存在')
      if (row.version !== input.version) fail('VERSION_CONFLICT', '门店资料已更新，请刷新后重试')
      if (row.status === 'CLOSED') fail('INVALID_STATE', '已停业门店不可编辑主档，请先复业')
      const before = `${row.name}/${row.feeAmount}分/V${row.version}`
      row.name = input.name.trim()
      row.managerName = input.managerName.trim()
      row.contact = input.contact.trim()
      row.address = input.address.trim()
      row.regionNames = [...input.regionNames] as [string, string, string]
      row.regionCodes = [...input.regionCodes] as [string, string, string]
      row.feeAmount = input.feeAmount
      row.minimumFeeAmount = input.minimumFeeAmount
      row.storefrontAssetId = input.storefrontAssetId
      row.storefrontUrl = input.storefrontUrl
      row.agentId = input.agentId
      row.version += 1
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: row.storeId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: `${row.name}/${row.feeAmount}分/V${row.version}`, beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStoreDetail(row.storeId) }
    }

    if (input.action === 'set-status') {
      const row = profiles.get(input.storeId) ?? fail('NOT_FOUND', '门店不存在')
      if (row.version !== input.version) fail('VERSION_CONFLICT', '门店资料已更新，请刷新后重试')
      if (row.status === input.status) fail('INVALID_STATE', '门店已是目标状态')
      const before = row.status
      row.status = input.status
      row.version += 1
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: row.storeId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: row.status, beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStoreDetail(row.storeId) }
    }

    if (input.action === 'set-coach-status') {
      const row = profiles.get(input.storeId) ?? fail('NOT_FOUND', '门店不存在')
      if (row.status === 'CLOSED') fail('INVALID_STATE', '已停业门店不可监管健脑官状态')
      const before = mockStaffDetail(input.coachId)
      if (before.assignment.storeId !== input.storeId || before.assignment.roleCode !== 'COACH') fail('INVALID_INPUT', '只能监管本店健脑官任职')
      if (before.assignment.version !== input.version) fail('VERSION_CONFLICT', '健脑官资料已更新，请刷新后重试')
      mockStaffMutate({
        action: 'set-status', assignmentId: input.coachId, status: input.status, version: input.version,
        reason: input.reason, idempotencyKey: `${input.idempotencyKey}:staff`,
      }, operator)
      const after = mockStaffDetail(input.coachId)
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: `${input.storeId}:${input.coachId}`,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before: before.assignment.status, after: after.assignment.status,
        beforeVersion: input.version, afterVersion: after.assignment.version,
      })
      return { detail: mockStoreDetail(input.storeId) }
    }

    if (input.action === 'mark-coach-credential-reset') {
      const row = profiles.get(input.storeId) ?? fail('NOT_FOUND', '门店不存在')
      if (row.status === 'CLOSED') fail('INVALID_STATE', '已停业门店不可重置健脑官凭证标记')
      const before = mockStaffDetail(input.coachId)
      if (before.assignment.storeId !== input.storeId || before.assignment.roleCode !== 'COACH') fail('INVALID_INPUT', '只能监管本店健脑官任职')
      if (before.assignment.version !== input.version) fail('VERSION_CONFLICT', '健脑官资料已更新，请刷新后重试')
      if (!before.assignment.credentialSet) fail('INVALID_STATE', '健脑官尚未设置凭证')
      if (before.assignment.status === 'LEFT') fail('INVALID_STATE', '已离职健脑官请到员工模块复职后再处理凭证')
      mockStaffMutate({
        action: 'mark-credential-reset', assignmentId: input.coachId, version: input.version,
        reason: input.reason, idempotencyKey: `${input.idempotencyKey}:staff`,
      }, operator)
      const after = mockStaffDetail(input.coachId)
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: `${input.storeId}:${input.coachId}`,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before: 'credentialSet=true', after: 'credentialSet=false',
        beforeVersion: input.version, afterVersion: after.assignment.version,
      })
      return { detail: mockStoreDetail(input.storeId) }
    }


    if (input.action === 'create') {
      const name = input.name.trim()
      if (!name || Array.from(name).length > 60) fail('INVALID_INPUT', '请填写1—60字门店名称')
      const storeId = (input.storeId?.trim() || `shop-hq-${profiles.size + 1}`)
      if (profiles.has(storeId)) fail('INVALID_INPUT', '门店 ID 已存在')
      const phone = (input.managerPhone ?? '').trim()
      if (phone && !/^1\d{10}$/.test(phone)) fail('INVALID_INPUT', '请填写正确联系手机号')
      const code = (input.code ?? '').trim() || `NO.HQ${String(profiles.size + 1).padStart(3, '0')}`
      const managerName = (input.managerName ?? '').trim() || '待完善'
      const address = (input.address ?? '').trim() || '待完善地址'
      const ownerAccountId = (input.ownerAccountId ?? '').trim() || null
      profiles.set(storeId, {
        storeId, number: code, name, status: 'ACTIVE',
        managerName, contact: phone || '13800000000', address,
        regionNames: ['河南省', '郑州市', '管城回族区'],
        regionCodes: ['410000', '410100', '410104'],
        feeAmount: 69800, minimumFeeAmount: 69800,
        storefrontAssetId: null, storefrontUrl: null,
        agentId: null, ownerAccountId, ownerCount: ownerAccountId ? 1 : 0,
        version: 1, openedAt: new Date().toISOString(),
      })
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: storeId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before: '', after: `${name}/V1`, beforeVersion: 0, afterVersion: 1,
      })
      return { detail: mockStoreDetail(storeId) }
    }

    if (input.action === 'change-owner') {
      const row = profiles.get(input.storeId) ?? fail('NOT_FOUND', '门店不存在')
      if (row.version !== input.version) fail('VERSION_CONFLICT', '门店资料已更新，请刷新后重试')
      if (row.status === 'CLOSED') fail('INVALID_STATE', '已停业门店不可更换店主')
      const ownerAccountId = input.ownerAccountId.trim()
      if (!ownerAccountId) fail('INVALID_INPUT', '请填写店主账号 ID')
      const before = row.ownerAccountId ?? ''
      row.ownerAccountId = ownerAccountId
      row.ownerCount = Math.max(1, row.ownerCount || 1)
      row.version += 1
      pushAudit({
        requestId: input.idempotencyKey, action: input.action, targetId: row.storeId,
        operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(),
        before, after: ownerAccountId, beforeVersion: input.version, afterVersion: row.version,
      })
      return { detail: mockStoreDetail(row.storeId) }
    }

    fail('INVALID_INPUT', '未知操作')
  })
}
