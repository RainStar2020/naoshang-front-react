import { describe, expect, it, vi } from 'vitest'
import { cacheSession } from './sessionCache'
import type { HqSession } from '../../types/auth'

const session = (token: string): HqSession => ({ token, expiresAt: new Date(Date.now() + 60000).toISOString(), account: { accountId: token, nickname: 'admin', headquartersAuthorized: true, status: 'active', permissions: [] } })
function setup() {
  const service = { login: vi.fn(async () => session('a')), getSession: vi.fn(async (token: string) => session(token)), logout: vi.fn(async () => {}) }
  return { service, cache: cacheSession(service) }
}
describe('共享会话缓存', () => {
  it('登录后各页面读取与聚焦恢复不再请求用户信息', async () => {
    const { service, cache } = setup()
    await cache.login({ loginAccount: 'admin', password: 'test' })
    await cache.getSession('a'); await cache.getSession('a')
    expect(service.getSession).not.toHaveBeenCalled()
  })
  it('刷新恢复的并发请求只发送一次', async () => {
    const { service, cache } = setup()
    await Promise.all([cache.getSession('a'), cache.getSession('a'), cache.getSession('a')])
    expect(service.getSession).toHaveBeenCalledTimes(1)
  })
  it('账号切换、退出与主动清理使缓存失效', async () => {
    const { service, cache } = setup()
    await cache.getSession('a'); await cache.getSession('b')
    await cache.logout(); await cache.getSession('b')
    cache.clearSessionCache(); await cache.getSession('b')
    expect(service.getSession).toHaveBeenCalledTimes(4)
  })
  it('请求失败不缓存，允许重试', async () => {
    const { service, cache } = setup()
    service.getSession.mockRejectedValueOnce(new Error('offline'))
    await expect(cache.getSession('a')).rejects.toThrow('offline')
    await cache.getSession('a')
    expect(service.getSession).toHaveBeenCalledTimes(2)
  })
})
