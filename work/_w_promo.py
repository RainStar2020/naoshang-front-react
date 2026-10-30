from pathlib import Path
Path(r"E:\project\react-web\naoshang-front-react\src\services\real\promo-materials.ts").write_text(r"""import * as api from '../../api'
import { PromoMaterialError, type PromoMaterialCatalog, type PromoMaterialDetail, type PromoMaterialList, type PromoMaterialMutation, type PromoMaterialQuery, type PromoMaterialTemplate } from '../../types/promo-materials'
import { arr, asPage, bool, mapHqError, mutationBody, num, record, str, stringList, nullableStr, unwrapData } from './bridge'

const emptyRich = { version: 1 as const, format: 'nodes' as const, nodes: [] as never[] }

export function mapPromoTemplate(raw: unknown): PromoMaterialTemplate {
  const r = record(raw)
  const typeRaw = str(r.type, 'image').toLowerCase()
  const type = (typeRaw === 'article' || typeRaw === 'video' ? typeRaw : 'image') as PromoMaterialTemplate['type']
  const statusRaw = str(r.status, 'DRAFT').toUpperCase()
  const status = (statusRaw === 'PUBLISHED' || statusRaw === 'OFFLINE' ? statusRaw : 'DRAFT') as PromoMaterialTemplate['status']
  const article = r.articleContent == null ? null : {
    version: 1 as const,
    format: 'nodes' as const,
    nodes: arr(record(r.articleContent).nodes) as never[],
  }
  const qr = r.qrRegion == null ? null : (() => {
    const q = record(r.qrRegion)
    return { x: num(q.x), y: num(q.y), width: num(q.width), height: num(q.height) }
  })()
  const ops = stringList(r.partnerOperations) as PromoMaterialTemplate['partnerOperations']
  return {
    materialId: str(r.materialId || r.id),
    title: str(r.title || r.name, '未命名素材'),
    type,
    categoryId: str(r.categoryId),
    categoryName: str(r.categoryName),
    status,
    coverUrl: str(r.coverUrl || r.cover),
    mediaUrl: str(r.mediaUrl || r.url),
    posterUrl: nullableStr(r.posterUrl),
    summary: str(r.summary),
    articleContent: article,
    qrSlotAtEnd: bool(r.qrSlotAtEnd),
    qrRegion: qr,
    mediaWidth: num(r.mediaWidth),
    mediaHeight: num(r.mediaHeight),
    videoDeliveryMode: str(r.videoDeliveryMode) === 'INTERACTIVE_H5' ? 'INTERACTIVE_H5' : null,
    h5RouteReady: bool(r.h5RouteReady),
    h5RouteNote: str(r.h5RouteNote),
    shareUrlTemplate: str(r.shareUrlTemplate),
    partnerOperations: ops,
    composedAssetForbidden: true,
    version: num(r.version, 1),
    updatedAt: str(r.updatedAt || r.createdAt),
    publishedAt: nullableStr(r.publishedAt),
    mockOnly: false,
    allowedActions: stringList(r.allowedActions) as PromoMaterialTemplate['allowedActions'],
  }
}

function mapAudit(raw: unknown) {
  const r = record(raw)
  return {
    operationId: str(r.operationId || r.id),
    requestId: str(r.requestId),
    action: str(r.action, 'save') as never,
    targetId: str(r.targetId || r.materialId),
    before: str(r.before),
    after: str(r.after),
    reason: str(r.reason),
    operatorId: str(r.operatorId),
    operatorName: str(r.operatorName || r.operator),
    occurredAt: str(r.occurredAt || r.createdAt),
    beforeVersion: num(r.beforeVersion),
    afterVersion: num(r.afterVersion ?? r.version),
  }
}

export function mapPromoCatalog(raw: unknown): PromoMaterialCatalog {
  const r = record(raw)
  return {
    categories: arr(r.categories).map((item) => {
      const row = record(item)
      const typeRaw = str(row.type, 'image').toLowerCase()
      return {
        categoryId: str(row.categoryId || row.id),
        name: str(row.name),
        type: (typeRaw === 'article' || typeRaw === 'video' ? typeRaw : 'image') as never,
      }
    }),
    types: arr(r.types).length
      ? arr(r.types).map((item) => {
          const row = record(item)
          return { id: str(row.id || row.type) as never, label: str(row.label || row.name) }
        })
      : [
          { id: 'image' as const, label: '图片' },
          { id: 'article' as const, label: '图文' },
          { id: 'video' as const, label: '视频' },
        ],
    composeGapNote: str(r.composeGapNote),
    videoH5GapNote: str(r.videoH5GapNote),
    pendingPolicy: record(r.pendingPolicy) as PromoMaterialCatalog['pendingPolicy'],
    mockOnly: false,
  }
}

export function mapPromoDetail(raw: unknown): PromoMaterialDetail {
  const r = record(raw)
  return {
    template: mapPromoTemplate(r.template ?? r),
    audit: arr(r.audit).map(mapAudit),
    composeGapNote: str(r.composeGapNote),
    videoH5GapNote: str(r.videoH5GapNote),
  }
}

export async function realPromoMaterialCatalog() {
  try { return mapPromoCatalog(await unwrapData(await api.getMaterialsCatalog())) }
  catch (error) { return mapHqError(error, PromoMaterialError) }
}

export async function realPromoMaterialList(query: PromoMaterialQuery): Promise<PromoMaterialList> {
  try {
    const page = asPage(await unwrapData(await api.getMaterials({ ...query } as never)), query.page, query.pageSize)
    const summary = record(page.summary)
    return {
      items: page.items.map(mapPromoTemplate),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      summary: {
        total: num(summary.total, page.total),
        draft: num(summary.draft),
        published: num(summary.published),
        offline: num(summary.offline),
      } as PromoMaterialList['summary'],
    }
  } catch (error) { return mapHqError(error, PromoMaterialError) }
}

export async function realPromoMaterialDetail(materialId: string) {
  try { return mapPromoDetail(await unwrapData(await api.getMaterialsByMaterialId({ materialId }))) }
  catch (error) { return mapHqError(error, PromoMaterialError) }
}

export async function realPromoMaterialMutate(input: PromoMaterialMutation) {
  try {
    const body = mutationBody({ ...record(input as never), action: str((input as { action?: string }).action, 'update'), reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as { version?: number }).version })
    await unwrapData(await api.postMaterialsMutate(body as never))
    const materialId = str((input as { materialId?: string }).materialId)
    return materialId ? realPromoMaterialDetail(materialId) : realPromoMaterialCatalog()
  } catch (error) { return mapHqError(error, PromoMaterialError) }
}

void emptyRich
""", encoding="utf-8")
print("promo ok")