import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { ApiError } from '../api/client'
import {
  isAssetsUploadFailure,
  isAssetsUploadSuccess,
  mapAssetsUploadTransportError,
  parseAssetsUploadResponse,
} from './assetsUpload'
import { ASSETS_UPLOAD_UNAVAILABLE_MESSAGE } from './assetsUploadErrors'

const success = {
  status: 'success' as const,
  message: '上传成功',
  url: 'https://cdn.example/a.png',
  assetId: 'ast_1',
  fileId: 'ast_1',
}

describe('parseAssetsUploadResponse', () => {
  it('reads the top-level success contract and does not expect a code/data wrapper', () => {
    expect(isAssetsUploadSuccess(success)).toBe(true)
    expect(parseAssetsUploadResponse(success)).toEqual(success)
  })

  it('fills fileId from assetId when fileId is omitted', () => {
    expect(parseAssetsUploadResponse({
      status: 'success',
      message: '上传成功',
      url: 'https://cdn.example/a.png',
      assetId: 'ast_1',
    })).toMatchObject({ assetId: 'ast_1', fileId: 'ast_1', url: 'https://cdn.example/a.png' })
  })

  it('rejects a wrapped legacy envelope and a fail body', () => {
    expect(() => parseAssetsUploadResponse({
      code: 0,
      message: 'ok',
      data: success,
    })).toThrow(/格式不正确/)
    expect(isAssetsUploadFailure({
      error: '文件过大',
      status: 'fail',
      message: '文件过大',
      url: null,
      assetId: null,
    })).toBe(true)
    expect(() => parseAssetsUploadResponse({
      error: '文件过大',
      status: 'fail',
      message: '文件过大',
      url: null,
      assetId: null,
    })).toThrow(/文件过大/)
  })
})

describe('mapAssetsUploadTransportError', () => {
  function axiosFail(status: number, data: unknown) {
    const config = { headers: new AxiosHeaders() } as never
    return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, null, {
      data,
      status,
      statusText: 'Error',
      headers: new AxiosHeaders(),
      config,
    })
  }

  it('surfaces the flat fail message and HTTP status as ApiError', () => {
    const error = mapAssetsUploadTransportError(axiosFail(400, {
      error: '仅支持 image/png、image/jpeg',
      status: 'fail',
      message: '仅支持 image/png、image/jpeg',
      url: null,
      assetId: null,
    }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      message: '仅支持 image/png、image/jpeg',
      status: 400,
      code: 40000,
    })
  })

  it('maps 401/403/500 to ApiError with the fail message', () => {
    expect(mapAssetsUploadTransportError(axiosFail(401, {
      error: '未登录',
      status: 'fail',
      message: '未登录',
      url: null,
      assetId: null,
    }))).toMatchObject({ message: '未登录', status: 401, code: 40100 })

    expect(mapAssetsUploadTransportError(axiosFail(403, {
      error: '无权',
      status: 'fail',
      message: '无权',
      url: null,
      assetId: null,
    }))).toMatchObject({ message: '无权', status: 403, code: 40300 })

    expect(mapAssetsUploadTransportError(axiosFail(500, {
      error: '存储写入失败',
      status: 'fail',
      message: '存储写入失败',
      url: null,
      assetId: null,
    }))).toMatchObject({ message: '存储写入失败', status: 500, code: 50000 })
  })

  it('maps HTTP 404 to the unavailable upload message', () => {
    const error = mapAssetsUploadTransportError(axiosFail(404, { message: 'Not Found' }))
    expect(error).toMatchObject({
      name: 'AssetsUploadUnavailableError',
      message: ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
      code: 40400,
    })
  })

  it('preserves network errors without a response', () => {
    const offline = new AxiosError('offline', 'ERR_NETWORK')
    expect(mapAssetsUploadTransportError(offline)).toBe(offline)
  })
})
