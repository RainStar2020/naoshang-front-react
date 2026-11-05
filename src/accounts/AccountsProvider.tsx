import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { usersService } from '../services/users'
import type { UserAccount } from '../types/users'
import { AccountsContext, type AccountsContextValue } from './accountsContext'

const PAGE_SIZE = 200

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.token
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setAccounts([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const all: UserAccount[] = []
      let page = 1
      let total = Number.POSITIVE_INFINITY
      while (all.length < total) {
        const result = await usersService.list(token, { page, pageSize: PAGE_SIZE })
        all.push(...result.items)
        total = result.total
        if (!result.items.length) break
        page += 1
        if (page > 50) break
      }
      setAccounts(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账号列表失败')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byId = useMemo(() => {
    const map = new Map<string, UserAccount>()
    for (const account of accounts) {
      if (account.accountId) map.set(account.accountId, account)
    }
    return map
  }, [accounts])

  const getAccount = useCallback(
    (id: string | null | undefined) => {
      if (!id) return undefined
      return byId.get(id)
    },
    [byId],
  )

  const value = useMemo<AccountsContextValue>(
    () => ({ accounts, byId, loading, error, getAccount, refresh }),
    [accounts, byId, loading, error, getAccount, refresh],
  )

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
}

export function useAccounts() {
  const value = useContext(AccountsContext)
  if (!value) throw new Error('useAccounts 必须在 AccountsProvider 内使用')
  return value
}
