/** HQ-29 总部分红（只读组装账）。金额单位为元，前端不算账、不把金额当成分。 */
import type { MoneyYuan, PaginationQuery } from './hq/common'

export type HqLedgerDirection = 'income' | 'expense'
export type HqLedgerStatus = 'pending' | 'posted' | 'reversed' | 'voided'
export type HqLedgerSource = 'fee_income' | 'hq_commission' | 'mirrored_expense' | 'order'

export interface HqLedgerOption {
  value: string
  label: string
}

export interface HqLedgerTypeOption extends HqLedgerOption {
  direction: string
}

export interface HqLedgerSummary {
  incomeTotal: MoneyYuan
  expenseTotal: MoneyYuan
  netAmount: MoneyYuan
  scope: string
  postedIncludedCount?: number
}

export interface HqLedgerBalance {
  availableBalance: MoneyYuan
  frozenBalance: MoneyYuan
  currency: string
  unit: string
  scope: string
  version: number
}

export interface HqLedgerCatalog {
  directions: HqLedgerOption[]
  types: HqLedgerTypeOption[]
  statuses: HqLedgerOption[]
  counterpartyKinds: HqLedgerOption[]
  relatedTypes: HqLedgerOption[]
  summary: HqLedgerSummary
  balance: HqLedgerBalance
}

export interface HqLedgerCatalogQuery {
  from?: string
  to?: string
}

export interface HqLedgerListQuery extends PaginationQuery {
  from?: string
  to?: string
  direction?: string
  type?: string
  status?: string
  keyword?: string
  includedInSummary?: boolean
}

export interface HqLedgerCounterparty {
  kind: string
  kindLabel: string
  id: string | null
  name: string | null
  phone: string | null
}

export interface HqLedgerListItem {
  ledgerId: string
  businessKey: string
  occurredAt: string
  period: string | null
  direction: string
  directionLabel: string
  type: string
  typeLabel: string
  amount: MoneyYuan
  includedInSummary: boolean
  excludeReason: string | null
  dedupeNote: string | null
  counterparty: HqLedgerCounterparty
  relatedType: string | null
  relatedTypeLabel: string | null
  relatedId: string | null
  relatedNo: string | null
  remark: string | null
  status: string
  statusLabel: string
  source: string
  sourceId: string
  balanceAfter: MoneyYuan | null
  version: number
  createdAt: string
}

export interface HqLedgerListData {
  items: HqLedgerListItem[]
  total: number
  page: number
  pageSize: number
  summary: HqLedgerSummary
}

export interface HqLedgerRelatedDocument {
  type: string
  typeLabel: string
  id: string
  no: string | null
  title: string | null
  status: string | null
  amount: MoneyYuan | null
}

export interface HqLedgerSiblingEntry {
  ledgerId: string
  type: string
  typeLabel: string
  direction: string
  amount: MoneyYuan
  includedInSummary: boolean
  status: string
}

export interface HqLedgerDetail extends HqLedgerListItem {
  bookedAt: string | null
  updatedAt: string
  sourceModule: string | null
  relatedDocuments: HqLedgerRelatedDocument[]
  siblingEntries: HqLedgerSiblingEntry[]
}

export class HqLedgerError extends Error {
  constructor(
    public kind: 'not_ready' | 'not_found' | 'invalid' | 'unavailable',
    message: string,
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'HqLedgerError'
  }
}
