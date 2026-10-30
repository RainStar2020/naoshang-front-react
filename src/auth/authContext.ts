import { createContext } from 'react'
import type { HqLoginRequest, HqSession } from '../types/auth'

export interface AuthContextValue {
  session: HqSession | null
  loading: boolean
  error: string | null
  notice: string | null
  login: (input: HqLoginRequest) => Promise<HqSession>
  logout: () => Promise<void>
  retry: () => Promise<void>
}

/** Keep createContext in this leaf module so HMR of AuthProvider/pages cannot duplicate the context object. */
export const AuthContext = createContext<AuthContextValue | null>(null)
