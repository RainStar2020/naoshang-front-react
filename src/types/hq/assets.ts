/** HQ assets 上传。现行契约为一次 POST /assets；旧的意图/完成接口仍保留类型声明。 */
import type { Endpoint, MutationRequest, MutationData } from './common'

export interface AssetsEndpoints {
  /** 登记上传意图，返回 uploadUrl / assetId 等。 */
  'POST /assets/upload-intents': Endpoint<never, never, MutationRequest, unknown>
  /** 上传完成回调。 */
  'POST /assets/:assetId/completions': Endpoint<{ assetId: string }, never, MutationRequest, MutationData>
}

/** 后台现用及后端已支持的 purpose；上传时保持原值，不做映射。 */
export type AssetsUploadPurpose =
  | 'product'
  | 'course-cms'
  | 'promo-material'
  | 'generic'
  | 'avatar'
  | 'member-avatar'
  | 'feedback'
  | 'storefront'
  | 'material-qr'
  | 'consultant-qr'
  | 'training-file'
  | 'training-video'

/** POST /assets 成功回包：字段在顶层，没有 { code, message, data } 外层。 */
export interface AssetsUploadSuccess {
  status: 'success'
  message: string
  url: string
  assetId: string
  fileId: string
}

/** POST /assets 失败回包：字段在顶层。 */
export interface AssetsUploadFailure {
  error: string
  status: 'fail'
  message: string
  url: null
  assetId: null
}
