/** HQ-20 训练反馈代写/撤回与课时逐次核销。字段对齐小程序 feedback/*、members/records、training Mock（trainingTotal/Used、specialTotal/Used）。 */
export type FeedbackKind = 'training' | 'self-study' | 'camp'
export type FeedbackStatus = 'PUBLISHED' | 'WITHDRAWN'
export type LessonBucket = 'training' | 'special'

export interface TrainingMemberBalance {
  memberId: string
  accountId: string
  contextId: string
  displayId: string
  memberName: string
  storeId: string | null
  storeName: string | null
  /** 陪练课时总量（整数课时，非金额） */
  trainingTotal: number
  trainingUsed: number
  trainingRemaining: number
  /** 专项/集训课时 */
  specialTotal: number
  specialUsed: number
  specialRemaining: number
  version: number
  mockOnly: boolean
}

export interface TrainingFeedbackAttachment {
  assetId: string
  kind: 'image' | 'file' | 'video'
  name: string
  sizeLabel: string | null
  previewUrl: string | null
}

export interface TrainingFeedback {
  feedbackId: string
  memberId: string
  memberName: string
  displayId: string
  storeId: string | null
  storeName: string | null
  kind: FeedbackKind
  title: string
  body: string
  coachName: string
  status: FeedbackStatus
  /** coach=门店侧；hq-proxy=总部代写 */
  origin: 'coach' | 'hq-proxy'
  attachments: TrainingFeedbackAttachment[]
  createdAt: string
  withdrawnAt: string | null
  withdrawReason: string | null
  version: number
  mockOnly: boolean
}

export interface LessonConsumeRecord {
  recordId: string
  memberId: string
  memberName: string
  displayId: string
  storeId: string | null
  bucket: LessonBucket
  quantity: number
  beforeRemaining: number
  afterRemaining: number
  beforeUsed: number
  afterUsed: number
  reason: string
  operatorId: string
  operatorName: string
  requestId: string
  occurredAt: string
  beforeVersion: number
  afterVersion: number
}

export interface TrainingAudit {
  operationId: string
  requestId: string
  action: TrainingMutation['action']
  targetId: string
  before: string
  after: string
  reason: string
  operatorId: string
  operatorName: string
  occurredAt: string
  beforeVersion: number
  afterVersion: number
}

export interface TrainingBalanceQuery {
  page: number
  pageSize: number
  keyword?: string
  storeId?: string
}

export interface TrainingBalanceList {
  items: TrainingMemberBalance[]
  total: number
  page: number
  pageSize: number
  summary: {
    members: number
    trainingRemaining: number
    specialRemaining: number
    lowBalance: number
  }
}

export interface TrainingFeedbackQuery {
  page: number
  pageSize: number
  keyword?: string
  kind?: FeedbackKind
  status?: FeedbackStatus
  memberId?: string
  storeId?: string
}

export interface TrainingFeedbackList {
  items: TrainingFeedback[]
  total: number
  page: number
  pageSize: number
  summary: { feedback: number; published: number; withdrawn: number; hqProxy: number }
}

export interface TrainingCatalog {
  stores: { storeId: string; name: string }[]
  kinds: { value: FeedbackKind; label: string }[]
  buckets: { value: LessonBucket; label: string }[]
  audit: TrainingAudit[]
  mockOnly: boolean
}

export interface TrainingMemberDetail {
  balance: TrainingMemberBalance
  consumes: LessonConsumeRecord[]
  feedback: TrainingFeedback[]
  audit: TrainingAudit[]
}

export type TrainingMutation =
  | {
      action: 'proxy-feedback'
      memberId: string
      kind: FeedbackKind
      title: string
      body: string
      reason: string
      idempotencyKey: string
    }
  | {
      action: 'withdraw-feedback'
      feedbackId: string
      version: number
      reason: string
      idempotencyKey: string
    }
  | {
      action: 'consume-lessons'
      memberId: string
      bucket: LessonBucket
      quantity: number
      version: number
      reason: string
      idempotencyKey: string
    }

export type TrainingMutationResult =
  | { action: 'proxy-feedback'; feedback: TrainingFeedback; mockOnly: boolean }
  | { action: 'withdraw-feedback'; feedback: TrainingFeedback; mockOnly: boolean }
  | { action: 'consume-lessons'; balance: TrainingMemberBalance; record: LessonConsumeRecord; mockOnly: boolean }

export class TrainingError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'TrainingError'
  }
}
