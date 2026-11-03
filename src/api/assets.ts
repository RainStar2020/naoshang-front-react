/** HQ assets 上传意图与完成回调（2 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import { apiClient, mergeRequestHeaders, type RequestOptions } from './client'
import type { AssetsEndpoints } from '../types/hq/assets'

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
