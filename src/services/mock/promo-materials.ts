import type {
  PartnerMaterialOp,
  PromoMaterialAction,
  PromoMaterialAudit,
  PromoMaterialCatalog,
  PromoMaterialCategory,
  PromoMaterialDetail,
  PromoMaterialList,
  PromoMaterialMutation,
  PromoMaterialMutationResult,
  PromoMaterialQuery,
  PromoMaterialTemplate,
  QrFillRegion,
} from '../../types/promo-materials'
import { PromoMaterialError } from '../../types/promo-materials'
import type { RichContent } from '../../types/cms'
import { emptyContent } from '../../utils/richContent'

const STORAGE_KEY = 'ns_hq_promo_materials_v1'
const AUDIT_KEY = 'ns_hq_promo_materials_audit_v1'
const IDEM_KEY = 'ns_hq_promo_materials_idem_v1'

export const COMPOSE_GAP =
  '合图由服务端完成：总部只维护原图与唯一二维码填充区；用户侧只上传码。前端禁止假装已合成最终图，不得本地烧录伪终图。'

export const VIDEO_H5_GAP =
  '视频素材走互动 H5，不默认烧录二维码；当前无专用 web-view 路由，属联调增量，h5RouteReady 恒为 false。'

type IdemRecord = { fingerprint: string; result: PromoMaterialMutationResult }
type StoreShape = {
  items: PromoMaterialTemplate[]
  audit: PromoMaterialAudit[]
  idem: Record<string, IdemRecord>
}

const CATEGORIES: PromoMaterialCategory[] = [
  { categoryId: 'image-cat-1', name: '营销海报', type: 'image' },
  { categoryId: 'image-cat-2', name: '课程封面模板', type: 'image' },
  { categoryId: 'article-cat-1', name: '干货图文', type: 'article' },
  { categoryId: 'article-cat-2', name: '政策说明', type: 'article' },
  { categoryId: 'video-cat-1', name: '宣传视频', type: 'video' },
  { categoryId: 'video-cat-2', name: '学员案例', type: 'video' },
]

function nowIso() {
  return new Date().toISOString()
}

function stamp(offsetMin = 0) {
  return new Date(Date.now() - offsetMin * 60_000).toISOString()
}

function partnerOps(type: PromoMaterialTemplate['type'], status: PromoMaterialTemplate['status']): PartnerMaterialOp[] {
  if (status !== 'PUBLISHED') return []
  if (type === 'image') return ['upload-qr', 'render', 'download']
  if (type === 'video') return ['upload-qr', 'copy-link']
  return ['upload-qr', 'copy-link']
}

function actionsFor(row: PromoMaterialTemplate): PromoMaterialAction[] {
  const a: PromoMaterialAction[] = []
  if (row.status === 'DRAFT' || row.status === 'OFFLINE') a.push('save', 'set-qr-region', 'publish')
  if (row.status === 'DRAFT') a.push('delete')
  if (row.status === 'PUBLISHED') a.push('offline', 'save', 'set-qr-region')
  if (row.type === 'video' || row.type === 'article') {
    // video no burn; article end slot
    return a.filter((x) => x !== 'set-qr-region')
  }
  return a
}

function withDerived(row: PromoMaterialTemplate): PromoMaterialTemplate {
  const next: PromoMaterialTemplate = {
    ...row,
    articleContent: row.type === 'article' ? (row.articleContent ?? emptyContent()) : null,
    qrSlotAtEnd: row.type === 'article' ? !!row.qrSlotAtEnd : false,
    qrRegion: row.type === 'image' ? row.qrRegion ?? null : null,
    partnerOperations: partnerOps(row.type, row.status),
    composedAssetForbidden: true,
    videoDeliveryMode: row.type === 'video' ? 'INTERACTIVE_H5' : null,
    h5RouteReady: false,
    h5RouteNote: row.type === 'video' ? VIDEO_H5_GAP : '',
    allowedActions: [],
    mockOnly: true,
  }
  next.allowedActions = actionsFor(next)
  return next
}

