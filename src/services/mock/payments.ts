import type { HqAccount } from '../../types/auth'
import { PaymentError, type ChannelVerification, type PaymentAudit, type PaymentBusiness, type PaymentCatalog, type PaymentChannel, type PaymentChannelConfig, type PaymentDownload, type PaymentJob, type PaymentMutation, type PaymentMutationResult, type PaymentRecord } from '../../types/payments'
import { mockDeliveryCatalog } from './delivery'
import { parsePaymentCsv } from '../../utils/paymentCsv'
import { makeCsv } from '../../utils/csv'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: PaymentError['code'], message: string): never => { throw new PaymentError(code, message) }
const configs: PaymentChannelConfig[] = (['MALL', 'MEMBERSHIP', 'BUSINESS'] as PaymentBusiness[]).flatMap(business => [{ configId: `MINI_PROGRAM-${business}-WECHAT`, platform: 'MINI_PROGRAM' as const, business, channel: 'WECHAT' as const, enabled: true, version: 1 }, ...(['WECHAT', 'ALIPAY'] as PaymentChannel[]).map(channel => ({ configId: `H5-${business}-${channel}`, platform: 'H5' as const, business, channel, enabled: true, version: 1 }))])
const jobs: PaymentJob[] = [], audit: PaymentAudit[] = []
const verifications = new Map<string, ChannelVerification>(), readyTimes = new Map<string, number>(), sources = new Map<string, { csv: string; rows: ReturnType<typeof parsePaymentCsv> }>(), receipts = new Map<string, string>()
const operations = new Map<string, { payload: string; result: PaymentMutationResult }>(), exports = new Map<string, { payload: string; result: PaymentDownload }>()
function payments(): PaymentRecord[] { return mockDeliveryCatalog().orders.flatMap(order => order.transaction?.payments.map(payment => ({ paymentId: payment.paymentId, orderId: order.orderId, orderNo: order.orderNo, accountId: order.accountId, channel: payment.channel, platform: payment.channel === 'WECHAT' ? 'MINI_PROGRAM' as const : 'H5' as const, business: order.transaction!.source.kind, status: payment.status, amount: payment.amount, paidAt: payment.paidAt, channelTradeNo: payment.thirdPartyTradeNo, statementDate: (payment.paidAt ?? order.createdAt).slice(0, 10), createdAt: order.createdAt, verification: verifications.get(payment.paymentId) ?? null })) ?? []) }
const findPayment = (id: string) => payments().find(row => row.paymentId === id) ?? fail('NOT_FOUND', '支付单不存在')
const findJob = (id: string) => jobs.find(row => row.jobId === id) ?? fail('NOT_FOUND', '支付任务不存在')
function log(action: PaymentAudit['action'], requestId: string, targetId: string, operatorName: string, reason: string, detail: string) { audit.push({ operationId: crypto.randomUUID(), requestId, targetId, operatorName, reason, detail, action, occurredAt: new Date().toISOString() }) }
/** 固定渠道适配器演示：不接受浏览器传入成功状态、交易号或金额核验结论。 */
function verify(payment: PaymentRecord): ChannelVerification {
  const latePaid = payment.orderId === 'delivery-demo-order-4', mismatch = payment.orderId === 'delivery-demo-order-8', unavailable = payment.orderId === 'delivery-demo-order-9'
  return { status: unavailable ? 'UNAVAILABLE' : mismatch ? 'MISMATCH' : latePaid || payment.status === 'SUCCESS' ? 'SUCCESS' : 'CLOSED', amount: unavailable ? null : payment.amount + (mismatch ? 1 : 0), channelTradeNo: unavailable ? null : payment.channelTradeNo ?? `DEMO-CHANNEL-${payment.orderId}`, checkedAt: new Date().toISOString(), detail: unavailable ? 'Mock渠道暂不可用，未确认资金状态' : mismatch ? 'Mock渠道金额与本地不一致，禁止补偿' : latePaid ? 'Mock渠道已付、本地待付的异常样例' : 'Mock渠道核验结果，非真实查单' }
}
function completeJobs() {
  for (const job of jobs) {
    if (job.status !== 'PROCESSING' || (readyTimes.get(job.jobId) ?? Infinity) > Date.now()) continue
    try {
      if (job.kind === 'reconcile') {
        const source = sources.get(job.jobId)!, local = payments().filter(row => row.channel === job.channel && row.statementDate === job.statementDate)
        const differences: PaymentJob['differences'] = []
        const add = (paymentId: string, reason: PaymentJob['differences'][number]['reason'], localAmount: number | null, channelAmount: number | null, detail: string) => differences.push({ id: crypto.randomUUID(), paymentId, reason, localAmount, channelAmount, detail })
        for (const line of source.rows) {
          const row = local.find(row => row.paymentId === line.paymentId)
          if (!row) { add(line.paymentId, 'CHANNEL_ONLY', null, line.amount, '所选渠道及账单日内无本地支付单'); continue }
          if (row.amount !== line.amount) add(row.paymentId, 'AMOUNT_MISMATCH', row.amount, line.amount, '金额不一致')
          if ((row.status === 'WAITING' ? 'PENDING' : row.status) !== line.status) add(row.paymentId, 'STATUS_MISMATCH', row.amount, line.amount, '渠道和本地支付状态不一致')
          if (row.channelTradeNo !== line.channelTradeNo && row.status === 'SUCCESS') add(row.paymentId, 'TRADE_NO_MISMATCH', row.amount, line.amount, '成功支付的渠道交易号不一致')
        }
        for (const row of local) if (!source.rows.some(line => line.paymentId === row.paymentId)) add(row.paymentId, 'LOCAL_ONLY', row.amount, null, '账单文件缺少本地支付单')
        job.differences = differences; job.result = `解析${source.rows.length}条，本地${local.length}条，发现${differences.length}项差异；仅生成核对结果，不自动补单`
      } else {
        const payment = findPayment(job.paymentId!), verification = verify(payment); verifications.set(payment.paymentId, verification)
        if (verification.status === 'UNAVAILABLE') throw new Error('渠道不可用，请稍后重新提交任务；未确认付款')
        if (job.kind === 'query') job.result = `${verification.detail}；渠道状态 ${verification.status}，本地状态保持 ${payment.status}`
        else {
          const order = mockDeliveryCatalog().orders.find(row => row.orderId === payment.orderId)!
          if (verification.status !== 'SUCCESS' || verification.amount !== payment.amount || !verification.channelTradeNo || order.paymentStatus !== 'PENDING_PAYMENT' || payment.status !== 'WAITING') throw new Error('核验未确认等额付款或订单已关闭/已付，不执行补偿')
          let receipt = receipts.get(payment.paymentId)
          if (!receipt) { receipt = `DEMO-COMPENSATION-${crypto.randomUUID()}`; receipts.set(payment.paymentId, receipt) }
          job.receiptId = receipt; job.result = 'Mock一次性补偿回执已生成；未真实入账、未修改HQ-11付款状态、未发权益，待后端补偿API接入'
        }
      }
      job.status = 'SUCCEEDED'
    } catch (err) { job.status = 'FAILED'; job.result = err instanceof Error ? err.message : '任务失败，未确认付款' }
    job.completedAt = new Date().toISOString(); log(job.kind, job.requestId, job.jobId, job.operatorName, job.reason, `${job.status}：${job.result}`)
  }
}
export function mockPaymentCatalog(): PaymentCatalog {
  completeJobs(); const rows = payments()
  return copy({ configs, payments: rows, attempts: rows.map(row => ({ attemptId: `demo-attempt-${row.paymentId}`, paymentId: row.paymentId, orderId: row.orderId, channel: row.channel, platform: row.platform, status: row.status, createdAt: row.createdAt, requestId: `demo-request-${row.paymentId}` })), jobs: [...jobs].reverse(), audit: [...audit].reverse() })
}
export function mockPaymentMutate(input: PaymentMutation, operator: HqAccount): PaymentMutationResult {
  completeJobs()
  if (!['save-channel', 'query', 'compensate', 'reconcile'].includes(input.action) || !input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '操作、原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(previous.result) }
  let result: PaymentMutationResult
  if (input.action === 'save-channel') {
    const row = configs.find(row => row.configId === input.configId) ?? fail('NOT_FOUND', '平台渠道组合不受支持')
    if (row.version !== input.version) fail('VERSION_CONFLICT', '渠道配置已更新，请刷新')
    if (typeof input.enabled !== 'boolean') fail('INVALID_INPUT', '渠道开关无效')
    row.enabled = input.enabled; row.version++; result = { jobId: null, configId: row.configId }; log(input.action, input.idempotencyKey, row.configId, operator.nickname, input.reason.trim(), `${input.enabled ? '启用' : '停用'} ${row.platform}/${row.business}/${row.channel}；已有支付尝试不受开关改写`)
  } else {
    let parsed: ReturnType<typeof parsePaymentCsv> | null = null
    if (input.action === 'reconcile') {
      if (!['WECHAT', 'ALIPAY'].includes(input.channel) || !/^\d{4}-\d{2}-\d{2}$/.test(input.statementDate) || !Number.isFinite(Date.parse(input.statementDate)) || new Date(input.statementDate).toISOString().slice(0, 10) !== input.statementDate || !/^[^\\/:*?"<>|]{1,100}\.csv$/i.test(input.fileName)) fail('INVALID_INPUT', '渠道、账单日期或CSV文件名无效')
      try { parsed = parsePaymentCsv(input.csv) } catch (err) { fail('INVALID_INPUT', err instanceof Error ? err.message : 'CSV解析失败') }
      for (const line of parsed!) { const payment = payments().find(row => row.paymentId === line.paymentId); if (payment && (payment.channel !== input.channel || payment.statementDate !== input.statementDate)) fail('INVALID_INPUT', '文件含其他渠道或账单日支付单，请核对文件范围') }
    } else {
      findPayment(input.paymentId)
      const existing = jobs.find(job => job.kind === input.action && job.paymentId === input.paymentId && (job.status === 'PROCESSING' || input.action === 'compensate' && job.status === 'SUCCEEDED'))
      if (existing) { result = { jobId: existing.jobId, configId: null }; operations.set(key, { payload, result }); return copy(result) }
    }
    const jobId = crypto.randomUUID(), kind = input.action
    const job: PaymentJob = { jobId, reconciliationJobId: kind === 'reconcile' ? jobId : null, kind, paymentId: 'paymentId' in input ? input.paymentId : null, status: 'PROCESSING', requestId: input.idempotencyKey, operatorName: operator.nickname, reason: input.reason.trim(), createdAt: new Date().toISOString(), completedAt: null, result: 'Mock服务任务处理中，请查询结果；不在浏览器写入付款状态', receiptId: null, fileName: input.action === 'reconcile' ? input.fileName : null, channel: input.action === 'reconcile' ? input.channel : null, statementDate: input.action === 'reconcile' ? input.statementDate : null, differences: [], mockOnly: true }
    jobs.push(job); readyTimes.set(jobId, Date.now() + 1000)
    if (input.action === 'reconcile') sources.set(jobId, { csv: input.csv, rows: parsed! })
    result = { jobId, configId: null }; log(input.action, input.idempotencyKey, jobId, operator.nickname, input.reason.trim(), '已提交Mock服务任务')
  }
  operations.set(key, { payload, result: copy(result) }); return copy(result)
}
export function mockPaymentDownload(jobId: string, kind: 'source' | 'differences', reason: string, requestId: string, operator: HqAccount): PaymentDownload {
  completeJobs(); if (!reason.trim() || reason.trim().length > 200 || !requestId || !['source', 'differences'].includes(kind)) fail('INVALID_INPUT', '请填写导出原因和请求号')
  const key = `${operator.accountId}:${requestId}`, payload = JSON.stringify([jobId, kind, reason]), old = exports.get(key)
  if (old) { if (old.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '导出请求号参数改变'); return copy(old.result) }
  const job = findJob(jobId)
  if (job.kind !== 'reconcile' || kind === 'differences' && job.status !== 'SUCCEEDED') fail('INVALID_STATE', '请选择已完成的对账任务导出差异')
  const csv = kind === 'source' ? sources.get(jobId)!.csv : makeCsv([['支付单ID', '差异原因', '本地金额(分)', '渠道金额(分)', '说明'], ...job.differences.map(row => [row.paymentId, row.reason, row.localAmount, row.channelAmount, row.detail])])
  const result = { csv, fileName: `payment-demo-${kind}-${jobId}.csv`, mockOnly: true as const }; exports.set(key, { payload, result: copy(result) }); log('download', requestId, jobId, operator.nickname, reason.trim(), `导出${kind === 'source' ? '原始演示账单' : '差异结果'}`); return result
}
export function mockPaymentSample(channel: PaymentChannel, statementDate: string): PaymentDownload {
  if (!['WECHAT', 'ALIPAY'].includes(channel)) fail('INVALID_INPUT', '渠道无效')
  const rows = payments().filter(row => row.channel === channel && row.statementDate === statementDate)
  if (!rows.length) fail('INVALID_INPUT', '该渠道/日期暂无演示支付单，可选2026-10-01')
  return { csv: makeCsv([['paymentId', 'channelTradeNo', 'amount', 'status'], ...rows.map(row => { const v = verify(row); return [row.paymentId, v.channelTradeNo ?? '', v.amount ?? row.amount, v.status === 'SUCCESS' || v.status === 'MISMATCH' ? 'SUCCESS' : v.status === 'CLOSED' ? 'CLOSED' : 'PENDING'] })]), fileName: `payment-demo-${channel}-${statementDate}.csv`, mockOnly: true }
}
export function mockEnabledPaymentChannels(platform: string, business: string) { return copy(configs.filter(row => row.platform === platform && row.business === business && row.enabled).map(row => row.channel)) }

