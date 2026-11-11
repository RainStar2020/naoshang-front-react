import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders } from 'axios'
import { apiClient } from './client'
import { regionalAgencyApi as api } from './regionalAgency'
const original = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = original })
describe('区域代理专项六接口', () => {
  it('使用新列表、详情分页、检验和申请列表契约', async () => {
    const calls: { url?: string; params: unknown }[] = []
    apiClient.defaults.adapter = async config => {
      calls.push({ url: config.url, params: config.params })
      return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 0, message: 'ok', data: { items: [], total: 0, page: 2, pageSize: 20 } } }
    }
    await api.list({ page: 2, pageSize: 20, name: '张', phone: '138', regionType: 'store', regionCode: 'store-1' })
    await api.detail('任命/1', 2, 20)
    await api.check('district', '330106')
    await api.applications({ page: 1, pageSize: 20, status: 'PENDING_REVIEW' })
    expect(calls.map(c => c.url)).toEqual(['/region-agents', '/region-agents/' + encodeURIComponent('任命/1'), '/region-agents/check', '/region-agents/applications'])
    expect(calls[0].params).toMatchObject({ name: '张', phone: '138', regionType: 'store' })
    expect(calls[1].params).toEqual({ page: 2, pageSize: 20 })
  })
  it('任命与审核原样发送元金额、审核版本及幂等请求头', async () => {
    const calls: { url?: string; body: any; key: unknown }[] = []
    apiClient.defaults.adapter = async config => {
      calls.push({ url: config.url, body: JSON.parse(config.data), key: config.headers.get('Idempotency-Key') })
      return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 0, message: 'ok', data: { operationId: 'op' } } }
    }
    await api.appoint({ partnerId: '0001', regionType: 'district', regionCode: '330106', promotionCode: 'agent-code', feeAmount: 160000.12, reason: '到账确认' }, 'key-1')
    const decision = { decision: 'APPROVE' as const, version: 7, reason: '到账确认', feeAmount: 123.45 }
    await api.decide('app/1', decision, 'key-2')
    await api.decide('app/1', decision, 'key-2')
    expect(calls[0]).toMatchObject({ url: '/region-agents/appointments', key: 'key-1', body: { partnerId: '0001', feeAmount: 160000.12, promotionCode: 'agent-code' } })
    expect(calls[1]).toEqual(calls[2])
    expect(calls[1]).toMatchObject({ url: '/region-agents/applications/app%2F1/decisions', key: 'key-2', body: { decision: 'APPROVE', version: 7, feeAmount: 123.45 } })
    expect(calls[0].body).not.toHaveProperty('referrerId')
  })
  it('区域占用冲突不会作为成功回执', async () => {
    apiClient.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { code: 40900, message: '该区域已有有效代理', data: null } })
    await expect(api.decide('app', { decision: 'APPROVE', version: 1, reason: '确认到账' }, 'original')).rejects.toThrow('该区域已有有效代理')
  })
})
