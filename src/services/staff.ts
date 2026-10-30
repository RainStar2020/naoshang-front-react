import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { StaffError, type StaffMutation, type StaffQuery } from '../types/staff'
import { mockStaffCatalog, mockStaffDetail, mockStaffList, mockStaffMutate } from './mock/staff'
import * as real from './real/staff'

async function authorize(token: string, mode: 'access' | 'roles' | 'manage' = 'access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'staff:access')) throw new StaffError('FORBIDDEN', '没有员工角色与权限查询权限')
  if (mode === 'roles' && !hasPermission(account, 'staff:roles')) throw new StaffError('FORBIDDEN', '没有门店角色字典维护权限')
  if (mode === 'manage' && !hasPermission(account, 'staff:manage')) throw new StaffError('FORBIDDEN', '没有员工任职管理权限')
  return account
}

export const staffService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockStaffCatalog()
    return (await real.realStaffCatalog()) as Awaited<ReturnType<typeof mockStaffCatalog>>
  },
  async list(token: string, query: StaffQuery) {
    await authorize(token)
    if (isMockAuth) return mockStaffList(query)
    return (await real.realStaffList(query)) as Awaited<ReturnType<typeof mockStaffList>>
  },
  async detail(token: string, assignmentId: string) {
    await authorize(token)
    if (isMockAuth) return mockStaffDetail(assignmentId)
    return (await real.realStaffDetail(assignmentId)) as Awaited<ReturnType<typeof mockStaffDetail>>
  },
  async mutate(token: string, input: StaffMutation) {
    const mode = input.action === 'save-role' ? 'roles' : 'manage'
    const account = await authorize(token, mode)
    if (isMockAuth) return mockStaffMutate(input, account)
    return (await real.realStaffMutate(input)) as Awaited<ReturnType<typeof mockStaffMutate>>
  },
}