function validateRegion(region: QrFillRegion): void {
  const { x, y, width, height } = region
  if (![x, y, width, height].every((n) => Number.isFinite(n))) {
    throw new PromoMaterialError('QR_REGION_INVALID', '二维码区域坐标无效')
  }
  if (width <= 0 || height <= 0) {
    throw new PromoMaterialError('QR_REGION_INVALID', '二维码区域宽高须大于 0')
  }
  if (x < 0 || y < 0 || x + width > 1.0001 || y + height > 1.0001) {
    throw new PromoMaterialError('QR_REGION_INVALID', '二维码区域须落在原图归一化范围 [0,1] 内，且每模板仅一区')
  }
  if (Math.abs(width - height) > 0.001) {
    throw new PromoMaterialError('QR_REGION_INVALID', '二维码填充区须为正方形（宽高相等）')
  }
}

function seed(): PromoMaterialTemplate[] {
  const base: Omit<PromoMaterialTemplate, 'allowedActions' | 'mockOnly' | 'partnerOperations' | 'composedAssetForbidden' | 'videoDeliveryMode' | 'h5RouteReady' | 'h5RouteNote' | 'articleContent' | 'qrSlotAtEnd'>[] = [
    {
      materialId: 'pm-image-poster-1',
      title: '联创招募海报 A',
      type: 'image',
      categoryId: 'image-cat-1',
      categoryName: '营销海报',
      status: 'PUBLISHED',
      coverUrl: 'https://picsum.photos/seed/pm-poster-a/400/400',
      mediaUrl: 'https://picsum.photos/seed/pm-poster-a/800/1200',
      posterUrl: null,
      summary: '原图右下唯一二维码填充区，用户上传码后由服务端合成',
      qrRegion: { x: 0.7, y: 0.75, width: 0.2, height: 0.2 },
      mediaWidth: 800,
      mediaHeight: 1200,
      shareUrlTemplate: 'https://example.local/invite?code={inviteCode}',
      version: 2,
      updatedAt: stamp(120),
      publishedAt: stamp(200),
    },
    {
      materialId: 'pm-image-draft-1',
      title: '暑期课封面模板（草稿）',
      type: 'image',
      categoryId: 'image-cat-2',
      categoryName: '课程封面模板',
      status: 'DRAFT',
      coverUrl: 'https://picsum.photos/seed/pm-cover-draft/400/400',
      mediaUrl: 'https://picsum.photos/seed/pm-cover-draft/900/900',
      posterUrl: null,
      summary: '草稿：尚未框选二维码区，不可发布',
      qrRegion: null,
      mediaWidth: 900,
      mediaHeight: 900,
      shareUrlTemplate: 'https://example.local/invite?code={inviteCode}',
      version: 1,
      updatedAt: stamp(40),
      publishedAt: null,
    },
    {
      materialId: 'pm-image-offline-1',
      title: '旧版门店物料',
      type: 'image',
      categoryId: 'image-cat-1',
      categoryName: '营销海报',
      status: 'OFFLINE',
      coverUrl: 'https://picsum.photos/seed/pm-offline/400/400',
      mediaUrl: 'https://picsum.photos/seed/pm-offline/800/1000',
      posterUrl: null,
      summary: '已下线模板，保留历史区域',
      qrRegion: { x: 0.1, y: 0.7, width: 0.2, height: 0.2 },
      mediaWidth: 800,
      mediaHeight: 1000,
      shareUrlTemplate: 'https://example.local/invite?code={inviteCode}',
      version: 3,
      updatedAt: stamp(800),
      publishedAt: stamp(900),
    },
    {
      materialId: 'pm-article-1',
      title: '如何邀请下级合伙人',
      type: 'article',
      categoryId: 'article-cat-1',
      categoryName: '干货图文',
      status: 'PUBLISHED',
      coverUrl: 'https://picsum.photos/seed/pm-article/400/300',
      mediaUrl: 'https://picsum.photos/seed/pm-article/800/600',
      posterUrl: null,
      summary: '图文素材：末尾唯一二维码预留位；用户上传码，合图走服务端',
      qrRegion: null,
      mediaWidth: 800,
      mediaHeight: 600,
      shareUrlTemplate: 'https://example.local/article/invite?code={inviteCode}',
      version: 1,
      updatedAt: stamp(300),
      publishedAt: stamp(310),
    },
    {
      materialId: 'pm-article-draft-1',
      title: '招商图文（草稿无码位）',
      type: 'article',
      categoryId: 'article-cat-2',
      categoryName: '政策说明',
      status: 'DRAFT',
      coverUrl: 'https://picsum.photos/seed/pm-article-draft/400/300',
      mediaUrl: 'https://picsum.photos/seed/pm-article-draft/800/600',
      posterUrl: null,
      summary: '草稿：未启用末尾二维码预留位，不可发布',
      qrRegion: null,
      mediaWidth: 800,
      mediaHeight: 600,
      shareUrlTemplate: 'https://example.local/article/invite?code={inviteCode}',
      version: 1,
      updatedAt: stamp(25),
      publishedAt: null,
    },
    {
      materialId: 'pm-video-1',
      title: '品牌宣传片 · 互动 H5',
      type: 'video',
      categoryId: 'video-cat-1',
      categoryName: '宣传视频',
      status: 'PUBLISHED',
      coverUrl: 'https://picsum.photos/seed/pm-video/400/300',
      mediaUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      posterUrl: 'https://picsum.photos/seed/pm-video-poster/800/450',
      summary: '视频不烧录二维码；互动 H5 专用路由待联调',
      qrRegion: null,
      mediaWidth: 1280,
      mediaHeight: 720,
      shareUrlTemplate: 'https://example.local/h5/video?code={inviteCode}',
      version: 1,
      updatedAt: stamp(50),
      publishedAt: stamp(55),
    },
    {
      materialId: 'pm-video-draft-1',
      title: '学员案例剪辑（草稿）',
      type: 'video',
      categoryId: 'video-cat-2',
      categoryName: '学员案例',
      status: 'DRAFT',
      coverUrl: 'https://picsum.photos/seed/pm-video-draft/400/300',
      mediaUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      posterUrl: 'https://picsum.photos/seed/pm-video-draft-p/800/450',
      summary: '草稿视频，发布后仍为互动 H5，无烧录区',
      qrRegion: null,
      mediaWidth: 1280,
      mediaHeight: 720,
      shareUrlTemplate: 'https://example.local/h5/video?code={inviteCode}',
      version: 1,
      updatedAt: stamp(20),
      publishedAt: null,
    },
  ]
  return base.map((row) => {
    const stamped =
      row.materialId === 'pm-article-1'
        ? {
            ...row,
            articleContent: {
              version: 1 as const,
              format: 'nodes' as const,
              nodes: [
                { name: 'p' as const, attrs: {}, children: [{ type: 'text' as const, text: '邀请下级合伙人时，请先完成实名与签约。' }] },
                { name: 'p' as const, attrs: {}, children: [{ type: 'text' as const, text: '文末预留二维码位，由用户上传个人码后服务端合成。' }] },
              ],
            },
            qrSlotAtEnd: true,
          }
        : row.type === 'article'
          ? { ...row, articleContent: emptyContent(), qrSlotAtEnd: false }
          : row
    return withDerived({
      ...stamped,
      partnerOperations: [],
      composedAssetForbidden: true,
      videoDeliveryMode: null,
      h5RouteReady: false,
      h5RouteNote: '',
      allowedActions: [],
      mockOnly: true,
    } as PromoMaterialTemplate)
  })
}

