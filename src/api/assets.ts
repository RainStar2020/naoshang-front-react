/** HQ assets 上传。一次 POST /assets 为现行上传路径；旧的意图/完成接口仍保留。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { AssetsEndpoints, AssetsUploadSuccess } from '../types/hq/assets'
import { mapAssetsUploadTransportError, parseAssetsUploadResponse } from '../utils/assetsUpload'

/** @see POST /api/hq/assets */
export async function postAssets(
  request: { file: File; purpose: string; fileName?: string },
  options: RequestOptions = {},
): Promise<AssetsUploadSuccess> {
  const form = new FormData()
  form.append('file', request.file)
  form.append('purpose', request.purpose)
  if (request.fileName) form.append('fileName', request.fileName)

  const headers = mergeRequestHeaders(options)
  // Let Axios set the multipart boundary; do not force Content-Type.
  headers.delete('Content-Type')

  try {
    const response = await apiClient.post<unknown>('/assets', form, {
      ...options,
      headers,
    })
    return parseAssetsUploadResponse(response.data)
  } catch (error) {
    throw mapAssetsUploadTransportError(error)
  }
}

/** @see POST /api/hq/assets/upload-intents */
export async function postAssetsUploadIntents(request: AssetsEndpoints['POST /assets/upload-intents']['request'], options: RequestOptions = {}): Promise<AssetsEndpoints['POST /assets/upload-intents']['response']> {
  const response = await apiClient.post<AssetsEndpoints['POST /assets/upload-intents']['response']>('/assets/upload-intents', request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}

/** @see POST /api/hq/assets/:assetId/completions */
export async function postAssetsByAssetIdCompletions(path: AssetsEndpoints['POST /assets/:assetId/completions']['path'], request: AssetsEndpoints['POST /assets/:assetId/completions']['request'], options: RequestOptions = {}): Promise<AssetsEndpoints['POST /assets/:assetId/completions']['response']> {
  const response = await apiClient.post<AssetsEndpoints['POST /assets/:assetId/completions']['response']>(`/assets/${encodeURIComponent(path.assetId)}/completions`, request.body, {
    ...options,
    headers: mergeRequestHeaders(options, request.headers),
  })
  return response.data
}
