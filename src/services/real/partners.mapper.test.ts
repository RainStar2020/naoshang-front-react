import { expect, it } from 'vitest'
import { asAnnualStatus, mapPartnerAudit, mapPartnerCatalog, mapPartnerDetail, mapPartnerList, mapPartnerProfile, mapPartnerPromotionTask } from './partners'

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


it('mapPartnerCatalog merges partnerLevels + benefits from real HQ payload', () => {
  const catalog = mapPartnerCatalog({
    partnerLevels: [
      { value: 'DEMO-VIP', label: 'DEMO-VIP' },
      { value: 'DEMO-ANGEL', label: 'DEMO-ANGEL' },
      { value: 'DEMO-BOARD', label: 'DEMO-BOARD' },
      { value: 'DEMO-FOUNDER', label: 'DEMO-FOUNDER' },
    ],
    benefits: [
      {
        partnerLevel: 'DEMO-FOUNDER',
        summary: '',
        content: { version: 1, format: 'nodes', nodes: [{ type: 'text', text: '联创权益' }] },
        version: 2,
      },
      {
        partnerLevel: 'DEMO-VIP',
        summary: '',
        content: { version: 1, format: 'nodes', nodes: [{ type: 'text', text: 'VIP权益' }] },
        version: 2,
      },
      {
        partnerLevel: 'DEMO-ANGEL',
        summary: '1',
        content: { version: 1, format: 'nodes', nodes: [{ type: 'text', text: "131e'q" }] },
        version: 2,
      },
      {
        partnerLevel: 'DEMO-BOARD',
        summary: '22',
        content: { version: 1, format: 'nodes', nodes: [{ type: 'text', text: '私董权益' }] },
        version: 2,
      },
    ],
    audit: [
      {
        id: 'hqal_117',
        action: 'upgrade',
        targetId: 'partner:p6',
        operatorName: '区县代-戊',
        reason: '升档',
        before: { partnerLevel: 'DEMO-VIP', frozen: false },
        after: { partnerLevel: 'DEMO-ANGEL' },
        occurredAt: '2026-10-01T01:00:00.000Z',
      },
    ],
  })
  expect(catalog.levels.map((row) => row.partnerLevel)).toEqual([
    'DEMO-VIP',
    'DEMO-ANGEL',
    'DEMO-BOARD',
    'DEMO-FOUNDER',
  ])
  expect(catalog.levels[0]).toMatchObject({
    partnerLevel: 'DEMO-VIP',
    title: 'VIP',
    summary: '',
    wholesaleLabel: '',
    quotaOccupancy: 0,
    nextLevel: null,
    taskTarget: null,
    version: 2,
  })
  expect(catalog.levels[0].content.nodes.length).toBeGreaterThan(0)
  expect(catalog.levels[1]).toMatchObject({ partnerLevel: 'DEMO-ANGEL', title: '天使', summary: '1' })
  expect(catalog.levels[2]).toMatchObject({ partnerLevel: 'DEMO-BOARD', title: '私董', summary: '22' })
  expect(catalog.levels[3]).toMatchObject({ partnerLevel: 'DEMO-FOUNDER', title: '联创', summary: '' })
  expect(catalog.audit[0]).toMatchObject({
    operationId: 'hqal_117',
    action: 'upgrade',
    before: 'VIP',
    after: '天使',
  })
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

it('mapPartnerAudit normalizes save-benefits aliases', () => {
  for (const action of ['save-benefits', 'SAVE_LEVEL_DESC', 'updateLevelBenefits', 'saveBenefits']) {
    expect(mapPartnerAudit({ operationId: 'x', action, before: { summary: 'a' }, after: { summary: 'b' } }).action).toBe('save-benefits')
  }
})

it('asAnnualStatus defaults missing/unknown to NOT_OPEN, never ACTIVE', () => {
  expect(asAnnualStatus(undefined)).toBe('NOT_OPEN')
  expect(asAnnualStatus(null)).toBe('NOT_OPEN')
  expect(asAnnualStatus('')).toBe('NOT_OPEN')
  expect(asAnnualStatus('UNKNOWN')).toBe('NOT_OPEN')
  expect(asAnnualStatus('FROZEN')).toBe('NOT_OPEN')
  expect(asAnnualStatus('ACTIVE')).toBe('ACTIVE')
  expect(asAnnualStatus('EXPIRED')).toBe('EXPIRED')
  expect(asAnnualStatus('NOT_OPEN')).toBe('NOT_OPEN')
})

it('mapPartnerProfile keeps annualStatus independent of partnerStatus', () => {
  const profile = mapPartnerProfile({
    contextId: 'partner:p9',
    accountId: 'p9',
    partnerStatus: 'ACTIVE',
    annualStatus: 'NOT_OPEN',
    annualValidUntil: null,
  })
  expect(profile.partnerStatus).toBe('ACTIVE')
  expect(profile.annualStatus).toBe('NOT_OPEN')
  expect(profile.annualValidUntil).toBeNull()
})

it('mapPartnerProfile maps ACTIVE / EXPIRED annualStatus and annualValidUntil', () => {
  const active = mapPartnerProfile({
    contextId: 'c-active',
    accountId: 'a1',
    partnerStatus: 'ACTIVE',
    annualStatus: 'ACTIVE',
    annualValidUntil: '2027-10-01T00:00:00.000Z',
  })
  expect(active.annualStatus).toBe('ACTIVE')
  expect(active.annualValidUntil).toBe('2027-10-01T00:00:00.000Z')

  const expired = mapPartnerProfile({
    contextId: 'c-expired',
    accountId: 'a2',
    partnerStatus: 'FROZEN',
    annualStatus: 'EXPIRED',
    annualValidUntil: '2025-10-01T00:00:00.000Z',
  })
  expect(expired.annualStatus).toBe('EXPIRED')
  expect(expired.annualValidUntil).toBe('2025-10-01T00:00:00.000Z')
})

it('mapPartnerProfile missing annualStatus stays NOT_OPEN even when partnerStatus ACTIVE', () => {
  const profile = mapPartnerProfile({
    contextId: 'c-missing-annual',
    accountId: 'a3',
    partnerStatus: 'ACTIVE',
  })
  expect(profile.partnerStatus).toBe('ACTIVE')
  expect(profile.annualStatus).toBe('NOT_OPEN')
  expect(profile.annualValidUntil).toBeNull()
})

it('mapPartnerList preserves per-row annualStatus so list can distinguish 未开通/正常/已到期', () => {
  const list = mapPartnerList({
    items: [
      { contextId: 'c1', accountId: 'a1', partnerStatus: 'ACTIVE', annualStatus: 'NOT_OPEN', annualValidUntil: null },
      { contextId: 'c2', accountId: 'a2', partnerStatus: 'ACTIVE', annualStatus: 'ACTIVE', annualValidUntil: '2027-01-01T00:00:00.000Z' },
      { contextId: 'c3', accountId: 'a3', partnerStatus: 'FROZEN', annualStatus: 'EXPIRED', annualValidUntil: '2025-01-01T00:00:00.000Z' },
    ],
    total: 3,
  }, 1, 10)
  expect(list.items.map((row) => row.annualStatus)).toEqual(['NOT_OPEN', 'ACTIVE', 'EXPIRED'])
  expect(list.items[0].annualValidUntil).toBeNull()
  expect(list.items[1].annualValidUntil).toBe('2027-01-01T00:00:00.000Z')
  expect(list.items[2].partnerStatus).toBe('FROZEN')
})