function emptyStore(): StoreShape {
  return { items: seed(), audit: [], idem: {} }
}

function load(): StoreShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StoreShape
    if (!Array.isArray(parsed.items)) return emptyStore()
    return {
      items: parsed.items.map((row) => withDerived(row)),
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      idem: parsed.idem && typeof parsed.idem === 'object' ? parsed.idem : {},
    }
  } catch {
    return emptyStore()
  }
}

function save(state: StoreShape) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, audit: state.audit, idem: state.idem }))
  sessionStorage.setItem(AUDIT_KEY, JSON.stringify(state.audit))
  sessionStorage.setItem(IDEM_KEY, JSON.stringify(state.idem))
}

function find(items: PromoMaterialTemplate[], id: string) {
  return items.find((row) => row.materialId === id)
}

function categoryName(categoryId: string, type: PromoMaterialTemplate['type']) {
  const hit = CATEGORIES.find((c) => c.categoryId === categoryId && c.type === type)
  if (!hit) throw new PromoMaterialError('INVALID_INPUT', '分类与素材类型不匹配')
  return hit.name
}

function pushAudit(
  state: StoreShape,
  input: Omit<PromoMaterialAudit, 'operationId' | 'occurredAt'>,
) {
  state.audit.unshift({
    ...input,
    operationId: `pma-${crypto.randomUUID()}`,
    occurredAt: nowIso(),
  })
}

