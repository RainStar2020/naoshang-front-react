// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Agents from './Agents'
import { regionalAgencyApi as api } from '../api/regionalAgency'
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ session: { account: {} } }) }))
vi.mock('../auth/access', () => ({ hasPermission: () => true }))
vi.mock('../services/auth', () => ({ isMockAuth: false }))
vi.mock('../api/regionalAgency', () => ({ regionalAgencyApi: { list: vi.fn(), detail: vi.fn(), applications: vi.fn(), check: vi.fn(), appoint: vi.fn(), decide: vi.fn() } }))
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const computedStyle = window.getComputedStyle
  window.getComputedStyle = element => computedStyle(element)
})
afterEach(() => { cleanup(); vi.clearAllMocks() })
const assignment = { assignmentId: 'ra1', regionType: 'district' as const, regionCode: '330106', regionName: '浙江省杭州市西湖区', parentCode: null, status: 'DISABLED' as const, agent: { accountId: '001', name: '代理甲', phone: '13800008000', tier: 'private' }, referrer: null, upline: null, appointedAt: null, lastLoginAt: null, version: 1 }
describe('区域代理页面', () => {
  it('展示真实任命字段、中文状态，详情读取真实任命主键', async () => {
    vi.mocked(api.list).mockResolvedValue({ items: [assignment], total: 1, page: 1, pageSize: 20 })
    vi.mocked(api.detail).mockResolvedValue({ assignment, otherAssignments: [], childType: 'store', items: [], total: 0, page: 1, pageSize: 20 })
    render(<Agents />)
    await screen.findByText('代理甲')
    expect(screen.getByText('停用')).toBeTruthy()
    expect(screen.getByText('13800008000 · 私董')).toBeTruthy()
    expect(screen.getByText('浙江省杭州市西湖区')).toBeTruthy()
    expect(screen.queryByText('关闭区域独占')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '详情' }))
    await waitFor(() => expect(api.detail).toHaveBeenCalledWith('ra1', 1, 10))
    await screen.findByText('直属单店代理')
  })
  it('未填写原因和到账确认时不能提交任命', async () => {
    vi.mocked(api.list).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    render(<Agents />)
    fireEvent.click(screen.getByRole('button', { name: '总部直接任命' }))
    fireEvent.click(screen.getByRole('button', { name: '核对任命' }))
    await screen.findByText('请确认线下款项已实际到账')
    expect(api.appoint).not.toHaveBeenCalled()
  })
})
