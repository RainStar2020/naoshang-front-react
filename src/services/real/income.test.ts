import { describe, expect, it } from 'vitest'
import { mapIncomeEntry } from './income'

describe('收益台账 API 映射', () => {
  it('读取新版嵌套归属字段，并把元转换为页面金额分', () => {
    const entry = mapIncomeEntry({
      ledgerId: 'ccs_001', identity: 'costore', identityLabel: '合店', amount: 1280,
      bizType: 'costore', orderId: null, status: 'settled', version: 1,
      occurredAt: '2026-10-30T10:00:00.000Z',
      ownerUser: { accountId: 'cs_owner_01', name: '合店老板', phone: '13800000031' },
      store: { id: 'CS.001', name: '深圳南山旗舰店', code: 'CS.001' },
      region: null,
    })
    expect(entry).toMatchObject({
      entryId: 'ccs_001', accountId: 'cs_owner_01', accountName: '合店老板', phone: '13800000031',
      storeId: 'CS.001', storeName: '深圳南山旗舰店', category: 'costore', amount: 128000,
      settlementStatus: 'SETTLED', createdAt: '2026-10-30T10:00:00.000Z',
    })
  })
})
