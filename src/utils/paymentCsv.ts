/** 严格解析对账CSV：只接受数据，不执行公式；支持引号、转义引号与CRLF。 */
export function parsePaymentCsv(source: string) {
  if (new TextEncoder().encode(source).length > 1024 * 1024) throw new Error('Mock对账文件最多1MB')
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false
  const input = source.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) { if (c === '"') { if (input[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } } else field += c; continue }
    if (closed && ![',', '\r', '\n'].includes(c)) throw new Error('CSV引号后存在非法字符')
    if (c === '"') { if (field || closed) throw new Error('CSV引号格式错误'); quoted = true }
    else if (c === ',') { row.push(field); field = ''; closed = false }
    else if (c === '\n' || c === '\r') { if (c === '\r' && input[i + 1] === '\n') i++; row.push(field); if (row.some(value => value !== '')) rows.push(row); row = []; field = ''; closed = false }
    else field += c
    if (rows.length > 501) throw new Error('对账明细最多500条')
  }
  if (quoted) throw new Error('CSV引号未闭合')
  if (field || row.length || closed) { row.push(field); rows.push(row) }
  if (rows.length < 2 || rows.length > 501 || rows[0].join(',') !== 'paymentId,channelTradeNo,amount,status') throw new Error('表头须为paymentId,channelTradeNo,amount,status，包含1至500条明细')
  const ids = new Set<string>(), trades = new Set<string>()
  return rows.slice(1).map((fields, index) => {
    const [paymentId, channelTradeNo, amountText, status] = fields
    if (fields.length !== 4 || !/^(demo-payment-|DEMO-)[A-Za-z0-9_-]+$/.test(paymentId) || !/^(DEMO-[A-Za-z0-9_-]+)?$/.test(channelTradeNo) || !/^(0|[1-9]\d*)$/.test(amountText) || !Number.isSafeInteger(Number(amountText)) || Number(amountText) > 100000000000 || !['SUCCESS', 'PENDING', 'CLOSED'].includes(status)) throw new Error(`第${index + 2}行格式无效；仅接收DEMO标识和整数分金额`)
    if (ids.has(paymentId) || channelTradeNo && trades.has(channelTradeNo)) throw new Error('文件中支付单ID或渠道交易号重复')
    ids.add(paymentId); if (channelTradeNo) trades.add(channelTradeNo)
    return { paymentId, channelTradeNo: channelTradeNo || null, amount: Number(amountText), status: status as 'SUCCESS' | 'PENDING' | 'CLOSED' }
  })
}
