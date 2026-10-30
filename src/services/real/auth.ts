import { getAuthMe, postAuthLogin, postAuthLogout } from '../../api/auth'
import { ApiError } from '../../api/client'
import { AuthError, hqPermissions, type HqLoginRequest, type HqSession } from '../../types/auth'
import type { Admin } from '../../types/hq/auth'

function session(token: string, expiresAt: string, admin: Admin): HqSession {
  if (!token || admin.role !== 'admin' || !Number.isFinite(Date.parse(expiresAt))) {
    throw new AuthError('HQ_REQUIRED', '服务端返回的总部会话无效')
  }
  if (Date.parse(expiresAt) <= Date.now()) throw new AuthError('SESSION_EXPIRED', '登录已过期，请重新登录')
  return {
    token,
    expiresAt,
    account: {
      accountId: admin.adminId,
      nickname: admin.displayName,
      headquartersAuthorized: true,
      status: 'active',
      // 当前后端只有 admin 会话；hqPermissions 尚非权限门槛。
      // 此映射只控制前端导航，真实操作仍由后端鉴权。
      permissions: [...hqPermissions],
    },
  }
}

function authError(error: unknown, login = false): never {
  if (error instanceof AuthError) throw error
  if (error instanceof ApiError) {
    if (error.code === 40100) throw new AuthError(login ? 'INVALID_CREDENTIALS' : 'SESSION_EXPIRED', error.message)
    if (error.code === 40300) throw new AuthError('HQ_REQUIRED', error.message)
  }
  throw new AuthError('UNAVAILABLE', error instanceof Error ? error.message : '暂时无法连接总部服务')
}

/** 真实总部会话适配：兼容现有登录表单与页面的 HqSession。 */
export const realAuthService = {
  async login(input: HqLoginRequest): Promise<HqSession> {
    try {
      const result = await postAuthLogin({ username: input.loginAccount, password: input.password })
      if (result.code !== 0) throw new ApiError(result)
      return session(result.data.token, result.data.expiresAt, result.data.admin)
    } catch (error) { return authError(error, true) }
  },
  async getSession(token: string): Promise<HqSession> {
    if (!token) throw new AuthError('SESSION_EXPIRED', '请先登录总部账号')
    try {
      const result = await getAuthMe(undefined, { headers: { Authorization: `Bearer ${token}` } })
      if (result.code !== 0) throw new ApiError(result)
      if (result.data.status !== 'ACTIVE') throw new AuthError('ACCOUNT_FROZEN', '总部账号已停用')
      return session(token, result.data.tokenExpiresAt, result.data)
    } catch (error) { return authError(error) }
  },
  async logout(): Promise<void> {
    try {
      const result = await postAuthLogout({})
      if (result.code !== 0) throw new ApiError(result)
    } catch (error) {
      // 服务端已撤销的会话可以直接清理本地状态。
      if (error instanceof ApiError && error.code === 40100) return
      authError(error)
    }
  },
}
