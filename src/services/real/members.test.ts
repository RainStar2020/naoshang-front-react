import { describe, expect, it } from 'vitest'
import { mapMemberDetail, mapMemberOptions, mapMemberProfile } from './members'

describe('real members mapMemberOptions', () => {
  it('always supplies parents/grades/stores/tiers arrays for empty catalog', () => {
    const options = mapMemberOptions({})
    expect(options.parents).toEqual([])
    expect(options.grades).toEqual([])
    expect(options.stores).toEqual([])
    expect(options.tiers).toEqual([])
    expect(() => options.parents.map((item) => item.accountId)).not.toThrow()
    expect(() => options.grades.map((item) => item.code)).not.toThrow()
  })

  it('aliases accounts/users and membershipTiers into filter options', () => {
    const options = mapMemberOptions({
      accounts: [{ id: 'a-1', name: '家长甲', mobile: '13900001001' }],
      gradeList: [{ gradeCode: 'PRIMARY_1', gradeLabel: '一年级' }],
      shops: [{ shopId: 'shop-1', storeName: '梧桐街店', code: 'S1' }],
      membershipTiers: [{ tierId: 'tier-1', title: '一阶', levels: [{ courseId: 'c1', title: '课1' }] }],
    })
    expect(options.parents).toEqual([{ accountId: 'a-1', nickname: '家长甲', phone: '13900001001' }])
    expect(options.grades).toEqual([{ code: 'PRIMARY_1', label: '一年级' }])
    expect(options.stores[0]).toMatchObject({ storeId: 'shop-1', name: '梧桐街店', number: 'S1' })
    expect(options.tiers[0]).toMatchObject({ membershipTierId: 'tier-1', name: '一阶' })
    expect(options.tiers[0].levels[0]).toMatchObject({ levelId: 'c1', name: '课1' })
  })
})

describe('real members mapMemberProfile', () => {
  it('fills entitlements and string fields so list renders never crash', () => {
    const member = mapMemberProfile({
      id: 'm-1',
      userNo: 'XY00001',
      nickname: '林小雨',
      grade: 'PRIMARY_1',
      gender: 'F',
      mobile: 'ignore',
      parent: { accountId: 'a-1', nickname: '家长', phone: '13900001001' },
      version: 2,
    })
    expect(member.memberId).toBe('m-1')
    expect(member.displayId).toBe('XY00001')
    expect(member.name).toBe('林小雨')
    expect(member.gradeCode).toBe('PRIMARY_1')
    expect(member.genderCode).toBe('FEMALE')
    expect(member.genderLabel).toBe('女')
    expect(member.parentName).toBe('家长')
    expect(member.parentPhone).toBe('13900001001')
    expect(member.entitlements).toEqual([])
    expect(() => member.entitlements.some((g) => g.status === 'active')).not.toThrow()
    expect(() => member.name.slice(0, 1)).not.toThrow()
  })

  it('maps grants alias into entitlements', () => {
    const member = mapMemberProfile({
      memberId: 'm-2',
      grants: [{ id: 'g1', tierId: 'tier-2', status: 'active', source: 'activation-code', createdAt: '2026-10-01T00:00:00+08:00' }],
    })
    expect(member.entitlements).toHaveLength(1)
    expect(member.entitlements[0]).toMatchObject({
      grantId: 'g1',
      membershipTierId: 'tier-2',
      status: 'active',
      source: 'activation-code',
      expiresAt: null,
    })
  })
})

describe('real members mapMemberDetail', () => {
  it('always supplies levels/orders/feedback/audit arrays', () => {
    const detail = mapMemberDetail({ id: 'm-9', name: '测试' })
    expect(detail.member.memberId).toBe('m-9')
    expect(detail.levels).toEqual([])
    expect(detail.orders).toEqual([])
    expect(detail.feedback).toEqual([])
    expect(detail.audit).toEqual([])
    expect(() => detail.orders.length).not.toThrow()
    expect(() => detail.audit.length).not.toThrow()
  })
})
