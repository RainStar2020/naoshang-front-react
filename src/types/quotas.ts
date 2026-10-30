import type { PartnerProfile } from './partners'
export type QuotaType = 'STANDARD' | 'ACTIVITY'
/** remaining 为可用量，不含 reserved；所有数量均为整数，金额单位为分。 */
export interface QuotaBalance { quotaType: QuotaType; total: number; remaining: number; reserved: number; used: number; transferred: number }
export interface QuotaEligibility { qualified: boolean; canRecharge: boolean; reason: string; allowedTypes: QuotaType[]; perOperationLimit: number; remainingLimit: number; limitLabel: string }
export interface QuotaOwner { ownerAccountId: string; contextId: string; name: string; phone: string; displayId: string; partnerLevel: PartnerProfile['partnerLevel']; partnerStatus: PartnerProfile['partnerStatus']; version: number; balances: QuotaBalance[]; eligibility: QuotaEligibility }
export interface QuotaBatch extends QuotaBalance { batchId: string; ownerAccountId: string; source: 'PURCHASE' | 'ACTIVITY_GRANT' | 'HQ_RECHARGE' | 'TRANSFER'; sourceOrderId: string | null; operationId: string; title: string; createdAt: string; expiresAt: null; transferable: boolean; refundable: false }
export type QuotaLedgerKind = 'PURCHASE' | 'ACTIVITY_GRANT' | 'HQ_RECHARGE' | 'RESERVE' | 'RELEASE' | 'CONSUME' | 'TRANSFER_OUT' | 'TRANSFER_IN'
export interface QuotaLedger { ledgerId: string; operationId: string; requestId: string; ownerAccountId: string; targetAccountId: string | null; batchId: string; quotaType: QuotaType; kind: QuotaLedgerKind; quantity: number; sourceOrderId: string | null; reason: string; operatorName: string; createdAt: string; before: QuotaBalance; after: QuotaBalance }
export interface QuotaOrder { orderId: string; ownerAccountId: string; targetAccountId: string | null; kind: 'PURCHASE' | 'ACTIVITY_UPGRADE'; quotaType: QuotaType; quantity: number; batchId: string | null; status: 'UNPAID' | 'PAID' | 'CANCELLED'; unitAmount: number; payableAmount: number; paymentReceiptId: string | null; createdAt: string; updatedAt: string; note: string }
export interface QuotaRecharge { operationId: string; requestId: string; ownerAccountId: string; targetAccountId: string; batchId: string; quotaType: QuotaType; quantity: number; reason: string; operatorName: string; createdAt: string; before: QuotaBalance; after: QuotaBalance; beforeVersion: number; afterVersion: number }
export interface QuotaQuery { page: number; pageSize: number; keyword?: string; eligibility?: 'ALLOWED' | 'DENIED' }
export interface QuotaList { items: QuotaOwner[]; total: number; summary: { owners: number; rechargeable: number; standardRemaining: number; activityRemaining: number; reserved: number } }
export interface QuotaDetail { owner: QuotaOwner; batches: QuotaBatch[]; ledger: QuotaLedger[]; orders: QuotaOrder[]; recharges: QuotaRecharge[]; activityServiceFeePerQuota: 200000 }
export interface QuotaRechargeInput { targetAccountId: string; quotaType: QuotaType; quantity: number; version: number; reason: string; idempotencyKey: string }
export class QuotaError extends Error { constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) { super(message); this.name = 'QuotaError' } }
