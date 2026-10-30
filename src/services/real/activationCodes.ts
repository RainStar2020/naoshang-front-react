import * as api from '../../api'
import {
  ActivationError,
  type ActivationAudit,
  type ActivationBatch,
  type ActivationCode,
  type ActivationCodeType,
  type ActivationDetail,
  type ActivationExportRequest,
  type ActivationMutation,
  type ActivationOptions,
  type ActivationQuery,
  type ActivationStatus,
} from '../../types/activationCodes'
import { arr, asPage, bool, cast, mapHqError, mutationBody, nullableStr, num, record, str, unsupported, unwrapData } from './bridge'

const CODE_TYPES = new Set<ActivationCodeType>(['membership-tier', 'column'])
const STATUSES = new Set<ActivationStatus>(['unused', 'issued', 'used', 'revoked', 'expired'])
const AUDIT_ACTIONS = new Set(['generate', 'issue', 'revoke', 'reissue', 'set-expiry', 'export', 'activate'])

function asCodeType(value: unknown): ActivationCodeType {
  const raw = str(value)
  return CODE_TYPES.has(raw as ActivationCodeType) ? (raw as ActivationCodeType) : 'membership-tier'
}

function asStatus(value: unknown): ActivationStatus {
  const raw = str(value).toLowerCase()
  return STATUSES.has(raw as ActivationStatus) ? (raw as ActivationStatus) : 'unused'
}

function mapTarget(raw: unknown) {
  const r = record(raw)
  const targetId = str(r.targetId || r.id || r.tierId || r.columnId || r.membershipTierId)
  if (!targetId) return null
  return {
    codeType: asCodeType(r.codeType || r.type || (r.columnId || r.column ? 'column' : 'membership-tier')),
    targetId,
    name: str(r.name || r.title || r.targetName || targetId),
    demoOnly: bool(r.demoOnly, false),
  }
}

function mapAccountOption(raw: unknown) {
  const r = record(raw)
  const accountId = str(r.accountId || r.id || r.userId)
  if (!accountId) return null
  return {
    accountId,
    name: str(r.name || r.nickname || r.displayName || accountId),
    phone: str(r.phone || r.mobile || r.loginAccount),
  }
}

function mapMemberOption(raw: unknown) {
  const r = record(raw)
  const memberId = str(r.memberId || r.id)
  if (!memberId) return null
  return {
    memberId,
    accountId: str(r.accountId || r.parentAccountId || r.userId),
    contextId: str(r.contextId || r.businessContextId),
    name: str(r.name || r.nickname || r.displayName || memberId),
    displayId: str(r.displayId || r.userNo || r.memberNo || memberId),
  }
}

function mapStoreOption(raw: unknown) {
  const r = record(raw)
  const storeId = str(r.storeId || r.id || r.shopId)
  if (!storeId) return null
  return {
    storeId,
    name: str(r.name || r.storeName || r.title || storeId),
    number: str(r.number || r.code || r.storeNo),
    active: r.active !== false && str(r.status).toUpperCase() !== 'INACTIVE',
  }
}

function stringListish(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return str(item)
      return str(record(item).codeId || record(item).id)
    }).filter(Boolean)
  }
  const single = str(value)
  return single ? [single] : []
}

/** Normalize activation catalog into dedicated filter options with safe arrays. */
export function mapActivationOptions(raw: unknown): ActivationOptions {
  const r = record(raw)
  const targetSource = r.targets || r.targetOptions
    ? arr(r.targets || r.targetOptions)
    : [...arr(r.tiers), ...arr(r.columns), ...arr(r.products)]
  const targets = targetSource
    .map(mapTarget)
    .filter((item): item is NonNullable<typeof item> => !!item)
  const accounts = arr(r.accounts || r.accountOptions || r.users || r.parents)
    .map(mapAccountOption)
    .filter((item): item is NonNullable<typeof item> => !!item)
  const members = arr(r.members || r.memberOptions || r.students)
    .map(mapMemberOption)
    .filter((item): item is NonNullable<typeof item> => !!item)
  const stores = arr(r.stores || r.storeOptions || r.shops)
    .map(mapStoreOption)
    .filter((item): item is NonNullable<typeof item> => !!item)
  return {
    targets,
    accounts,
    members,
    stores,
    maxBatchSize: Math.max(1, num(r.maxBatchSize ?? r.batchLimit ?? r.maxQuantity, 100)),
    maxSelectionSize: Math.max(1, num(r.maxSelectionSize ?? r.selectionLimit ?? r.maxSelect, 100)),
  }
}

export function mapActivationBatch(raw: unknown): ActivationBatch {
  const r = record(raw)
  return {
    batchId: str(r.batchId || r.id),
    name: str(r.name || r.batchName || r.title),
    codeType: asCodeType(r.codeType || r.type),
    targetId: str(r.targetId || r.tierId || r.columnId),
    targetName: str(r.targetName || r.targetTitle || r.productName),
    quantity: num(r.quantity ?? r.count ?? r.total),
    expiresAt: nullableStr(r.expiresAt ?? r.expireAt ?? r.expiryAt),
    createdAt: str(r.createdAt || r.createTime),
    createdBy: str(r.createdBy || r.creatorName || r.operatorName || r.createdByName),
  }
}

