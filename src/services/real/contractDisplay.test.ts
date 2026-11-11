import { describe, it, expect } from 'vitest'
import { mapAgent } from './agents'
import { mapStaffAssignment } from './staff'
import { displayText } from '../../i18n/hqLabels'

describe('最新总部契约展示', () => {
  it('停用代理不回退为有效，保留辖区名称，不伪造档位', () => {
    const agent = mapAgent({ agentId: 'a', status: 'DISABLED', region: '北京市', allowedActions: [] })
    expect(agent.status).toBe('DISABLED')
    expect(agent.region).toBe('北京市')
    expect(agent.levelLabel).toBe('')
    expect(agent.allowedActions).toEqual([])
  })
  it('停用员工不显示为有效，角色使用返回列表', () => {
    const staff = mapStaffAssignment({ staffId: 's', status: 'DISABLED', roles: ['coach'] })
    expect(staff.status).toBe('FROZEN')
    expect(staff.roleTitle).toBe('健脑官')
    expect(mapStaffAssignment({ staffId: 's' }).roleTitle).toBe('')
  })
  it('支付及商品状态显示中文，普通文本不被误翻译', () => {
    expect(displayText('REFUNDING', 'paymentStatus')).toBe('退款中')
    expect(displayText('PAID', 'status')).toBe('已支付')
    expect(displayText('ON_SALE', 'status')).toBe('上架')
    expect(displayText('PAID', 'nickname')).toBe('PAID')
  })
})
