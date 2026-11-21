import { describe, expect, it } from 'vitest'
import {
  buildHqLedgerListQuery,
  describeIncludedInSummary,
  formatBalanceAfter,
  formatYuan,
  pickHeaderSummary,
  toDateParam,
  usesCatalogSummary,
} from './hqLedgerQuery'
import { encodeHqLedgerId, hqLedgerDetailRequestPath } from '../api/hqLedger'

const catalogSummary = {
  incomeTotal: 260000,
  expenseTotal: 184000,
  netAmount: 76000,
  scope: 'posted_included',
}

const listSummary = {
  incomeTotal: 100000,
  expenseTotal: 0,
  netAmount: 100000,
  postedIncludedCount: 1,
  scope: 'posted_included',
}

describe('toDateParam / buildHqLedgerListQuery', () => {
  it('日期选择器输出 YYYY-MM-DD，空值不进查询', () => {
    expect(toDateParam('2026-11-20')).toBe('2026-11-20')
    expect(toDateParam(' 2026-11-01 ')).toBe('2026-11-01')
    expect(toDateParam(undefined)).toBeUndefined()
    expect(toDateParam('')).toBeUndefined()
    expect(
      buildHqLedgerListQuery({
        from: '2026-11-01',
        to: '2026-11-20',
        page: 2,
        pageSize: 50,
        keyword: '  李四  ',
        direction: 'income',
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      from: '2026-11-01',
      to: '2026-11-20',
      keyword: '李四',
      direction: 'income',
    })
  })

  it('page 默认 1，pageSize 默认 20 且上限 100（含 ALL 截断）', () => {
    expect(buildHqLedgerListQuery({})).toEqual({ page: 1, pageSize: 20 })
    expect(buildHqLedgerListQuery({ page: 0, pageSize: 99999 }).pageSize).toBe(100)
    expect(buildHqLedgerListQuery({ page: -3 }).page).toBe(1)
  })

  it('空的方向/类型/状态/关键词不会作为查询参数发出', () => {
    const query = buildHqLedgerListQuery({
      direction: undefined,
      type: '',
      status: undefined,
      keyword: '   ',
    })
    expect(query).toEqual({ page: 1, pageSize: 20 })
    expect(query).not.toHaveProperty('direction')
    expect(query).not.toHaveProperty('type')
    expect(query).not.toHaveProperty('keyword')
  })
})

describe('pickHeaderSummary', () => {
  it('仅日期或无筛选时用 catalog.summary，不用 items 加总', () => {
    expect(usesCatalogSummary({ from: '2026-11-01', to: '2026-11-20' })).toBe(true)
    expect(usesCatalogSummary({})).toBe(true)
    const header = pickHeaderSummary({
      catalogSummary,
      listSummary,
      filters: { from: '2026-11-01' },
    })
    expect(header).toEqual(catalogSummary)
    expect(header?.incomeTotal).toBe(260000)
    expect(header?.incomeTotal).not.toBe(120000)
  })

  it('改了方向/类型/状态/关键词后改用列表 summary，且不得把 items 加总当页头', () => {
    const items = [
      { amount: 100000, includedInSummary: true },
      { amount: 20000, includedInSummary: false },
    ]
    const summed = items.reduce((sum, item) => sum + item.amount, 0)
    const header = pickHeaderSummary({
      catalogSummary,
      listSummary,
      filters: { direction: 'income' },
    })
    expect(header).toEqual(listSummary)
    expect(header?.incomeTotal).toBe(100000)
    expect(header?.incomeTotal).not.toBe(summed)
    expect(pickHeaderSummary({ catalogSummary, listSummary, filters: { type: 'agent_fee' } })).toEqual(listSummary)
    expect(pickHeaderSummary({ catalogSummary, listSummary, filters: { status: 'posted' } })).toEqual(listSummary)
    expect(pickHeaderSummary({ catalogSummary, listSummary, filters: { keyword: '李四' } })).toEqual(listSummary)
  })
})

describe('formatYuan', () => {
  it('按元原样展示两位小数，不做 /100', () => {
    expect(formatYuan(100000)).toBe('100000.00 元')
    expect(formatYuan(17.5)).toBe('17.50 元')
    expect(formatYuan(100000 / 100)).not.toBe('100000.00 元')
    expect(formatBalanceAfter(null)).toBe('—')
    expect(formatBalanceAfter(undefined)).toBe('—')
    expect(formatBalanceAfter(76000)).toBe('76000.00 元')
  })
})

describe('encodeHqLedgerId', () => {
  it('合成 ID 编码后可还原，不改写原值', () => {
    const ids = ['fi:af-ra_10001', 'cm:ag-ra_10001-hq_residual-0', 'ex:founding-2026-11-p1', 'ord:o_10001']
    for (const ledgerId of ids) {
      const encoded = encodeHqLedgerId(ledgerId)
      expect(encoded).toBe(encodeURIComponent(ledgerId))
      expect(decodeURIComponent(encoded)).toBe(ledgerId)
      expect(hqLedgerDetailRequestPath(ledgerId)).toBe(`/hq-ledger/${encoded}`)
      expect(hqLedgerDetailRequestPath(ledgerId)).toContain(encoded)
      expect(encoded).not.toBe(ledgerId)
      expect(encoded).toContain('%3A')
    }
  })
})

describe('describeIncludedInSummary', () => {
  it('true 且已入账表示计入页头合计，待入账支出只计入冻结', () => {
    expect(describeIncludedInSummary({ includedInSummary: true, status: 'posted' })).toMatchObject({
      text: '计入已入账合计',
      color: 'success',
    })
    expect(describeIncludedInSummary({ includedInSummary: true, status: 'pending' }).text).toBe('计入冻结')
    expect(describeIncludedInSummary({ includedInSummary: true, status: 'pending' }).note).toContain('冻结余额')
    expect(describeIncludedInSummary({ includedInSummary: false, dedupeNote: '同笔代理费已全额入账' }).text).toBe('不计入账面')
  })
})
