import axios from 'axios'
import { ApiError } from '../api/client'
import type { AssetsUploadFailure, AssetsUploadSuccess } from '../types/hq/assets'
import {
  ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
  isAssetsUploadUnavailableError,
} from './assetsUploadErrors'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isAssetsUploadFailure(value: unknown): value is AssetsUploadFailure {
  return isRecord(value) && value.status === 'fail'
}

export function isAssetsUploadSuccess(value: unknown): value is AssetsUploadSuccess {
  return isRecord(value)
    && value.status === 'success'
    && typeof value.assetId === 'string'
    && value.assetId !== ''
    && typeof value.url === 'string'
    && value.url !== ''
}

export function parseAssetsUploadResponse(data: unknown): AssetsUploadSuccess {
  if (isAssetsUploadFailure(data)) {
    throw mapAssetsUploadFailure(messageFromUploadBody(data), undefined)
  }
  if (!isAssetsUploadSuccess(data)) {
    throw new Error('上传接口返回格式不正确')
  }
  const fileId = typeof data.fileId === 'string' && data.fileId ? data.fileId : data.assetId
  return {
    status: 'success',
    message: typeof data.message === 'string' && data.message ? data.message : '上传成功',
    url: data.url,
    assetId: data.assetId,
    fileId,
  }
}

export function messageFromUploadBody(body: unknown, status?: number): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message.trim()) return body.message
    if (typeof body.error === 'string' && body.error.trim()) return body.error
  }
  if (status === 401) return '未登录，请重新登录后再上传'
  if (status === 403) return '没有上传权限'
  if (status === 400) return '上传参数不合法'
  if (status === 404) return ASSETS_UPLOAD_UNAVAILABLE_MESSAGE
  if (status === 500) return '存储写入失败'
  return '上传失败'
}

function apiCodeFromHttpStatus(status?: number): number | string {
  if (status === 401) return 40100
  if (status === 403) return 40300
  if (status === 404) return 40400
  if (status === 400) return 40000
  if (status === 500) return 50000
  return status ?? 50000
}

export function mapAssetsUploadFailure(message: string, status?: number): Error {
  if (status === 404 || isAssetsUploadUnavailableError({ message, code: apiCodeFromHttpStatus(status), status })) {
    const enriched = new Error(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE) as Error & { code?: unknown; status?: number }
    enriched.code = 40400
    enriched.status = status
    enriched.name = 'AssetsUploadUnavailableError'
    return enriched
  }
  return new ApiError({
    code: apiCodeFromHttpStatus(status),
    message,
    data: null,
  }, status)
}

/** Map Axios / interceptor errors from POST /assets onto ApiError or the unavailable error. */
export function mapAssetsUploadTransportError(error: unknown): unknown {
  if (axios.isAxiosError(error)) {
    if (!error.response) return error
    const status = error.response.status
    const message = messageFromUploadBody(error.response.data, status)
    return mapAssetsUploadFailure(message, status)
  }
  if (isAssetsUploadUnavailableError(error)) {
    const enriched = new Error(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE) as Error & { code?: unknown; status?: number }
    enriched.code = error instanceof ApiError ? error.code : 40400
    enriched.status = error instanceof ApiError ? error.status : (error as { status?: number }).status
    enriched.name = 'AssetsUploadUnavailableError'
    return enriched
  }
  if (error instanceof ApiError) return error
  return error
}
