import { ApiError, type RequestOptions } from '../../api/client'
import type { ApiResponse, MutationRequest } from '../../types/hq/common'

export type DataRecord = Record<string, unknown>
export interface ModuleInput {
  path: Record<string, string>
  query?: DataRecord
  request?: MutationRequest
  options?: RequestOptions
}
export interface ModuleOperation {
  key: string
  method: 'GET' | 'POST'
  path: string
  title: string
  params: string[]
  actions: string[]
  invoke: (input: ModuleInput) => Promise<ApiResponse<unknown>>
}
export interface LiveModule {
  name: string
  title: string
  route: string
  operations: ModuleOperation[]
}

export function record(value: unknown): DataRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as DataRecord : {}
}

/** 仅用于 JSON 输入边界：拒绝数组、null 和原始值，不为未知字段猜测类型。 */
export function parseObject(value: string): DataRecord {
  const parsed: unknown = JSON.parse(value || '{}')
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('业务参数必须是 JSON 对象')
  return parsed as DataRecord
}

export function requiredPath(input: ModuleInput, key: string): string {
  const value = input.path[key]?.trim()
  if (!value) throw new Error(`请填写 ${key}`)
  return value
}

/** JSON 编辑器是外部输入边界；验证通用字段及文档明确的 action。 */
export function buildMutationRequest(operation: ModuleOperation, body: DataRecord, reason: string, key: string): MutationRequest {
  if (!reason.trim()) throw new Error('请填写操作原因')
  if (!key.trim()) throw new Error('请填写幂等请求号')
  if (!body.action || typeof body.action !== 'string') throw new Error('请选择或填写操作类型')
  if (operation.actions.length && !operation.actions.includes(body.action)) throw new Error('操作类型不在后端契约范围内')
  if (body.version !== undefined && (!Number.isInteger(body.version) || Number(body.version) < 1)) throw new Error('版本号必须为大于 0 的整数')
  if (body.action === 'update-note' && typeof body.note !== 'string') throw new Error('修改备注必须填写 note 字符串')
  return { body: { ...body, reason: reason.trim(), idempotencyKey: key.trim() } }
}

/** 统一在服务层解开信封。失败不回退到演示数据，不自动重试写操作。 */
export async function runOperation(operation: ModuleOperation, input: ModuleInput): Promise<unknown> {
  for (const param of operation.params) requiredPath(input, param)
  if (operation.method === 'POST') {
    if (!input.request) throw new Error('缺少请求参数')
    if (!operation.path.startsWith('/auth/')) {
      const body = input.request.body
      const reason = body.reason || input.request.headers?.['X-Reason']
      if (typeof reason !== 'string' || !reason.trim()) throw new Error('请填写操作原因')
      if (typeof body.action !== 'string' || !body.action.trim()) throw new Error('缺少操作类型')
      if (operation.actions.length && !operation.actions.includes(body.action)) throw new Error('操作类型不在后端契约范围内')
    }
  }
  const result = await operation.invoke(input)
  if (result.code !== 0) throw new ApiError(result)
  return result.data
}

/** 同时识别列表数据、catalog 中的数组与草稿包裹对象。 */
export function dataRows(data: unknown): DataRecord[] {
  if (Array.isArray(data)) return data.map((row) => ({ ...record(row), ...record(record(row).draft) }))
  const object = record(data)
  if (Array.isArray(object.items)) return dataRows(object.items)
  return []
}

export function rowIdentifier(row: DataRecord, key: string): string {
  const value = row[key] ?? record(row.draft)[key] ?? record(row.profile)[key] ?? (key === 'accountId' ? row.ownerAccountId : undefined)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** 核对窗口不回显认证口令，包括嵌套参数。 */
export function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(record(value)).map(([key, item]) => [key, /password|secret|token/i.test(key) ? '••••••' : redactCredentials(item)]))
}
