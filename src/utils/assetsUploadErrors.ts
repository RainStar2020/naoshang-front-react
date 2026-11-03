/** 总部资产上传契约缺失时的统一错误识别与文案。 */
export const ASSETS_UPLOAD_UNAVAILABLE_MESSAGE =
  '总部后台尚未开通图片上传接口（需实现 POST /api/hq/assets/upload-intents 与 POST /api/hq/assets/{assetId}/completions，见 docs/hq-api-doc.md）。本地预览图无法入库；请后端补齐后再提交带新图的商品。若本次没有新本地图，可先删除本地预览图后再「提交到服务端」只保存商品信息。'

export function isAssetsUploadUnavailableError(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('尚未开通图片上传接口') || message.includes(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE)) return true
  const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined
  if (code === 40400 || code === 'NOT_FOUND') {
    return /upload-intents|assets\/.*completions|接口不存在/.test(message)
  }
  return /接口不存在/.test(message) && /upload-intents/.test(message)
}
