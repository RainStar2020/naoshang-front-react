import * as api from '../../api'
import { ApiError } from '../../api/client'
import {
  ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
  isAssetsUploadUnavailableError,
} from '../../utils/assetsUploadErrors'
import { mutationBody, record, str, unwrapData } from './bridge'

export type AssetUploadResult = {
  assetId: string
  url: string
  previewUrl: string
  kind: 'image' | 'video' | 'file'
  mockOnly: false
}

export { ASSETS_UPLOAD_UNAVAILABLE_MESSAGE, isAssetsUploadUnavailableError } from '../../utils/assetsUploadErrors'

function rethrowUploadUnavailable(error: unknown): never {
  if (isAssetsUploadUnavailableError(error)) {
    const enriched = new Error(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE) as Error & { code?: unknown }
    enriched.code = error instanceof ApiError ? error.code : 40400
    enriched.name = 'AssetsUploadUnavailableError'
    throw enriched
  }
  throw error
}

/** HQ assets upload-intents → PUT/POST uploadUrl → completions. */
export async function realUploadAsset(file: File, purpose = 'generic'): Promise<AssetUploadResult> {
  const intentBody = mutationBody({
    action: 'create-intent',
    reason: `upload:${purpose}`,
    idempotencyKey: `upload-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    purpose,
  })
  let intentRaw: unknown
  try {
    intentRaw = await unwrapData(await api.postAssetsUploadIntents(intentBody as never))
  } catch (error) {
    rethrowUploadUnavailable(error)
  }
  const intent = record(intentRaw)
  const assetId = str(intent.assetId || intent.id)
  const uploadUrl = str(intent.uploadUrl || intent.url)
  const method = str(intent.method, 'PUT').toUpperCase()
  if (!assetId) throw new Error('上传意图未返回 assetId')
  if (uploadUrl) {
    const headers = record(intent.headers)
    const headerInit: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
      if (value != null && value !== '') headerInit[key] = String(value)
    }
    if (!headerInit['Content-Type'] && file.type) headerInit['Content-Type'] = file.type
    const formFields = record(intent.formFields)
    let response: Response
    if (method === 'POST' && Object.keys(formFields).length) {
      const form = new FormData()
      for (const [key, value] of Object.entries(formFields)) form.append(key, String(value))
      form.append(str(intent.fileField || 'file'), file)
      response = await fetch(uploadUrl, { method: 'POST', body: form })
    } else {
      response = await fetch(uploadUrl, { method: method === 'POST' ? 'POST' : 'PUT', body: file, headers: headerInit })
    }
    if (!response.ok) throw new Error(`直传失败 HTTP ${response.status}`)
  }
  const completeBody = mutationBody({
    action: 'complete',
    reason: `complete:${purpose}`,
    idempotencyKey: `complete-${assetId}-${Date.now()}`,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  })
  let doneRaw: unknown
  try {
    doneRaw = await unwrapData(await api.postAssetsByAssetIdCompletions({ assetId }, completeBody as never))
  } catch (error) {
    rethrowUploadUnavailable(error)
  }
  const done = record(doneRaw)
  const url = str(done.url || done.cdnUrl || done.previewUrl || intent.publicUrl || intent.url)
  const kindRaw = str(done.kind || intent.kind || file.type)
  const kind: AssetUploadResult['kind'] = kindRaw.includes('video') ? 'video' : kindRaw.includes('image') || (file.type || '').startsWith('image/') ? 'image' : 'file'
  return { assetId, url, previewUrl: str(done.previewUrl || url), kind: kind === 'file' ? 'image' : kind, mockOnly: false }
}
