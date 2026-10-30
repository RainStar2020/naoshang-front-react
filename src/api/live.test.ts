import { describe, expect, it } from 'vitest'
import * as api from './index'
import { liveModules } from '../services/real/registry'

/** 显式启用，日常 npm test 不访问真实服务、不产生远端会话。 */
const enabled = import.meta.env.HQ_API_LIVE === '1'
const sources = import.meta.glob('../types/hq/*.ts', { query: '?raw', import: 'default', eager: true })
type Row = Record<string, unknown>
const object = (value: unknown): Row => typeof value === 'object' && value !== null ? value as Row : {}
const array = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : []

describe.skipIf(!enabled)('局域网后台只读联调', () => {
  it('真实登录、82 个 GET 路由、分页、注销和 token 撤销', async () => {
    const password = import.meta.env.HQ_API_PASSWORD
    if (!password) throw new Error('请通过 HQ_API_PASSWORD 环境变量提供测试账号口令')
    const originalBase = api.apiClient.defaults.baseURL
    api.apiClient.defaults.baseURL = import.meta.env.HQ_API_TEST_URL || 'http://localhost:3000/api/hq'
    const routes = Object.values(sources).flatMap((source) => [...String(source).matchAll(/'GET ([^']+)':/g)].map((m) => m[1]))
    const data = new Map<string, unknown>()
    const passed: string[] = []
    const missing: string[] = []
    const failures: { path: string; code?: number | string; message: string }[] = []
    let loggedIn = false
    try {
      await expect(api.getAuthMe()).rejects.toMatchObject({ code: 40100 })
      const login = await api.postAuthLogin({ username: import.meta.env.HQ_API_USERNAME || 'admin', password }).catch((error: unknown) => {
        throw new Error(`真实登录失败：${error instanceof Error ? error.message : '连接异常'}`)
      })
      if (login.code !== 0) throw new Error('登录未返回成功信封')
      api.setApiToken(login.data.token)
      loggedIn = true

      function fn(path: string) {
        const operation = liveModules.flatMap((module) => module.operations).find((item) => item.key === `GET ${path}`)
        if (!operation) throw new Error(`真实页面缺少端点绑定：${path}`)
        return (input: Record<string, unknown> = {}) => operation.invoke({
          path: operation.params.length ? Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])) : {},
          query: operation.params.length ? undefined : input,
        })
      }

      // 先读列表与目录，再用真实数据中的 ID 访问详情，不创建测试业务数据。
      for (const path of routes.filter((route) => !route.includes(':'))) {
        const result = await fn(path)({ pageSize: 1 })
        expect(result.code, path).toBe(0)
        data.set(path, result.data)
        passed.push(path)
      }
      const first = (path: string) => array(object(data.get(path)).items)[0] || {}
      const value = (path: string, key: string) => first(path)[key]
      const idFor = (path: string, key: string): string => {
        let id: unknown
        if (key === 'accountId') id = path.startsWith('/revenue') ? value('/revenue/accounts', 'ownerAccountId') : value('/users', 'accountId')
        else if (key === 'memberId') id = value('/members', key)
        else if (key === 'columnId') {
          const column = array(object(data.get('/columns/catalog')).columns)[0] || {}
          id = column.columnId || object(column.draft).columnId
        }
        else if (key === 'jobId') id = array(object(data.get('/payments/catalog')).recentJobs)[0]?.jobId
        else if (key === 'requestId') id = value('/trace', key)
        else {
          const parent = path.split('/:')[0]
          id = value(parent, key)
        }
        return typeof id === 'string' && id ? id : '__hq_readonly_missing__'
      }
      for (const path of routes.filter((route) => route.includes(':'))) {
        const params = Object.fromEntries([...path.matchAll(/:(\w+)/g)].map((m) => [m[1], idFor(path, m[1])]))
        try {
          const result = await fn(path)(params)
          expect(result.code, path).toBe(0)
          passed.push(path)
        } catch (error) {
          // 集合为空时只验证资源不存在的契约；不宣称详情读取成功。
          if (Object.values(params).includes('__hq_readonly_missing__') && error instanceof api.ApiError && error.code === 40400 && error.status === 404) missing.push(path)
          else failures.push({ path, code: error instanceof api.ApiError ? error.code : undefined, message: error instanceof Error ? error.message : String(error) })
        }
      }
      const page = await api.getUsers({ page: 1, pageSize: 101 })
      if (page.code !== 0) throw new Error('分页请求失败')
      expect(page.data.pageSize).toBe(100)
      const exported = await api.getPaymentsExport()
      if (exported.code !== 0) throw new Error('对账导出失败')
      expect(String(object(exported.data).contentType)).toContain('text/csv')
      expect(typeof object(exported.data).csv).toBe('string')
      await api.postAuthLogout({})
      loggedIn = false
      await expect(api.getAuthMe()).rejects.toMatchObject({ code: 40100 })
      expect(routes).toHaveLength(82)
      expect(passed.length + missing.length + failures.length).toBe(82)
      console.info(JSON.stringify({ totalGetRoutes: routes.length, successfulReads: passed.length, expectedNotFoundForEmptyCollections: missing.length, missingRoutes: missing, failures, paginationCap: 'passed', csvEnvelope: 'passed', loginLogout: 'passed' }))
      expect(failures, '列表返回的真实 ID 应可读取详情').toEqual([])
    } finally {
      if (loggedIn) await api.postAuthLogout({}).catch(() => undefined)
      api.setApiToken(null)
      api.apiClient.defaults.baseURL = originalBase
    }
  }, 120_000)
})
