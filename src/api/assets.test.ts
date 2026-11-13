import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { apiClient, setApiToken } from './client'
import { postAssets } from './assets'
import { ASSETS_UPLOAD_UNAVAILABLE_MESSAGE } from '../utils/assetsUploadErrors'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  setApiToken(null)
})

const file = () => new File(['hello'], 'cover.png', { type: 'image/png' })

describe('postAssets', () => {
  it('POSTs multipart /assets once, keeps the flat success body, and sends the session Bearer token', async () => {
    const upload = file()
    const paths: string[] = []
    setApiToken('hq-token')
    apiClient.defaults.adapter = async (config) => {
      paths.push(String(config.url))
      expect(config.method).toBe('post')
      expect(config.baseURL).toBe('/api/hq')
      expect(config.headers.get('Authorization')).toBe('Bearer hq-token')
      expect(String(config.headers.get('Content-Type') || '')).not.toMatch(/application\/json/i)
      expect(config.data).toBeInstanceOf(FormData)
      const form = config.data as FormData
      expect(form.get('purpose')).toBe('product')
      expect(form.get('fileName')).toBe('cover.png')
      const sent = form.get('file')
      expect(sent).toBeTruthy()
      if (sent instanceof File) {
        expect(sent.name).toBe('cover.png')
        expect(sent.type).toBe('image/png')
      }
      return {
        data: {
          status: 'success',
          message: '上传成功',
          url: 'https://cdn.example/cover.png',
          assetId: 'ast_1',
          fileId: 'ast_1',
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }

    await expect(postAssets({ file: upload, purpose: 'product', fileName: 'cover.png' })).resolves.toEqual({
      status: 'success',
      message: '上传成功',
      url: 'https://cdn.example/cover.png',
      assetId: 'ast_1',
      fileId: 'ast_1',
    })
    expect(paths).toEqual(['/assets'])
  })

  it('does not unwrap a flat success body into { code, data }', async () => {
    apiClient.defaults.adapter = async (config) => ({
      data: {
        status: 'success',
        message: '上传成功',
        url: 'https://cdn.example/a.png',
        assetId: 'ast_2',
        fileId: 'ast_2',
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    })
    const result = await postAssets({ file: file(), purpose: 'generic' })
    expect(result).not.toHaveProperty('code')
    expect(result).not.toHaveProperty('data')
    expect(result.assetId).toBe('ast_2')
    expect(result.url).toBe('https://cdn.example/a.png')
  })

  it('maps a flat fail body on HTTP 400 to ApiError using the top-level message', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('bad request', 'ERR_BAD_REQUEST', config, null, {
        data: {
          error: '文件过大',
          status: 'fail',
          message: '文件过大',
          url: null,
          assetId: null,
        },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config,
      })
    }
    await expect(postAssets({ file: file(), purpose: 'product' })).rejects.toMatchObject({
      name: 'ApiError',
      message: '文件过大',
      status: 400,
      code: 40000,
    })
  })

  it('maps HTTP 404 to the unavailable upload message', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('not found', 'ERR_BAD_REQUEST', config, null, {
        data: { message: 'Not Found' },
        status: 404,
        statusText: 'Not Found',
        headers: new AxiosHeaders(),
        config,
      })
    }
    await expect(postAssets({ file: file(), purpose: 'generic' })).rejects.toMatchObject({
      name: 'AssetsUploadUnavailableError',
      message: ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
    })
  })
})
