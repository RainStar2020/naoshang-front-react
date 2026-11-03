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
  expect(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE).toMatch(/upload-intents/)
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
