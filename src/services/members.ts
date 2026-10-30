import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { MemberServiceError, type EntitlementAction, type EntitlementMutation, type MemberProfileMutation, type MemberQuery } from '../types/members'
import { mockMemberDetail, mockMemberMutation, mockMemberOptions, mockMemberProfileMutation, mockMembers } from './mock/members'
import * as real from './real/members'

async function authorize(token: string, permission: HqPermission = 'members:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'members:access') || !hasPermission(account, permission)) throw new MemberServiceError('FORBIDDEN', '当前总部账号没有学员查询或此权益操作权限')
  return account
}

export const membersService = {
  async list(token: string, query: MemberQuery) {
    await authorize(token)
    if (isMockAuth) return mockMembers(query)
    return (await real.realMembers(query)) as Awaited<ReturnType<typeof mockMembers>>
  },
  async options(token: string) {
    await authorize(token)
    if (isMockAuth) return mockMemberOptions()
    return (await real.realMemberOptions()) as Awaited<ReturnType<typeof mockMemberOptions>>
  },
  async detail(token: string, memberId: string) {
    await authorize(token)
    if (isMockAuth) return mockMemberDetail(memberId)
    return (await real.realMemberDetail(memberId)) as Awaited<ReturnType<typeof mockMemberDetail>>
  },
  async mutate(token: string, input: EntitlementMutation) {
    const permissions: Record<EntitlementAction, HqPermission> = { grant: 'members:grant', revoke: 'members:revoke', restore: 'members:restore' }
    const operator = await authorize(token, permissions[input.action])
    if (isMockAuth) return mockMemberMutation(input, operator)
    return (await real.realMemberMutation(input)) as Awaited<ReturnType<typeof mockMemberMutation>>
  },
  /** 档案写：绑店/解绑/改资料/设状态（权限复用 members:access）。 */
  async profileMutate(token: string, input: MemberProfileMutation) {
    const operator = await authorize(token, 'members:access')
    if (isMockAuth) return mockMemberProfileMutation(input, operator)
    return (await real.realMemberProfileMutation(input)) as Awaited<ReturnType<typeof mockMemberProfileMutation>>
  },
}
