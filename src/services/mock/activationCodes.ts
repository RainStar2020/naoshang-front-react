import { ActivationError, type ActivationAudit, type ActivationBatch, type ActivationCode, type ActivationCodeType, type ActivationDetail, type ActivationExport, type ActivationExportRequest, type ActivationMutation, type ActivationMutationResult, type ActivationOptions, type ActivationQuery, type CodeSelection } from '../../types/activationCodes'
import type { HqAccount } from '../../types/auth'
import { mockPublishedTiers } from './cms'
import { mockActivateMemberCode, mockMemberDetail, mockMembers } from './members'
import { mockListUsers, mockUserDetail, mockUserOptions } from './users'
import { makeCsv } from '../../utils/csv'
import { mockColumnTargets, prepareMockColumnActivation, activateMockColumnCode } from './columns'

const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: ActivationError['code'], message: string): never => { throw new ActivationError(code, message) }
const limits = { maxBatchSize: 100, maxSelectionSize: 100 } // 仅Mock服务配置，正式上限由API返回。
interface StoredCode extends ActivationCode { secret: string }
const codes: StoredCode[] = []
const batches: ActivationBatch[] = []
const audit: ActivationAudit[] = []
const mutations = new Map<string, { payload: string; result: ActivationMutationResult }>()
const exports = new Map<string, { payload: string; result: ActivationExport }>()
function target(codeType: ActivationCodeType, targetId: string) {
  return mockActivationOptions().targets.find(item => item.codeType === codeType && item.targetId === targetId) ?? fail('INVALID_INPUT', '目标类型或会员等级/专栏不存在，不能使用软件卡或单学习等级ID')
}
export function mockActivationOptions(): ActivationOptions {
  return copy({ ...limits,
    targets: [...mockPublishedTiers().map(tier => ({ codeType: 'membership-tier' as const, targetId: tier.membershipTierId, name: tier.name, demoOnly: true })), ...mockColumnTargets().map(column => ({ codeType: 'column' as const, targetId: column.columnId, name: column.title, demoOnly: true }))],
    accounts: mockListUsers({ page: 1, pageSize: 50 }).items.map(item => ({ accountId: item.accountId, name: item.nickname, phone: item.phone })),
    members: mockMembers({ page: 1, pageSize: 50 }).items.map(item => ({ memberId: item.memberId, accountId: item.accountId, contextId: item.contextId, name: item.name, displayId: item.displayId })),
    stores: mockUserOptions().stores,
  })
}
function effective(code: StoredCode): ActivationCode {
  const { secret: _, ...value } = code
  return copy({ ...value, status: !['used', 'revoked'].includes(code.status) && code.expiresAt && Date.parse(code.expiresAt) <= Date.now() ? 'expired' : code.status })
}
const find = (id: string) => codes.find(code => code.codeId === id) ?? fail('NOT_FOUND', '激活码不存在')
function newCode(batch: ActivationBatch): StoredCode {
  const secret = `DEMO-${batch.codeType === 'membership-tier' ? 'MEM' : 'COL'}-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`
  return { codeId: crypto.randomUUID(), batchId: batch.batchId, secret, maskedCode: `${secret.slice(0, 8)}…${secret.slice(-4)}`, codeType: batch.codeType, targetId: batch.targetId, targetName: batch.targetName, status: 'unused', expiresAt: batch.expiresAt, version: 1, issuedTo: null, issuedToAccountId: null, issuedToMemberId: null, storeId: null, issuedAt: null, usedByAccountId: null, usedByMemberId: null, usedAt: null, sourceOrderId: null, replacementCodeId: null, replacesCodeId: null, createdAt: new Date().toISOString() }
}
// 仅为总部查询演示：使用记录与既有学员会员授权一致；不会发起真实激活。
for (let n = 0; n < 3; n++) {
  const codeType = n === 2 ? 'column' : 'membership-tier'
  const batch: ActivationBatch = { batchId: `demo-batch-${n + 1}`, name: ['会员一阶演示批次', '会员二阶演示批次', '专栏演示批次'][n], codeType, targetId: n === 2 ? 'demo-column-memory' : `demo-tier-${n + 1}`, targetName: n === 2 ? '《记忆基础》（演示）' : ['一阶菁英会员', '二阶行能会员'][n], quantity: 4, expiresAt: null, createdAt: '2026-10-01T09:00:00+08:00', createdBy: 'Mock初始化' }
  batches.push(batch)
  for (let i = 0; i < 4; i++) {
    const code = newCode(batch)
    code.codeId = `demo-code-${n * 4 + i + 1}`
    code.createdAt = batch.createdAt
    if (n === 0 && i === 1) { code.status = 'issued'; code.issuedToAccountId = 'account-1'; code.issuedToMemberId = 'member-2'; code.issuedTo = '林晓雅 / 林小满'; code.issuedAt = batch.createdAt }
    if (n === 0 && i === 2) { code.status = 'issued'; code.storeId = 'shop-1'; code.issuedTo = '脑商训练营梧桐街店'; code.issuedAt = batch.createdAt }
    if (n === 0 && i === 3) code.status = 'revoked'
    if (n === 1 && i === 0) { code.status = 'used'; code.issuedToAccountId = 'account-1'; code.issuedToMemberId = 'member-1'; code.issuedTo = '林晓雅 / 林小禾'; code.issuedAt = batch.createdAt; code.usedByAccountId = 'account-1'; code.usedByMemberId = 'member-1'; code.usedAt = batch.createdAt; code.sourceOrderId = 'member-demo-order-1' }
    if (n === 1 && i === 1) code.expiresAt = '2020-01-01T00:00:00Z'
    codes.push(code)
  }
}
export function mockActivationBatches() { return copy([...batches].reverse()) }
export function mockActivationAudit() { return copy([...audit].reverse()) }
export function mockActivationList(query: ActivationQuery) {
  if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  const keyword = query.keyword?.trim().toLowerCase()
  const items = codes.map(effective).filter(code => (!keyword || [code.codeId, code.maskedCode, code.issuedTo ?? '', code.sourceOrderId ?? ''].some(value => value.toLowerCase().includes(keyword))) && (!query.batchId || code.batchId === query.batchId) && (!query.codeType || code.codeType === query.codeType) && (!query.targetId || code.targetId === query.targetId) && (!query.status || code.status === query.status) && (!query.storeId || code.storeId === query.storeId)).reverse()
  return { items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize }
}
export function mockActivationDetail(id: string): ActivationDetail {
  const code = effective(find(id))
  return copy({ code, batch: batches.find(batch => batch.batchId === code.batchId)!, audit: audit.filter(item => item.codeIds.includes(id)).reverse() })
}
function expiry(value: string | null) {
  if (value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) fail('INVALID_INPUT', '请选择未来的有效期，或明确选择不设到期时间')
  return new Date(value).toISOString()
}
function reason(value: string) { if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字操作原因') }
function selected(items: CodeSelection[]) {
  if (!Array.isArray(items) || !items.length || items.length > limits.maxSelectionSize || new Set(items.map(item => item.codeId)).size !== items.length) fail('INVALID_INPUT', '请选择有效且不重复的激活码，数量不能超过服务返回上限')
  return items.map(item => { const code = find(item.codeId); if (code.version !== item.version) fail('VERSION_CONFLICT', '激活码状态已变化，请刷新后重新操作'); return code })
}
function addAudit(action: ActivationAudit['action'], codeIds: string[], batchId: string | null, input: { reason: string; idempotencyKey: string }, operator: Pick<HqAccount, 'accountId' | 'nickname'>, before: string, after: string) {
  const entry: ActivationAudit = { operationId: crypto.randomUUID(), requestId: input.idempotencyKey, action, codeIds, batchId, reason: input.reason.trim(), operatorId: operator.accountId, operatorName: operator.nickname, before, after, occurredAt: new Date().toISOString() }
  audit.push(entry); return entry
}
export function mockActivationMutate(input: ActivationMutation, operator: HqAccount): ActivationMutationResult {
  reason(input.reason)
  if (!input.idempotencyKey || !['generate', 'issue', 'revoke', 'reissue', 'set-expiry'].includes(input.action)) fail('INVALID_INPUT', '操作类型或请求号无效')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input)
  const previous = mutations.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '请求号参数发生变化，请刷新后重新操作'); return copy(previous.result) }
  let affected: string[] = [], batchId: string | null = null, before = '', after = ''
  if (input.action === 'generate') {
    if (!input.name.trim() || input.name.trim().length > 60 || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > limits.maxBatchSize) fail('INVALID_INPUT', '批次名称或数量无效，请遵守服务返回的批量上限')
    const targetInfo = target(input.codeType, input.targetId)
    const batch: ActivationBatch = { batchId: crypto.randomUUID(), name: input.name.trim(), codeType: input.codeType, targetId: input.targetId, targetName: targetInfo.name, quantity: input.quantity, expiresAt: expiry(input.expiresAt), createdAt: new Date().toISOString(), createdBy: operator.nickname }
    const created = Array.from({ length: input.quantity }, () => newCode(batch))
    batches.push(batch); codes.push(...created)
    batchId = batch.batchId; affected = created.map(code => code.codeId); before = '未生成'; after = `已生成${created.length}个未用码（未分发、未授权）`
  } else {
    const rows = selected(input.codes)
    if (rows.some(code => code.status === 'used')) fail('INVALID_STATE', '已用码不能撤销、补发、调整有效期或再次分发')
    before = rows.map(code => `${code.codeId}:${effective(code).status}`).join('；')
    let issued: { accountId: string | null; memberId: string | null; storeId: string | null; label: string } | null = null
    if (input.action === 'issue') {
      if (rows.some(code => !['unused', 'issued'].includes(effective(code).status) || code.issuedToAccountId || code.replacementCodeId)) fail('INVALID_STATE', '仅可分发未用码或门店库存码；已绑定账号的码不可换绑或转赠')
      const store = input.storeId ? mockUserOptions().stores.find(item => item.storeId === input.storeId && item.active) : null
      if (input.storeId && !store) fail('INVALID_INPUT', '请选择可用门店')
      if (!input.accountId && (!store || input.memberId)) fail('INVALID_INPUT', '请选择账号或门店；指定孩子必须同时指定所属账号')
      const account = input.accountId ? mockUserDetail(input.accountId).account : null
      const member = input.memberId ? mockMemberDetail(input.memberId).member : null
      if (member && member.accountId !== account?.accountId) fail('IDENTITY_MISMATCH', '指定孩子不属于所选账号')
      if (member && rows.some(code => code.codeType === 'column')) fail('INVALID_INPUT', '专栏按账号授权，不能绑定孩子')
      issued = { accountId: account?.accountId ?? null, memberId: member?.memberId ?? null, storeId: store?.storeId ?? null, label: account ? `${account.nickname}${member ? ` / ${member.name}` : ''}` : store!.name }
    }
    if (input.action === 'revoke' && rows.some(code => code.status === 'revoked')) fail('INVALID_STATE', '选择中含已撤销码，请刷新后重选')
    if (input.action === 'set-expiry' && rows.some(code => code.status === 'revoked')) fail('INVALID_STATE', '已撤销码不能重新启用，请使用补发流程')
    if (input.action === 'reissue' && rows.some(code => !!code.replacementCodeId)) fail('INVALID_STATE', '旧码已有补发记录，不能再次补发同一旧码')
    const newExpiry = input.action === 'set-expiry' || input.action === 'reissue' ? expiry(input.expiresAt) : null
    // 所有选择和参数先验证，通过后一次性变更，避免批量操作部分成功。
    const replacements = input.action === 'reissue' ? rows.map(code => {
      const next = newCode(batches.find(batch => batch.batchId === code.batchId)!)
      Object.assign(next, { expiresAt: newExpiry, issuedTo: code.issuedTo, issuedToAccountId: code.issuedToAccountId, issuedToMemberId: code.issuedToMemberId, storeId: code.storeId, issuedAt: code.issuedAt, status: code.issuedTo ? 'issued' : 'unused', sourceOrderId: code.sourceOrderId, replacesCodeId: code.codeId })
      return next
    }) : []
    rows.forEach((code, index) => {
      if (input.action === 'issue' && issued) { code.status = 'issued'; code.issuedTo = issued.label; code.issuedToAccountId = issued.accountId; code.issuedToMemberId = issued.memberId; code.storeId = issued.storeId ?? code.storeId; code.issuedAt = new Date().toISOString() }
      if (input.action === 'revoke' || input.action === 'reissue') code.status = 'revoked'
      if (input.action === 'reissue') code.replacementCodeId = replacements[index].codeId
      if (input.action === 'set-expiry') code.expiresAt = newExpiry
      code.version++
    })
    codes.push(...replacements)
    affected = [...rows, ...replacements].map(code => code.codeId)
    after = input.action === 'issue' ? `已分发给${issued!.label}，未开通权益` : input.action === 'reissue' ? '旧码作废，新码继承原交付对象；未开通权益' : input.action === 'revoke' ? '已撤销未用码，未变更任何学习权益' : '已调整未用码有效期，不影响永久学习权益'
  }
  const operation = addAudit(input.action, affected, batchId, input, operator, before, after)
  const result: ActivationMutationResult = { batchId, affectedCodeIds: affected, operation, mockOnly: true }
  mutations.set(key, { payload, result: copy(result) }); return copy(result)
}
export function mockActivationExport(input: ActivationExportRequest, operator: HqAccount): ActivationExport {
  reason(input.reason)
  if (!input.idempotencyKey) fail('INVALID_INPUT', '缺少导出请求号')
  const key = `${operator.accountId}:${input.idempotencyKey}`, payload = JSON.stringify(input)
  const previous = exports.get(key)
  if (previous) { if (previous.payload !== payload) fail('IDEMPOTENCY_CONFLICT', '导出请求参数不一致'); return copy(previous.result) }
  const rows = selected(input.codes)
  const csv = makeCsv([['环境', '码ID', '批次ID', '完整演示码', '类型', '目标', '状态', '有效期', '交付对象', '使用账号', '使用学员', '使用时间'], ...rows.map(code => ['仅Mock演示，不可用于真实小程序', code.codeId, code.batchId, code.secret, code.codeType, code.targetName, effective(code).status, code.expiresAt ?? '不设到期时间', code.issuedTo, code.usedByAccountId, code.usedByMemberId, code.usedAt])])
  addAudit('export', rows.map(code => code.codeId), null, input, operator, '完整码受导出权限保护', `导出${rows.length}条演示码`)
  const result: ActivationExport = { csv, fileName: `activation-demo-${crypto.randomUUID()}.csv`, count: rows.length, requestId: input.idempotencyKey, mockOnly: true }
  exports.set(key, { payload, result: copy(result) }); return result
}

