import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { mockListUsers, mockMutateUser, mockUserDetail, mockUserOptions } from './mock/users'
import type { HqPermission } from '../types/auth'
import { UserServiceError, type UserListQuery, type UserMutation } from '../types/users'
import * as real from './real/users'

async function authorize(token: string, permission: HqPermission = 'users:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'users:access') || !hasPermission(account, permission)) throw new UserServiceError('FORBIDDEN', '当前总部账号没有此操作权限')
  return account
}

/** HQ-02 服务入口；mock 模式走内存演示，api 模式走真实 HQ users API。 */
export const usersService = {
  async list(token: string, query: UserListQuery) {
    await authorize(token)
    if (isMockAuth) return mockListUsers(query)
    return (await real.realListUsers(query)) as Awaited<ReturnType<typeof mockListUsers>>
  },
  async options(token: string) {
    await authorize(token)
    if (isMockAuth) return mockUserOptions()
    return (await real.realUserOptions()) as Awaited<ReturnType<typeof mockUserOptions>>
  },
  async detail(token: string, accountId: string) {
    await authorize(token)
    if (isMockAuth) return mockUserDetail(accountId)
    return (await real.realUserDetail(accountId)) as Awaited<ReturnType<typeof mockUserDetail>>
  },
  async mutate(token: string, input: UserMutation) {
    const permissions: Record<UserMutation['action'], HqPermission> = {
      freeze: 'users:freeze',
      'change-store': 'users:change-store',
      'reset-password': 'users:reset-password',
      'change-display-id': 'users:edit-number',
    }
    const operator = await authorize(token, permissions[input.action])
    if (isMockAuth) return mockMutateUser(input, operator)
    return (await real.realMutateUser(input)) as Awaited<ReturnType<typeof mockMutateUser>>
  },
}
