/** 区域代理专项契约（2026-11-10）：真实任命与申请审核六接口。 */
import { apiClient } from './client'
import type { ApiResponse, PageData } from '../types/hq/common'
import type { AgencyQuery, Assignment, AgencyDetail, AgencyApplication, ApplicationQuery, RegionType, AppointmentInput, AppointmentResult, DecisionInput, DecisionResult } from '../types/regionalAgency'
import { unwrapData } from '../services/real/bridge'
async function get<T>(path: string, params: object): Promise<T> {
  return unwrapData((await apiClient.get<ApiResponse<T>>(path, { params })).data)
}
async function post<T>(path: string, body: object, key: string): Promise<T> {
  return unwrapData((await apiClient.post<ApiResponse<T>>(path, body, { headers: { 'Idempotency-Key': key } })).data)
}
export const regionalAgencyApi = {
  list: (query: AgencyQuery) => get<PageData<Assignment>>('/region-agents', query),
  detail: (id: string, page = 1, pageSize = 20) => get<AgencyDetail>(`/region-agents/${encodeURIComponent(id)}`, { page, pageSize }),
  check: (regionType: RegionType, regionCode: string) => get<{ regionType: RegionType; regionCode: string; available: boolean }>('/region-agents/check', { regionType, regionCode }),
  appoint: (input: AppointmentInput, key: string) => post<AppointmentResult>('/region-agents/appointments', input, key),
  applications: (query: ApplicationQuery) => get<PageData<AgencyApplication>>('/region-agents/applications', query),
  decide: (id: string, input: DecisionInput, key: string) => post<DecisionResult>(`/region-agents/applications/${encodeURIComponent(id)}/decisions`, input, key),
}
