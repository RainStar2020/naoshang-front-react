import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import { InvitationError, type InvitationMutation, type InvitationQuery, type InvitationTeamQuery } from '../types/invitations'
import { mockInvitationCandidates, mockInvitationDetail, mockInvitationList, mockInvitationMutate, mockInvitationTeam } from './mock/invitations'
import * as real from './real/invitations'

async function authorize(token: string, manage = false) {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'invitations:access') || (manage && !hasPermission(account, 'invitations:manage'))) throw new InvitationError('FORBIDDEN', '没有邀请关系查询或总部变更权限')
  return account
}

export const invitationsService = {
  async list(token: string, query: InvitationQuery) {
    await authorize(token)
    if (isMockAuth) return mockInvitationList(query)
    return (await real.realInvitationList(query)) as Awaited<ReturnType<typeof mockInvitationList>>
  },
  async detail(token: string, accountId: string) {
    await authorize(token)
    if (isMockAuth) return mockInvitationDetail(accountId)
    return (await real.realInvitationDetail(accountId)) as Awaited<ReturnType<typeof mockInvitationDetail>>
  },
  async team(token: string, query: InvitationTeamQuery) {
    await authorize(token)
    if (isMockAuth) return mockInvitationTeam(query)
    return (await real.realInvitationTeam(query)) as Awaited<ReturnType<typeof mockInvitationTeam>>
  },
  async candidates(token: string, accountId: string, keyword = '') {
    await authorize(token, true)
    if (isMockAuth) return mockInvitationCandidates(accountId, keyword)
    return (await real.realInvitationCandidates(accountId, keyword)) as Awaited<ReturnType<typeof mockInvitationCandidates>>
  },
  async mutate(token: string, input: InvitationMutation) {
    const account = await authorize(token, true)
    if (isMockAuth) return mockInvitationMutate(input, account)
    return (await real.realInvitationMutate(input)) as Awaited<ReturnType<typeof mockInvitationMutate>>
  },
}