/** 仅用于Mock消费验收，不在总部页面或公共总部服务上提供用户代激活接口。 */
interface ActivationPreview { previewToken: string; codeId: string; codeVersion: number; accountId: string; memberId: string; contextId: string; memberVersion: number; targetId: string; targetName: string; unlockedLevelIds: string[]; expiresAt: number }
const previews = new Map<string, ActivationPreview>()
const consumed = new Map<string, { previewToken: string; result: ReturnType<typeof mockActivateMemberCode> }>()
function usable(code: StoredCode) {
  if (effective(code).status === 'expired') fail('EXPIRED', '激活码已到期')
  if (code.status !== 'issued' || !code.issuedToAccountId) fail('INVALID_STATE', '激活码须先分发到账号，且不能已用或已撤销')
}
export function previewMockActivation(secret: string, accountId: string, memberId: string): ActivationPreview {
  const code = codes.find(item => item.secret === secret.trim().toUpperCase()) ?? fail('NOT_FOUND', '演示激活码不存在；不接受软件卡码')
  usable(code)
  if (code.codeType === 'column') fail('CONSUMER_UNAVAILABLE', '专栏不能指定孩子，请使用HQ-07独立的账号专栏预览/消费通道')
  const member = mockMemberDetail(memberId).member
  if (code.issuedToAccountId !== accountId || member.accountId !== accountId || code.issuedToMemberId && code.issuedToMemberId !== memberId) fail('IDENTITY_MISMATCH', '购买账号、受益学员或绑定对象不匹配')
  const tier = mockPublishedTiers().find(item => item.membershipTierId === code.targetId) ?? fail('NOT_FOUND', '目标会员等级不存在')
  if (!tier.levels.length) fail('INVALID_STATE', '目标等级暂无已发布课程')
  if (member.entitlements.some(item => item.membershipTierId === code.targetId)) fail('INVALID_STATE', '此等级已有权益记录，请勿重复消耗新码')
  const preview: ActivationPreview = { previewToken: crypto.randomUUID(), codeId: code.codeId, codeVersion: code.version, accountId, memberId, contextId: member.contextId, memberVersion: member.version, targetId: tier.membershipTierId, targetName: tier.name, unlockedLevelIds: tier.levels.map(level => level.levelId), expiresAt: Date.now() + 5 * 60 * 1000 }
  previews.set(preview.previewToken, copy(preview)); return copy(preview)
}
export function consumeMockActivation(previewToken: string, idempotencyKey: string) {
  const preview = previews.get(previewToken) ?? fail('INVALID_INPUT', '请先预览受益人和目标权益')
  if (!idempotencyKey) fail('INVALID_INPUT', '缺少激活请求号')
  const key = `${preview.accountId}:${idempotencyKey}`, previous = consumed.get(key)
  if (previous) { if (previous.previewToken !== previewToken) fail('IDEMPOTENCY_CONFLICT', '重复请求不能更换预览'); return copy(previous.result) }
  if (preview.expiresAt <= Date.now()) fail('EXPIRED', '激活预览已过期，请重新校验')
  const code = find(preview.codeId)
  usable(code)
  if (code.version !== preview.codeVersion) fail('VERSION_CONFLICT', '激活码已更新，请重新预览')
  const levels = mockPublishedTiers().find(item => item.membershipTierId === preview.targetId)?.levels.map(level => level.levelId)
  if (JSON.stringify(levels) !== JSON.stringify(preview.unlockedLevelIds)) fail('VERSION_CONFLICT', '课程目录已变化，请重新预览')
  const result = mockActivateMemberCode({ ...preview, version: preview.memberVersion, codeId: code.codeId, requestId: idempotencyKey })
  code.status = 'used'; code.usedByAccountId = preview.accountId; code.usedByMemberId = preview.memberId; code.usedAt = new Date().toISOString(); code.version++
  addAudit('activate', [code.codeId], code.batchId, { reason: 'Mock用户预览并确认后消费，永久开通整组学习等级', idempotencyKey }, { accountId: preview.accountId, nickname: 'Mock用户主动激活' }, '已分发、未使用', '已使用，学习权益永久有效')
  consumed.set(key, { previewToken, result: copy(result) }); return copy(result)
}

