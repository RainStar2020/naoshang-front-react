import type { RichContent } from './cms'
/** HQ-24 推广素材、二维码区域模板、视频互动 H5。对照 partner/materials、material-edit；总部维护模板与唯一二维码填充区；禁止前端伪造服务端合成终图；视频不烧录二维码。 */
export type PromoMaterialType = 'image' | 'article' | 'video'
export type PromoMaterialStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
/** 视频仅互动 H5；不默认烧录二维码。 */
export type VideoDeliveryMode = 'INTERACTIVE_H5'
export type PartnerMaterialOp = 'upload-qr' | 'render' | 'download' | 'copy-link'
export type PromoMaterialAction = 'save' | 'set-qr-region' | 'publish' | 'offline' | 'delete'

/** 原图上唯一二维码填充区；归一化坐标 0–1，相对 mediaWidth/mediaHeight。 */
export interface QrFillRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface PromoMaterialCategory {
  categoryId: string
  name: string
  type: PromoMaterialType
}

export interface PromoMaterialTemplate {
  materialId: string
  title: string
  type: PromoMaterialType
  categoryId: string
  categoryName: string
  status: PromoMaterialStatus
  coverUrl: string
  mediaUrl: string
  posterUrl: string | null
  summary: string
  /** 图文正文（文字+图片）；图片/视频为 null。 */
  articleContent: RichContent | null
  /** 图文末尾唯一二维码预留位；图片用 qrRegion；视频恒 false。 */
  qrSlotAtEnd: boolean
  /** 图片发布前必填正方形区；图文/视频为 null（图文用 qrSlotAtEnd；视频走 H5，不烧录）。 */
  qrRegion: QrFillRegion | null
  mediaWidth: number
  mediaHeight: number
  videoDeliveryMode: VideoDeliveryMode | null
  /** 专用 web-view/H5 路由就绪度；当前联调缺口为 false。 */
  h5RouteReady: boolean
  h5RouteNote: string
  shareUrlTemplate: string
  partnerOperations: PartnerMaterialOp[]
  /** 恒 true：合图仅服务端；前端不得展示/生成伪终图。 */
  composedAssetForbidden: true
  version: number
  updatedAt: string
  publishedAt: string | null
  mockOnly: boolean
  allowedActions: PromoMaterialAction[]
}

export interface PromoMaterialAudit {
  operationId: string
  requestId: string
  action: PromoMaterialAction
  targetId: string
  before: string
  after: string
  reason: string
  operatorId: string
  operatorName: string
  occurredAt: string
  beforeVersion: number
  afterVersion: number
}

export interface PromoMaterialQuery {
  page: number
  pageSize: number
  keyword?: string
  type?: PromoMaterialType
  status?: PromoMaterialStatus
  categoryId?: string
}

export interface PromoMaterialList {
  items: PromoMaterialTemplate[]
  total: number
  page: number
  pageSize: number
  summary: {
    templates: number
    draft: number
    published: number
    offline: number
    imageWithRegion: number
    videoH5: number
    missingQrRegion: number
  }
}

export interface PromoMaterialCatalog {
  categories: PromoMaterialCategory[]
  types: { id: PromoMaterialType; label: string }[]
  composeGapNote: string
  videoH5GapNote: string
  pendingPolicy: {
    dedicatedWebViewRoutePending: true
    clientSideComposeForbidden: true
  }
  mockOnly: boolean
}

export interface PromoMaterialDetail {
  template: PromoMaterialTemplate
  audit: PromoMaterialAudit[]
  composeGapNote: string
  videoH5GapNote: string
}

export type PromoMaterialMutation =
  | {
      action: 'save'
      materialId?: string
      version: number
      reason: string
      idempotencyKey: string
      title: string
      type: PromoMaterialType
      categoryId: string
      coverUrl: string
      mediaUrl: string
      posterUrl?: string | null
      summary: string
      mediaWidth: number
      mediaHeight: number
      shareUrlTemplate: string
      articleContent?: RichContent | null
      qrSlotAtEnd?: boolean
    }
  | {
      action: 'set-qr-region'
      materialId: string
      version: number
      reason: string
      idempotencyKey: string
      qrRegion: QrFillRegion
    }
  | {
      action: 'publish' | 'offline' | 'delete'
      materialId: string
      version: number
      reason: string
      idempotencyKey: string
    }

export interface PromoMaterialMutationResult {
  action: PromoMaterialAction
  template: PromoMaterialTemplate
  mockOnly: boolean
  message: string
}

export type PromoMaterialErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'QR_REGION_REQUIRED'
  | 'QR_SLOT_REQUIRED'
  | 'QR_REGION_INVALID'

export class PromoMaterialError extends Error {
  constructor(public code: PromoMaterialErrorCode, message: string) {
    super(message)
    this.name = 'PromoMaterialError'
  }
}
