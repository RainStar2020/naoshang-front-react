import { describe, expect, it } from 'vitest'
import { mapActivationAudit, mapActivationBatch, mapActivationCode, mapActivationDetail, mapActivationOptions } from './activationCodes'

describe('real activationCodes mapActivationOptions', () => {
  it('always supplies targets/accounts/members/stores arrays for empty catalog', () => {
    const options = mapActivationOptions({})
    expect(options.targets).toEqual([])
    expect(options.accounts).toEqual([])
    expect(options.members).toEqual([])
    expect(options.stores).toEqual([])
    expect(options.maxBatchSize).toBe(100)
    expect(options.maxSelectionSize).toBe(100)
    expect(() => options.targets.map((item) => item.targetId)).not.toThrow()
    expect(() => options.stores.map((item) => item.storeId)).not.toThrow()
  })

  it('aliases tiers/columns/users/shops into filter options', () => {
    const options = mapActivationOptions({
      tiers: [{ tierId: 'tier-1', title: '一阶菁英会员', type: 'membership-tier' }],
      columns: [{ columnId: 'col-1', title: '记忆基础' }],
      users: [{ id: 'a-1', nickname: '家长甲', mobile: '13900001001' }],
      students: [{ id: 'm-1', accountId: 'a-1', nickname: '林小雨', userNo: 'XY1' }],
      shops: [{ shopId: 'shop-1', storeName: '梧桐街店', code: 'S1' }],
      batchLimit: 50,
      selectionLimit: 20,
    })
    expect(options.targets).toEqual([
      { codeType: 'membership-tier', targetId: 'tier-1', name: '一阶菁英会员', demoOnly: false },
      { codeType: 'column', targetId: 'col-1', name: '记忆基础', demoOnly: false },
    ])
    expect(options.accounts[0]).toMatchObject({ accountId: 'a-1', name: '家长甲', phone: '13900001001' })
    expect(options.members[0]).toMatchObject({ memberId: 'm-1', accountId: 'a-1', name: '林小雨', displayId: 'XY1' })
    expect(options.stores[0]).toMatchObject({ storeId: 'shop-1', name: '梧桐街店', number: 'S1' })
    expect(options.maxBatchSize).toBe(50)
    expect(options.maxSelectionSize).toBe(20)
  })
})

describe('real activationCodes mappers', () => {
  it('fills code/batch/audit arrays so list and tabs never crash', () => {
    const code = mapActivationCode({ id: 'c-1', status: 'ISSUED' })
    expect(code.codeId).toBe('c-1')
    expect(code.status).toBe('issued')
    expect(code.version).toBe(1)
    expect(code.maskedCode).toBe('')

    const batch = mapActivationBatch({ id: 'b-1', batchName: '演示批次', count: 4 })
    expect(batch).toMatchObject({ batchId: 'b-1', name: '演示批次', quantity: 4 })

    const audit = mapActivationAudit({ id: 'op-1', codes: [{ codeId: 'c-1' }, 'c-2'] })
    expect(audit.codeIds).toEqual(['c-1', 'c-2'])
    expect(() => audit.codeIds.length).not.toThrow()

    const detail = mapActivationDetail({ id: 'c-9', batchId: 'b-9' })
    expect(detail.code.codeId).toBe('c-9')
    expect(detail.batch.batchId).toBe('b-9')
    expect(detail.audit).toEqual([])
  })
})