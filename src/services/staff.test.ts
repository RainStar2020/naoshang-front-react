import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { StaffMutation, StoreCapability } from '../types/staff'

let service: typeof import('./staff')['staffService']
let auth: typeof import('./auth')['authService']
let token: string

const caps = (list: StoreCapability[]) => list
const saveRole = (extra: Partial<Extract<StaffMutation, { action: 'save-role' }>> = {}): Extract<StaffMutation, { action: 'save-role' }> => ({
  action: 'save-role', roleCode: 'COACH', title: '健脑官', summary: '更新后的健脑官说明，不含收益权限。',
  capabilities: caps(['store:profile:read', 'members:read', 'members:manage', 'feedback:read', 'feedback:write', 'orders:verify']),
  allowCrossStore: false, version: 1, reason: '调整健脑官能力说明', idempotencyKey: crypto.randomUUID(), ...extra,
})
const create = (extra: Partial<Extract<StaffMutation, { action: 'create-assignment' }>> = {}): Extract<StaffMutation, { action: 'create-assignment' }> => ({
  action: 'create-assignment', storeId: 'shop-2', displayName: '新健脑官', loginAccount: 'coach-new-01', roleCode: 'COACH',
  linkedAccountId: null, allowCrossStore: false, markCredentialSet: false, version: 0, reason: '总部录入新健脑官任职', idempotencyKey: crypto.randomUUID(), ...extra,
})
const setStatus = (extra: Partial<Extract<StaffMutation, { action: 'set-status' }>> = {}): Extract<StaffMutation, { action: 'set-status' }> => ({
  action: 'set-status', assignmentId: 'staff-2', status: 'FROZEN', version: 1, reason: '门店反馈异常，先冻结任职', idempotencyKey: crypto.randomUUID(), ...extra,
})

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-27T10:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  service = (await import('./staff')).staffService
  auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录返回三角色、能力字典与可用门店，且不含收益类能力', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.roles.map(row => row.roleCode)).toEqual(['STORE_OWNER', 'STORE_MANAGER', 'COACH'])
  expect(catalog.capabilityDictionary.every(row => !/revenue|settle|withdraw|income|commission/.test(row.code))).toBe(true)
  expect(catalog.stores.every(row => row.active)).toBe(true)
  expect(catalog.mockOnly).toBe(true)
})

it('列表完整结果统计不受分页影响，支持门店/角色/状态筛选', async () => {
  const a = await service.list(token, { page: 1, pageSize: 5 })
  const b = await service.list(token, { page: 2, pageSize: 5 })
  expect(a.summary).toEqual(b.summary)
  expect(a.summary).toMatchObject({ assignments: 7, active: 5, frozen: 1, left: 1 })
  const filtered = await service.list(token, { page: 1, pageSize: 10, storeId: 'shop-1', roleCode: 'COACH', status: 'ACTIVE' })
  expect(filtered.items.map(row => row.assignmentId)).toEqual(['staff-2'])
})

it('详情不回显密码，仅 credentialSet；生效能力来自角色字典', async () => {
  const detail = await service.detail(token, 'staff-2')
  expect(detail.assignment).toMatchObject({ loginAccount: 'demo-coach', credentialSet: true, roleCode: 'COACH' })
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
  expect(detail.assignment.effectiveCapabilities).toEqual(detail.role.capabilities)
})

it('保存角色可改标题能力与跨店默认，并同步任职生效能力', async () => {
  const before = await service.detail(token, 'staff-2')
  const result = await service.mutate(token, saveRole({
    title: '健脑官（更新）',
    capabilities: caps(['store:profile:read', 'members:read', 'feedback:read']),
    allowCrossStore: true,
  })) as { catalog: { roles: { roleCode: string; title: string; allowCrossStore: boolean; version: number; capabilities: string[] }[] } }
  const role = result.catalog.roles.find(row => row.roleCode === 'COACH')!
  expect(role).toMatchObject({ title: '健脑官（更新）', allowCrossStore: true, version: 2, capabilities: ['store:profile:read', 'members:read', 'feedback:read'] })
  const after = await service.detail(token, 'staff-2')
  expect(after.assignment.effectiveCapabilities).toEqual(['store:profile:read', 'members:read', 'feedback:read'])
  expect(after.assignment.version).toBe(before.assignment.version)
})

