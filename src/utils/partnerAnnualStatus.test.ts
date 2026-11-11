import { expect, it } from 'vitest'
import { ANNUAL_STATUS_LABELS, annualStatusLabel, annualStatusTagColor } from './partnerAnnualStatus'

it('annualStatusLabel matches shared ACTIVE / EXPIRED / NOT_OPEN copy', () => {
  expect(annualStatusLabel('ACTIVE')).toBe('年度权益正常')
  expect(annualStatusLabel('EXPIRED')).toBe('年度已到期')
  expect(annualStatusLabel('NOT_OPEN')).toBe('未开通')
  expect(ANNUAL_STATUS_LABELS).toEqual({
    ACTIVE: '年度权益正常',
    EXPIRED: '年度已到期',
    NOT_OPEN: '未开通',
  })
})

it('annualStatusLabel does not treat partnerStatus ACTIVE as annual entitlement', () => {
  // When annualStatus is NOT_OPEN, copy must stay 未开通 even if caller also has partnerStatus ACTIVE.
  expect(annualStatusLabel('NOT_OPEN')).toBe('未开通')
  expect(annualStatusLabel('NOT_OPEN')).not.toBe('年度权益正常')
})

it('annualStatusLabel maps missing/unknown to 未开通, never ACTIVE', () => {
  expect(annualStatusLabel(undefined)).toBe('未开通')
  expect(annualStatusLabel(null)).toBe('未开通')
  expect(annualStatusLabel('')).toBe('未开通')
  expect(annualStatusLabel('UNKNOWN')).toBe('未开通')
  expect(annualStatusLabel('FROZEN')).toBe('未开通')
  expect(annualStatusLabel('PENDING_ANNUAL')).toBe('未开通')
})

it('annualStatusTagColor is green only for ACTIVE', () => {
  expect(annualStatusTagColor('ACTIVE')).toBe('green')
  expect(annualStatusTagColor('EXPIRED')).toBe('default')
  expect(annualStatusTagColor('NOT_OPEN')).toBe('default')
  expect(annualStatusTagColor(undefined)).toBe('default')
})