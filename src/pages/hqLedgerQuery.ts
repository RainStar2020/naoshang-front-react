/** 总部分红查询构造与展示格式化。金额按元展示，禁止 /100。页头合计不得把 items 加总。 */
import type { HqLedgerBalance, HqLedgerListQuery, HqLedgerSummary } from '../types/hqLedger'

export const HQ_LEDGER_PAGE_SIZE = 20
export const HQ_LEDGER_PAGE_SIZE_MAX = 100

export interface HqLedgerFilterState {
  from?: string
  to?: string
  direction?: string
  type?: string
  status?: string
  keyword?: string
  includedInSummary?: boolean
}

/** 把日期选择器的值规范为 YYYY-MM-DD；无效则忽略。 */
export function toDateParam(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return undefined
    return formatShanghaiDate(parsed)
  }
  if (typeof value === 'object' && value !== null && typeof (value as { format?: unknown }).format === 'function') {
    const formatted = (value as { format: (t: string) => string }).format('YYYY-MM-DD')
    return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : undefined
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatShanghaiDate(value)
  return undefined
}

function formatShanghaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts
}

export function clampPage(page: number | undefined): number {
  const n = Number(page)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

export function clampPageSize(pageSize: number | undefined): number {
  const n = Number(pageSize)
  if (!Number.isFinite(n) || n < 1) return HQ_LEDGER_PAGE_SIZE
  return Math.min(HQ_LEDGER_PAGE_SIZE_MAX, Math.floor(n))
}

/** 构造列表查询。空筛选不传；pageSize 限制在 1–100。 */
export function buildHqLedgerListQuery(input: HqLedgerFilterState & { page?: number; pageSize?: number }): HqLedgerListQuery {
  const query: HqLedgerListQuery = {
    page: clampPage(input.page),
    pageSize: clampPageSize(input.pageSize),
  }
  const from = toDateParam(input.from)
  const to = toDateParam(input.to)
  if (from) query.from = from
  if (to) query.to = to
  if (input.direction) query.direction = input.direction
  if (input.type) query.type = input.type
  if (input.status) query.status = input.status
  const keyword = input.keyword?.trim()
  if (keyword) query.keyword = keyword
  if (typeof input.includedInSummary === 'boolean') query.includedInSummary = input.includedInSummary
  return query
}

/**
 * 仅日期或无筛选时用 catalog.summary；改了方向/类型/状态/关键词（或计入标记）后用列表 summary。
 * 余额始终使用 catalog.balance，不在此函数处理。
 */
export function usesCatalogSummary(filters: HqLedgerFilterState): boolean {
  return (
    !filters.direction &&
    !filters.type &&
    !filters.status &&
    !filters.keyword?.trim() &&
    typeof filters.includedInSummary !== 'boolean'
  )
}

export function pickHeaderSummary(input: {
  catalogSummary?: HqLedgerSummary | null
  listSummary?: HqLedgerSummary | null
  filters: HqLedgerFilterState
}): HqLedgerSummary | null {
  if (usesCatalogSummary(input.filters)) return input.catalogSummary ?? input.listSummary ?? null
  return input.listSummary ?? null
}

/** 金额按元、两位小数展示。禁止把元当成分再 /100。 */
export function formatYuan(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  return `${Number(amount).toFixed(2)} 元`
}

export function formatBalanceAfter(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return formatYuan(value)
}

/** 列表时间列：ISO-8601 UTC 转为 Asia/Shanghai 的 YYYY-MM-DD HH:mm。 */
export function formatOccurredAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const text = date.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
  return text.slice(0, 16)
}

export function formatCounterparty(row: {
  name?: string | null
  phone?: string | null
  id?: string | null
  kindLabel?: string | null
}): string {
  const name = (row.name || '').trim()
  const phone = (row.phone || '').trim()
  if (name && phone) return `${name} / ${phone}`
  if (name || phone) return name || phone
  return row.id || row.kindLabel || '—'
}

export const ASSEMBLED_BOOK_HINT =
  '一期是组装账面，不含课程/商品等销售收入和提现打款，不是可提现资金账户。页头收入/支出/净额只含已入账且具备账面资格的流水；待入账但有账面资格的支出只进入冻结余额。'

/** includedInSummary 表示账面资格，不等于已计入页头收入/支出。 */
export function describeIncludedInSummary(row: {
  includedInSummary: boolean
  status?: string | null
  dedupeNote?: string | null
}): { text: string; color: string; note: string | null } {
  if (!row.includedInSummary) {
    return { text: '不计入账面', color: 'warning', note: row.dedupeNote ?? null }
  }
  if (row.status === 'pending') {
    return {
      text: '计入冻结',
      color: 'processing',
      note: row.dedupeNote || '待入账，只进入冻结余额，不进入页头收入/支出合计',
    }
  }
  return { text: '计入已入账合计', color: 'success', note: row.dedupeNote ?? null }
}

export function isAssembledBookBalance(balance?: HqLedgerBalance | null): boolean {
  return balance?.scope === 'assembled_book'
}
