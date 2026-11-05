import { describe, expect, it } from 'vitest'
import { mapQuotaOwner } from './quotas'

describe('mapQuotaOwner real HQ list item', () => {
  it('maps flat quota list fields from API', () => {
    const row = mapQuotaOwner({
      quotaId: 'p1',
      ownerId: 'p1',
      ownerType: 'partner',
      standard: 500,
      activityTotal: 0,
      total: 500,
      frozen: 0,
      available: 500,
      used: 12,
      status: 'ACTIVE',
      version: 1,
      allowedActions: ['freeze', 'adjust'],
    })
    expect(row).toMatchObject({
      quotaId: 'p1',
      ownerAccountId: 'p1',
      ownerType: 'partner',
      standard: 500,
      activityTotal: 0,
      quotaTotal: 500,
      frozen: 0,
      available: 500,
      spent: 12,
      quotaStatus: 'ACTIVE',
      version: 1,
      allowedActions: ['freeze', 'adjust'],
      eligibility: { canRecharge: true },
    })
    expect(row.balances.find((b) => b.quotaType === 'STANDARD')?.total).toBe(500)
  })

  it('maps summary-facing totals for activity rows', () => {
    const row = mapQuotaOwner({
      quotaId: 'p3',
      ownerId: 'p3',
      ownerType: 'partner',
      standard: 97,
      activityTotal: 4,
      total: 101,
      frozen: 0,
      available: 101,
      status: 'ACTIVE',
      version: 1,
      allowedActions: ['freeze', 'adjust'],
    })
    expect(row).toMatchObject({ standard: 97, activityTotal: 4, quotaTotal: 101, available: 101, spent: 0 })
  })
})
