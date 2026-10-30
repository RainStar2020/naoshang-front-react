import axios, { AxiosHeaders, type AxiosRequestConfig, type InternalAxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'
import type { ApiFailure, MutationHeaders } from '../types/hq/common'

/** Field-level validation detail from the v2 envelope. */
export interface ApiFieldError {
  field: string
  message: string
}

/** Business error; keeps backend code, HTTP status, optional version / field errors / trace id. */
export class ApiError extends Error {
  readonly code: number | string
  readonly currentVersion?: number
  readonly errors?: ApiFieldError[]
  readonly traceId?: string

  constructor(
    readonly response: {
      code: number | string
      message: string
      data?: null
      response?: null
      currentVersion?: number
      errors?: ApiFieldError[]
    },
    readonly status?: number,
    traceId?: string,
  ) {
    super(response.message)
    this.name = 'ApiError'
    this.code = response.code
    this.currentVersion = response.currentVersion
    this.errors = response.errors
    this.traceId = traceId
  }
}

let tokenProvider: () => string | null = () => null

/** Wire real auth state. Read token per request; pass null to clear. */
export function setApiToken(token: string | null): void {
  tokenProvider = () => token
}

/** Bind app session storage without coupling the request layer to a store. */
export function setApiTokenProvider(provider: () => string | null): void {
  tokenProvider = provider
}

/**
 * HQ modules whose GET routes already speak the v2 envelope when
 * `X-API-Version: 2` is present. Mutating / CSV / other modules stay on v1.
 */
export const HQ_API_V2_GET_MODULES = [
  'users',
  'course',
  'announcements',
  'materials',
  'software-cards',
  'quotas',
  'delivery',
  'staff',
  'stores',
  'training',
  'invitations',
  'transfers',
  'support',
  'trace',
] as const

/** Explicit migrated GET routes; do not opt in arbitrary module subpaths. */
const HQ_API_V2_GET_ROUTES = [
  "users",
  "users/catalog",
  "users/:accountId",
  "course/entitlements",
  "course/catalog",
  "course/entitlements/:entitlementId",
  "announcements",
  "announcements/catalog",
  "announcements/:announcementId",
  "materials",
  "materials/catalog",
  "materials/:materialId",
  "software-cards",
  "software-cards/batches",
  "software-cards/catalog",
  "quotas",
  "quotas/catalog",
  "quotas/:quotaId",
  "delivery/shipments",
  "delivery/catalog",
  "delivery/shipments/:shipmentId",
  "staff",
  "staff/catalog",
  "staff/:staffId",
  "stores",
  "stores/catalog",
  "stores/:storeId",
  "training/balances",
  "training/feedback",
  "training/catalog",
  "training/members/:memberId",
  "invitations",
  "invitations/:accountId",
  "invitations/:accountId/team",
  "transfers",
  "transfers/catalog",
  "transfers/:applicationId",
  "support/tickets",
  "support/catalog",
  "support/tickets/:ticketId",
  "trace",
  "trace/catalog",
  "trace/:traceId",
  "trace/by-request/:requestId"
].map(path => new RegExp('^' + path.split('/').map(segment => segment.startsWith(':') ? '[^/]+' : segment).join('/') + '$'))

/** Resolve the path under `/api/hq` from an Axios request config. */
export function resolveHqRequestPath(config: Pick<InternalAxiosRequestConfig, 'url' | 'baseURL'>): string {
  const raw = String(config.url || '')
  const withoutQuery = raw.split('?')[0]
  const hqMarker = '/api/hq/'
  const hqIdx = withoutQuery.indexOf(hqMarker)
  if (hqIdx >= 0) return withoutQuery.slice(hqIdx + hqMarker.length).replace(/^\//, '')
  const base = String(config.baseURL || '')
  if (withoutQuery.startsWith(base) && base.includes('/api/hq')) {
    return withoutQuery.slice(base.length).replace(/^\//, '')
  }
  return withoutQuery.replace(/^\//, '')
}

/**
 * Attach `X-API-Version: 2` only for GET on migrated modules.
 * Never for POST/mutate, CSV export, OPTIONS, health, or non-listed modules.
 */
export function shouldAttachApiVersion2(config: Pick<InternalAxiosRequestConfig, 'method' | 'url' | 'baseURL'>): boolean {
  const method = String(config.method || 'get').toLowerCase()
  if (method !== 'get') return false
  const path = resolveHqRequestPath(config)
  if (!path) return false
  if (/\.csv$/i.test(path) || /(^|\/)export(\/|$)/i.test(path)) return false
  return HQ_API_V2_GET_ROUTES.some(route => route.test(path))
}

/** Shared HQ Axios instance; env base URL must include `/api/hq`. */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_HQ_API_BASE_URL || '/api/hq',
  timeout: 30_000,
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  // Login needs no session; avoid sending an expired token.
  const token = config.url === '/auth/login' ? null : tokenProvider()
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  if (shouldAttachApiVersion2(config) && !config.headers.has('X-API-Version')) {
    config.headers.set('X-API-Version', '2')
  }
  return config
})

type LegacyFailureBody = {
  code: number
  message: string
  data: null
  currentVersion?: number
}

type V2FailureBody = {
  status: 0
  code: string
  message: string
  response: null
  errors?: ApiFieldError[]
  currentVersion?: number
}

type V2SuccessBody = {
  status: 1
  response: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** New contract: numeric `status` + `response` key (value may be null). */
export function isV2Envelope(value: unknown): value is V2SuccessBody | V2FailureBody {
  return isRecord(value)
    && typeof value.status === 'number'
    && 'response' in value
}

/** Old contract failure: numeric non-zero `code`, `data: null`. Do not treat as string code. */
export function isLegacyApiFailure(value: unknown): value is LegacyFailureBody {
  return isRecord(value)
    && typeof value.code === 'number'
    && value.code !== 0
    && typeof value.message === 'string'
    && 'data' in value
    && value.data === null
}

function isV2Failure(value: unknown): value is V2FailureBody {
  return isV2Envelope(value)
    && value.status === 0
    && typeof (value as V2FailureBody).code === 'string'
    && typeof (value as V2FailureBody).message === 'string'
}

function isV2Success(value: unknown): value is V2SuccessBody {
  return isV2Envelope(value) && value.status === 1
}

/** Read CORS-exposed `X-Trace-Id` from Axios response headers. */
export function readTraceId(headers: unknown): string | undefined {
  if (!headers) return undefined
  if (typeof (headers as AxiosHeaders).get === 'function') {
    const fromGetter = (headers as AxiosHeaders).get('X-Trace-Id')
      ?? (headers as AxiosHeaders).get('x-trace-id')
    if (typeof fromGetter === 'string' && fromGetter) return fromGetter
    if (Array.isArray(fromGetter) && fromGetter[0]) return String(fromGetter[0])
  }
  const recordHeaders = headers as Record<string, unknown>
  const raw = recordHeaders['x-trace-id'] ?? recordHeaders['X-Trace-Id']
  if (typeof raw === 'string' && raw) return raw
  if (Array.isArray(raw) && raw[0]) return String(raw[0])
  return undefined
}

function logApiError(error: ApiError, context: string): void {
  // Keep message for UI; attach trace id for backend triage.
  console.error(`[hq-api] ${context}`, {
    code: error.code,
    message: error.message,
    status: error.status,
    traceId: error.traceId,
    errors: error.errors,
    currentVersion: error.currentVersion,
  })
}

function apiErrorFromV2(body: V2FailureBody, status?: number, traceId?: string): ApiError {
  return new ApiError({
    code: body.code,
    message: body.message,
    data: null,
    response: null,
    currentVersion: body.currentVersion,
    errors: body.errors,
  }, status, traceId)
}

function apiErrorFromLegacy(body: LegacyFailureBody, status?: number, traceId?: string): ApiError {
  return new ApiError(body, status, traceId)
}

/**
 * Normalize any success body to the legacy `{ code: 0, message, data }` shape
 * so LiveModule / dedicated adapters / typed API helpers keep working unchanged.
 * V2 success has no message; empty string is intentional.
 */
export function normalizeSuccessEnvelope(data: unknown): unknown {
  if (isV2Success(data)) {
    return { code: 0 as const, message: '', data: data.response }
  }
  return data
}

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data
    const traceId = readTraceId(response.headers)

    // Identify envelope first, then success / failure. Never treat numeric code as string.
    if (isV2Failure(body)) {
      const error = apiErrorFromV2(body, response.status, traceId)
      logApiError(error, 'business failure on 2xx')
      throw error
    }
    if (isV2Success(body)) {
      response.data = normalizeSuccessEnvelope(body)
      return response
    }
    if (isLegacyApiFailure(body)) {
      const error = apiErrorFromLegacy(body, response.status, traceId)
      logApiError(error, 'legacy business failure on 2xx')
      throw error
    }
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data
      const status = error.response?.status
      const traceId = readTraceId(error.response?.headers)
      if (isV2Failure(body)) {
        const apiError = apiErrorFromV2(body, status, traceId)
        logApiError(apiError, 'business failure on non-2xx')
        return Promise.reject(apiError)
      }
      if (isLegacyApiFailure(body)) {
        const apiError = apiErrorFromLegacy(body, status, traceId)
        logApiError(apiError, 'legacy business failure on non-2xx')
        return Promise.reject(apiError)
      }
      if (traceId) {
        console.error('[hq-api] transport error', {
          message: error.message,
          status,
          traceId,
        })
      }
    }
    // Preserve AxiosError / cancel for callers (timeout, offline, abort).
    return Promise.reject(error)
  },
)

/** Callers may pass cancel, timeout, and extra headers; route/params/shape stay in API fns. */
export type RequestOptions = Pick<AxiosRequestConfig, 'signal' | 'timeout'> & {
  headers?: RawAxiosRequestHeaders | AxiosHeaders
}

/** Merge audit headers; request audit wins over generic options. */
export function mergeRequestHeaders(options: RequestOptions, headers?: MutationHeaders): AxiosHeaders {
  const merged = new AxiosHeaders()
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value !== undefined) merged.set(key, value)
    }
  }
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) merged.set(key, value)
    }
  }
  return merged
}
