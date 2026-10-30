from pathlib import Path
Path(r"E:\project\react-web\naoshang-front-react\src\services\real\softwareCards.ts").write_text(r"""import * as api from '../../api'
import { SoftwareCardError, type SoftwareCard, type SoftwareCatalog, type SoftwareExportRequest, type SoftwareList, type SoftwareMutation, type SoftwareQuery } from '../../types/softwareCards'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unsupported, unwrapData } from './bridge'

export function mapSoftwareCard(raw: unknown): SoftwareCard {
  const r = record(raw)
  const status = str(r.status || r.stockStatus, 'available').toLowerCase()
  const stock = (['available', 'assigned', 'delivered', 'retired', 'replaced'].includes(status) ? status : 'available') as SoftwareCard['status']
  const deliveryModeRaw = str(r.deliveryMode).toLowerCase()
  const deliveryMode = deliveryModeRaw === 'hq' || deliveryModeRaw === 'store' ? deliveryModeRaw : null
  const external = str(r.externalStatus, 'unknown').toLowerCase()
  const externalStatus = (['unknown', 'inactive', 'active', 'expired'].includes(external) ? external : 'unknown') as SoftwareCard['externalStatus']
  return {
    cardId: str(r.cardId || r.id),
    batchId: str(r.batchId),
    typeId: str(r.typeId),
    typeName: str(r.typeName || r.name),
    maskedCode: str(r.maskedCode || r.codeMasked || r.code || '****'),
    status: stock,
    version: num(r.version, 1),
    claimDeadline: nullableStr(r.claimDeadline),
    claimExpired: bool(r.claimExpired),
    externalStatus,
    externalValidUntil: nullableStr(r.externalValidUntil),
    externalCheckedAt: nullableStr(r.externalCheckedAt),
    deliveryMode,
    deliveryStoreId: nullableStr(r.deliveryStoreId),
    accountId: nullableStr(r.accountId),
    accountName: nullableStr(r.accountName),
    sourceOrderId: nullableStr(r.sourceOrderId),
    assignedAt: nullableStr(r.assignedAt),
    deliveredAt: nullableStr(r.deliveredAt),
    secretExportedAt: nullableStr(r.secretExportedAt),
    replacesCardId: nullableStr(r.replacesCardId),
    replacementCardId: nullableStr(r.replacementCardId),
    createdAt: str(r.createdAt),
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action: str(r.action, 'assign') as never,
    cardIds: stringList(r.cardIds),
    batchId: nullableStr(r.batchId),
    typeId: nullableStr(r.typeId),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    before: str(r.before),
    after: str(r.after),
    occurredAt: str(r.occurredAt || r.createdAt),
  }
}

export function mapSoftwareCatalog(raw: unknown): SoftwareCatalog {
  const r = record(raw)
  const options = record(r.options)
  return {
    types: arr(r.types).map((item) => {
      const row = record(item)
      return {
        typeId: str(row.typeId || row.id),
        businessCode: str(row.businessCode || row.code),
        name: str(row.name),
        termLabel: str(row.termLabel),
        systemLabel: str(row.systemLabel),
        description: str(row.description),
        active: row.active !== false,
        version: num(row.version, 1),
      }
    }),
    batches: arr(r.batches).map((item) => {
      const row = record(item)
      return {
        batchId: str(row.batchId || row.id),
        name: str(row.name),
        typeId: str(row.typeId),
        typeName: str(row.typeName),
        source: str(row.source, 'hq') as never,
        sourceName: str(row.sourceName),
        referenceNo: str(row.referenceNo),
        quantity: num(row.quantity),
        claimDeadline: nullableStr(row.claimDeadline),
        createdAt: str(row.createdAt),
        createdBy: str(row.createdBy),
      }
    }),
    audit: arr(r.audit).map(mapAudit),
    options: {
      maxImportSize: num(options.maxImportSize, 500),
      maxSelectionSize: num(options.maxSelectionSize, 50),
      accounts: arr(options.accounts).map((item) => {
        const row = record(item)
        return { accountId: str(row.accountId || row.id), name: str(row.name || row.nickname), phone: str(row.phone), storeId: nullableStr(row.storeId) }
      }),
      stores: arr(options.stores).map((item) => {
        const row = record(item)
        return { storeId: str(row.storeId || row.id), name: str(row.name), number: str(row.number || row.code), active: row.active !== false }
      }),
      orders: arr(options.orders).map((item) => {
        const row = record(item)
        return {
          orderId: str(row.orderId || row.id),
          orderNo: str(row.orderNo),
          accountId: str(row.accountId),
          typeId: str(row.typeId),
          fulfillmentType: 'ACTIVATION_CODE' as const,
          status: str(row.status, 'PAID') as never,
          quantity: num(row.quantity),
          remainingQuantity: num(row.remainingQuantity),
          deliveryMode: str(row.deliveryMode, 'hq') as never,
          deliveryStoreId: nullableStr(row.deliveryStoreId),
          mockOnly: false,
        }
      }),
    },
  }
}

export async function realSoftwareCatalog() {
  try { return mapSoftwareCatalog(await unwrapData(await api.getSoftwareCardsCatalog())) }
  catch (error) { return mapHqError(error, SoftwareCardError) }
}

export async function realSoftwareList(query: SoftwareQuery): Promise<SoftwareList> {
  try {
    const page = asPage(await unwrapData(await api.getSoftwareCards({ ...query } as never)), query.page, query.pageSize)
    return { items: page.items.map(mapSoftwareCard), total: page.total, page: page.page, pageSize: page.pageSize }
  } catch (error) { return mapHqError(error, SoftwareCardError) }
}

export async function realSoftwareDetail(id: string) {
  try {
    const page = asPage(await unwrapData(await api.getSoftwareCards({ keyword: id, page: 1, pageSize: 20 } as never)))
    const hit = page.items.find((i) => str(record(i).cardId || record(i).id) === id) || page.items[0]
    if (!hit) throw new SoftwareCardError('NOT_FOUND', '软件卡不存在')
    return mapSoftwareCard(hit)
  } catch (error) { return mapHqError(error, SoftwareCardError) }
}

export async function realSoftwareReplacements(id: string) {
  try {
    const detail = record(await realSoftwareDetail(id) as never)
    return arr(detail.replacements).map(mapSoftwareCard)
  } catch (error) { return mapHqError(error, SoftwareCardError) }
}

export async function realSoftwareMutate(input: SoftwareMutation) {
  try {
    const actionMap: Record<string, string> = {
      'save-type': 'activate', import: 'activate', assign: 'bind', deliver: 'activate', retire: 'deactivate', replace: 'revoke',
    }
    const action = actionMap[input.action]
    if (!action) unsupported(SoftwareCardError, input.action, '软件卡操作与 HQ software-cards actions 无法映射')
    if (input.action === 'import' || input.action === 'save-type') {
      const body = mutationBody({ ...record(input as never), action: 'activate', reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
      await unwrapData(await api.postSoftwareCardsBatches(body as never))
    } else {
      const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
      await unwrapData(await api.postSoftwareCardsMutate(body as never))
    }
    return realSoftwareCatalog()
  } catch (error) { return mapHqError(error, SoftwareCardError) }
}

export async function realSoftwareExport(_input: SoftwareExportRequest) {
  return unsupported(SoftwareCardError, 'export', 'HQ software-cards API 未暴露导出下载')
}
""", encoding="utf-8")
print("softwareCards ok")