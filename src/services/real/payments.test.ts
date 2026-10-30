import { describe, expect, it } from 'vitest'
import { mapPaymentCatalog, mapPaymentJob, mapPaymentRecord } from './payments'

describe('real payments mapPaymentCatalog', () => {
  it('fills catalog arrays so Payments page never crashes on .some/.map', () => {
    const catalog = mapPaymentCatalog({})
    expect(catalog.configs).toEqual([])
    expect(catalog.payments).toEqual([])
    expect(catalog.attempts).toEqual([])
    expect(catalog.jobs).toEqual([])
    expect(catalog.audit).toEqual([])
    expect(() => catalog.jobs.some((job) => job.status === 'PROCESSING')).not.toThrow()
    expect(() => catalog.payments.map((row) => row.paymentId)).not.toThrow()
    expect(() => catalog.audit.map((row) => row.operationId)).not.toThrow()
  })

  it('aliases recentJobs/channels and defaults job.differences', () => {
    const catalog = mapPaymentCatalog({
      channels: [{ platform: 'H5', business: 'MALL', channel: 'ALIPAY', enabled: true }],
      recentJobs: [{ id: 'j-1', type: 'reconcile', status: 'SUCCEEDED' }],
      operations: [{ id: 'op-1', action: 'query', paymentId: 'pay-1' }],
    })
    expect(catalog.configs[0]).toMatchObject({
      configId: 'H5-MALL-ALIPAY',
      platform: 'H5',
      business: 'MALL',
      channel: 'ALIPAY',
      enabled: true,
    })
    expect(catalog.jobs[0].jobId).toBe('j-1')
    expect(catalog.jobs[0].kind).toBe('reconcile')
    expect(catalog.jobs[0].differences).toEqual([])
    expect(() => catalog.jobs[0].differences.map((row) => row.id)).not.toThrow()
    expect(catalog.audit[0]).toMatchObject({ operationId: 'op-1', action: 'query', targetId: 'pay-1' })
  })

  it('maps sparse payment records', () => {
    const payment = mapPaymentRecord({ id: 'pay-9', orderNumber: 'O1', userId: 'a1', amount: 12.5, status: 'success' })
    expect(payment.paymentId).toBe('pay-9')
    expect(payment.orderNo).toBe('O1')
    expect(payment.accountId).toBe('a1')
    expect(payment.status).toBe('SUCCESS')
    expect(payment.amount).toBe(1250)
    expect(payment.verification).toBeNull()

    const job = mapPaymentJob({ jobId: 'j-2', differences: undefined })
    expect(job.differences).toEqual([])
  })
})
