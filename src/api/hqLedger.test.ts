import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('./client', () => ({
  apiClient: { get },
}))

describe('getHqLedgerById path encoding', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { code: 0, message: 'ok', data: {} } })
  })

  it('详情路径使用 encodeURIComponent，ledgerId 原样可还原', async () => {
    const { getHqLedgerById, hqLedgerDetailRequestPath } = await import('./hqLedger')
    const ledgerId = 'fi:af-ra_10001'
    await getHqLedgerById({ ledgerId })
    expect(get).toHaveBeenCalledTimes(1)
    const url = get.mock.calls[0][0] as string
    expect(url).toBe(hqLedgerDetailRequestPath(ledgerId))
    expect(url).toBe('/hq-ledger/fi%3Aaf-ra_10001')
    const encodedSeg = url.slice('/hq-ledger/'.length)
    expect(decodeURIComponent(encodedSeg)).toBe(ledgerId)
  })

  it('列表与目录不走 revenue / 提现 / dividend-audit', async () => {
    const { getHqLedgerCatalog, getHqLedgerList } = await import('./hqLedger')
    await getHqLedgerCatalog({ from: '2026-11-01', to: '2026-11-20' })
    await getHqLedgerList({ page: 1, pageSize: 20, direction: 'income' })
    const urls = get.mock.calls.map((item) => item[0] as string)
    expect(urls).toEqual(['/hq-ledger/catalog', '/hq-ledger'])
    for (const url of urls) {
      expect(url).not.toMatch(/revenue|withdrawals|dividend-audit/)
    }
  })
})
