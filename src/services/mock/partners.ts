import { mockInvitationSuperiorId } from './invitations'
import type { HqAccount } from '../../types/auth'
import { partnerLevels, PartnerError, type PartnerAudit, type PartnerCatalog, type PartnerLevel, type PartnerLevelBenefits, type PartnerMutation, type PartnerMutationResult, type PartnerProfile, type PartnerPromotionTask, type PartnerQuery, type PartnerReceipt } from '../../types/partners'
import { mockListUsers, mockUserDetail } from './users'
import { hasContent, normalizeContent } from '../../utils/richContent'
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: PartnerError['code'], message: string): never => { throw new PartnerError(code, message) }
const levels: PartnerLevelBenefits[] = partnerLevels.map((partnerLevel, index) => ({ partnerLevel, title: ['VIP', '天使', '私董', '联创'][index], wholesaleLabel: ['小批', '中批', '大批', '总批'][index], quotaOccupancy: [1, 3, 6, 24][index], nextLevel: partnerLevels[index + 1] ?? null, taskTarget: [3, 9, 18, null][index], summary: '年度经营权益说明演示；具体资格、收益及报价由服务端返回。', content: normalizeContent({ version: 1, format: 'nodes', nodes: [{ name: 'p', children: [{ type: 'text', text: '年度合伙权益200元/年，与永久学习权益分离。此说明不决定收益或充值资格。' }] }] }), version: 1 }))
interface StoredPartner { accountId: string; contextId: string; partnerLevel: PartnerLevel; annualValidUntil: string | null; frozen: boolean; version: number; task: PartnerPromotionTask | null; taskHistory: PartnerPromotionTask[] }
function newTask(level: PartnerLevel, progress = 0, qualified = false): PartnerPromotionTask | null { const config = levels.find(row => row.partnerLevel === level)!; if (!config.nextLevel) return null; return { taskId: `demo-task-${crypto.randomUUID()}`, version: 1, beforeLevel: level, targetLevel: config.nextLevel, progress, target: config.taskTarget!, canClaim: qualified, startedAt: '2026-10-01T00:00:00+08:00', validUntil: '2027-09-30T23:59:59+08:00', status: qualified ? 'READY' : 'IN_PROGRESS', qualificationNote: qualified ? 'Mock服务端确认可申请，需账号主动提交' : '进度为服务端演示值，不据团队列表累计' } }
const partners: StoredPartner[] = mockListUsers({ page: 1, pageSize: 50 }).items.filter(row => row.businessContexts.some(context => context.module === 'partner')).map((account, index, all) => {
  const level = partnerLevels[index % 4], task = newTask(level, index === 1 ? 9 : index === 6 ? 18 : 1, index === 1)
  if (task && index === 6) task.qualificationNote = '演示：数字达到目标，服务端仍在资格复核，不可申请'
  if (task && index === 8) task.validUntil = '2025-09-30T23:59:59+08:00'
  return { accountId: account.accountId, contextId: account.businessContexts.find(context => context.module === 'partner')!.contextId, partnerLevel: level, annualValidUntil: index === 2 ? '2025-10-01T00:00:00+08:00' : index === 3 ? null : '2027-10-01T00:00:00+08:00', frozen: false, version: 1, task, taskHistory: [] }
})
const receipts: PartnerReceipt[] = [], audit: PartnerAudit[] = []
const operations = new Map<string, { payload: string; result: PartnerMutationResult }>(), claims = new Map<string, { payload: string; receiptId: string }>(), readyTimes = new Map<string, number>()
const find = (contextId: string) => partners.find(row => row.contextId === contextId) ?? fail('NOT_FOUND', '合伙业务身份不存在')
const title = (level: PartnerLevel) => levels.find(row => row.partnerLevel === level)!.title
function profile(row: StoredPartner): PartnerProfile {
  const account = mockUserDetail(row.accountId).account, annualStatus = row.annualValidUntil === null ? 'NOT_OPEN' : Date.parse(row.annualValidUntil) <= Date.now() ? 'EXPIRED' : 'ACTIVE'
  const frozen = row.frozen || account.frozen || annualStatus === 'EXPIRED', processing = receipts.some(receipt => receipt.contextId === row.contextId && receipt.status === 'PROCESSING')
  const partnerStatus = frozen ? annualStatus === 'EXPIRED' ? 'EXPIRED' : 'FROZEN' : annualStatus === 'NOT_OPEN' ? 'PENDING_ANNUAL' : 'ACTIVE'
  const allowedTargetLevels = !frozen && annualStatus === 'ACTIVE' && !processing ? partnerLevels.slice(partnerLevels.indexOf(row.partnerLevel) + 1) : []
  const task = row.task ? copy(row.task) : null
  if (task && Date.parse(task.validUntil) <= Date.now()) { task.status = 'EXPIRED'; task.canClaim = false }
  if (task && (frozen || annualStatus !== 'ACTIVE' || processing)) { task.canClaim = false; if (processing) task.status = 'PROCESSING' }
  const superiorId = mockInvitationSuperiorId(row.accountId)
  const superior = superiorId ? { accountId: superiorId, contextId: partners.find(item => item.accountId === superiorId)?.contextId ?? null, name: mockUserDetail(superiorId).account.nickname } : null
  return { contextId: row.contextId, accountId: row.accountId, displayId: account.displayId, name: account.nickname, phone: account.phone, partnerLevel: row.partnerLevel, partnerStatus, frozen, annualStatus, annualValidUntil: row.annualValidUntil, annualFeeAmount: 20000, superior, version: row.version, allowedTargetLevels: [...allowedTargetLevels], allowedActions: [...(allowedTargetLevels.length ? ['manual-upgrade' as const] : []), ...(task?.canClaim ? ['claim-promotion' as const] : [])], task }
}
function addAudit(value: Omit<PartnerAudit, 'operationId' | 'occurredAt'>) { const entry = { ...value, operationId: crypto.randomUUID(), occurredAt: new Date().toISOString() }; audit.push(entry); return entry.operationId }
function applyLevel(row: StoredPartner, targetLevel: PartnerLevel, source: 'HQ_MANUAL' | 'USER_TASK') {
  if (row.task) { const task = copy(row.task); task.status = source === 'USER_TASK' ? 'COMPLETED' : 'SUPERSEDED'; task.canClaim = false; task.version++; row.taskHistory.push(task) }
  row.partnerLevel = targetLevel; row.task = newTask(targetLevel); if (row.task) { row.task.startedAt = new Date().toISOString(); row.task.validUntil = new Date(Date.now() + 365 * 86400000).toISOString() }; row.version++
}
function completeClaims() {
  for (const receipt of receipts) {
    if (receipt.source !== 'USER_TASK' || receipt.status !== 'PROCESSING' || (readyTimes.get(receipt.receiptId) ?? Infinity) > Date.now()) continue
    const row = find(receipt.contextId), current = profile(row)
    try {
      if (current.frozen || current.annualStatus !== 'ACTIVE' || row.partnerLevel !== receipt.beforeLevel || row.task?.taskId !== receipt.taskId || !row.task.canClaim || Date.parse(row.task.validUntil) <= Date.now()) fail('INVALID_STATE', '身份、年度权益或任务资格已变化，晋升未执行')
      applyLevel(row, receipt.targetLevel, 'USER_TASK'); receipt.status = 'SUCCEEDED'; receipt.result = 'Mock服务端任务晋升成功；不新增收益、不续年度、不扣介绍人名额'
    } catch (err) { receipt.status = 'FAILED'; receipt.result = err instanceof Error ? err.message : '晋升失败'; row.version++ }
    receipt.completedAt = new Date().toISOString(); addAudit({ requestId: receipt.requestId, action: 'task-promotion', contextId: row.contextId, targetId: receipt.receiptId, operatorName: receipt.operatorName, reason: receipt.reason, before: title(receipt.beforeLevel), after: `${receipt.status}：${title(row.partnerLevel)}；${receipt.result}` })
  }
}
export function mockPartnerCatalog(): PartnerCatalog { completeClaims(); return copy({ levels, receipts: [...receipts].reverse(), audit: [...audit].reverse() }) }
export function mockPartnerList(query: PartnerQuery) {
  completeClaims()
  if (!Number.isInteger(query.page) || query.page < 1 || ![5, 10, 20].includes(query.pageSize) || query.partnerLevel && !partnerLevels.includes(query.partnerLevel) || query.partnerStatus && !['ACTIVE', 'FROZEN', 'EXPIRED', 'PENDING_ANNUAL'].includes(query.partnerStatus)) fail('INVALID_INPUT', '分页或合伙状态参数无效')
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const rows = partners.map(profile).filter(row => (!keyword || `${row.name} ${row.phone} ${row.accountId} ${row.displayId}`.toLowerCase().includes(keyword)) && (!query.partnerLevel || row.partnerLevel === query.partnerLevel) && (!query.partnerStatus || row.partnerStatus === query.partnerStatus))
  return copy({ items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize, summary: { total: rows.length, active: rows.filter(row => row.partnerStatus === 'ACTIVE').length, frozen: rows.filter(row => row.frozen).length, annualExpired: rows.filter(row => row.annualStatus === 'EXPIRED').length } })
}
export function mockPartnerDetail(contextId: string) { completeClaims(); const row = find(contextId); return copy({ profile: profile(row), taskHistory: row.taskHistory, receipts: receipts.filter(receipt => receipt.contextId === contextId).reverse(), audit: audit.filter(entry => entry.contextId === contextId).reverse() }) }
export function mockPartnerMutate(input: PartnerMutation, operator: HqAccount): PartnerMutationResult {
  completeClaims()
  if (!['upgrade', 'save-benefits', 'save-level-names'].includes(input.action) || !input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '操作、原因或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), previous = operations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数已改变'); return copy(previous.result) }
  let result: PartnerMutationResult
  if (input.action === 'save-benefits') {
    const row = levels.find(row => row.partnerLevel === input.partnerLevel) ?? fail('NOT_FOUND', '合伙等级不存在')
    if (row.version !== input.version) fail('VERSION_CONFLICT', '等级说明已更新，请刷新')
    const content = normalizeContent(input.content)
    if (!input.summary.trim() || input.summary.length > 500 || !hasContent(content)) fail('INVALID_INPUT', '请填写1至500字摘要及等级权益正文')
    const before = `V${row.version}：${row.summary}`; row.summary = input.summary.trim(); row.content = content; row.version++
    result = { receiptId: null, operationId: addAudit({ requestId: input.idempotencyKey, action: input.action, contextId: null, targetId: row.partnerLevel, operatorName: operator.nickname, reason: input.reason.trim(), before, after: `V${row.version}：${row.summary}` }) }
  } else if (input.action === 'save-level-names') {
    if (!Array.isArray(input.names) || input.names.length !== partnerLevels.length) fail('INVALID_INPUT', '须一次性提交四档展示名')
    const seen = new Set()
    const beforeParts = [], afterParts = []
    for (const level of partnerLevels) {
      const item = input.names.find(row => row.partnerLevel === level) ?? fail('INVALID_INPUT', `缺少等级 ${level} 的展示名`)
      const row = levels.find(entry => entry.partnerLevel === level) ?? fail('NOT_FOUND', '合伙等级不存在')
      if (row.version !== item.version) fail('VERSION_CONFLICT', '等级名称配置已更新，请刷新后重试')
      const titleText = item.title.trim()
      if (!titleText || titleText.length > 20) fail('INVALID_INPUT', '展示名须为1–20个非空字符')
      if (seen.has(titleText)) fail('INVALID_INPUT', '四档展示名不可重复')
      seen.add(titleText)
      beforeParts.push(`${level}=${row.title}`)
      afterParts.push(`${level}=${titleText}`)
    }
    for (const level of partnerLevels) {
      const item = input.names.find(row => row.partnerLevel === level) ?? fail('INVALID_INPUT', `缺少等级 ${level} 的展示名`)
      const row = levels.find(entry => entry.partnerLevel === level) ?? fail('NOT_FOUND', '合伙等级不存在')
      row.title = item.title.trim()
      row.version++
    }
    result = { receiptId: null, operationId: addAudit({ requestId: input.idempotencyKey, action: 'save-level-names', contextId: null, targetId: 'level-names', operatorName: operator.nickname, reason: input.reason.trim(), before: beforeParts.join('；'), after: afterParts.join('；') }) }
  } else {
    const row = find(input.contextId), current = profile(row)
    if (row.version !== input.version) fail('VERSION_CONFLICT', '合伙档案已更新，请刷新')
    if (!current.allowedActions.includes('manual-upgrade') || !current.allowedTargetLevels.includes(input.targetLevel)) fail('INVALID_STATE', '服务端不允许此人工升级目标或当前状态不可操作')
    const beforeLevel = row.partnerLevel, receiptId = crypto.randomUUID(); applyLevel(row, input.targetLevel, 'HQ_MANUAL')
    receipts.push({ receiptId, requestId: input.idempotencyKey, contextId: row.contextId, accountId: row.accountId, source: 'HQ_MANUAL', taskId: null, beforeLevel, targetLevel: input.targetLevel, status: 'SUCCEEDED', result: 'Mock总部人工升级成功；年度期限、历史收益及孩子权益不变，不在此扣名额', reason: input.reason.trim(), operatorName: operator.nickname, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), mockOnly: true })
    result = { receiptId, operationId: addAudit({ requestId: input.idempotencyKey, action: input.action, contextId: row.contextId, targetId: receiptId, operatorName: operator.nickname, reason: input.reason.trim(), before: `${title(beforeLevel)} V${input.version}`, after: `${title(row.partnerLevel)} V${row.version}` }) }
  }
  operations.set(key, { payload, result: copy(result) }); return result
}
/** 小程序账号主动提交任务晋升的Mock契约；总部服务不暴露代领接口。 */
export function mockClaimPartnerPromotion(input: { accountId: string; contextId: string; taskId: string; version: number; idempotencyKey: string }) {
  completeClaims(); const row = find(input.contextId)
  if (row.accountId !== input.accountId) fail('FORBIDDEN', '合伙身份不属于当前账号')
  if (!input.idempotencyKey) fail('INVALID_INPUT', '缺少晋升请求号')
  const key = `${input.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input), old = claims.get(key)
  if (old) { if (old.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号不能更换晋升身份或任务'); return copy(receipts.find(receipt => receipt.receiptId === old.receiptId)!) }
  const current = profile(row)
  if (row.version !== input.version) fail('VERSION_CONFLICT', '合伙档案已更新，请刷新')
  if (!current.allowedActions.includes('claim-promotion') || !row.task || row.task.taskId !== input.taskId || !current.task?.canClaim) fail('INVALID_STATE', '任务未达资格、已过期、身份冻结或正在处理中')
  const receipt: PartnerReceipt = { receiptId: crypto.randomUUID(), requestId: input.idempotencyKey, contextId: row.contextId, accountId: row.accountId, source: 'USER_TASK', taskId: row.task!.taskId, beforeLevel: row.partnerLevel, targetLevel: row.task!.targetLevel, status: 'PROCESSING', result: 'Mock任务晋升处理中，未立即更改等级', reason: 'Mock账号主动点击申请任务晋升', operatorName: mockUserDetail(row.accountId).account.nickname, createdAt: new Date().toISOString(), completedAt: null, mockOnly: true }
  row.version++; receipts.push(receipt); readyTimes.set(receipt.receiptId, Date.now() + 1000); claims.set(key, { payload, receiptId: receipt.receiptId }); return copy(receipt)
}


