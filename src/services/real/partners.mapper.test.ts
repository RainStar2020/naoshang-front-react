import { expect, it } from 'vitest'
import { mapPartnerCatalog, mapPartnerDetail, mapPartnerList, mapPartnerProfile, mapPartnerPromotionTask } from './partners'

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

it('mapPartnerProfile maps superior phone when present', () => {
  const profile = mapPartnerProfile({
    contextId: 'partner:p2',
    accountId: 'p2',
    displayId: 'SD0002',
    name: '私董-乙',
    phone: '13800000002',
    superior: { accountId: 'p1', contextId: 'partner:p1', name: '总部联创-甲', phone: '13900000001' },
  })
  expect(profile.displayId).toBe('SD0002')
  expect(profile.phone).toBe('13800000002')
  expect(profile.superior).toMatchObject({ accountId: 'p1', name: '总部联创-甲', phone: '13900000001' })
})

it('mapPartnerProfile omits inventing superior phone', () => {
  const profile = mapPartnerProfile({
    contextId: 'partner:p2',
    accountId: 'p2',
    superior: { accountId: 'p1', name: '总部联创-甲' },
  })
  expect(profile.superior).toMatchObject({ accountId: 'p1', name: '总部联创-甲', phone: null })
})

it('mapPartnerDetail unwraps data.partner identity fields', () => {
  const detail = mapPartnerDetail({
    partner: {
      accountId: 'acc-1001',
      displayId: 'NS1001',
      name: '张三',
      phone: '13800138000',
      partnerLevel: 'DEMO-ANGEL',
      partnerStatus: 'ACTIVE',
      frozen: false,
      version: 3,
      superior: { accountId: 'acc-9', contextId: 'partner:acc-9', name: '李四', phone: '13900139000' },
      task: null,
    },
    receipts: [{ id: 'rcpt-1', status: 'SUCCEEDED', source: 'HQ_MANUAL' }],
    audit: [],
  }, 'partner:acc-1001')
  expect(detail.profile).toMatchObject({
    contextId: 'partner:acc-1001',
    accountId: 'acc-1001',
    displayId: 'NS1001',
    name: '张三',
    phone: '13800138000',
    partnerLevel: 'DEMO-ANGEL',
  })
  expect(detail.profile.superior).toMatchObject({ name: '李四', phone: '13900139000' })
  expect(detail.receipts[0]).toMatchObject({ receiptId: 'rcpt-1', status: 'SUCCEEDED' })
})

it('mapPartnerDetail still accepts flat profile payload', () => {
  const detail = mapPartnerDetail({ contextId: 'c1', accountId: 'a1', displayId: 'D1', name: '王五', phone: '13700000000' })
  expect(detail.profile).toMatchObject({ contextId: 'c1', accountId: 'a1', displayId: 'D1', name: '王五', phone: '13700000000' })
})

it('mapPartnerPromotionTask keeps HQ list task fields', () => {
  const task = mapPartnerPromotionTask({
    enabled: true,
    taskId: 'pt_45',
    status: 'ONGOING',
    statusLabel: '进行中',
    achieved: false,
    items: [
      { key: 'private', label: '直推私董', required: 3, current: 2, reached: false, progressText: '2/3', percent: 66.7 },
      { key: 'vip', label: '直推VIP', required: 18, current: 2, reached: false, progressText: '2/18', percent: 11.1 },
    ],
    daysLeft: 360,
    validUntil: '2027-10-29T00:51:07.330Z',
    startTier: 'cofounder',
    startTierLabel: '联创合伙人',
    targetTier: null,
    targetTierLabel: null,
    isMax: true,
    canApply: false,
    grantedTier: null,
    grantRule: '达标免费升 1 档（封顶联创）',
    deadlineText: '任务有效期 12 个月，将于 360 天后截止',
    text: '直推 3 位私董合伙人 或 直推 18 位VIP合伙人即可免费晋升（12 个月内）',
  })
  expect(task).toMatchObject({
    taskId: 'pt_45',
    enabled: true,
    status: 'ONGOING',
    statusLabel: '进行中',
    daysLeft: 360,
    canApply: false,
    canClaim: false,
    text: '直推 3 位私董合伙人 或 直推 18 位VIP合伙人即可免费晋升（12 个月内）',
  })
  expect(task?.items).toEqual([
    expect.objectContaining({ key: 'private', label: '直推私董', progressText: '2/3', current: 2, required: 3 }),
    expect.objectContaining({ key: 'vip', label: '直推VIP', progressText: '2/18' }),
  ])
})

it('mapPartnerList preserves nested task items on partner rows', () => {
  const list = mapPartnerList({
    items: [{
      contextId: 'partner:p1',
      accountId: 'p1',
      displayId: 'LC0001',
      name: '总部联创-甲',
      task: {
        enabled: true,
        taskId: 'pt_45',
        status: 'ONGOING',
        statusLabel: '进行中',
        items: [{ key: 'private', label: '直推私董', required: 3, current: 2, progressText: '2/3', percent: 66.7 }],
        daysLeft: 360,
        text: 'demo',
      },
    }],
    total: 1,
  }, 1, 10)
  expect(list.items[0].task?.statusLabel).toBe('进行中')
  expect(list.items[0].task?.items[0]).toMatchObject({ label: '直推私董', progressText: '2/3' })
})

it('mapPartnerPromotionTask returns null for empty task', () => {
  expect(mapPartnerPromotionTask(null)).toBeNull()
})

