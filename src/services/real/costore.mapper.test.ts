import { expect, it } from 'vitest'
import { mapCostoreApplication } from './costore'

it('passes through update-payment in allowedActions', () => {
  const application = mapCostoreApplication({
    applicationId: 'app-1',
    applicationStatus: 'APPROVED',
    paymentStatus: 'PAID',
    allowedActions: ['update-payment'],
  })
  expect(application.allowedActions).toEqual(['update-payment'])
})

it('normalizes WAITING_PAYMENT and payment-status PENDING_PAYMENT to PENDING', () => {
  expect(mapCostoreApplication({ paymentStatus: 'WAITING_PAYMENT' }).paymentStatus).toBe('PENDING')
  expect(mapCostoreApplication({ paymentStatus: 'PENDING_PAYMENT' }).paymentStatus).toBe('PENDING')
})

it('does not invent update-payment when the API omits it', () => {
  const approved = mapCostoreApplication({ applicationStatus: 'APPROVED', paymentStatus: 'PAID', allowedActions: ['approve'] })
  expect(approved.allowedActions).toEqual(['approve'])
  const refundFailed = mapCostoreApplication({ refundStatus: 'FAILED', allowedActions: [] })
  expect(refundFailed.allowedActions).toEqual(['retry-refund'])
})
