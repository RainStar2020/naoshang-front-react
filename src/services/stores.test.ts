import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { StoreMutation } from '../types/stores'

let service: typeof import('./stores')['storeService']
let auth: typeof import('./auth')['authService']
let staffService: typeof import('./staff')['staffService']
let token: string

const saveProfile = (extra: Partial<Extract<StoreMutation, { action: 'save-profile' }>> = {}): Extract<StoreMutation, { action: 'save-profile' }> => ({
  action: 'save-profile',
  storeId: 'shop-1',
  name: '脑商训练营梧桐街店（更新）',
  managerName: '李店长改',
  contact: '13800001999',
  address: '管城回族区梧桐街99号',
  regionNames: ['河南省', '郑州市', '管城回族区'],
  regionCodes: ['410000', '410100', '410104'],
  feeAmount: 420000,
  minimumFeeAmount: 69800,
  storefrontAssetId: 'asset-storefront-1',
  storefrontUrl: 'https://cdn.example.invalid/mock/storefront-wutong.jpg',
  agentId: 'agent-hn-1',
  version: 1,
  reason: '总部更正门店主档与合店费用',
  idempotencyKey: crypto.randomUUID(),
  ...extra,
})

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T10:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  service = (await import('./stores')).storeService
  auth = (await import('./auth')).authService
  staffService = (await import('./staff')).staffService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录返回归属代理与地区选项；列表种子与 users/staff 门店编号对齐', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.agents.map(row => row.agentId)).toEqual(['agent-hn-1', 'agent-ah-1'])
  expect(catalog.regionOptions.length).toBeGreaterThan(0)
  const list = await service.list(token, { page: 1, pageSize: 10 })
  expect(list.items.map(row => row.storeId).sort()).toEqual(['shop-1', 'shop-2', 'shop-3', 'shop-closed'].sort())
  expect(list.summary.stores).toBe(4)
  expect(list.items.find(row => row.storeId === 'shop-1')?.feeAmount).toBe(418800)
})

it('详情含主档、健脑官与任职摘要；密码不回显；费用为分', async () => {
  const detail = await service.detail(token, 'shop-1')
  expect(detail.store).toMatchObject({ storeId: 'shop-1', minimumFeeAmount: 69800, managerName: '李店长' })
  expect(detail.coaches.some(row => row.loginAccount === 'demo-coach')).toBe(true)
  expect(detail.staff.some(row => row.roleCode === 'STORE_MANAGER')).toBe(true)
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@/i)
  expect(detail.store.feeAmount % 1).toBe(0)
})

