import { createContext } from 'react'
import type { UserAccount } from '../types/users'

export type AccountsContextValue = {
  accounts: UserAccount[]
  byId: Map<string, UserAccount>
  loading: boolean
  error: string | null
  getAccount: (id: string | null | undefined) => UserAccount | undefined
  refresh: () => Promise<void>
}

/** Keep createContext in this leaf module so HMR of provider/pages cannot duplicate the context object. */
export const AccountsContext = createContext<AccountsContextValue | null>(null)
