import * as api from '../api/dividendAudit'
import { isMockAuth } from './auth'
import type { DividendAuditOverview, DividendKind, DividendKindOption } from '../types/dividendAudit'
import { IncomeError } from '../types/income'

const kinds: DividendKindOption[] = [
  { kind: 'memberCard', label: '会员卡分红' },
  { kind: 'promotion', label: '合店推广分红' },
  { kind: 'global', label: '全球奖' },
  { kind: 'founding', label: '创始奖' },
]

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}`
}
function periods() {
  const date = new Date(`${currentPeriod()}-01T00:00:00Z`)
  return Array.from({ length: 36 }, (_, i) => {
    const item = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - i, 1))
    return `${item.getUTCFullYear()}-${String(item.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

function mockOverview(kind: DividendKind, period: string, page: number, pageSize: number): DividendAuditOverview {
  const seed = kind === 'founding' ? 88 : kind === 'global' ? 158 : kind === 'promotion' ? 226 : 126
  const all = Array.from({ length: 27 }, (_, index) => {
    const eligible = kind === 'global' ? index % 4 !== 0 : true
    const performance = kind === 'founding' ? 0 : Number((seed * (1 + (26 - index) / 80)).toFixed(2))
    const weighted = kind === 'founding' || !eligible ? 0 : Number((seed * 0.45).toFixed(2))
    return {
      accountId: `NS${String(100000 + index)}`,
      name: ['张晨', '李晓', '王磊', '陈静'][index % 4],
      phone: `138****${String(1000 + index).slice(-4)}`,
      eligible,
      totalAmount: Number((performance + weighted).toFixed(2)),
      weightedAmount: weighted,
      performanceAmount: performance,
      performanceValue: kind === 'founding' ? null : 1200 + index * 86,
      ...(kind === 'global' ? { performanceShareBps: 260 + index * 15 } : {}),
    }
  })
  const items = all.slice((page - 1) * pageSize, page * pageSize)
  const summary = all.reduce((value, item) => ({ people: value.people + 1, totalAmount: value.totalAmount + item.totalAmount, weightedAmount: value.weightedAmount + item.weightedAmount, performanceAmount: value.performanceAmount + item.performanceAmount }), { people: 0, totalAmount: 0, weightedAmount: 0, performanceAmount: 0 })
  return { kind, period, isCurrentMonth: period === currentPeriod(), pool: Number(summary.totalAmount.toFixed(2)), items, total: all.length, page, pageSize, summary: { ...summary, totalAmount: Number(summary.totalAmount.toFixed(2)), weightedAmount: Number(summary.weightedAmount.toFixed(2)), performanceAmount: Number(summary.performanceAmount.toFixed(2)) } }
}

function unwrap<T>(response: { code: number; message: string; data: T | null }): T {
  if (response.code !== 0) throw new IncomeError('INVALID_INPUT', response.message)
  if (response.data == null) throw new IncomeError('INVALID_INPUT', '总部接口未返回业务数据')
  return response.data
}

export const dividendAuditService = {
  async kinds(): Promise<DividendKindOption[]> {
    return isMockAuth ? kinds : unwrap(await api.getDividendKinds()).kinds
  },
  async periods(kind: DividendKind) {
    return isMockAuth ? { kind, currentPeriod: currentPeriod(), periods: periods() } : unwrap(await api.getDividendPeriods(kind))
  },
  async overview(query: { kind: DividendKind; period?: string; page?: number; pageSize?: number }): Promise<DividendAuditOverview> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const period = query.period ?? currentPeriod()
    return isMockAuth ? mockOverview(query.kind, period, page, pageSize) : unwrap(await api.getDividendOverview({ ...query, page, pageSize }))
  },
}
