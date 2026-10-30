import { expect, it } from 'vitest'
import { mapPartnerCatalog, mapPartnerDetail, mapPartnerList, mapPartnerProfile } from './partners'

it('mapPartnerCatalog fills missing receipts/levels/audit arrays', () => {
  const catalog = mapPartnerCatalog({})
  expect(catalog.levels).toEqual([])
  expect(catalog.receipts).toEqual([])
  expect(catalog.audit).toEqual([])
})

it('mapPartnerCatalog maps alternate field names', () => {
  const catalog = mapPartnerCatalog({
    partnerLevels: [{ code: 'VIP', name: 'VIP合伙人', version: 2 }],
    recentReceipts: [{ id: 'r1', status: 'PROCESSING', source: 'HQ_MANUAL' }],
    operations: [{ id: 'op1', action: 'upgrade', reason: 'demo' }],
  })
  expect(catalog.levels[0]).toMatchObject({ partnerLevel: 'DEMO-VIP', title: 'VIP合伙人', version: 2 })
  expect(catalog.receipts[0]).toMatchObject({ receiptId: 'r1', status: 'PROCESSING', mockOnly: false })
  expect(catalog.audit[0]).toMatchObject({ operationId: 'op1', action: 'upgrade' })
})

it('mapPartnerProfile defaults allowedActions/targetLevels arrays', () => {
  const profile = mapPartnerProfile({ contextId: 'c1', accountId: 'a1', nickname: '张三' })
  expect(profile.allowedActions).toEqual([])
  expect(profile.allowedTargetLevels).toEqual([])
  expect(profile.task).toBeNull()
  expect(profile.superior).toBeNull()
})

it('mapPartnerList/detail keep arrays when payload sparse', () => {
  const list = mapPartnerList({ items: [{ contextId: 'c1', accountId: 'a1' }], total: 1 }, 1, 10)
  expect(list.items).toHaveLength(1)
  expect(list.summary.total).toBe(1)
  const detail = mapPartnerDetail({ contextId: 'c1', accountId: 'a1' })
  expect(detail.taskHistory).toEqual([])
  expect(detail.receipts).toEqual([])
  expect(detail.audit).toEqual([])
})
