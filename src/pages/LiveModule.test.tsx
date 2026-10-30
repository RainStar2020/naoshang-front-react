// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AxiosHeaders } from 'axios'
import { apiClient } from '../api/client'
import LiveModulePage from './LiveModule'

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ session: { token: 'ui-test', account: { accountId: 'admin' } } }) }))

const adapter = apiClient.defaults.adapter
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
  // Ant Design measures scrolling; jsdom does not implement pseudo-element styles.
  const computedStyle = window.getComputedStyle
  window.getComputedStyle = (element) => computedStyle(element)
})
afterEach(() => { cleanup(); apiClient.defaults.adapter = adapter })

function open(path = '/users') {
  return render(<MemoryRouter initialEntries={[path]}><LiveModulePage /></MemoryRouter>)
}

describe('真实业务页面（本地适配器测试，不访问后台）', () => {
  it('加载真实服务返回的账号记录并通过详情接口读取档案', async () => {
    apiClient.defaults.adapter = async (config) => ({
      config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
      data: { code: 0, message: 'ok', data: config.url === '/users'
        ? { items: [{ accountId: 'live-user', nickname: '接口返回用户', frozen: false }], total: 1, page: 1, pageSize: 20 }
        : { profile: { accountId: 'live-user', nickname: '真实详情档案' } } },
    })
    open()
    await screen.findByText('接口返回用户')
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }))
    await screen.findByText('档案')
    fireEvent.click(screen.getByText('档案'))
    await screen.findByText('真实详情档案')
    expect(screen.queryByText('林晓雅')).toBeNull()
  })

  it('空数据正常显示，不填入演示记录', async () => {
    apiClient.defaults.adapter = async (config) => ({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 0, message: 'ok', data: { items: [], total: 0, page: 1, pageSize: 20 } } })
    open('/announcements')
    await screen.findByText('后端当前未返回记录；这不代表接口异常。')
    expect(screen.getAllByText('共 0 条').length).toBeGreaterThan(0)
  })

  it('读取失败显式显示错误，不回退 mock', async () => {
    apiClient.defaults.adapter = async (config) => ({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 50000, message: '测试：后台不可用', data: null } })
    open('/products')
    await screen.findByText('测试：后台不可用')
    expect(screen.getByText('请求失败，请重试')).toBeTruthy()
  })

  it('写操作必须核对，取消核对不会发送 POST', async () => {
    let writes = 0
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'post') writes++
      return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 0, message: 'ok', data: { items: [], total: 0, page: 1, pageSize: 20 } } }
    }
    open()
    await screen.findByText('后端当前未返回记录；这不代表接口异常。')
    fireEvent.click(screen.getByRole('button', { name: '账号写操作' }))
    fireEvent.change(screen.getByLabelText('账号 ID'), { target: { value: 'target-user' } })
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '本地测试' } })
    fireEvent.click(screen.getByRole('button', { name: '核对并提交' }))
    await screen.findByText('确认执行真实后台操作')
    expect(writes).toBe(0)
    fireEvent.click(await screen.findByRole('button', { name: /取\s*消/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '确认执行真实后台操作' })).toBeNull())
    expect(writes).toBe(0)
  })

  it('后端没有代理模块时不渲染旧演示页', () => {
    open('/agents')
    expect(screen.getByText('后端文档尚未提供该模块的接口，暂不开放演示操作。')).toBeTruthy()
  })

  it('确认后发送一次真实格式的请求并显示操作回执', async () => {
    const writes: unknown[] = []
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        writes.push(JSON.parse(config.data))
        expect(config.url).toBe('/users/target-user/mutate')
        expect(config.headers.get('Authorization')).toBe('Bearer ui-test')
      }
      return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 0, message: 'ok', data: config.method === 'post'
        ? { operationId: 'receipt-ui-success' } : { items: [], total: 0, page: 1, pageSize: 20 } } }
    }
    open()
    await screen.findByText('后端当前未返回记录；这不代表接口异常。')
    fireEvent.click(screen.getByRole('button', { name: '账号写操作' }))
    fireEvent.change(screen.getByLabelText('账号 ID'), { target: { value: 'target-user' } })
    fireEvent.change(screen.getByLabelText('操作原因'), { target: { value: '本地核对测试' } })
    fireEvent.click(screen.getByRole('button', { name: '核对并提交' }))
    fireEvent.click(await screen.findByRole('button', { name: '确认提交' }))
    await screen.findByText('receipt-ui-success')
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ action: 'freeze', reason: '本地核对测试', idempotencyKey: expect.any(String) })
  })

  it('配额列表表头与枚举走字典中文，不再直接露 camelCase / ACTIVE', async () => {
    apiClient.defaults.adapter = async (config) => ({
      config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
      data: {
        code: 0, message: 'ok',
        data: {
          items: [{
            quotaId: 'q-1',
            ownerType: 'partner',
            ownerId: 'p-1',
            standard: 10,
            activityTotal: 3,
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00Z',
          }],
          total: 1, page: 1, pageSize: 20,
        },
      },
    })
    open('/quotas')
    await screen.findByText('合伙人')
    // antd Table 会为测量再渲染一份表头文案，用 AllBy
    expect(screen.getAllByText('归属类型').length).toBeGreaterThan(0)
    expect(screen.getAllByText('标准名额').length).toBeGreaterThan(0)
    expect(screen.getAllByText('活动名额合计').length).toBeGreaterThan(0)
    expect(screen.getAllByText('生效').length).toBeGreaterThan(0)
    expect(screen.queryByText('ownerType')).toBeNull()
    expect(screen.queryByText('activityTotal')).toBeNull()
    // 枚举原文不应作为单元格主文案出现
    expect(screen.queryByText('ACTIVE')).toBeNull()
  })

})
