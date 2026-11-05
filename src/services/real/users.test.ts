import { describe, expect, it } from 'vitest'
import { displayValue, mapAccount, mapAuditEntry, mapTierOptions, mapUserStoreBinding } from './users'

describe('real users mapAccount', () => {
  it('fills missing regionNames/businessContexts and aliases mobile to phone', () => {
    const account = mapAccount({
      id: 'u-1',
      userNo: 'VIP0001',
      name: '测试用户',
      mobile: '13900001001',
      status: 'ACTIVE',
      storeId: 'shop-1',
      storeName: '梧桐街店',
      version: 3,
      createdAt: '2026-10-29T00:00:00+08:00',
    })
    expect(account).toMatchObject({
      accountId: 'u-1',
      displayId: 'VIP0001',
      nickname: '测试用户',
      phone: '13900001001',
      frozen: false,
      storeId: 'shop-1',
      storeName: '梧桐街店',
      version: 3,
    })
    expect(account.regionNames).toEqual([])
    expect(account.regionCodes).toEqual([])
    expect(account.businessContexts).toEqual([])
    expect(account.tier).toBeNull()
    expect(account.tierLabel).toBeNull()
    expect(account.passwordResetAt).toBeNull()
    expect(account.nickname.slice(0, 1)).toBe('测')
  })

  it('reads nested profile regions/identities and province-city-district names', () => {
    const account = mapAccount({
      accountId: 'u-2',
      profile: {
        nickname: '嵌套资料',
        phone: '13800000002',
        provinceName: '河南省',
        cityName: '郑州市',
        districtName: '中原区',
        provinceCode: '410000',
        cityCode: '410100',
        districtCode: '410102',
        identities: [
          { id: 'partner:u-2', module: 'partner', label: 'VIP 合伙人' },
          '区代',
        ],
      },
      frozen: true,
    })
    expect(account.phone).toBe('13800000002')
    expect(account.nickname).toBe('嵌套资料')
    expect(account.frozen).toBe(true)
    expect(account.regionNames).toEqual(['河南省', '郑州市', '中原区'])
    expect(account.regionCodes).toEqual(['410000', '410100', '410102'])
    expect(account.businessContexts.map((item) => item.label)).toEqual(['VIP 合伙人', '区代'])
    expect(account.businessContexts[1].module).toBe('agency')
  })

  it('maps tierLabel (and tier) for 业务身份 column', () => {
    const account = mapAccount({
      accountId: 'cs_mgr_02',
      nickname: '仓店店长-赵强',
      phone: '138****0032',
      tier: 'vip',
      tierLabel: 'VIP合伙人',
      status: 'ACTIVE',
    })
    expect(account.tier).toBe('vip')
    expect(account.tierLabel).toBe('VIP合伙人')
  })

  it('reads tierLabel from nested profile when top-level absent', () => {
    const account = mapAccount({
      accountId: 'u-3',
      profile: { nickname: '嵌套档位', tier: 'svip', tierLabel: 'SVIP合伙人' },
    })
    expect(account.tier).toBe('svip')
    expect(account.tierLabel).toBe('SVIP合伙人')
  })

    it('never leaves join/length-sensitive fields undefined even for empty payloads', () => {
    const account = mapAccount(null)
    expect(account.regionNames).toEqual([])
    expect(account.businessContexts).toEqual([])
    expect(account.tier).toBeNull()
    expect(account.tierLabel).toBeNull()
    expect(typeof account.nickname).toBe('string')
    expect(typeof account.phone).toBe('string')
    expect(() => account.regionNames.join(' / ')).not.toThrow()
    expect(() => account.businessContexts.length).not.toThrow()
    expect(() => account.nickname.slice(0, 1)).not.toThrow()
  })
})

