/**
 * One-shot: write services/real/* adapters + patch facades for isMockAuth branching.
 * Run: node scripts/wire-real-adapters.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const realDir = path.join(root, 'src', 'services', 'real')
const servicesDir = path.join(root, 'src', 'services')
const typesDir = path.join(root, 'src', 'types')

function write(rel, content) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content.replace(/\r?\n/g, '\n'), 'utf8')
  console.log('wrote', rel)
}

const bridge = `/** Shared helpers for dedicated-page → HQ API adapters. */
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

export type DomainErrorCtor = new (code: string, message: string) => Error

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

export function mapHqError(error: unknown, DomainError: DomainErrorCtor, fallbackMessage = '总部服务暂时不可用'): never {
  if (error instanceof Error && error.name.endsWith('Error') && 'code' in error) throw error
  if (error instanceof ApiError) {
    const code = CODE_MAP[error.code] || 'INVALID_INPUT'
    throw new DomainError(code, error.message || fallbackMessage)
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  throw new DomainError('INVALID_INPUT', message || fallbackMessage)
}

export function asPage<T = Loose>(data: unknown, fallbackPage = 1, fallbackSize = 20): {
  items: T[]
  total: number
  page: number
  pageSize: number
  summary?: unknown
  raw: Loose
} {
  const raw = record(data)
  const items = (Array.isArray(data) ? data : arr(raw.items)).map((item) => record(item)) as T[]
  return {
    items,
    total: num(raw.total, items.length),
    page: num(raw.page, fallbackPage),
    pageSize: num(raw.pageSize, fallbackSize),
    summary: raw.summary,
    raw,
  }
}

export function mutationBody(input: Loose & { reason?: string; idempotencyKey?: string; version?: number; action: string }) {
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
  throw new DomainError('INVALID_INPUT', \`后端未提供「\${action}」对应接口：\${hint}\`)
}
`

write('src/services/real/bridge.ts', bridge)

console.log('bridge done')
