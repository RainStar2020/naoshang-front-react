import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '../services/auth'
import { allowedReturnPath, firstAllowedPath, hasPermission } from './access'

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.useRealTimers()
})
const login = (loginAccount = 'hq-admin', password = 'Demo@123456') => authService.login({ loginAccount, password })

describe('总部身份与会话', () => {
  it('总部账号可登录，响应不包含密码', async () => {
    const session = await login()
    expect(session.account.headquartersAuthorized).toBe(true)
    expect(JSON.stringify(session)).not.toContain('Demo@123456')
    expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now())
  })
  it('拒绝错误密码', async () => {
    await expect(login('hq-admin', 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })
  it('业务身份不能替代总部授权', async () => {
    await expect(login('partner')).rejects.toMatchObject({ code: 'HQ_REQUIRED' })
  })
  it('冻结账号无法登录', async () => {
    await expect(login('hq-frozen')).rejects.toMatchObject({ code: 'ACCOUNT_FROZEN' })
  })
  it('恢复有效会话', async () => {
    const session = await login()
    expect(await authService.getSession(session.token)).toEqual(session)
  })
  it('拒绝伪造或被替换的 token', async () => {
    const old = await login()
    await login('hq-content')
    await expect(authService.getSession(old.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('过期会话不能恢复', async () => {
    vi.useFakeTimers()
    const session = await login()
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    await expect(authService.getSession(session.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('退出撤销会话', async () => {
    const session = await login()
    await authService.logout()
    await expect(authService.getSession(session.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('缓存损坏时拒绝会话', async () => {
    sessionStorage.setItem('naoshang:hq:mock-session:v1', '{broken')
    await expect(authService.getSession('token')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('不信任缓存中的权限', async () => {
    const session = await login('hq-content')
    session.account.permissions.push('revenue:access')
    sessionStorage.setItem('naoshang:hq:mock-session:v1', JSON.stringify(session))
    const restored = await authService.getSession(session.token)
    expect(hasPermission(restored.account, 'revenue:access')).toBe(false)
  })
})

describe('菜单和路由共用的权限规则', () => {
  it('内容账号可访问课程，不能访问收益', async () => {
    const { account } = await login('hq-content')
    expect(hasPermission(account, 'course:access')).toBe(true)
    expect(hasPermission(account, 'revenue:access')).toBe(false)
  })
  it('拒绝无会话、无总部资格和冻结状态', async () => {
    const { account } = await login()
    expect(hasPermission(null, 'course:access')).toBe(false)
    expect(hasPermission({ ...account, headquartersAuthorized: false }, 'course:access')).toBe(false)
    expect(hasPermission({ ...account, status: 'frozen' }, 'course:access')).toBe(false)
  })
  it('无权限账号进入 403，避免重定向回环', async () => {
    const { account } = await login('hq-empty')
    expect(firstAllowedPath(account)).toBe('/forbidden')
  })
  it('登录回跳仅接受获授权站内路由', async () => {
    const { account } = await login('hq-content')
    expect(allowedReturnPath('/materials', account)).toBe('/materials')
    for (const path of ['/revenue', '//evil.test', 'https://evil.test', '/login', undefined]) {
      expect(allowedReturnPath(path, account)).toBe('/course')
    }
  })
})
