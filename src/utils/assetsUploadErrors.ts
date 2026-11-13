/** 总部资产上传契约缺失时的统一错误识别与文案。 */
export const ASSETS_UPLOAD_UNAVAILABLE_MESSAGE =
  '总部后台尚未开通图片上传接口（需实现 POST /api/hq/assets，见 docs/hq-api-doc.md）。本地预览图无法入库；请后端补齐后再提交带新图的商品。若本次没有新本地图，可先删除本地预览图后再「提交到服务端」只保存商品信息。'

function readErrorMeta(error: unknown): { message: string; code?: unknown; status?: unknown } {
  if (!error) return { message: '' }
  if (error instanceof Error) {
    const code = 'code' in error ? (error as { code?: unknown }).code : undefined
    const status = 'status' in error ? (error as { status?: unknown }).status : undefined
    return { message: error.message, code, status }
  }
  if (typeof error === 'object') {
    const record = error as { message?: unknown; code?: unknown; status?: unknown }
    return {
      message: typeof record.message === 'string' ? record.message : String(error),
      code: record.code,
      status: record.status,
    }
  }
  return { message: String(error) }
}

function mentionsMissingAssetsApi(message: string): boolean {
  return /upload-intents|assets\/.*completions|接口不存在|POST\s+\/api\/hq\/assets|\/assets/.test(message)
}

export function isAssetsUploadUnavailableError(error: unknown): boolean {
  if (!error) return false
  const { message, code, status } = readErrorMeta(error)
  if (message.includes('尚未开通图片上传接口') || message.includes(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE)) return true
  if (code === 40400 || code === 'NOT_FOUND' || status === 404) {
    return mentionsMissingAssetsApi(message) || status === 404
  }
  return /接口不存在/.test(message) && mentionsMissingAssetsApi(message)
}
