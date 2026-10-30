import { describe, expect, it } from 'vitest'
import { formatProfitYuan, isSaleBelowCost, profitFen, yuanFromFen, fenFromYuan } from './productPricing'
import { assertProductContentAllowsSave, findForbiddenProductMedia } from './productContent'
import { fulfillmentTypes } from '../types/products'

describe('productPricing', () => {
  it('分↔元与盈利计算', () => {
    expect(yuanFromFen(19900)).toBe(199)
    expect(fenFromYuan(12.34)).toBe(1234)
    expect(profitFen(19900, 4200)).toBe(15700)
    expect(formatProfitYuan(19900, 4200)).toBe('157.00')
    expect(formatProfitYuan(1000, 5000)).toBe('-40.00')
    expect(isSaleBelowCost(1000, 5000)).toBe(true)
    expect(isSaleBelowCost(5000, 1000)).toBe(false)
  })
})

describe('productContent 禁视频', () => {
  it('检出 video 并在 assert 时抛错', () => {
    const bad = { version: 1, format: 'nodes', nodes: [{ name: 'video', attrs: {}, children: [] }] }
    expect(findForbiddenProductMedia(bad)).toBe('video')
    expect(() => assertProductContentAllowsSave(bad)).toThrow(/图片/)
    expect(findForbiddenProductMedia({ version: 1, format: 'nodes', nodes: [{ name: 'img', attrs: { src: 'https://a.test/x.png' }, children: [] }] })).toBeNull()
  })
})

describe('履约类型枚举', () => {
  it('仅四类且不含 VIRTUAL/MEMBERSHIP', () => {
    expect([...fulfillmentTypes]).toEqual(['PHYSICAL', 'ACTIVATION_CODE', 'OFFLINE_SERVICE', 'COLUMN_ACCESS'])
  })
})