function summarize(items: PromoMaterialTemplate[]) {
  return {
    templates: items.length,
    draft: items.filter((i) => i.status === 'DRAFT').length,
    published: items.filter((i) => i.status === 'PUBLISHED').length,
    offline: items.filter((i) => i.status === 'OFFLINE').length,
    imageWithRegion: items.filter((i) => i.type === 'image' && i.qrRegion).length,
    videoH5: items.filter((i) => i.type === 'video').length,
    missingQrRegion: items.filter((i) => (i.type === 'image' && !i.qrRegion) || (i.type === 'article' && !i.qrSlotAtEnd)).length,
  }
}

export function mockPromoMaterialCatalog(): PromoMaterialCatalog {
  return {
    categories: CATEGORIES.map((c) => ({ ...c })),
    types: [
      { id: 'image', label: '图片素材' },
      { id: 'article', label: '图文素材' },
      { id: 'video', label: '视频素材' },
    ],
    composeGapNote: COMPOSE_GAP,
    videoH5GapNote: VIDEO_H5_GAP,
    pendingPolicy: { dedicatedWebViewRoutePending: true, clientSideComposeForbidden: true },
    mockOnly: true,
  }
}

export function mockPromoMaterialList(query: PromoMaterialQuery): PromoMaterialList {
  const state = load()
  let rows = [...state.items]
  if (query.type) rows = rows.filter((r) => r.type === query.type)
  if (query.status) rows = rows.filter((r) => r.status === query.status)
  if (query.categoryId) rows = rows.filter((r) => r.categoryId === query.categoryId)
  const kw = query.keyword?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(kw) ||
        r.summary.toLowerCase().includes(kw) ||
        r.materialId.toLowerCase().includes(kw),
    )
  }
  const total = rows.length
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  const items = rows.slice(start, start + query.pageSize).map((r) => withDerived(r))
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: summarize(state.items),
  }
}

export function mockPromoMaterialDetail(materialId: string): PromoMaterialDetail {
  const state = load()
  const row = find(state.items, materialId)
  if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
  return {
    template: withDerived(row),
    audit: state.audit.filter((a) => a.targetId === materialId).slice(0, 20),
    composeGapNote: COMPOSE_GAP,
    videoH5GapNote: VIDEO_H5_GAP,
  }
}

