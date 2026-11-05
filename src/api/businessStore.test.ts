import { afterEach, describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import {
  businessStoreApiClient,
  deleteStoreCoach,
  getStoreWorkspace,
  patchStoreCoach,
  postStoreCoach,
  setBusinessStoreApiToken,
  setBusinessStoreApiTokenProvider,
} from './businessStore'

const adapter = businessStoreApiClient.defaults.adapter

function respond(inspect: (config: InternalAxiosRequestConfig) => void, data: unknown): void {
  businessStoreApiClient.defaults.adapter = async (config) => {
    inspect(config)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
}

afterEach(() => {
  businessStoreApiClient.defaults.adapter = adapter
  setBusinessStoreApiToken(null)
})

describe('门店工作台 API', () => {
  it('读取工作台并自动携带当前门店会话', async () => {
    let token = 'old'
    setBusinessStoreApiTokenProvider(() => token)
    token = 'latest'
    respond((config) => {
      expect(config.method).toBe('get')
      expect(config.url).toBe('/agency/store-workspace')
      expect(config.params).toEqual({ contextId: 'agency:p6' })
      expect(config.headers.get('Authorization')).toBe('Bearer latest')
    }, { store: {}, staff: [], members: [], approvals: [], owners: [], allowedActions: [] })
    await getStoreWorkspace({ contextId: 'agency:p6' })
  })

  it('新增、编辑和删除都编码路径，并把删除参数放在请求体', async () => {
    respond((config) => {
      expect(config.method).toBe('post')
      expect(config.url).toBe('/stores/330110-S1/coaches')
      expect(JSON.parse(config.data)).toEqual({ name: '李教练', loginAccount: 'coach_li', idempotencyKey: 'key-1' })
    }, { coach: { id: 'co_1' } })
    await postStoreCoach({ storeId: '330110-S1' }, { name: '李教练', loginAccount: 'coach_li', idempotencyKey: 'key-1' })

    respond((config) => {
      expect(config.method).toBe('patch')
      expect(config.url).toBe('/stores/CS.001/coaches/co_1')
      expect(JSON.parse(config.data)).toEqual({ status: 'DISABLED', version: 2 })
    }, { coach: { id: 'co_1' } })
    await patchStoreCoach({ storeId: 'CS.001', coachId: 'co_1' }, { status: 'DISABLED', version: 2 })

    respond((config) => {
      expect(config.method).toBe('delete')
      expect(config.url).toBe('/stores/a%2Fb/coaches/co%3F1')
      expect(JSON.parse(config.data)).toEqual({ version: 3, contextId: 'agency:p6' })
    }, { removed: true, coachId: 'co?1' })
    await deleteStoreCoach({ storeId: 'a/b', coachId: 'co?1' }, { version: 3, contextId: 'agency:p6' })
  })
})
