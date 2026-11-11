import type { PartnerProfile } from '../types/partners'

export type AnnualStatus = PartnerProfile['annualStatus']

/** Shared copy for list column + detail drawer. Unknown/missing → 未开通 (never silently ACTIVE). */
export const ANNUAL_STATUS_LABELS: Record<AnnualStatus, string> = {
  ACTIVE: '年度权益正常',
  EXPIRED: '年度已到期',
  NOT_OPEN: '未开通',
}

export function annualStatusLabel(status: string | null | undefined): string {
  const raw = String(status ?? '').toUpperCase()
  if (raw === 'ACTIVE' || raw === 'EXPIRED' || raw === 'NOT_OPEN') {
    return ANNUAL_STATUS_LABELS[raw]
  }
  return ANNUAL_STATUS_LABELS.NOT_OPEN
}

export function annualStatusTagColor(status: string | null | undefined): string {
  return String(status ?? '').toUpperCase() === 'ACTIVE' ? 'green' : 'default'
}