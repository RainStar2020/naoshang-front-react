import { apiClient, type RequestOptions } from './client'
import type { ApiResponse } from '../types/hq/common'
import type { DividendAuditOverview, DividendKind, DividendKindOption } from '../types/dividendAudit'

export function getDividendKinds(options: RequestOptions = {}) {
  return apiClient.get<ApiResponse<{ kinds: DividendKindOption[] }>>('/dividend-audit/kinds', options).then((response) => response.data)
}

export function getDividendPeriods(kind: DividendKind, options: RequestOptions = {}) {
  return apiClient.get<ApiResponse<{ kind: DividendKind; currentPeriod: string; periods: string[] }>>('/dividend-audit/periods', { ...options, params: { kind } }).then((response) => response.data)
}

export function getDividendOverview(query: { kind: DividendKind; period?: string; page?: number; pageSize?: number }, options: RequestOptions = {}) {
  return apiClient.get<ApiResponse<DividendAuditOverview>>('/dividend-audit/overview', { ...options, params: query }).then((response) => response.data)
}
