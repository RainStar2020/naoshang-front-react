import { describe, expect, it } from 'vitest'
import { actionLabel, displayText, enumLabel, fieldLabel } from './hqLabels'

describe('hqLabels 字典层', () => {
  it('字段表头优先中文，查不到回退 key', () => {
    expect(fieldLabel('ownerType')).toBe('归属类型')
    expect(fieldLabel('standard')).toBe('标准名额')
    expect(fieldLabel('activityTotal')).toBe('活动名额合计')
    expect(fieldLabel('unknownCamelCase')).toBe('unknownCamelCase')
  })

  it('枚举按字段优先，再回退全局', () => {
    expect(enumLabel('ownerType', 'partner')).toBe('合伙人')
    expect(enumLabel('status', 'ACTIVE')).toBe('生效')
    expect(enumLabel(undefined, 'ACTIVE')).toBe('生效')
    expect(enumLabel('status', 'TOTALLY_UNKNOWN')).toBeUndefined()
  })

  it('displayText 带字段上下文映射枚举', () => {
    expect(displayText('partner', 'ownerType')).toBe('合伙人')
    expect(displayText('ACTIVE', 'status')).toBe('生效')
    expect(displayText(true)).toBe('是')
    expect(displayText(null)).toBe('—')
    expect(displayText('RAW_VALUE', 'status')).toBe('RAW_VALUE')
  })

  it('actionLabel 回退原文', () => {
    expect(actionLabel('freeze')).toBe('冻结')
    expect(actionLabel('custom-op')).toBe('custom-op')
  })
})

 describe('HQ 返回值展示', () => {
  it('保留与枚举同名的用户文本和标识', () => {
    expect(displayText('ACTIVE', 'nickname')).toBe('ACTIVE')
    expect(displayText('partner', 'accountId')).toBe('partner')
    expect(displayText('published', 'title')).toBe('published')
  })
  it('映射实际档位、金额表头及数组枚举', () => {
    expect(displayText('private', 'tier')).toBe('私董')
    expect(displayText('coach', 'roles')).toBe('健脑官')
    expect(displayText('REVOKED', 'entitlementStatus')).toBe('已撤销')
    expect(fieldLabel('availableBalance')).toBe('可用余额（元）')
    expect(fieldLabel('sourceStoreName')).toBe('转出门店名称')
  })
})
