import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { mockBindUserStore, mockListUsers, mockMutateUser, mockUnbindUserStore, mockUserDetail, mockUserOptions, mockUserStoreBinding } from './mock/users'
import type { HqPermission } from '../types/auth'
import { UserServiceError, type UserListQuery, type UserMutation, type UserStoreBindInput, type UserStoreUnbindInput } from '../types/users'
import * as real from './real/users'

async function authorize(token: string, permission: HqPermission = 'users:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'users:access') || !hasPermission(account, permission)) throw new UserServiceError('FORBIDDEN', '当前总部账号没有此操作权限')
  return account
}

/** 查绑：users:access 或 members:access（孩子档案只读跟随家长）。写绑/解绑：仅 users:access + users:change-store（用户账号页）。 */
async function authorizeStoreBinding(token: string, write: boolean) {
  const { account } = await authService.getSession(token)
  const viaUsersRead = hasPermission(account, 'users:access')
  const viaUsersWrite = viaUsersRead && hasPermission(account, 'users:change-store')
  const viaMembersRead = hasPermission(account, 'members:access')
  if (write) {
    if (!viaUsersWrite) throw new UserServiceError('FORBIDDEN', '当前总部账号没有门店绑定操作权限')
  } else if (!viaUsersRead && !viaMembersRead) {
    throw new UserServiceError('FORBIDDEN', '当前总部账号没有门店绑定查询权限')
  }
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
  /** HQ §5 查询指定用户门店绑定与可选门店（含 HQ）。只读：users:access 或 members:access。 */
  async getStoreBinding(token: string, accountId: string) {
    await authorizeStoreBinding(token, false)
    if (isMockAuth) return mockUserStoreBinding(accountId)
    return (await real.realUserStoreBinding(accountId)) as Awaited<ReturnType<typeof mockUserStoreBinding>>
  },
  /** HQ §5 绑定/更换门店；一人一店，重复绑定覆盖。 */
  async bindStore(token: string, input: UserStoreBindInput) {
    await authorizeStoreBinding(token, true)
    if (isMockAuth) return mockBindUserStore(input)
    return (await real.realBindUserStore(input)) as Awaited<ReturnType<typeof mockBindUserStore>>
  },
  /** HQ §5 解绑门店。 */
  async unbindStore(token: string, input: UserStoreUnbindInput) {
    await authorizeStoreBinding(token, true)
    if (isMockAuth) return mockUnbindUserStore(input)
    return (await real.realUnbindUserStore(input)) as Awaited<ReturnType<typeof mockUnbindUserStore>>
  },
}
