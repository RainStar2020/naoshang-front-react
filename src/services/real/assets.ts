import * as api from '../../api'
import { ApiError } from '../../api/client'
import {
  ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
  isAssetsUploadUnavailableError,
} from '../../utils/assetsUploadErrors'

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
    enriched.code = error instanceof ApiError ? error.code : ((error as { code?: unknown }).code ?? 40400)
    enriched.name = 'AssetsUploadUnavailableError'
    throw enriched
  }
  throw error
}

function inferKind(file: File): AssetUploadResult['kind'] {
  const kindRaw = file.type || ''
  const kind: AssetUploadResult['kind'] = kindRaw.includes('video')
    ? 'video'
    : kindRaw.includes('image') || kindRaw.startsWith('image/')
      ? 'image'
      : 'file'
  // Preserve historical caller shape: unknown non-video types were returned as image.
  return kind === 'file' ? 'image' : kind
}

/** HQ assets: single POST /assets (multipart fields file, purpose, optional fileName). */
export async function realUploadAsset(file: File, purpose = 'generic'): Promise<AssetUploadResult> {
  let uploaded
  try {
    uploaded = await api.postAssets({
      file,
      purpose,
      ...(file.name ? { fileName: file.name } : {}),
    })
  } catch (error) {
    rethrowUploadUnavailable(error)
  }
  return {
    assetId: uploaded.assetId,
    url: uploaded.url,
    previewUrl: uploaded.url,
    kind: inferKind(file),
    mockOnly: false,
  }
}