describe('real users mapTierOptions', () => {
  it('reads tier/tierLabel pairs from catalog tiers', () => {
    expect(mapTierOptions({
      tiers: [
        { tier: 'vip', tierLabel: 'VIP合伙人' },
        { value: 'parent', label: '家长' },
        'svip',
      ],
    })).toEqual([
      { value: 'vip', label: 'VIP合伙人' },
      { value: 'parent', label: '家长' },
      { value: 'svip', label: 'svip' },
    ])
  })

  it('dedupes and falls back across alias arrays', () => {
    expect(mapTierOptions({
      partnerLevels: [{ partnerLevel: 'vip', title: 'VIP' }, { code: 'vip', name: '重复' }],
      levels: [],
    })).toEqual([{ value: 'vip', label: 'VIP' }])
  })
})


describe('real users displayValue / mapAuditEntry', () => {
  it('flattens {frozen, note} objects so React tables can render them', () => {
    expect(displayValue({ frozen: true, note: '风控复核' })).toBe('冻结；备注：风控复核')
    expect(displayValue({ frozen: false, note: '' })).toBe('正常')
    expect(displayValue('已解冻')).toBe('已解冻')
    expect(displayValue(null)).toBe('—')
  })

  it('maps audit rows with object before/after and fills missing operationId', () => {
    const entry = mapAuditEntry({
      action: 'unfreeze',
      before: { frozen: true, note: '旧备注' },
      after: { frozen: false, note: '已解冻' },
      reason: { frozen: false, note: '客服核实' },
      operatorName: '总部管理员',
      occurredAt: '2026-11-03T10:00:00+08:00',
    }, 2, 'acc-9')
    expect(entry.operationId).toBe('audit-acc-9-2')
    expect(entry.action).toBe('freeze')
    expect(entry.before).toContain('冻结')
    expect(entry.after).toContain('正常')
    expect(entry.reason).toContain('客服核实')
    expect(entry.operatorName).toBe('总部管理员')
  })

  it('keeps string audit fields and prefers explicit operationId', () => {
    const entry = mapAuditEntry({
      operationId: 'op-1',
      requestId: 'req-1',
      accountId: 'acc-1',
      action: 'update-note',
      before: '无备注',
      after: '总部备注',
      reason: '补充说明',
      operatorId: 'admin',
      operatorName: 'Admin',
      occurredAt: '2026-11-03T12:00:00+08:00',
    })
    expect(entry).toMatchObject({
      operationId: 'op-1',
      requestId: 'req-1',
      before: '无备注',
      after: '总部备注',
      reason: '补充说明',
      action: 'freeze',
    })
  })
})

describe('mapUserStoreBinding', () => {
  it('maps profile/binding/stores including HQ', () => {
    const view = mapUserStoreBinding('p2', {
      profile: { id: 'p2', name: '私董-乙', storeBinding: {} },
      binding: { bound: true, storeId: 'ra_221', storeName: '脑商智慧门店（杭州滨江）' },
      stores: [
        { id: 'ra_221', storeNo: '331002-S1', name: '脑商智慧门店（杭州滨江）' },
        { id: 'HQ', storeNo: 'HQ', name: '总部服务' },
      ],
    })
    expect(view.accountId).toBe('p2')
    expect(view.profileName).toBe('私董-乙')
    expect(view.binding).toMatchObject({ bound: true, storeId: 'ra_221', storeName: '脑商智慧门店（杭州滨江）' })
    expect(view.stores).toEqual([
      expect.objectContaining({ storeId: 'ra_221', storeNo: '331002-S1' }),
      expect.objectContaining({ storeId: 'HQ', isHeadquarters: true, name: '总部服务' }),
    ])
  })

  it('treats unbound binding safely', () => {
    const view = mapUserStoreBinding('p4', {
      binding: { bound: false, storeId: null, storeName: null },
      stores: [{ id: 'HQ', storeNo: 'HQ', name: '总部服务', isHeadquarters: true }],
    })
    expect(view.binding).toMatchObject({ bound: false, storeId: null, storeName: null })
  })
})
