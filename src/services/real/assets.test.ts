import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiClient, setApiToken } from '../../api/client'
import { realUploadAsset } from './assets'
import { ASSETS_UPLOAD_UNAVAILABLE_MESSAGE } from '../../utils/assetsUploadErrors'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  setApiToken(null)
})

describe('realUploadAsset', () => {
  it('calls POST /assets once and returns the public AssetUploadResult shape', async () => {
    const paths: string[] = []
    setApiToken('hq-token')
    apiClient.defaults.adapter = async (config) => {
      paths.push(`${config.method}:${config.url}`)
      expect(config.data).toBeInstanceOf(FormData)
      const form = config.data as FormData
      expect(form.get('purpose')).toBe('course-cms')
      expect(form.get('fileName')).toBe('lesson.png')
      return {
        data: {
          status: 'success',
          message: '上传成功',
          url: 'https://cdn.example/lesson.png',
          assetId: 'ast_9',
          fileId: 'ast_9',
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }

    const file = new File(['img'], 'lesson.png', { type: 'image/png' })
    await expect(realUploadAsset(file, 'course-cms')).resolves.toEqual({
      assetId: 'ast_9',
      url: 'https://cdn.example/lesson.png',
      previewUrl: 'https://cdn.example/lesson.png',
      kind: 'image',
      mockOnly: false,
    })
    expect(paths).toEqual(['post:/assets'])
  })

  it('surfaces a flat fail message to callers and never falls back to upload-intents', async () => {
    const paths: string[] = []
    apiClient.defaults.adapter = async (config) => {
      paths.push(String(config.url))
      throw new AxiosError('bad request', 'ERR_BAD_REQUEST', config, null, {
        data: {
          error: '不支持的 purpose',
          status: 'fail',
          message: '不支持的 purpose',
          url: null,
          assetId: null,
        },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config,
      })
    }
    await expect(realUploadAsset(new File(['x'], 'x.png', { type: 'image/png' }), 'product')).rejects.toMatchObject({
      message: '不支持的 purpose',
      status: 400,
    })
    expect(paths).toEqual(['/assets'])
  })

  it('uses the shared unavailable message when POST /assets is missing', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('not found', 'ERR_BAD_REQUEST', config, null, {
        data: { message: 'Not Found' },
        status: 404,
        statusText: 'Not Found',
        headers: new AxiosHeaders(),
        config,
      })
    }
    await expect(realUploadAsset(new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toMatchObject({
      name: 'AssetsUploadUnavailableError',
      message: ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
    })
  })
})
