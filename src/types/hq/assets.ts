/** HQ assets 上传意图与完成回调（2 个接口）。仅声明文档明确的契约；未定义的字段保留为 unknown。 */
import type { Endpoint, MutationRequest, MutationData } from './common'

export interface AssetsEndpoints {
  /** 登记上传意图，返回 uploadUrl / assetId 等。 */
  'POST /assets/upload-intents': Endpoint<never, never, MutationRequest, unknown>
  /** 上传完成回调。 */
  'POST /assets/:assetId/completions': Endpoint<{ assetId: string }, never, MutationRequest, MutationData>
}
