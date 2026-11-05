import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig, type RawAxiosRequestHeaders } from 'axios'

/** H5 门店工作台接口。该契约不经过 `/api/hq`，默认使用根路径。 */
export const businessStoreApiClient = axios.create({
  baseURL: import.meta.env.VITE_BUSINESS_API_BASE_URL || '',
  timeout: 30_000,
  headers: { Accept: 'application/json' },
})

let tokenProvider: () => string | null = () => null

/** 绑定门店侧会话；调用时读取最新 token，传 null 可清除。 */
export function setBusinessStoreApiToken(token: string | null): void {
  tokenProvider = () => token
}

/** 支持由外部会话存储按请求提供门店侧 token。 */
export function setBusinessStoreApiTokenProvider(provider: () => string | null): void {
  tokenProvider = provider
}

businessStoreApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenProvider()
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

export type BusinessStoreRequestOptions = Pick<AxiosRequestConfig, 'signal' | 'timeout'> & {
  headers?: RawAxiosRequestHeaders
}

export interface BusinessCoach {
  id: string
  name: string
  loginAccount: string
  status: 'ACTIVE' | 'DISABLED'
  invitationStatus: 'PENDING' | 'ACTIVE' | 'REVOKED'
  version: number
}

export interface StoreWorkspace {
  store: {
    kind: string
    /** 历史兼容店长账号 ID；健脑官绑定应使用 entityId。 */
    id: string
    /** 门店实体 ID，创建、更新和删除健脑官时推荐传此字段。 */
    entityId: string
    regionCode?: string
    name: string
  }
  staff: BusinessCoach[]
  members: unknown[]
  approvals: unknown[]
  owners: unknown[]
  allowedActions: string[]
}

export interface CreateBusinessCoachInput {
  name: string
  loginAccount: string
  password?: string
  idempotencyKey: string
}

export interface UpdateBusinessCoachInput {
  name?: string
  loginAccount?: string
  status?: 'ACTIVE' | 'DISABLED'
  version: number
}

export interface DeleteBusinessCoachInput {
  version: number
  contextId?: string
}

/** 查询代理门店工作台；contextId 例如 `agency:p6`。 */
export async function getStoreWorkspace(
  query: { contextId: string },
  options: BusinessStoreRequestOptions = {},
): Promise<StoreWorkspace> {
  const response = await businessStoreApiClient.get<StoreWorkspace>('/agency/store-workspace', { ...options, params: query })
  return response.data
}

/** 新增健脑官。storeId 推荐使用工作台返回的 store.entityId。 */
export async function postStoreCoach(
  path: { storeId: string },
  body: CreateBusinessCoachInput,
  options: BusinessStoreRequestOptions = {},
): Promise<{ coach: BusinessCoach }> {
  const response = await businessStoreApiClient.post<{ coach: BusinessCoach }>(
    `/stores/${encodeURIComponent(path.storeId)}/coaches`, body, options,
  )
  return response.data
}

/** 编辑健脑官；version 为必填的乐观锁版本。 */
export async function patchStoreCoach(
  path: { storeId: string; coachId: string },
  body: UpdateBusinessCoachInput,
  options: BusinessStoreRequestOptions = {},
): Promise<{ coach: BusinessCoach }> {
  const response = await businessStoreApiClient.patch<{ coach: BusinessCoach }>(
    `/stores/${encodeURIComponent(path.storeId)}/coaches/${encodeURIComponent(path.coachId)}`, body, options,
  )
  return response.data
}

/** 删除健脑官并作废其既有会话；version 为必填的乐观锁版本。 */
export async function deleteStoreCoach(
  path: { storeId: string; coachId: string },
  body: DeleteBusinessCoachInput,
  options: BusinessStoreRequestOptions = {},
): Promise<{ removed: true; coachId: string } | { locked: true; [key: string]: unknown }> {
  const response = await businessStoreApiClient.delete<{ removed: true; coachId: string } | { locked: true; [key: string]: unknown }>(
    `/stores/${encodeURIComponent(path.storeId)}/coaches/${encodeURIComponent(path.coachId)}`,
    { ...options, data: body },
  )
  return response.data
}
