import { expect, it } from 'vitest'
import { ApiError } from '../api/client'
import {
  ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
  isAssetsUploadUnavailableError,
} from './assetsUploadErrors'
import { contentHasLocalMedia } from './productDraftCache'

it('detects legacy 40400 upload-intents missing', () => {
  const err = new ApiError({
    code: 40400,
    message: '总部后台接口不存在：POST /api/hq/assets/upload-intents',
    data: null,
  })
  expect(isAssetsUploadUnavailableError(err)).toBe(true)
})

it('detects 404 on the new POST /assets endpoint', () => {
  const err = new ApiError({
    code: 40400,
    message: '总部后台接口不存在：POST /api/hq/assets',
    data: null,
  }, 404)
  expect(isAssetsUploadUnavailableError(err)).toBe(true)
  expect(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE).toMatch(/POST \/api\/hq\/assets/)
  expect(isAssetsUploadUnavailableError({ message: 'Not Found', status: 404 })).toBe(true)
})

it('does not treat validation failures as an unavailable upload API', () => {
  const err = new ApiError({
    code: 40000,
    message: '不支持的 purpose',
    data: null,
  }, 400)
  expect(isAssetsUploadUnavailableError(err)).toBe(false)
})

it('contentHasLocalMedia finds data urls', () => {
  expect(contentHasLocalMedia({
    version: 1,
    format: 'nodes',
    nodes: [{ name: 'img', attrs: { src: 'data:image/png;base64,QQ==' }, children: [] }],
  })).toBe(true)
  expect(contentHasLocalMedia({
    version: 1,
    format: 'nodes',
    nodes: [{ name: 'img', attrs: { src: 'https://cdn.example/a.png' }, children: [] }],
  })).toBe(false)
})
