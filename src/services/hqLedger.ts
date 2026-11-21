/** HQ-29 总部分红只读服务：拆信封、防御性映射。不做写操作，不算账。 */
import axios from 'axios'
import { ApiError } from '../api/client'
import * as api from '../api/hqLedger'
import type { RequestOptions } from '../api/client'
import type {
  HqLedgerBalance,
  HqLedgerCatalog,
  HqLedgerCatalogQuery,
  HqLedgerCounterparty,
  HqLedgerDetail,
  HqLedgerListData,
  HqLedgerListItem,
  HqLedgerListQuery,
  HqLedgerRelatedDocument,
  HqLedgerSiblingEntry,
  HqLedgerSummary,
  HqLedgerTypeOption,
} from '../types/hqLedger'
import { HqLedgerError as LedgerError } from '../types/hqLedger'

export { encodeHqLedgerId, hqLedgerDetailRequestPath } from '../api/hqLedger'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value)
}

function asNullableString(value: unknown): string | null {
  if (value == null || value === '') return null
  return asString(value)
}

/** 金额按元原样读取，禁止 /100。 */
export function asYuan(value: unknown, fallback: number | null = 0): number | null {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return n
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asOptions(value: unknown): { value: string; label: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const optionValue = asString(row.value)
      if (!optionValue) return null
      return { value: optionValue, label: asString(row.label, optionValue) }
    })
    .filter((item): item is { value: string; label: string } => item != null)
}

function emptySummary(): HqLedgerSummary {
  return { incomeTotal: 0, expenseTotal: 0, netAmount: 0, scope: 'posted_included' }
}

export function mapSummary(raw: unknown): HqLedgerSummary {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const summary: HqLedgerSummary = {
    incomeTotal: asYuan(row.incomeTotal, 0) ?? 0,
    expenseTotal: asYuan(row.expenseTotal, 0) ?? 0,
    netAmount: asYuan(row.netAmount, 0) ?? 0,
    scope: asString(row.scope, 'posted_included'),
  }
  if (row.postedIncludedCount != null) summary.postedIncludedCount = asNumber(row.postedIncludedCount, 0)
  return summary
}

export function mapBalance(raw: unknown): HqLedgerBalance {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    availableBalance: asYuan(row.availableBalance, 0) ?? 0,
    frozenBalance: asYuan(row.frozenBalance, 0) ?? 0,
    currency: asString(row.currency, 'CNY'),
    unit: asString(row.unit, 'yuan'),
    scope: asString(row.scope, 'assembled_book'),
    version: asNumber(row.version, 0),
  }
}

export function mapCatalog(raw: unknown): HqLedgerCatalog {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const types: HqLedgerTypeOption[] = Array.isArray(row.types)
    ? row.types
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const type = item as Record<string, unknown>
          const value = asString(type.value)
          if (!value) return null
          return {
            value,
            label: asString(type.label, value),
            direction: asString(type.direction),
          }
        })
        .filter((item): item is HqLedgerTypeOption => item != null)
    : []
  return {
    directions: asOptions(row.directions),
    types,
    statuses: asOptions(row.statuses),
    counterpartyKinds: asOptions(row.counterpartyKinds),
    relatedTypes: asOptions(row.relatedTypes),
    summary: mapSummary(row.summary) || emptySummary(),
    balance: mapBalance(row.balance),
  }
}

function mapCounterparty(raw: unknown): HqLedgerCounterparty {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const kind = asString(row.kind, 'other')
  return {
    kind,
    kindLabel: asString(row.kindLabel, kind),
    id: asNullableString(row.id),
    name: asNullableString(row.name),
    phone: asNullableString(row.phone),
  }
}

export function mapListItem(raw: unknown): HqLedgerListItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const ledgerId = asString(row.ledgerId)
  if (!ledgerId) return null
  const type = asString(row.type)
  const direction = asString(row.direction)
  const status = asString(row.status)
  return {
    ledgerId,
    businessKey: asString(row.businessKey),
    occurredAt: asString(row.occurredAt),
    period: asNullableString(row.period),
    direction,
    directionLabel: asString(row.directionLabel, direction),
    type,
    typeLabel: asString(row.typeLabel, type),
    amount: asYuan(row.amount, 0) ?? 0,
    includedInSummary: asBoolean(row.includedInSummary, false),
    excludeReason: asNullableString(row.excludeReason),
    dedupeNote: asNullableString(row.dedupeNote),
    counterparty: mapCounterparty(row.counterparty),
    relatedType: asNullableString(row.relatedType),
    relatedTypeLabel: asNullableString(row.relatedTypeLabel),
    relatedId: asNullableString(row.relatedId),
    relatedNo: asNullableString(row.relatedNo),
    remark: asNullableString(row.remark),
    status,
    statusLabel: asString(row.statusLabel, status),
    source: asString(row.source),
    sourceId: asString(row.sourceId),
    balanceAfter: asYuan(row.balanceAfter, null),
    version: asNumber(row.version, 0),
    createdAt: asString(row.createdAt),
  }
}

