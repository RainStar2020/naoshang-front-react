import { describe, expect, it } from 'vitest'
import axios from 'axios'
import { ApiError } from '../api/client'
import {
  asYuan,
  describeHqLedgerError,
  mapCatalog,
  mapDetail,
  mapList,
  mapListItem,
  mapSummary,
  toHqLedgerError,
} from './hqLedger'

const feeIncome = {
  ledgerId: 'fi:af-ra_10001',
  businessKey: 'agent_fee:ra_10001',
  occurredAt: '2026-11-20T09:00:00.000Z',
  period: '2026-11',
  direction: 'income',
  directionLabel: '收入',
  type: 'agent_fee',
  typeLabel: '代理任命实收费用',
  amount: 100000.0,
  includedInSummary: true,
  excludeReason: null,
  dedupeNote: null,
  counterparty: { kind: 'agent', kindLabel: '代理', id: 'ra_10001', name: '李四', phone: '138****8000' },
  relatedType: 'agent_appointment',
  relatedTypeLabel: '代理任命',
  relatedId: 'ra_10001',
  relatedNo: 'DL2026112000000001',
  remark: '区县代任命实收',
  status: 'posted',
  statusLabel: '已入账',
  source: 'fee_income',
  sourceId: 'af-ra_10001',
  balanceAfter: 76000.0,
  version: 0,
  createdAt: '2026-11-20T09:00:00.000Z',
}

const residual = {
  ...feeIncome,
  ledgerId: 'cm:ag-ra_10001-hq_residual-0',
  type: 'commission_agent',
  typeLabel: '代理任命总部留存/归总部部分',
  amount: 20000.0,
  includedInSummary: false,
  excludeReason: 'duplicate_of_full_fee',
  dedupeNote: '同笔代理费已全额入账，本行是总部留存提成，仅展示不计入合计',
  balanceAfter: null,
}

describe('mapper：金额按元、计入标记保留', () => {
  it('asYuan / mapListItem 不把元当成分', () => {
    expect(asYuan(100000)).toBe(100000)
    expect(asYuan(100000)).not.toBe(1000)
    const item = mapListItem(feeIncome)
    expect(item?.amount).toBe(100000)
    expect(item?.includedInSummary).toBe(true)
    expect(mapListItem(residual)?.includedInSummary).toBe(false)
    expect(mapListItem(residual)?.dedupeNote).toContain('仅展示不计入合计')
    expect(mapListItem(residual)?.balanceAfter).toBeNull()
  })

  it('列表合计以后端 summary 为准，不能用 items 加总替代', () => {
    const data = mapList({
      items: [feeIncome, residual],
      total: 2,
      page: 1,
      pageSize: 20,
      summary: {
        incomeTotal: 100000.0,
        expenseTotal: 0,
        netAmount: 100000.0,
        postedIncludedCount: 1,
        scope: 'posted_included',
      },
    })
    const itemSum = data.items.reduce((sum, item) => sum + item.amount, 0)
    expect(itemSum).toBe(120000)
    expect(data.summary.incomeTotal).toBe(100000)
    expect(data.summary.incomeTotal).not.toBe(itemSum)
    expect(data.summary.postedIncludedCount).toBe(1)
  })

  it('catalog 余额 scope 为 assembled_book，枚举按接口返回映射', () => {
    const catalog = mapCatalog({
      directions: [{ value: 'income', label: '收入' }],
      types: [{ value: 'agent_fee', label: '代理任命实收费用', direction: 'income' }],
      statuses: [{ value: 'posted', label: '已入账' }],
      counterpartyKinds: [],
      relatedTypes: [],
      summary: { incomeTotal: 260000, expenseTotal: 184000, netAmount: 76000, scope: 'posted_included' },
      balance: {
        availableBalance: 76000,
        frozenBalance: 0,
        currency: 'CNY',
        unit: 'yuan',
        scope: 'assembled_book',
        version: 0,
      },
    })
    expect(catalog.types[0]).toEqual({ value: 'agent_fee', label: '代理任命实收费用', direction: 'income' })
    expect(catalog.balance.scope).toBe('assembled_book')
    expect(catalog.balance.availableBalance).toBe(76000)
    expect(mapSummary(catalog.summary).incomeTotal).toBe(260000)
  })

  it('详情保留关联单据与同业务其他流水，ledgerId 不改写', () => {
    const detail = mapDetail({
      ...residual,
      bookedAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
      sourceModule: 'commissions',
      relatedDocuments: [
        { type: 'agent_appointment', typeLabel: '代理任命', id: 'ra_10001', no: 'DL2026112000000001', title: '任命', status: 'paid', amount: 100000 },
      ],
      siblingEntries: [
        { ledgerId: 'fi:af-ra_10001', type: 'agent_fee', typeLabel: '代理任命实收费用', direction: 'income', amount: 100000, includedInSummary: true, status: 'posted' },
      ],
    })
    expect(detail?.ledgerId).toBe('cm:ag-ra_10001-hq_residual-0')
    expect(detail?.relatedDocuments[0].amount).toBe(100000)
    expect(detail?.siblingEntries[0].ledgerId).toBe('fi:af-ra_10001')
  })
})

describe('toHqLedgerError', () => {
  it('HTTP 404 友好提示接口未就绪，40400 提示流水不存在', () => {
    const ready = toHqLedgerError(new ApiError({ code: 50000, message: 'nope' }, 404))
    expect(ready.kind).toBe('not_ready')
    expect(describeHqLedgerError(ready)).toContain('尚未就绪')

    const missing = toHqLedgerError(new ApiError({ code: 40400, message: '流水不存在', data: null }, 404))
    expect(missing.kind).toBe('not_found')
    expect(missing.message).toBe('流水不存在')

    const axios404 = new axios.AxiosError('Request failed with status code 404')
    axios404.response = {
      status: 404,
      data: 'Cannot GET /api/hq/hq-ledger',
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
    }
    const mapped = toHqLedgerError(axios404)
    expect(mapped.kind).toBe('not_ready')
    expect(mapped.message).toContain('尚未就绪')
  })
})
