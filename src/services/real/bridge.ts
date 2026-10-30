/** Shared helpers for dedicated-page ↔ HQ API adapters. */
import { ApiError } from '../../api/client'
import type { ApiResponse } from '../../types/hq/common'

export type Loose = Record<string, unknown>

export function record(value: unknown): Loose {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Loose : {}
}

export function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return fallback
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function stringList(value: unknown): string[] {
  return arr(value).map((item) => str(item)).filter(Boolean)
}

/** Empty string and nullish become null; otherwise stringified. */
export function nullableStr(value: unknown): string | null {
  if (value == null || value === '') return null
  return str(value)
}

/** Prefer integer fen; convert fractional/small yuan-like values. */
export function moneyToFen(value: unknown): number {
  if (value == null || value === '') return 0
  const n = num(value)
  if (!Number.isFinite(n)) return 0
  if (!Number.isInteger(n) || (n > 0 && n < 1000)) return yuanToFen(n)
  return n
}

/** HQ API amounts are yuan; dedicated UI types historically use fen. */
export function yuanToFen(yuan: unknown): number {
  return Math.round(num(yuan) * 100)
}

export function fenToYuan(fen: unknown): number {
  return Math.round(num(fen)) / 100
}

export async function unwrapData<T>(response: ApiResponse<T>): Promise<T> {
  if (response.code !== 0) throw new ApiError(response as never)
  return response.data
}

export type DomainErrorCtor = new (code: any, message: string) => Error

const CODE_MAP: Record<number, string> = {
  40100: 'FORBIDDEN',
  40300: 'FORBIDDEN',
  40400: 'NOT_FOUND',
  40000: 'INVALID_INPUT',
  40900: 'INVALID_STATE',
  40901: 'VERSION_CONFLICT',
  40902: 'IDEMPOTENCY_CONFLICT',
  40903: 'INVALID_STATE',
  50000: 'INVALID_INPUT',
}

/** Map v2 string business codes onto dedicated-page domain error codes. */
const STRING_CODE_MAP: Record<string, string> = {
  VALIDATION_ERROR: 'INVALID_INPUT',
  UNAUTHORIZED: 'FORBIDDEN',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'INVALID_STATE',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_INPUT: 'INVALID_INPUT',
}

export function mapHqError(error: unknown, DomainError: DomainErrorCtor, fallbackMessage = '总部服务暂时不可用'): never {
  if (error instanceof Error && 'code' in error && !(error instanceof ApiError) && error.name !== 'Error') throw error
  if (error instanceof ApiError) {
    const mapped = typeof error.code === 'string'
      ? (STRING_CODE_MAP[error.code] || 'INVALID_INPUT')
      : (CODE_MAP[error.code] || 'INVALID_INPUT')
    throw new DomainError(mapped, error.message || fallbackMessage)
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  throw new DomainError('INVALID_INPUT', message || fallbackMessage)
}

/**
 * Normalize list payloads for dedicated pages.
 * Accepts legacy `{ items, page, pageSize, total }` and v2
 * `{ list, pageNum, pageSize, total, totalPages }` — outer envelope only
 * is guaranteed standardized; item DTOs may still vary.
 */
export function asPage<T = Loose>(data: unknown, fallbackPage = 1, fallbackSize = 20): {
  items: T[]
  total: number
  page: number
  pageSize: number
  summary?: unknown
  raw: Loose
} {
  const raw = record(data)
  const listSource = Array.isArray(data)
    ? data
    : Array.isArray(raw.list)
      ? raw.list
      : arr(raw.items)
  const items = listSource.map((item) => record(item)) as T[]
  return {
    items,
    total: num(raw.total, items.length),
    page: num(raw.pageNum ?? raw.page, fallbackPage),
    pageSize: num(raw.pageSize, fallbackSize),
    summary: raw.summary,
    raw,
  }
}

export function mutationBody(input: { reason?: string; idempotencyKey?: string; version?: number; action: string } & Loose) {
  const { reason, idempotencyKey, version, action, ...rest } = input
  return {
    body: {
      ...rest,
      action,
      ...(reason !== undefined ? { reason } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    },
    headers: {
      ...(reason ? { 'X-Reason': String(reason) } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey) } : {}),
    },
  }
}

export function unsupported(DomainError: DomainErrorCtor, action: string, hint: string): never {
  throw new DomainError('INVALID_INPUT', `后端未提供「${action}」对应接口：${hint}`)
}

/** Pass-through cast when API payload is close enough for dedicated pages. */
export function cast<T = any>(value: unknown): T {
  return value as T
}