export function mapList(raw: unknown): HqLedgerListData {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const items = Array.isArray(row.items)
    ? row.items.map(mapListItem).filter((item): item is HqLedgerListItem => item != null)
    : []
  return {
    items,
    total: asNumber(row.total, items.length),
    page: asNumber(row.page, 1),
    pageSize: asNumber(row.pageSize, 20),
    summary: mapSummary(row.summary),
  }
}

function mapRelatedDocuments(raw: unknown): HqLedgerRelatedDocument[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const id = asString(row.id)
      const type = asString(row.type)
      if (!id && !type) return null
      return {
        type,
        typeLabel: asString(row.typeLabel, type),
        id,
        no: asNullableString(row.no),
        title: asNullableString(row.title),
        status: asNullableString(row.status),
        amount: asYuan(row.amount, null),
      }
    })
    .filter((item): item is HqLedgerRelatedDocument => item != null)
}

function mapSiblingEntries(raw: unknown): HqLedgerSiblingEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const ledgerId = asString(row.ledgerId)
      if (!ledgerId) return null
      return {
        ledgerId,
        type: asString(row.type),
        typeLabel: asString(row.typeLabel, asString(row.type)),
        direction: asString(row.direction),
        amount: asYuan(row.amount, 0) ?? 0,
        includedInSummary: asBoolean(row.includedInSummary, false),
        status: asString(row.status),
      }
    })
    .filter((item): item is HqLedgerSiblingEntry => item != null)
}

export function mapDetail(raw: unknown): HqLedgerDetail | null {
  const base = mapListItem(raw)
  if (!base) return null
  const row = raw as Record<string, unknown>
  return {
    ...base,
    bookedAt: asNullableString(row.bookedAt),
    updatedAt: asString(row.updatedAt, base.createdAt),
    sourceModule: asNullableString(row.sourceModule),
    relatedDocuments: mapRelatedDocuments(row.relatedDocuments),
    siblingEntries: mapSiblingEntries(row.siblingEntries),
  }
}

function unwrap<T, R>(response: { code: number | string; message: string; data: T | null | undefined }, map: (data: T) => R | null): R {
  if (response.code !== 0) throw toHqLedgerError(new ApiError({ code: response.code, message: response.message, data: null }))
  if (response.data == null) throw new LedgerError('unavailable', '总部接口未返回业务数据')
  const mapped = map(response.data)
  if (mapped == null) throw new LedgerError('unavailable', '总部接口返回的流水数据无法识别')
  return mapped
}

export function toHqLedgerError(error: unknown): LedgerError {
  if (error instanceof LedgerError) return error
  if (error instanceof ApiError) {
    const code = Number(error.code)
    // 业务 40400：源记录不存在。HTTP 404 且非该业务码：路由尚未注册。
    if (code === 40400) return new LedgerError('not_found', error.message || '流水不存在', error)
    if (error.status === 404) return new LedgerError('not_ready', '总部分红接口尚未就绪，请稍后重试。', error)
    if (code === 40000) return new LedgerError('invalid', error.message || '查询参数不正确', error)
    if (code === 40100 || code === 40300) return new LedgerError('unavailable', error.message || '没有权限查看总部分红', error)
    return new LedgerError('unavailable', error.message || '加载总部分红失败', error)
  }
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return new LedgerError('not_ready', '总部分红接口尚未就绪，请稍后重试。', error)
    if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
      return new LedgerError('unavailable', error.code === 'ECONNABORTED' ? '加载总部分红超时' : '已取消加载', error)
    }
    return new LedgerError('unavailable', error.message || '暂时无法连接总部服务', error)
  }
  return new LedgerError('unavailable', error instanceof Error ? error.message : '加载总部分红失败', error)
}

export function describeHqLedgerError(error: unknown): string {
  return toHqLedgerError(error).message
}

export const hqLedgerService = {
  async catalog(query?: HqLedgerCatalogQuery, options?: RequestOptions): Promise<HqLedgerCatalog> {
    try {
      return unwrap(await api.getHqLedgerCatalog(query, options), mapCatalog)
    } catch (error) {
      throw toHqLedgerError(error)
    }
  },
  async list(query?: HqLedgerListQuery, options?: RequestOptions): Promise<HqLedgerListData> {
    try {
      return unwrap(await api.getHqLedgerList(query, options), mapList)
    } catch (error) {
      throw toHqLedgerError(error)
    }
  },
  async detail(ledgerId: string, options?: RequestOptions): Promise<HqLedgerDetail> {
    try {
      return unwrap(await api.getHqLedgerById({ ledgerId }, options), mapDetail)
    } catch (error) {
      throw toHqLedgerError(error)
    }
  },
}
