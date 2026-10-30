import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { TrainingError, type TrainingBalanceQuery, type TrainingFeedbackQuery, type TrainingMutation } from '../types/training'
import { mockTrainingBalances, mockTrainingCatalog, mockTrainingFeedbackDetail, mockTrainingFeedbackList, mockTrainingMemberDetail, mockTrainingMutate } from './mock/training'
import * as real from './real/training'

async function authorize(token: string, permission: HqPermission = 'training:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'training:access') || !hasPermission(account, permission)) {
    throw new TrainingError('FORBIDDEN', '没有训练反馈或课时核销查询/操作权限')
  }
  return account
}

export const trainingService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockTrainingCatalog()
    return (await real.realTrainingCatalog()) as Awaited<ReturnType<typeof mockTrainingCatalog>>
  },
  async balances(token: string, query: TrainingBalanceQuery) {
    await authorize(token)
    if (isMockAuth) return mockTrainingBalances(query)
    return (await real.realTrainingBalances(query)) as Awaited<ReturnType<typeof mockTrainingBalances>>
  },
  async feedbackList(token: string, query: TrainingFeedbackQuery) {
    await authorize(token)
    if (isMockAuth) return mockTrainingFeedbackList(query)
    return (await real.realTrainingFeedbackList(query)) as Awaited<ReturnType<typeof mockTrainingFeedbackList>>
  },
  async memberDetail(token: string, memberId: string) {
    await authorize(token)
    if (isMockAuth) return mockTrainingMemberDetail(memberId)
    return (await real.realTrainingMemberDetail(memberId)) as Awaited<ReturnType<typeof mockTrainingMemberDetail>>
  },
  async feedbackDetail(token: string, feedbackId: string) {
    await authorize(token)
    if (isMockAuth) return mockTrainingFeedbackDetail(feedbackId)
    return (await real.realTrainingFeedbackDetail(feedbackId)) as Awaited<ReturnType<typeof mockTrainingFeedbackDetail>>
  },
  async mutate(token: string, input: TrainingMutation) {
    const permission: HqPermission = input.action === 'consume-lessons' ? 'training:consume' : 'training:feedback'
    const account = await authorize(token, permission)
    if (isMockAuth) return mockTrainingMutate(input, account)
    return (await real.realTrainingMutate(input)) as Awaited<ReturnType<typeof mockTrainingMutate>>
  },
}
