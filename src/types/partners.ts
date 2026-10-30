import type { RichContent } from './cms'
export const partnerLevels = ['DEMO-VIP', 'DEMO-ANGEL', 'DEMO-BOARD', 'DEMO-FOUNDER'] as const
export type PartnerLevel = typeof partnerLevels[number]
/** 稳定编码 DEMO-*；title 为可配置展示名（默认 VIP/天使/私董/联创）。 */
export interface PartnerLevelBenefits { partnerLevel: PartnerLevel; title: string; wholesaleLabel: string; quotaOccupancy: number; nextLevel: PartnerLevel | null; taskTarget: number | null; summary: string; content: RichContent; version: number }
export interface PartnerPromotionTask { taskId: string; version: number; beforeLevel: PartnerLevel; targetLevel: PartnerLevel; progress: number; target: number; canClaim: boolean; startedAt: string; validUntil: string; status: 'IN_PROGRESS' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'EXPIRED' | 'SUPERSEDED'; qualificationNote: string }
export interface PartnerProfile { contextId: string; accountId: string; displayId: string; name: string; phone: string; partnerLevel: PartnerLevel; partnerStatus: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'PENDING_ANNUAL'; frozen: boolean; annualStatus: 'ACTIVE' | 'EXPIRED' | 'NOT_OPEN'; annualValidUntil: string | null; annualFeeAmount: 20000; superior: { accountId: string; contextId: string | null; name: string } | null; version: number; allowedActions: ('manual-upgrade' | 'claim-promotion')[]; allowedTargetLevels: PartnerLevel[]; task: PartnerPromotionTask | null }
export interface PartnerReceipt { receiptId: string; requestId: string; contextId: string; accountId: string; source: 'HQ_MANUAL' | 'USER_TASK'; taskId: string | null; beforeLevel: PartnerLevel; targetLevel: PartnerLevel; status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED'; result: string; reason: string; operatorName: string; createdAt: string; completedAt: string | null; mockOnly: boolean }
export interface PartnerAudit { operationId: string; requestId: string; action: 'upgrade' | 'save-benefits' | 'save-level-names' | 'task-promotion'; contextId: string | null; targetId: string; operatorName: string; reason: string; before: string; after: string; occurredAt: string }
export interface PartnerCatalog { levels: PartnerLevelBenefits[]; receipts: PartnerReceipt[]; audit: PartnerAudit[] }
export interface PartnerQuery { page: number; pageSize: number; keyword?: string; partnerLevel?: PartnerLevel; partnerStatus?: PartnerProfile['partnerStatus'] }
export interface PartnerList { items: PartnerProfile[]; total: number; page: number; pageSize: number; summary: { total: number; active: number; frozen: number; annualExpired: number } }
export interface PartnerDetail { profile: PartnerProfile; taskHistory: PartnerPromotionTask[]; receipts: PartnerReceipt[]; audit: PartnerAudit[] }
export type PartnerLevelNameInput = { partnerLevel: PartnerLevel; title: string; version: number }
export type PartnerMutation =
  | { action: 'upgrade'; contextId: string; targetLevel: PartnerLevel; version: number; reason: string; idempotencyKey: string }
  | { action: 'save-benefits'; partnerLevel: PartnerLevel; summary: string; content: RichContent; version: number; reason: string; idempotencyKey: string }
  | { action: 'save-level-names'; names: PartnerLevelNameInput[]; reason: string; idempotencyKey: string }
export interface PartnerMutationResult { receiptId: string | null; operationId: string }
export class PartnerError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'PartnerError' } }
