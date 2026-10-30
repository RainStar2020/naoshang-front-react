import type { HqLoginRequest, HqSession } from '../../types/auth'

interface SessionService {
  login(input: HqLoginRequest): Promise<HqSession>
  getSession(token: string): Promise<HqSession>
  logout(): Promise<void>
}

/** 单个登录会话的内存缓存；并发恢复共用 Promise，失败后允许重试。 */
export function cacheSession(service: SessionService) {
  let cached: HqSession | null = null
  let pending: { token: string; promise: Promise<HqSession> } | null = null
  let generation = 0
  const clearSessionCache = () => { generation++; cached = null; pending = null }
  return {
    clearSessionCache,
    async login(input: HqLoginRequest) {
      clearSessionCache()
      const current = generation
      const result = await service.login(input)
      if (current === generation) cached = result
      return result
    },
    getSession(token: string): Promise<HqSession> {
      if (cached?.token === token && Date.parse(cached.expiresAt) > Date.now()) return Promise.resolve(cached)
      if (pending?.token === token) return pending.promise
      clearSessionCache()
      const current = generation
      const promise = Promise.resolve().then(() => service.getSession(token)).then((result) => {
        if (current === generation) cached = result
        return result
      }).finally(() => { if (current === generation) pending = null })
      pending = { token, promise }
      return promise
    },
    async logout() {
      await service.logout()
      clearSessionCache()
    },
  }
}
