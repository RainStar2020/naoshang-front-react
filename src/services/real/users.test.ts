import { describe, expect, it } from 'vitest'
import { mapAccount } from './users'

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

  it('never leaves join/length-sensitive fields undefined even for empty payloads', () => {
    const account = mapAccount(null)
    expect(account.regionNames).toEqual([])
    expect(account.businessContexts).toEqual([])
    expect(typeof account.nickname).toBe('string')
    expect(typeof account.phone).toBe('string')
    expect(() => account.regionNames.join(' / ')).not.toThrow()
    expect(() => account.businessContexts.length).not.toThrow()
    expect(() => account.nickname.slice(0, 1)).not.toThrow()
  })
})
