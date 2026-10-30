import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { authService, clearSessionCache } from '../services/auth'
import { AuthError, type HqLoginRequest, type HqSession } from '../types/auth'
import { setApiTokenProvider } from '../api/client'
import { AuthContext, type AuthContextValue } from './authContext'

const TOKEN_KEY = 'naoshang:hq:token:v1'
setApiTokenProvider(() => sessionStorage.getItem(TOKEN_KEY))
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<HqSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const generation = useRef(0)
  const clear = useCallback((message: string | null = null) => {
    generation.current++
    clearSessionCache()
    sessionStorage.removeItem(TOKEN_KEY)
    setSession(null)
    setNotice(message)
    setLoading(false)
  }, [])

  const restore = useCallback(async () => {
    const current = ++generation.current
    setError(null)
    try {
      const token = sessionStorage.getItem(TOKEN_KEY)
      const result = token ? await authService.getSession(token) : null
      if (generation.current === current) setSession(result)
    } catch (err) {
      if (generation.current !== current) return
      if (err instanceof AuthError && err.code !== 'UNAVAILABLE') clear(err.message)
      else setError('暂时无法验证总部会话，请重试')
    } finally { if (generation.current === current) setLoading(false) }
  }, [clear])

  useEffect(() => { void restore() }, [restore])
  useEffect(() => {
    if (!session) return
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (!Number.isFinite(remaining) || remaining <= 0) { clear('登录已过期，请重新登录'); return }
    const timer = window.setTimeout(() => clear('登录已过期，请重新登录'), Math.min(remaining, 2147483647))
    const onFocus = () => { void restore() }
    window.addEventListener('focus', onFocus)
    return () => { clearTimeout(timer); window.removeEventListener('focus', onFocus) }
  }, [session, clear, restore])

  const login = async (input: HqLoginRequest) => {
    const result = await authService.login(input)
    generation.current++
    sessionStorage.setItem(TOKEN_KEY, result.token)
    setSession(result)
    setNotice(null)
    setError(null)
    return result
  }
  const logout = async () => {
    // 先撤销服务会话，再清空客户端；失败时保留会话供重试。
    await authService.logout()
    clear()
  }
  return <AuthContext.Provider value={{ session, loading, error, notice, login, logout, retry: restore }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}