/** HQ-07独立账号专栏消费Mock，不在总部提供代激活按钮。 */
interface ColumnActivationPreview { previewToken: string; codeId: string; codeVersion: number; accountId: string; columnId: string; revision: number; productId: string; title: string; expiresAt: number }
const columnPreviews = new Map<string, ColumnActivationPreview>()
const columnConsumed = new Map<string, { previewToken: string; result: ReturnType<typeof activateMockColumnCode> }>()
export function previewMockColumnActivation(secret: string, accountId: string): ColumnActivationPreview {
  const code = codes.find(code => code.secret === secret.trim().toUpperCase()) ?? fail('NOT_FOUND', '专栏演示码不存在')
  usable(code)
  if (code.codeType !== 'column' || code.issuedToAccountId !== accountId || code.issuedToMemberId) fail('IDENTITY_MISMATCH', '码类型或绑定账号不匹配；专栏不绑定孩子')
  const check = prepareMockColumnActivation(accountId, code.targetId)
  const preview = { ...check, previewToken: crypto.randomUUID(), codeId: code.codeId, codeVersion: code.version, expiresAt: Date.now() + 5 * 60 * 1000 }
  columnPreviews.set(preview.previewToken, copy(preview)); return copy(preview)
}
export function consumeMockColumnActivation(previewToken: string, idempotencyKey: string) {
  const preview = columnPreviews.get(previewToken) ?? fail('INVALID_INPUT', '请先预览账号、专栏与购买资格')
  if (!idempotencyKey) fail('INVALID_INPUT', '缺少专栏激活请求号')
  const key = `${preview.accountId}:${idempotencyKey}`, previous = columnConsumed.get(key)
  if (previous) { if (previous.previewToken !== previewToken) fail('IDEMPOTENCY_CONFLICT', '请求号不能更换专栏预览'); return copy(previous.result) }
  if (preview.expiresAt <= Date.now()) fail('EXPIRED', '专栏预览已过期')
  const code = find(preview.codeId)
  usable(code)
  if (code.version !== preview.codeVersion || code.codeType !== 'column' || code.issuedToAccountId !== preview.accountId) fail('VERSION_CONFLICT', '专栏码已变化，请重新预览')
  const result = activateMockColumnCode({ accountId: preview.accountId, columnId: preview.columnId, revision: preview.revision, codeId: code.codeId })
  code.status = 'used'; code.usedByAccountId = preview.accountId; code.usedByMemberId = null; code.usedAt = new Date().toISOString(); code.version++
  addAudit('activate', [code.codeId], code.batchId, { idempotencyKey, reason: 'Mock账号购买资格核验、预览确认后激活专栏，不修改孩子授权和已有进度' }, { accountId: preview.accountId, nickname: 'Mock账号主动激活专栏' }, '专栏码已分发未使用', '账号专栏永久授权已开通')
  columnConsumed.set(key, { previewToken, result: copy(result) }); return copy(result)
}