export function mockPromoMaterialMutate(
  mutation: PromoMaterialMutation,
  operator: { operatorId: string; operatorName: string },
): PromoMaterialMutationResult {
  const state = load()
  const fingerprint = JSON.stringify(mutation)
  const prev = state.idem[mutation.idempotencyKey]
  if (prev) {
    if (prev.fingerprint === fingerprint) return prev.result
    throw new PromoMaterialError('IDEMPOTENCY_CONFLICT', '幂等键已用于其他操作')
  }
  if (!mutation.reason.trim()) throw new PromoMaterialError('INVALID_INPUT', '请填写原因')

  let result: PromoMaterialMutationResult

  if (mutation.action === 'save') {
    const title = mutation.title.trim()
    if (!title) throw new PromoMaterialError('INVALID_INPUT', '请填写标题')
    if (!mutation.mediaUrl.trim()) throw new PromoMaterialError('INVALID_INPUT', '请填写原图/媒体地址')
    if (!Number.isFinite(mutation.mediaWidth) || !Number.isFinite(mutation.mediaHeight) || mutation.mediaWidth <= 0 || mutation.mediaHeight <= 0) {
      throw new PromoMaterialError('INVALID_INPUT', '媒体宽高须为正数')
    }
    const catName = categoryName(mutation.categoryId, mutation.type)

    if (!mutation.materialId) {
      if (mutation.version !== 0) throw new PromoMaterialError('INVALID_INPUT', '新建模板 version 须为 0')
      const created = withDerived({
        materialId: `pm-${mutation.type}-${crypto.randomUUID().slice(0, 8)}`,
        title,
        type: mutation.type,
        categoryId: mutation.categoryId,
        categoryName: catName,
        status: 'DRAFT',
        coverUrl: mutation.coverUrl.trim() || mutation.mediaUrl.trim(),
        mediaUrl: mutation.mediaUrl.trim(),
        posterUrl: mutation.type === 'video' ? mutation.posterUrl ?? null : null,
        summary: mutation.summary.trim(),
        articleContent: mutation.type === 'article' ? (mutation.articleContent ?? emptyContent()) : null,
        qrSlotAtEnd: mutation.type === 'article' ? !!mutation.qrSlotAtEnd : false,
        qrRegion: null,
        mediaWidth: mutation.mediaWidth,
        mediaHeight: mutation.mediaHeight,
        videoDeliveryMode: mutation.type === 'video' ? 'INTERACTIVE_H5' : null,
        h5RouteReady: false,
        h5RouteNote: mutation.type === 'video' ? VIDEO_H5_GAP : '',
        shareUrlTemplate: mutation.shareUrlTemplate.trim() || 'https://example.local/invite?code={inviteCode}',
        partnerOperations: [],
        composedAssetForbidden: true,
        version: 1,
        updatedAt: nowIso(),
        publishedAt: null,
        mockOnly: true,
        allowedActions: [],
      })
      state.items.unshift(created)
      pushAudit(state, {
        requestId: mutation.idempotencyKey,
        action: 'save',
        targetId: created.materialId,
        before: '(none)',
        after: `DRAFT:${created.title}`,
        reason: mutation.reason.trim(),
        operatorId: operator.operatorId,
        operatorName: operator.operatorName,
        beforeVersion: 0,
        afterVersion: created.version,
      })
      result = { action: 'save', template: created, mockOnly: true, message: '已创建草稿模板（未合成终图）' }
    } else {
      const row = find(state.items, mutation.materialId)
      if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
      if (row.version !== mutation.version) throw new PromoMaterialError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
      if (row.type !== mutation.type) throw new PromoMaterialError('INVALID_INPUT', '不可更改素材类型')
      const beforeV = row.version
      const before = `${row.status}:${row.title}`
      row.title = title
      row.categoryId = mutation.categoryId
      row.categoryName = catName
      row.coverUrl = mutation.coverUrl.trim() || mutation.mediaUrl.trim()
      row.mediaUrl = mutation.mediaUrl.trim()
      row.posterUrl = row.type === 'video' ? mutation.posterUrl ?? null : null
      row.summary = mutation.summary.trim()
      if (row.type === 'article') {
        row.articleContent = mutation.articleContent ?? row.articleContent ?? emptyContent()
        row.qrSlotAtEnd = !!mutation.qrSlotAtEnd
        row.qrRegion = null
      }
      row.mediaWidth = mutation.mediaWidth
      row.mediaHeight = mutation.mediaHeight
      row.shareUrlTemplate = mutation.shareUrlTemplate.trim() || row.shareUrlTemplate
      row.updatedAt = nowIso()
      row.version += 1
      const updated = withDerived(row)
      const idx = state.items.findIndex((i) => i.materialId === row.materialId)
      state.items[idx] = updated
      pushAudit(state, {
        requestId: mutation.idempotencyKey,
        action: 'save',
        targetId: row.materialId,
        before,
        after: `${updated.status}:${updated.title}`,
        reason: mutation.reason.trim(),
        operatorId: operator.operatorId,
        operatorName: operator.operatorName,
        beforeVersion: beforeV,
        afterVersion: updated.version,
      })
      result = { action: 'save', template: updated, mockOnly: true, message: '已保存模板字段（不含合图）' }
    }
  } else if (mutation.action === 'set-qr-region') {
    const row = find(state.items, mutation.materialId)
    if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
    if (row.version !== mutation.version) throw new PromoMaterialError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.type === 'video') {
      throw new PromoMaterialError('INVALID_STATE', '视频走互动 H5，不设置烧录二维码区')
    }
    if (row.type === 'article') {
      throw new PromoMaterialError('INVALID_STATE', '图文使用末尾二维码预留位，请在保存时勾选码位，不框选原图区')
    }
    validateRegion(mutation.qrRegion)
    const beforeV = row.version
    const before = row.qrRegion ? JSON.stringify(row.qrRegion) : '(none)'
    row.qrRegion = { ...mutation.qrRegion }
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withDerived(row)
    const idx = state.items.findIndex((i) => i.materialId === row.materialId)
    state.items[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'set-qr-region',
      targetId: row.materialId,
      before,
      after: JSON.stringify(updated.qrRegion),
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'set-qr-region', template: updated, mockOnly: true, message: '已更新唯一二维码填充区（未合成终图）' }
  } else if (mutation.action === 'publish') {
    const row = find(state.items, mutation.materialId)
    if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
    if (row.version !== mutation.version) throw new PromoMaterialError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status === 'PUBLISHED') throw new PromoMaterialError('INVALID_STATE', '已发布')
    if (!row.mediaUrl) throw new PromoMaterialError('INVALID_INPUT', '缺少原图/媒体')
    if (row.type === 'image' && !row.qrRegion) {
      throw new PromoMaterialError('QR_REGION_REQUIRED', '图片模板发布前须框选唯一正方形二维码填充区')
    }
    if (row.type === 'article' && !row.qrSlotAtEnd) {
      throw new PromoMaterialError('QR_SLOT_REQUIRED', '图文模板发布前须启用末尾唯一二维码预留位')
    }
    if (row.type === 'image' && row.qrRegion) validateRegion(row.qrRegion)
    const beforeV = row.version
    const before = row.status
    row.status = 'PUBLISHED'
    row.publishedAt = nowIso()
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withDerived(row)
    const idx = state.items.findIndex((i) => i.materialId === row.materialId)
    state.items[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'publish',
      targetId: row.materialId,
      before,
      after: 'PUBLISHED（模板上线；合图仍由服务端）',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'publish', template: updated, mockOnly: true, message: '已发布模板；不生成合成终图' }
  } else if (mutation.action === 'offline') {
    const row = find(state.items, mutation.materialId)
    if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
    if (row.version !== mutation.version) throw new PromoMaterialError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'PUBLISHED') throw new PromoMaterialError('INVALID_STATE', '仅已发布可下线')
    const beforeV = row.version
    const before = row.status
    row.status = 'OFFLINE'
    row.updatedAt = nowIso()
    row.version += 1
    const updated = withDerived(row)
    const idx = state.items.findIndex((i) => i.materialId === row.materialId)
    state.items[idx] = updated
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'offline',
      targetId: row.materialId,
      before,
      after: 'OFFLINE',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: updated.version,
    })
    result = { action: 'offline', template: updated, mockOnly: true, message: '已下线模板' }
  } else if (mutation.action === 'delete') {
    const row = find(state.items, mutation.materialId)
    if (!row) throw new PromoMaterialError('NOT_FOUND', '素材模板不存在')
    if (row.version !== mutation.version) throw new PromoMaterialError('VERSION_CONFLICT', '版本冲突，请刷新后重试')
    if (row.status !== 'DRAFT') throw new PromoMaterialError('INVALID_STATE', '仅草稿可删除')
    const beforeV = row.version
    state.items = state.items.filter((i) => i.materialId !== row.materialId)
    pushAudit(state, {
      requestId: mutation.idempotencyKey,
      action: 'delete',
      targetId: row.materialId,
      before: `DRAFT:${row.title}`,
      after: '(deleted)',
      reason: mutation.reason.trim(),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      beforeVersion: beforeV,
      afterVersion: beforeV,
    })
    const ghost = withDerived({ ...row, status: 'DRAFT', version: beforeV })
    result = { action: 'delete', template: ghost, mockOnly: true, message: '已删除草稿' }
  } else {
    throw new PromoMaterialError('INVALID_INPUT', '操作类型无效')
  }

  state.idem[mutation.idempotencyKey] = { fingerprint, result }
  save(state)
  return result
}

export function __resetPromoMaterialsMockForTests() {
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(AUDIT_KEY)
  sessionStorage.removeItem(IDEM_KEY)
}
