/** HQ-29 总部分红（3 个只读接口）。金额单位为元；不要复用 revenue / 提现 / dividend-audit。 */
import { apiClient, type RequestOptions } from './client'
import type { HqLedgerEndpoints } from '../types/hq/hqLedger'

/**
 * 将合成 ledgerId 原样编码为路径段。解码后必须与入参一致。
 * 例：fi:af-ra_10001 → fi%3Aaf-ra_10001
 */
export function encodeHqLedgerId(ledgerId: string): string {
  return encodeURIComponent(ledgerId)
}

/** 详情请求路径（相对于 /api/hq）。 */
export function hqLedgerDetailRequestPath(ledgerId: string): string {
  return `/hq-ledger/${encodeHqLedgerId(ledgerId)}`
}

/**
 * 目录、筛选项、日期范围内合计与组装账面余额。
 * @see GET /api/hq/hq-ledger/catalog
 */
export async function getHqLedgerCatalog(
  query?: HqLedgerEndpoints['GET /hq-ledger/catalog']['query'],
  options: RequestOptions = {},
): Promise<HqLedgerEndpoints['GET /hq-ledger/catalog']['response']> {
  const response = await apiClient.get<HqLedgerEndpoints['GET /hq-ledger/catalog']['response']>(
    '/hq-ledger/catalog',
    { ...options, params: query },
  )
  return response.data
}

/**
 * 总部收支流水分页列表。
 * @see GET /api/hq/hq-ledger
 */
export async function getHqLedgerList(
  query?: HqLedgerEndpoints['GET /hq-ledger']['query'],
  options: RequestOptions = {},
): Promise<HqLedgerEndpoints['GET /hq-ledger']['response']> {
  const response = await apiClient.get<HqLedgerEndpoints['GET /hq-ledger']['response']>(
    '/hq-ledger',
    { ...options, params: query },
  )
  return response.data
}

/**
 * 单笔流水详情。路径参数 ledgerId 经 encodeURIComponent 后原样传递。
 * @see GET /api/hq/hq-ledger/{ledgerId}
 */
export async function getHqLedgerById(
  path: HqLedgerEndpoints['GET /hq-ledger/:ledgerId']['path'],
  options: RequestOptions = {},
): Promise<HqLedgerEndpoints['GET /hq-ledger/:ledgerId']['response']> {
  const response = await apiClient.get<HqLedgerEndpoints['GET /hq-ledger/:ledgerId']['response']>(
    hqLedgerDetailRequestPath(path.ledgerId),
    options,
  )
  return response.data
}