it('角色保存幂等、版本冲突与非法能力拒绝', async () => {
  const req = saveRole()
  const first = await service.mutate(token, req)
  expect(await service.mutate(token, req)).toEqual(first)
  await expect(service.mutate(token, { ...req, reason: '已改变' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  await expect(service.mutate(token, saveRole())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, saveRole({ version: 2, capabilities: ['revenue:read' as StoreCapability], idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('新建任职保留未设凭证；同登录账号跨店在角色未开放时拒绝', async () => {
  const created = await service.mutate(token, create()) as { detail: { assignment: { assignmentId: string; credentialSet: boolean; invitationStatus: string; version: number } } }
  expect(created.detail.assignment).toMatchObject({ credentialSet: false, invitationStatus: 'PENDING', version: 1 })
  await expect(service.mutate(token, create({ storeId: 'shop-1', loginAccount: 'demo-coach', idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(service.mutate(token, create({ allowCrossStore: true, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('开放角色跨店后，可给同登录账号在多门店任职', async () => {
  await service.mutate(token, saveRole({ allowCrossStore: true }))
  const first = await service.mutate(token, create({
    storeId: 'shop-1', loginAccount: 'coach-multi', allowCrossStore: true, displayName: '跨店一号', idempotencyKey: crypto.randomUUID(),
  })) as { detail: { assignment: { storeId: string; loginAccount: string } } }
  expect(first.detail.assignment).toMatchObject({ storeId: 'shop-1', loginAccount: 'coach-multi' })
  const second = await service.mutate(token, create({
    storeId: 'shop-2', loginAccount: 'coach-multi', allowCrossStore: true, displayName: '跨店二号', idempotencyKey: crypto.randomUUID(),
  })) as { detail: { assignment: { storeId: string; loginAccount: string; allowCrossStore: boolean } } }
  expect(second.detail.assignment).toMatchObject({ storeId: 'shop-2', loginAccount: 'coach-multi', allowCrossStore: true })
})

it('冻结保留任职记录；离职不删除并可复职；离职不可直接冻结', async () => {
  const frozen = await service.mutate(token, setStatus()) as { detail: { assignment: { status: string; version: number; leftAt: string | null } } }
  expect(frozen.detail.assignment).toMatchObject({ status: 'FROZEN', version: 2, leftAt: null })
  expect((await service.detail(token, 'staff-2')).assignment.assignmentId).toBe('staff-2')
  const left = await service.mutate(token, setStatus({ status: 'LEFT', version: 2, idempotencyKey: crypto.randomUUID() })) as { detail: { assignment: { status: string; invitationStatus: string; leftAt: string | null } } }
  expect(left.detail.assignment.status).toBe('LEFT')
  expect(left.detail.assignment.invitationStatus).toBe('REVOKED')
  expect(left.detail.assignment.leftAt).toBeTruthy()
  await expect(service.mutate(token, setStatus({ status: 'FROZEN', version: 3, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
  const restored = await service.mutate(token, setStatus({ status: 'ACTIVE', version: 3, idempotencyKey: crypto.randomUUID() })) as { detail: { assignment: { status: string; leftAt: string | null } } }
  expect(restored.detail.assignment).toMatchObject({ status: 'ACTIVE', leftAt: null })
})

it('凭证重置仅改 credentialSet，不返回密码；版本冲突需刷新', async () => {
  const result = await service.mutate(token, {
    action: 'mark-credential-reset', assignmentId: 'staff-2', version: 1, reason: '门店申请重置健脑官登录凭证', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { assignment: { credentialSet: boolean; invitationStatus: string; version: number } } }
  expect(result.detail.assignment).toMatchObject({ credentialSet: false, invitationStatus: 'PENDING', version: 2 })
  expect(JSON.stringify(result)).not.toMatch(/password/i)
  await expect(service.mutate(token, {
    action: 'mark-credential-reset', assignmentId: 'staff-2', version: 1, reason: '旧版本', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})

it('更新任职支持改角色与姓名；已离职拒绝编辑', async () => {
  const updated = await service.mutate(token, {
    action: 'update-assignment', assignmentId: 'staff-3', displayName: '赵健脑改名', loginAccount: 'coach-tongbai',
    roleCode: 'STORE_MANAGER', linkedAccountId: 'account-2', allowCrossStore: false, version: 1,
    reason: '升任店长并关联家长账号', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { assignment: { displayName: string; roleCode: string; linkedAccountId: string | null } } }
  expect(updated.detail.assignment).toMatchObject({ displayName: '赵健脑改名', roleCode: 'STORE_MANAGER', linkedAccountId: 'account-2' })
  await expect(service.mutate(token, {
    action: 'update-assignment', assignmentId: 'staff-6', displayName: '不可编辑', loginAccount: 'manager-left',
    roleCode: 'STORE_MANAGER', linkedAccountId: null, allowCrossStore: false, version: 2,
    reason: '尝试编辑离职', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('只读账号可查询；角色维护与任职管理分权；无模块权限拒绝', async () => {
  token = (await auth.login({ loginAccount: 'hq-staff-viewer', password: 'Demo@123456' })).token
  expect((await service.list(token, { page: 1, pageSize: 5 })).total).toBe(7)
  await expect(service.mutate(token, saveRole())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(service.mutate(token, create())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-staff-role-editor', password: 'Demo@123456' })).token
  await service.mutate(token, saveRole())
  await expect(service.mutate(token, create())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-staff-manager', password: 'Demo@123456' })).token
  await service.mutate(token, create())
  await expect(service.mutate(token, saveRole({ version: 2, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-costore-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('会话失效后拒绝；快照不可改写内存；非法分页与未知操作拒绝', async () => {
  const catalog = await service.catalog(token)
  const detail = await service.detail(token, 'staff-1')
  catalog.roles[0].title = '篡改'
  detail.assignment.status = 'LEFT'
  expect((await service.catalog(token)).roles[0].title).not.toBe('篡改')
  expect((await service.detail(token, 'staff-1')).assignment.status).toBe('ACTIVE')
  await auth.logout()
  await expect(service.list(token, { page: 1, pageSize: 5 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.list(token, { page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.detail(token, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(service.mutate(token, { ...setStatus(), action: 'other' as never })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
