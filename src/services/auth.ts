import { mockGetSession, mockLogin, mockLogout } from './mock/auth'
import type { HqLoginRequest, HqSession } from '../types/auth'
import { realAuthService } from './real/auth'
import { cacheSession } from './real/sessionCache'

/** 只有显式 mock 模式使用演示会话，开发环境默认连接真实服务。 */
export const isMockAuth = import.meta.env.VITE_HQ_AUTH_MODE === 'mock'
const mockAuthService = {
  login: (input: HqLoginRequest): Promise<HqSession> => mockLogin(input),
  getSession: (token: string): Promise<HqSession> => mockGetSession(token),
  logout: (): Promise<void> => mockLogout(),
}
const cachedRealAuthService = cacheSession(realAuthService)
export const clearSessionCache = cachedRealAuthService.clearSessionCache
export const authService = isMockAuth ? mockAuthService : cachedRealAuthService
