import type { PageData } from './hq/common'
export type RegionType = 'province' | 'city' | 'district' | 'store'
export interface Brief { accountId: string; name: string; phone: string; tier: string }
export interface Assignment {
  assignmentId: string; regionType: RegionType; regionCode: string; regionName: string;
  parentCode: string | null; status: 'ACTIVE' | 'DISABLED'; agent: Brief | null;
  referrer: Brief | null; upline: Brief | null; appointedAt: string | null;
  lastLoginAt: string | null; version: number
}
export interface AgencyApplication {
  applicationId: string; applicant: Brief | null; regionType: RegionType;
  regionCode: string | null; regionName: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'; createdAt: string;
  referrer: Brief | null; rejectionReason: string | null; reviewedAt: string | null;
  version: number; payableAmount: number
}
export interface CostoreChild { costoreId: string; owner: Brief | null; storeId: string }
export interface AgencyDetail extends PageData<Assignment | CostoreChild> {
  assignment: Assignment; otherAssignments: Assignment[]; childType: string
}
export interface AgencyQuery { page: number; pageSize: number; regionType?: RegionType; regionCode?: string; name?: string; phone?: string }
export interface ApplicationQuery extends Omit<AgencyQuery, 'regionCode'> { status?: AgencyApplication['status'] }
export interface AppointmentInput {
  partnerId: string; regionType: RegionType; regionCode: string; promotionCode?: string;
  parentCode?: string; priceTier?: number; feeAmount?: number; storeName?: string;
  storeAddress?: string; storeContact?: string; reason?: string
}
export interface DecisionInput { decision: 'APPROVE' | 'REJECT'; version: number; reason: string; feeAmount?: number }
export interface Commission {
  id: string; owner_id: string; type: string; subtype: string; period: string;
  base_amount: number; rate: number; amount: number; ref_order_id: string;
  status: string; note: string; formula?: string
}
export interface AppointmentResult { assignment: Assignment; grantedTier: string | null; fee: { amount: number; period: string }; commissions: Commission[]; operationId: string }
export interface DecisionResult { application: AgencyApplication; assignment: Assignment | null; operationId: string }
