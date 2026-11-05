import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, makeCsv } from './csv'

describe('CSV 导出', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('生成含 BOM、引用文本并防范公式注入的 CSV', () => {
    expect(makeCsv([['账号', '备注'], ['=SUM(A1:A2)', '含 "引号"']])).toBe('\uFEFF"账号","备注"\r\n"\'=SUM(A1:A2)","含 ""引号"""')
  })

  it('下载 .csv 文件并在稍后释放对象 URL', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.fn()
    const anchor = { href: '', download: '', click }
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
    vi.useFakeTimers()
    downloadCsv('用户账号', [['账号'], ['u1']])
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('用户账号.csv')
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:csv')
    vi.useRealTimers()
  })
})
