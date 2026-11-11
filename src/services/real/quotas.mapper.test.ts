import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders } from 'axios'
import { apiClient } from '../../api/client'
import { mapQuotaDetail, mapQuotaOwner, realQuotaDetail } from './quotas'

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

  it('maps accountDto owner.tier / owner.accountId / displayId without reading the wrapper as the person', () => {
    const row = mapQuotaOwner({
      quotaId: 'p1',
      ownerId: 'p1',
      standard: 1236,
      activityTotal: 0,
      total: 1236,
      frozen: 0,
      available: 1218,
      owner: {
        accountId: 'p1',
        name: '联创测试',
        phone: '13800000001',
        displayId: 'LC0001',
        tier: 'cofounder',
      },
    })
    expect(row).toMatchObject({
      quotaId: 'p1',
      ownerAccountId: 'p1',
      name: '联创测试',
      phone: '13800000001',
      displayId: 'LC0001',
      partnerLevel: 'DEMO-FOUNDER',
      standard: 1236,
      activityTotal: 0,
      quotaTotal: 1236,
      frozen: 0,
      available: 1218,
    })
    expect(row.balances.find((b) => b.quotaType === 'STANDARD')?.total).toBe(1236)
    expect(row.balances.find((b) => b.quotaType === 'STANDARD')?.remaining).toBe(1218)
  })

  it('does not default a missing or unknown tier to DEMO-VIP', () => {
    expect(mapQuotaOwner({ quotaId: 'p1', ownerId: 'p1', standard: 1 }).partnerLevel).toBe('')
    expect(mapQuotaOwner({
      quotaId: 'p1',
      owner: { accountId: 'p1', name: '未知档位', displayId: 'LC0001', tier: 'not-a-real-tier' },
    }).partnerLevel).toBe('')
  })
})

describe('mapQuotaDetail real HQ payload', () => {
  const accountDto = {
    quotaId: 'p1',
    ownerId: 'p1',
    standard: 1236,
    activityTotal: 2,
    total: 1238,
    frozen: 0,
    available: 1220,
    owner: {
      accountId: 'p1',
      name: '联创测试',
      phone: '13800000001',
      displayId: 'LC0001',
      tier: 'cofounder',
    },
  }

  it('reads owner and balances from data.account and flows from data.transactions', () => {
    const detail = mapQuotaDetail({
      account: accountDto,
      ledger: {
        standard: 1236,
        activity: [{ qty: 2, obtainedAt: '2026-11-01T00:00:00+08:00', expireAt: null }],
      },
      transactions: [
        { id: 'tx-consume-1', type: 'consume', partnerId: 'p1', qty: 1, quotaType: 'STANDARD' },
        { id: 'tx-unknown-1', type: 'issue', partnerId: 'p1', qty: 18 },
      ],
    })

    expect(detail.owner).toMatchObject({
      name: '联创测试',
      phone: '13800000001',
      displayId: 'LC0001',
      ownerAccountId: 'p1',
      partnerLevel: 'DEMO-FOUNDER',
      standard: 1236,
      activityTotal: 2,
      frozen: 0,
      available: 1220,
    })
    expect(detail.owner.balances.find((b) => b.quotaType === 'STANDARD')?.total).toBe(1236)
    expect(detail.owner.balances.find((b) => b.quotaType === 'ACTIVITY')?.total).toBe(2)

    expect(detail.ledger).toHaveLength(2)
    expect(detail.ledger[0]).toMatchObject({
      ledgerId: 'tx-consume-1',
      kind: 'CONSUME',
      quantity: 1,
      ownerAccountId: 'p1',
      quotaType: 'STANDARD',
      targetAccountId: null,
      createdAt: '',
    })
    expect(detail.ledger[1]).toMatchObject({
      ledgerId: 'tx-unknown-1',
      kind: 'ISSUE',
      quantity: 18,
      ownerAccountId: 'p1',
    })
    expect(detail.ledger.map((row) => row.kind)).not.toContain('TRANSFER_OUT')
    expect(detail.ledger.map((row) => row.kind)).not.toContain('TRANSFER_IN')
  })

  it('does not treat the ledger balance object as the flow list', () => {
    const detail = mapQuotaDetail({
      account: accountDto,
      ledger: {
        standard: 1236,
        activity: [{ qty: 2, obtainedAt: '2026-11-01T00:00:00+08:00', expireAt: null }],
      },
    })
    expect(detail.ledger).toEqual([])
    expect(detail.owner.standard).toBe(1236)
    expect(detail.owner.displayId).toBe('LC0001')
  })

  it('still accepts a legacy ledger array when transactions are absent', () => {
    const detail = mapQuotaDetail({
      account: accountDto,
      ledger: [{ id: 'legacy-1', kind: 'HQ_RECHARGE', quantity: 10, createdAt: '2026-11-01T00:00:00+08:00' }],
    })
    expect(detail.ledger).toHaveLength(1)
    expect(detail.ledger[0]).toMatchObject({ ledgerId: 'legacy-1', kind: 'HQ_RECHARGE', quantity: 10 })
  })
})

describe('realQuotaDetail', () => {
  const adapter = apiClient.defaults.adapter
  afterEach(() => { apiClient.defaults.adapter = adapter })

  it('does not fall back to the first list item when the detail GET fails', async () => {
    const urls: string[] = []
    apiClient.defaults.adapter = async (config) => {
      const url = `${config.baseURL || ''}${config.url || ''}`
      urls.push(`${String(config.method || 'get').toLowerCase()}:${url}`)
      if (String(config.url || '').includes('/quotas/p1')) {
        return {
          config,
          data: { code: 40400, message: '名额账户不存在', data: null },
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
        }
      }
      return {
        config,
        data: {
          code: 0,
          message: 'ok',
          data: {
            items: [{
              quotaId: 'OTHER',
              ownerId: 'OTHER',
              standard: 9,
              owner: { accountId: 'OTHER', name: '列表第一行', phone: '100', displayId: 'LC9999', tier: 'vip' },
            }],
            total: 1,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
      }
    }

    await expect(realQuotaDetail('p1')).rejects.toEqual(expect.objectContaining({
      name: 'QuotaError',
      code: 'NOT_FOUND',
    }))
    expect(urls.some((url) => url.includes('keyword') || /\/quotas\/?(\?|$)/.test(url))).toBe(false)
  })
})