export function mapActivationCode(raw: unknown): ActivationCode {
  const r = record(raw)
  return {
    codeId: str(r.codeId || r.id),
    batchId: str(r.batchId),
    maskedCode: str(r.maskedCode || r.codeMasked || r.code || r.masked),
    codeType: asCodeType(r.codeType || r.type),
    targetId: str(r.targetId || r.tierId || r.columnId),
    targetName: str(r.targetName || r.targetTitle || r.productName),
    status: asStatus(r.status),
    expiresAt: nullableStr(r.expiresAt ?? r.expireAt ?? r.expiryAt),
    version: Math.max(1, num(r.version, 1)),
    issuedTo: nullableStr(r.issuedTo ?? r.recipientName ?? r.deliveryTarget),
    issuedToAccountId: nullableStr(r.issuedToAccountId ?? r.accountId),
    issuedToMemberId: nullableStr(r.issuedToMemberId ?? r.memberId),
    storeId: nullableStr(r.storeId ?? r.shopId),
    issuedAt: nullableStr(r.issuedAt),
    usedByAccountId: nullableStr(r.usedByAccountId ?? r.usedAccountId),
    usedByMemberId: nullableStr(r.usedByMemberId ?? r.usedMemberId),
    usedAt: nullableStr(r.usedAt),
    sourceOrderId: nullableStr(r.sourceOrderId ?? r.orderId),
    replacementCodeId: nullableStr(r.replacementCodeId ?? r.newCodeId),
    replacesCodeId: nullableStr(r.replacesCodeId ?? r.oldCodeId),
    createdAt: str(r.createdAt || r.createTime),
  }
}

export function mapActivationAudit(raw: unknown): ActivationAudit {
  const r = record(raw)
  const actionRaw = str(r.action || r.op || r.type)
  const action = (AUDIT_ACTIONS.has(actionRaw) ? actionRaw : 'generate') as ActivationAudit['action']
  return {
    operationId: str(r.operationId || r.id || r.requestId, `op-${str(r.occurredAt || r.createdAt) || 'unknown'}`),
    requestId: str(r.requestId || r.idempotencyKey || r.operationId),
    action,
    codeIds: stringListish(r.codeIds ?? r.codes ?? r.affectedCodeIds),
    batchId: nullableStr(r.batchId),
    reason: str(r.reason || r.remark || r.comment),
    operatorId: str(r.operatorId || r.operatorAccountId || r.userId),
    operatorName: str(r.operatorName || r.operator || r.createdBy),
    before: str(r.before || r.beforeStatus || r.from),
    after: str(r.after || r.afterStatus || r.to),
    occurredAt: str(r.occurredAt || r.createdAt || r.createTime || r.operatedAt),
  }
}

export function mapActivationDetail(raw: unknown): ActivationDetail {
  const r = record(raw)
  const codeRaw = r.code || r.activationCode || r
  const batchRaw = r.batch || r.batchInfo || {}
  const auditRaw = r.audit || r.operations || r.logs || []
  return {
    code: mapActivationCode(codeRaw),
    batch: mapActivationBatch(Object.keys(record(batchRaw)).length ? batchRaw : { batchId: record(codeRaw).batchId }),
    audit: arr(auditRaw).map(mapActivationAudit),
  }
}

export async function realActivationOptions() {
  try {
    return cast(mapActivationOptions(await unwrapData(await api.getActivationCodesCatalog())))
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationBatches() {
  try {
    const page = asPage(await unwrapData(await api.getActivationCodesBatches({ page: 1, pageSize: 100 } as never)))
    return cast(arr(page.items).map(mapActivationBatch))
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationList(query: ActivationQuery) {
  try {
    const page = asPage(await unwrapData(await api.getActivationCodes({ ...query } as never)), query.page, query.pageSize)
    return cast({
      items: arr(page.items).map(mapActivationCode),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    })
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationDetail(id: string) {
  try {
    try {
      const raw = await unwrapData(await api.getActivationCodesBatchesByBatchId({ batchId: id }))
      const mapped = mapActivationDetail(raw)
      if (mapped.code.codeId && mapped.code.codeId !== mapped.batch.batchId) return cast(mapped)
      const page = asPage(await unwrapData(await api.getActivationCodes({ batchId: id, page: 1, pageSize: 1 } as never)))
      const hit = arr(page.items)[0]
      if (!hit) {
        // Caller asked for a code id; fall through to keyword search below.
        throw new Error('NOT_CODE_DETAIL')
      }
      return cast(mapActivationDetail({ code: hit, batch: raw, audit: [] }))
    } catch (inner) {
      if (inner instanceof ActivationError) throw inner
      const page = asPage(await unwrapData(await api.getActivationCodes({ keyword: id, page: 1, pageSize: 20 } as never)))
      const hit = arr(page.items).find((i) => str(record(i).codeId || record(i).id) === id) || arr(page.items)[0]
      if (!hit) throw new ActivationError('NOT_FOUND', '激活码不存在')
      return cast(mapActivationDetail({ code: hit, batch: { batchId: record(hit).batchId }, audit: [] }))
    }
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationAudit() {
  try {
    const catalog = record(await unwrapData(await api.getActivationCodesCatalog()))
    return cast(arr(catalog.audit || catalog.recentOperations || catalog.operations || catalog.logs).map(mapActivationAudit))
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationMutate(input: ActivationMutation) {
  try {
    const actionMap: Record<string, string> = {
      generate: 'activate',
      issue: 'activate',
      revoke: 'revoke',
      reissue: 'reassign',
      'set-expiry': 'deactivate',
    }
    const action = actionMap[input.action]
    if (!action) unsupported(ActivationError, input.action, '激活码操作与 HQ activation-codes actions 无法映射')
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    if (input.action === 'generate') {
      await unwrapData(await api.postActivationCodesBatches(body as never))
    } else {
      await unwrapData(await api.postActivationCodesMutate(body as never))
    }
    return realActivationOptions()
  } catch (error) { return mapHqError(error, ActivationError) }
}

export async function realActivationExport(_input: ActivationExportRequest) {
  return unsupported(ActivationError, 'export', 'HQ activation-codes API 未暴露导出下载')
}