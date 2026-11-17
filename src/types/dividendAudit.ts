export type DividendKind = 'memberCard' | 'promotion' | 'global' | 'founding'

export interface DividendKindOption { kind: DividendKind; label: string }

export interface DividendAuditItem {
  accountId: string
  name: string | null
  phone: string | null
  eligible: boolean
  totalAmount: number
  weightedAmount: number
  performanceAmount: number
  performanceValue: number | null
  performanceShareBps?: number
}

export interface DividendAuditOverview {
  kind: DividendKind
  period: string
  isCurrentMonth: boolean
  pool: number
  items: DividendAuditItem[]
  total: number
  page: number
  pageSize: number
  summary: {
    people: number
    totalAmount: number
    weightedAmount: number
    performanceAmount: number
  }
}
