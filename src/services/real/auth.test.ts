import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiClient, setApiToken } from '../../api/client'
import { realAuthService } from './auth'

const adapter = apiClient.defaults.adapter
const admin = { adminId: 'admin', username: 'admin', displayName: '总部/后台', role: 'admin' }
const expiresAt = new Date(Date.now() + 3600000).toISOString()
afterEach(() => { apiClient.defaults.adapter = adapter; setApiToken(null) })

function respond(data: unknown) {
  apiClient.defaults.adapter = async (config) => ({ config, data: { code: 0, message: 'ok', data }, status: 200, statusText: 'OK', headers: new AxiosHeaders() })
}

describe('真实总部认证适配', () => {
  it('将登录表单转换为后端 username 并适配现有会话', async () => {
    apiClient.defaults.adapter = async (config) => {
      expect(JSON.parse(config.data)).toEqual({ username: 'admin', password: 'example' })
      return { config, data: { code: 0, message: 'ok', data: { token: 'real-token', admin, expiresAt } }, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
    }
    const result = await realAuthService.login({ loginAccount: 'admin', password: 'example' })
    expect(result.account).toMatchObject({ accountId: 'admin', nickname: '总部/后台', headquartersAuthorized: true })
    expect(result.account.permissions).toContain('users:access')
    expect(JSON.stringify(result)).not.toContain('example')
  })

  it('从 me 的 tokenExpiresAt 恢复会话，空 hqPermissions 不影响当前 admin 导航', async () => {
    respond({ ...admin, hqPermissions: [], status: 'ACTIVE', version: 1, tokenExpiresAt: expiresAt })
    expect((await realAuthService.getSession('real-token')).expiresAt).toBe(expiresAt)
  })

  it('拒绝服务端停用的账号', async () => {
    respond({ ...admin, status: 'DISABLED', tokenExpiresAt: expiresAt })
    await expect(realAuthService.getSession('token')).rejects.toMatchObject({ code: 'ACCOUNT_FROZEN' })
  })

  it('过期会话不会恢复', async () => {
    respond({ ...admin, status: 'ACTIVE', tokenExpiresAt: '2000-01-01T00:00:00Z' })
    await expect(realAuthService.getSession('token')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })

  it('错误密码映射为登录错误；失效 token 映射为会话错误', async () => {
    apiClient.defaults.adapter = async (config) => ({ config, data: { code: 40100, message: 'unauthorized', data: null }, status: 200, statusText: 'OK', headers: new AxiosHeaders() })
    await expect(realAuthService.login({ loginAccount: 'admin', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(realAuthService.getSession('expired')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(realAuthService.logout()).resolves.toBeUndefined()
  })

  it('网络故障保留会话供界面重试', async () => {
    apiClient.defaults.adapter = async () => { throw new AxiosError('offline', 'ERR_NETWORK') }
    await expect(realAuthService.getSession('token')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    await expect(realAuthService.logout()).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })
})
