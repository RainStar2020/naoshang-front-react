import * as api from '../../api'
import { ColumnError, type ColumnMutation } from '../../types/columns'
import { cast, mapHqError, mutationBody, record, str, unsupported, unwrapData } from './bridge'

export async function realColumnCatalog() {
  try { return cast({ ...record(await unwrapData(await api.getColumnsCatalog())), mockOnly: false }) }
  catch (error) { return mapHqError(error, ColumnError) }
}

export async function realColumnRecords(columnId: string, accountId?: string) {
  try {
    const data = await unwrapData(await api.getColumnsByColumnIdRecords({ columnId }, accountId ? { accountId } as never : undefined))
    return cast(data)
  } catch (error) { return mapHqError(error, ColumnError) }
}

export async function realColumnMutation(input: ColumnMutation) {
  try {
    const action = input.action
    const columnId = str((input as { columnId?: string }).columnId || record((input as { value?: unknown }).value).columnId)
    if (!columnId) unsupported(ColumnError, input.action, '保存专栏需要 columnId（新建时由前端生成）')
    const body = mutationBody({ ...record(input as never), action, reason: input.reason, idempotencyKey: input.idempotencyKey, version: (input as any).version })
    await unwrapData(await api.postColumnsByColumnIdMutate({ columnId }, body as never))
    return realColumnCatalog()
  } catch (error) { return mapHqError(error, ColumnError) }
}

export async function realColumnUpload(file: File) {
  try {
    const body = { body: { fileName: file.name, contentType: file.type, size: file.size, reason: 'column-upload', action: 'upload' }, headers: { 'X-Reason': 'column-upload' } }
    const data = await unwrapData(await api.postColumnsAssets(body as never))
    return cast({ ...record(data), mockOnly: false })
  } catch (error) { return mapHqError(error, ColumnError) }
}

export function realColumnAssetUrl(url: string) { return url }
