import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders } from 'axios'
import { apiClient } from '../../api/client'
import { liveModules } from './registry'
import { buildMutationRequest, dataRows, parseObject, rowIdentifier, runOperation, type ModuleOperation } from './modules'

const adapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = adapter })

describe('真实业务模块绑定', () => {
  it('覆盖全部 26 模块、82 个读取与36个业务/账号设置写入；登录注销由认证服务负责', () => {
    expect(liveModules).toHaveLength(26)
    const operations = liveModules.flatMap((module) => module.operations)
    expect(new Set(operations.map((item) => item.key)).size).toBe(118)
    expect(operations.filter((item) => item.method === 'GET')).toHaveLength(82)
    expect(operations.filter((item) => item.method === 'POST')).toHaveLength(36)
    expect(new Set(liveModules.map((module) => module.route)).size).toBe(26)
  })

  for (const module of liveModules) {
    it(`${module.title}：每个操作正确绑定方法、路径、请求体和鉴权`, async () => {
      for (const operation of module.operations) {
        let sent = false
        apiClient.defaults.adapter = async (config) => {
          sent = true
          const expected = operation.path.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(`${key}/test`))
          expect(config.url, operation.key).toBe(expected)
          expect(config.method).toBe(operation.method.toLowerCase())
          expect(config.headers.get('Authorization')).toBe('Bearer module-test')
          if (operation.method === 'POST') {
            expect(JSON.parse(config.data)).toMatchObject({ reason: 'test', action: operation.actions[0] || 'create' })
            expect(JSON.parse(config.data).body).toBeUndefined()
          } else expect(config.params).toEqual({ page: 2, pageSize: 20 })
          return { config, data: { code: 0, message: 'ok', data: { operationId: 'test-receipt' } }, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
        }
        expect(await runOperation(operation, {
          path: Object.fromEntries(operation.params.map((key) => [key, `${key}/test`])),
          query: { page: 2, pageSize: 20 },
          request: { body: { reason: 'test', action: operation.actions[0] || 'create' } },
          options: { headers: { Authorization: 'Bearer module-test' } },
        })).toEqual({ operationId: 'test-receipt' })
        expect(sent).toBe(true)
      }
    })
  }

  const operation = liveModules.find((module) => module.name === 'users')!.operations.find((item) => item.method === 'POST')!
  it('提交前验证原因、版本、action 与备注必填，禁止越界操作', () => {
    expect(() => buildMutationRequest(operation, { action: 'freeze' }, '', 'key')).toThrow('原因')
    expect(() => buildMutationRequest(operation, { action: 'freeze' }, 'reason', '')).toThrow('请求号')
    expect(() => buildMutationRequest(operation, { action: 'reset-password' }, 'reason', 'key')).toThrow('契约')
    expect(() => buildMutationRequest(operation, { action: 'freeze', version: 1.5 }, 'reason', 'key')).toThrow('版本号')
    expect(() => buildMutationRequest(operation, { action: 'update-note' }, 'reason', 'key')).toThrow('note')
    expect(buildMutationRequest(operation, { action: 'update-note', note: 'memo', version: 2 }, 'reason', 'key').body).toMatchObject({ action: 'update-note', version: 2, idempotencyKey: 'key', note: 'memo' })
  })

  it('数据读取保留原金额，不虚构记录或转换为分', () => {
    expect(dataRows({ items: [{ amount: 19.99 }] })).toEqual([{ amount: 19.99 }])
    expect(dataRows({ items: [] })).toEqual([])
    expect(dataRows([{ draft: { columnId: 'c1', title: 'content' }, version: 3 }])[0]).toMatchObject({ columnId: 'c1', version: 3 })
    expect(rowIdentifier({ draft: { columnId: 'c1' } }, 'columnId')).toBe('c1')
  })

  it('解析未知请求参数时拒绝数组和非对象值', () => {
    for (const text of ['[]', 'null', '1', '"text"']) expect(() => parseObject(text)).toThrow('JSON 对象')
    expect(parseObject('{"amount":1.25}')).toEqual({ amount: 1.25 })
  })

  it('缺少路径参数时不发送请求', async () => {
    let called = false
    const endpoint: ModuleOperation = { ...operation, params: ['accountId'], invoke: async () => { called = true; return { code: 0, message: 'ok', data: {} } } }
    await expect(runOperation(endpoint, { path: {} })).rejects.toThrow('accountId')
    expect(called).toBe(false)
  })
})
