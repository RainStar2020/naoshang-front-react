import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { PaymentMutation } from '../types/payments'
import { parsePaymentCsv } from '../utils/paymentCsv'
let service: typeof import('./payments')['paymentsService']
let mock: typeof import('./mock/payments')
let auth: typeof import('./auth')['authService']
let token: string
const pendingId = 'demo-payment-delivery-demo-order-4'
const base = () => ({ reason: '验收支付模块', idempotencyKey: crypto.randomUUID() })
const query = (paymentId = pendingId): PaymentMutation => ({ ...base(), action: 'query', paymentId })
const compensate = (paymentId = pendingId): PaymentMutation => ({ ...base(), action: 'compensate', paymentId })
const config = (): Extract<PaymentMutation, { action: 'save-channel' }> => ({ ...base(), action: 'save-channel', configId: 'H5-MALL-ALIPAY', version: 1, enabled: false })
const reconcile = (csv: string): Extract<PaymentMutation, { action: 'reconcile' }> => ({ ...base(), action: 'reconcile', channel: 'ALIPAY', statementDate: '2026-10-01', fileName: 'demo-statement.csv', csv })
async function finish(jobId: string) { vi.advanceTimersByTime(1100); return (await service.catalog(token)).jobs.find(job => job.jobId === jobId)! }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T09:00:00+08:00')); vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./payments')).paymentsService; mock = await import('./mock/payments'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('只包含服务支持的小程序/H5渠道组合及支付尝试', async () => {
  const catalog = await service.catalog(token); expect(catalog.configs).toHaveLength(9); expect(catalog.configs.some(row => row.platform as string === 'APP')).toBe(false)
  expect(mock.mockEnabledPaymentChannels('MINI_PROGRAM', 'MALL')).toEqual(['WECHAT']); expect(catalog.attempts[0].paymentId).toBe(catalog.payments[0].paymentId)
})
it('按平台业务开关不扩散到其他组合和既有尝试', async () => {
  const before = (await service.catalog(token)).attempts; await service.mutate(token, config())
  expect(mock.mockEnabledPaymentChannels('H5', 'MALL')).toEqual(['WECHAT']); expect(mock.mockEnabledPaymentChannels('H5', 'BUSINESS')).toEqual(['WECHAT', 'ALIPAY']); expect((await service.catalog(token)).attempts).toEqual(before)
})
it('渠道配置版本冲突及非法组合被拒绝', async () => {
  await service.mutate(token, config()); await expect(service.mutate(token, config())).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  await expect(service.mutate(token, { ...config(), configId: 'APP-MALL-WECHAT' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('查单提交后先返回处理中，再生成渠道核验结果', async () => {
  const result = await service.mutate(token, query()); expect((await service.catalog(token)).jobs[0].status).toBe('PROCESSING')
  expect((await finish(result.jobId!)).status).toBe('SUCCEEDED'); expect((await service.catalog(token)).payments.find(row => row.paymentId === pendingId)).toMatchObject({ status: 'WAITING', verification: { status: 'SUCCESS' } })
})
it('查单不改写订单本地付款、交付或交易金额', async () => {
  const orders = (await import('./orders')).ordersService, before = await orders.detail(token, 'delivery-demo-order-4'); const result = await service.mutate(token, query()); await finish(result.jobId!)
  expect(await orders.detail(token, before.order.orderId)).toEqual(before)
})
it('渠道不可用任务失败，不误报成功付款', async () => {
  const result = await service.mutate(token, query('demo-payment-delivery-demo-order-9')); const job = await finish(result.jobId!); expect(job.status).toBe('FAILED'); expect(job.result).toContain('渠道不可用')
})
it('金额不一致展示MISMATCH，补偿必须失败', async () => {
  const queryResult = await service.mutate(token, query('demo-payment-delivery-demo-order-8')); await finish(queryResult.jobId!); expect((await service.catalog(token)).payments.find(row => row.paymentId.endsWith('order-8'))?.verification?.status).toBe('MISMATCH')
  const result = await service.mutate(token, compensate('demo-payment-delivery-demo-order-8')); expect((await finish(result.jobId!)).status).toBe('FAILED')
})
it('补单服务再次核验后仅生成演示回执，不改真实订单', async () => {
  const orders = (await import('./orders')).ordersService, before = await orders.detail(token, 'delivery-demo-order-4')
  const result = await service.mutate(token, compensate()); const job = await finish(result.jobId!); expect(job).toMatchObject({ status: 'SUCCEEDED', mockOnly: true }); expect(job.receiptId).toMatch(/^DEMO-COMPENSATION-/)
  expect(job.result).toContain('未真实入账'); expect(await orders.detail(token, before.order.orderId)).toEqual(before)
})
it('成功补偿不可通过不同请求号重复执行', async () => {
  const result = await service.mutate(token, compensate()); const job = await finish(result.jobId!); const repeated = await service.mutate(token, compensate())
  expect(repeated.jobId).toBe(result.jobId); expect((await service.catalog(token)).jobs.filter(row => row.kind === 'compensate')).toHaveLength(1); expect((await service.catalog(token)).jobs[0].receiptId).toBe(job.receiptId)
})
it('本地已成功支付不能再次补偿', async () => {
  const result = await service.mutate(token, compensate('demo-payment-delivery-demo-order-1')); expect((await finish(result.jobId!)).status).toBe('FAILED')
})
it('不能通过客户端伪造付款结果或修改本地状态', async () => {
  await expect(service.mutate(token, { ...base(), action: 'set-paid', paymentId: pendingId, status: 'SUCCESS' } as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const result = await service.mutate(token, { ...compensate('demo-payment-delivery-demo-order-8'), status: 'SUCCESS', amount: 1 } as unknown as PaymentMutation); expect((await finish(result.jobId!)).status).toBe('FAILED')
})
it('请求重试幂等，改变请求参数被拒绝', async () => {
  const request = query(); const result = await service.mutate(token, request); expect(await service.mutate(token, request)).toEqual(result)
  await expect(service.mutate(token, { ...request, reason: '改变参数' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }); expect((await service.catalog(token)).jobs).toHaveLength(1)
})
it('渠道停用仍可查询已有支付尝试', async () => {
  await service.mutate(token, config()); const result = await service.mutate(token, query()); expect((await finish(result.jobId!)).status).toBe('SUCCEEDED')
})
it('CSV接受BOM、引用与CRLF的严格演示格式', async () => {
  const sample = await service.sample(token, 'ALIPAY', '2026-10-01'); expect(parsePaymentCsv(sample.csv)).toHaveLength((await service.catalog(token)).payments.filter(row => row.channel === 'ALIPAY' && row.statementDate === '2026-10-01').length)
  expect(() => parsePaymentCsv('paymentId,channelTradeNo,amount,status\n"DEMO-A","DEMO-T",100,SUCCESS')).not.toThrow()
})
it.each(['wrong,header\n1,2', 'paymentId,channelTradeNo,amount,status\nDEMO-A,DEMO-T,1.2,SUCCESS', 'paymentId,channelTradeNo,amount,status\nDEMO-A,DEMO-T,-1,SUCCESS', 'paymentId,channelTradeNo,amount,status\nDEMO-A,DEMO-T,100,UNKNOWN', 'paymentId,channelTradeNo,amount,status\n"DEMO-A,DEMO-T,100,SUCCESS'])('拒绝无效CSV数据', csv => { expect(() => parsePaymentCsv(csv)).toThrow() })
it('CSV拒绝重复ID、交易号和公式或非演示标识', () => {
  expect(() => parsePaymentCsv('paymentId,channelTradeNo,amount,status\nDEMO-A,DEMO-T,1,SUCCESS\nDEMO-A,DEMO-T2,1,SUCCESS')).toThrow('重复')
  expect(() => parsePaymentCsv('paymentId,channelTradeNo,amount,status\nDEMO-A,DEMO-T,1,SUCCESS\nDEMO-B,DEMO-T,1,SUCCESS')).toThrow('重复')
  expect(() => parsePaymentCsv('paymentId,channelTradeNo,amount,status\n=evil(),DEMO-T,1,SUCCESS')).toThrow('DEMO')
})
it('CSV大小与500行限制在服务解析端校验', () => {
  expect(() => parsePaymentCsv('x'.repeat(1024 * 1024 + 1))).toThrow('1MB')
  const csv = 'paymentId,channelTradeNo,amount,status\n' + Array.from({ length: 501 }, (_, i) => `DEMO-${i},DEMO-T${i},1,SUCCESS`).join('\n'); expect(() => parsePaymentCsv(csv)).toThrow('500')
})
it('账单日期渠道范围不允许混入其他支付单', async () => {
  const sample = await service.sample(token, 'WECHAT', '2026-10-01'); await expect(service.mutate(token, reconcile(sample.csv))).rejects.toThrow('其他渠道')
  await expect(service.mutate(token, { ...reconcile(sample.csv), statementDate: '2026-02-30' })).rejects.toThrow('日期')
})
it('对账任务输出状态差异，不自动补单', async () => {
  const sample = await service.sample(token, 'ALIPAY', '2026-10-01'); const result = await service.mutate(token, reconcile(sample.csv)); const job = await finish(result.jobId!)
  expect(job).toMatchObject({ kind: 'reconcile', status: 'SUCCEEDED', receiptId: null }); expect(job.differences.some(row => row.paymentId === pendingId && row.reason === 'STATUS_MISMATCH')).toBe(true)
  expect((await service.catalog(token)).jobs.some(row => row.kind === 'compensate')).toBe(false)
})
it('对账支持仅本地、仅渠道、金额和交易号差异', async () => {
  const payment = (await service.catalog(token)).payments.find(row => row.paymentId.endsWith('order-2'))!
  const csv = `paymentId,channelTradeNo,amount,status\n${payment.paymentId},DEMO-WRONG,1,SUCCESS\nDEMO-EXTRA,DEMO-EXTRA-TRADE,100,SUCCESS`
  const result = await service.mutate(token, reconcile(csv)); const reasons = (await finish(result.jobId!)).differences.map(row => row.reason)
  expect(reasons).toContain('CHANNEL_ONLY'); expect(reasons).toContain('LOCAL_ONLY'); expect(reasons).toContain('AMOUNT_MISMATCH'); expect(reasons).toContain('TRADE_NO_MISMATCH')
})
it('下载原文件保留内容，下载差异受完成状态与审计约束', async () => {
  const sample = await service.sample(token, 'ALIPAY', '2026-10-01'); const result = await service.mutate(token, reconcile(sample.csv)); await expect(service.download(token, result.jobId!, 'differences', '导出测试', 'export-early')).rejects.toMatchObject({ code: 'INVALID_STATE' })
  await finish(result.jobId!); expect((await service.download(token, result.jobId!, 'source', '导出测试', 'export-source')).csv).toBe(sample.csv)
  const exported = await service.download(token, result.jobId!, 'differences', '导出测试', 'export-diff'); expect(exported.csv).toContain('STATUS_MISMATCH'); expect(await service.download(token, result.jobId!, 'differences', '导出测试', 'export-diff')).toEqual(exported)
  expect((await service.catalog(token)).audit.filter(row => row.action === 'download')).toHaveLength(2)
})
it('操作员可查单对账导出，不可开渠道或补单', async () => {
  const operator = (await auth.login({ loginAccount: 'hq-payment-operator', password: 'Demo@123456' })).token
  await expect(service.mutate(operator, query())).resolves.toBeDefined(); await expect(service.sample(operator, 'ALIPAY', '2026-10-01')).resolves.toBeDefined()
  await expect(service.mutate(operator, config())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.mutate(operator, compensate())).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('只读账号禁止查单和导出，退出禁止查询', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-payment-viewer', password: 'Demo@123456' })).token
  await expect(service.catalog(viewer)).resolves.toBeDefined(); await expect(service.mutate(viewer, query())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(service.sample(viewer, 'ALIPAY', '2026-10-01')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await auth.logout(); await expect(service.catalog(viewer)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('空原因和未知支付单被拒绝，响应副本不能修改服务状态', async () => {
  await expect(service.mutate(token, { ...query(), reason: '' })).rejects.toThrow('原因'); await expect(service.mutate(token, query('missing'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const value = await service.catalog(token); value.configs[0].enabled = false; expect((await service.catalog(token)).configs[0].enabled).toBe(true)
})

