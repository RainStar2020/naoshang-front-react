import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import {
  ApiError,
  apiClient,
  isLegacyApiFailure,
  isV2Envelope,
  normalizeSuccessEnvelope,
  readTraceId,
  setApiToken,
  setApiTokenProvider,
  shouldAttachApiVersion2,
} from './client'
import { postAuthLogin } from './auth'
import { getMaterials } from './materials'
import { getProducts } from './products'
import { getUsers, getUsersByAccountId, postUsersByAccountIdMutate } from './users'
import { postMaterialsMutate } from './materials'

const originalAdapter = apiClient.defaults.adapter
const success = { code: 0, message: 'ok', data: { operationId: 'hqop_1' } }

function respond(data: unknown = success, inspect?: (config: InternalAxiosRequestConfig) => void, headers?: AxiosHeaders): void {
  apiClient.defaults.adapter = async (config) => {
    inspect?.(config)
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: headers ?? new AxiosHeaders(),
      config,
    }
  }
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  setApiToken(null)
  vi.restoreAllMocks()
})

describe('总部 API 请求层', () => {
  it('返回完整信封并发送分页查询与实时 token', async () => {
    let token = 'first'
    setApiTokenProvider(() => token)
    token = 'latest'
    respond(success, (config) => {
      expect(config.headers.get('Authorization')).toBe('Bearer latest')
      expect(config.params).toEqual({ page: 2, frozen: false })
      expect(config.baseURL).toBe('/api/hq')
      expect(config.method).toBe('get')
    })
    expect(await getUsers({ page: 2, frozen: false })).toEqual(success)
  })

  it('登录不会附带自动注入的 token', async () => {
    setApiToken('expired')
    respond(success, (config) => {
      expect(config.headers.has('Authorization')).toBe(false)
      expect(JSON.parse(config.data)).toEqual({ username: 'admin', password: 'example' })
    })
    await postAuthLogin({ username: 'admin', password: 'example' })
  })

  it('路径 ID 编码，避免斜杠和查询字符改变路由', async () => {
    respond(success, (config) => expect(config.url).toBe('/users/a%2Fb%3Fc%23d'))
    await getUsersByAccountId({ accountId: 'a/b?c#d' })
  })

  it('写操作分开发送 body 和审计头，保留头部幂等键优先语义', async () => {
    respond(success, (config) => {
      expect(config.url).toBe('/users/u1/mutate')
      expect(config.method).toBe('post')
      expect(JSON.parse(config.data)).toEqual({ action: 'freeze', version: 1, idempotencyKey: 'body-key' })
      expect(config.headers.get('X-Reason')).toBe('review')
      expect(config.headers.get('Idempotency-Key')).toBe('header-key')
      expect(config.headers.get('X-Request-Id')).toBe('request-id')
    })
    await postUsersByAccountIdMutate({ accountId: 'u1' }, {
      body: { action: 'freeze', version: 1, idempotencyKey: 'body-key' },
      headers: { 'X-Reason': 'review', 'Idempotency-Key': 'header-key' },
    }, { headers: { 'x-reason': 'overridden', 'X-Request-Id': 'request-id' } })
  })

  it('HTTP 200 中的业务错误拒绝，并保留 currentVersion', async () => {
    respond({ code: 40901, message: 'conflict', data: null, currentVersion: 3 })
    await expect(getUsers()).rejects.toMatchObject({ name: 'ApiError', code: 40901, currentVersion: 3, status: 200 })
  })

  it('HTTP 错误中的业务信封转换为 ApiError', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, null, {
        data: { code: 40100, message: 'expired', data: null },
        status: 401, statusText: 'Unauthorized', headers: new AxiosHeaders(), config,
      })
    }
    await expect(getUsers()).rejects.toBeInstanceOf(ApiError)
    await expect(getUsers()).rejects.toMatchObject({ code: 40100, status: 401 })
  })

  it('保留网络错误对象以供调用方处理', async () => {
    const error = new AxiosError('offline', 'ERR_NETWORK')
    apiClient.defaults.adapter = async () => { throw error }
    await expect(getUsers()).rejects.toBe(error)
  })

  it('传递取消信号和超时，允许显式 Authorization', async () => {
    const controller = new AbortController()
    setApiToken('automatic')
    respond(success, (config) => {
      expect(config.signal).toBe(controller.signal)
      expect(config.timeout).toBe(5000)
      expect(config.headers.get('Authorization')).toBe('Bearer explicit')
    })
    await getUsers(undefined, { signal: controller.signal, timeout: 5000, headers: { Authorization: 'Bearer explicit' } })
  })

  it('已取消的请求不发送到适配器', async () => {
    const controller = new AbortController()
    controller.abort()
    let called = false
    const adapter: AxiosAdapter = async () => { called = true; throw new Error('unexpected') }
    apiClient.defaults.adapter = adapter
    await expect(getUsers(undefined, { signal: controller.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(called).toBe(false)
  })
})

describe('HQ API v2 版本头与双契约', () => {
  it('shouldAttachApiVersion2 仅匹配已接入模块的 GET', () => {
    expect(shouldAttachApiVersion2({ method: 'get', url: '/materials' })).toBe(true)
    expect(shouldAttachApiVersion2({ method: 'GET', url: '/users/u1' })).toBe(true)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/software-cards/batches' })).toBe(true)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/course/entitlements' })).toBe(true)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/trace/by-request/r1' })).toBe(true)
    expect(shouldAttachApiVersion2({ method: 'post', url: '/materials/mutate' })).toBe(false)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/products' })).toBe(false)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/orders' })).toBe(false)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/payments/export' })).toBe(false)
    expect(shouldAttachApiVersion2({ method: 'get', url: '/auth/me' })).toBe(false)
    expect(shouldAttachApiVersion2({ method: 'options', url: '/materials' })).toBe(false)
  })

  it('已接入模块 GET 自动带 X-API-Version: 2', async () => {
    respond({ status: 1, response: { items: [] } }, (config) => {
      expect(config.headers.get('X-API-Version')).toBe('2')
      expect(config.method).toBe('get')
      expect(config.url).toBe('/materials')
    })
    await getMaterials()
  })

  it('未接入模块 GET 与同模块写请求不带版本头', async () => {
    respond(success, (config) => {
      expect(config.headers.has('X-API-Version')).toBe(false)
    })
    await getProducts()

    respond(success, (config) => {
      expect(config.method).toBe('post')
      expect(config.headers.has('X-API-Version')).toBe(false)
    })
    await postMaterialsMutate({
      body: { action: 'create', reason: 'test' },
      headers: { 'X-Reason': 'test' },
    } as never)
  })

  it('新契约成功规范化为 code/data，允许 response 为 null', async () => {
    respond({ status: 1, response: { pageNum: 1, pageSize: 20, total: 0, totalPages: 0, list: [] } })
    expect(await getMaterials()).toEqual({
      code: 0,
      message: '',
      data: { pageNum: 1, pageSize: 20, total: 0, totalPages: 0, list: [] },
    })

    respond({ status: 1, response: null })
    expect(await getUsers()).toEqual({ code: 0, message: '', data: null })
  })

  it('新契约校验失败（非 2xx）转为 ApiError，保留字符串 code、errors、X-Trace-Id', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    apiClient.defaults.adapter = async (config) => {
      const headers = new AxiosHeaders()
      headers.set('X-Trace-Id', 'trace-abc')
      throw new AxiosError('bad request', 'ERR_BAD_REQUEST', config, null, {
        data: {
          status: 0,
          code: 'VALIDATION_ERROR',
          message: '参数不合法',
          response: null,
          errors: [{ field: 'pageSize', message: '超出上限' }],
        },
        status: 400,
        statusText: 'Bad Request',
        headers,
        config,
      })
    }
    await expect(getMaterials()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'VALIDATION_ERROR',
      message: '参数不合法',
      status: 400,
      traceId: 'trace-abc',
      errors: [{ field: 'pageSize', message: '超出上限' }],
    })
    expect(spy).toHaveBeenCalled()
  })

  it('先识别信封类型：旧数值 code 失败不被当成新字符串错误码', () => {
    const legacy = { code: 40100, message: 'expired', data: null }
    expect(isV2Envelope(legacy)).toBe(false)
    expect(isLegacyApiFailure(legacy)).toBe(true)

    const v2 = { status: 0, code: 'UNAUTHORIZED', message: 'expired', response: null }
    expect(isV2Envelope(v2)).toBe(true)
    expect(isLegacyApiFailure(v2)).toBe(false)

    expect(normalizeSuccessEnvelope({ status: 1, response: { ok: true } })).toEqual({
      code: 0,
      message: '',
      data: { ok: true },
    })
  })

  it('readTraceId 兼容 AxiosHeaders 与普通对象', () => {
    const headers = new AxiosHeaders()
    headers.set('X-Trace-Id', 't-1')
    expect(readTraceId(headers)).toBe('t-1')
    expect(readTraceId({ 'x-trace-id': 't-2' })).toBe('t-2')
  })
})