it('保存主档校验手机号、费用下限与门头照成对；成功后版本递增', async () => {
  await expect(service.mutate(token, saveProfile({ contact: '128', idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, saveProfile({ feeAmount: 100, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, saveProfile({ storefrontAssetId: 'a1', storefrontUrl: null, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const result = await service.mutate(token, saveProfile()) as { detail: { store: { name: string; feeAmount: number; version: number; contact: string } } }
  expect(result.detail.store).toMatchObject({ name: '脑商训练营梧桐街店（更新）', feeAmount: 420000, version: 2, contact: '13800001999' })
})

it('主档保存幂等与版本冲突；停业门店拒绝编辑', async () => {
  const req = saveProfile()
  const first = await service.mutate(token, req)
  expect(await service.mutate(token, req)).toEqual(first)
  await expect(service.mutate(token, { ...req, reason: '改原因' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  await expect(service.mutate(token, saveProfile())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, saveProfile({ storeId: 'shop-closed', version: 2, idempotencyKey: crypto.randomUUID() }))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('可冻结与复业门店；状态无变化拒绝', async () => {
  const frozen = await service.mutate(token, {
    action: 'set-status', storeId: 'shop-2', status: 'FROZEN', version: 1, reason: '异常经营先冻结', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { store: { status: string; version: number } } }
  expect(frozen.detail.store).toMatchObject({ status: 'FROZEN', version: 2 })
  await expect(service.mutate(token, {
    action: 'set-status', storeId: 'shop-2', status: 'FROZEN', version: 2, reason: '重复', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  const active = await service.mutate(token, {
    action: 'set-status', storeId: 'shop-2', status: 'ACTIVE', version: 2, reason: '核查通过复业', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { store: { status: string } } }
  expect(active.detail.store.status).toBe('ACTIVE')
})

it('健脑官冻结与凭证重置复用 staff Mock，并反映到门店详情', async () => {
  const beforeStaff = await staffService.detail(token, 'staff-2')
  expect(beforeStaff.assignment.credentialSet).toBe(true)
  const frozen = await service.mutate(token, {
    action: 'set-coach-status', storeId: 'shop-1', coachId: 'staff-2', status: 'FROZEN', version: 1,
    reason: '门店举报健脑官异常', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { coaches: { coachId: string; status: string }[] } }
  expect(frozen.detail.coaches.find(row => row.coachId === 'staff-2')?.status).toBe('FROZEN')
  expect((await staffService.detail(token, 'staff-2')).assignment.status).toBe('FROZEN')
  await service.mutate(token, {
    action: 'set-coach-status', storeId: 'shop-1', coachId: 'staff-2', status: 'ACTIVE', version: 2,
    reason: '核查后解冻', idempotencyKey: crypto.randomUUID(),
  })
  const reset = await service.mutate(token, {
    action: 'mark-coach-credential-reset', storeId: 'shop-1', coachId: 'staff-2', version: 3,
    reason: '门店申请重置健脑官登录凭证', idempotencyKey: crypto.randomUUID(),
  }) as { detail: { coaches: { coachId: string; credentialSet: boolean }[] } }
  expect(reset.detail.coaches.find(row => row.coachId === 'staff-2')?.credentialSet).toBe(false)
  expect(JSON.stringify(reset)).not.toMatch(/password/i)
  expect((await staffService.detail(token, 'staff-2')).assignment.credentialSet).toBe(false)
})

it('停业门店拒绝健脑官冻结与凭证重置', async () => {
  await expect(service.mutate(token, {
    action: 'set-coach-status', storeId: 'shop-closed', coachId: 'staff-2', status: 'FROZEN', version: 1,
    reason: '停业店不可监管', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await expect(service.mutate(token, {
    action: 'mark-coach-credential-reset', storeId: 'shop-closed', coachId: 'staff-2', version: 1,
    reason: '停业店不可重置', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })
})

it('不可跨店监管健脑官；不可把店长当健脑官监管', async () => {
  await expect(service.mutate(token, {
    action: 'set-coach-status', storeId: 'shop-2', coachId: 'staff-2', status: 'FROZEN', version: 1,
    reason: '跨店', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, {
    action: 'set-coach-status', storeId: 'shop-1', coachId: 'staff-1', status: 'FROZEN', version: 1,
    reason: '店长', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

it('只读账号可查询；无 manage 拒绝写；无模块权限拒绝', async () => {
  token = (await auth.login({ loginAccount: 'hq-stores-viewer', password: 'Demo@123456' })).token
  expect((await service.list(token, { page: 1, pageSize: 5 })).total).toBe(4)
  await expect(service.mutate(token, saveProfile())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  token = (await auth.login({ loginAccount: 'hq-stores-manager', password: 'Demo@123456' })).token
  await service.mutate(token, saveProfile())
  token = (await auth.login({ loginAccount: 'hq-staff-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('会话失效拒绝；快照隔离；非法分页与未知门店拒绝', async () => {
  const list = await service.list(token, { page: 1, pageSize: 5 })
  list.items[0].name = '篡改'
  expect((await service.list(token, { page: 1, pageSize: 5 })).items[0].name).not.toBe('篡改')
  await auth.logout()
  await expect(service.list(token, { page: 1, pageSize: 5 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
  await expect(service.list(token, { page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.detail(token, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

it('新增门店成功后出现在列表；缺名称拒绝；更换店主写 ownerAccountId', async () => {
  await expect(service.mutate(token, {
    action: 'create', name: '  ', version: 0, reason: '空名称', idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })

  const created = await service.mutate(token, {
    action: 'create',
    name: '总部联调新店',
    code: 'NO.HQ99',
    managerName: '联调店长',
    managerPhone: '13900001111',
    address: '联调路1号',
    ownerAccountId: 'account-1',
    version: 0,
    reason: '联调新增门店',
    idempotencyKey: crypto.randomUUID(),
  }) as { detail: { store: { storeId: string; name: string; ownerAccountId: string | null; version: number } } }
  expect(created.detail.store).toMatchObject({ name: '总部联调新店', ownerAccountId: 'account-1', version: 1 })
  const list = await service.list(token, { page: 1, pageSize: 20, keyword: '联调新店' })
  expect(list.items.some(row => row.storeId === created.detail.store.storeId)).toBe(true)

  const owned = await service.mutate(token, {
    action: 'change-owner',
    storeId: created.detail.store.storeId,
    ownerAccountId: 'account-2',
    version: created.detail.store.version,
    reason: '联调更换店主',
    idempotencyKey: crypto.randomUUID(),
  }) as { detail: { store: { ownerAccountId: string | null; version: number } } }
  expect(owned.detail.store).toMatchObject({ ownerAccountId: 'account-2', version: 2 })
})
