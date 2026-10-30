import type { BusinessIdentity, RegionOption, StoreOption, UserAccount, UserAuditEntry, UserDetail, UserFilterOptions, UserListQuery, UserListResult, UserMutation, UserMutationResult } from '../../types/users'
import { USER_DISPLAY_ID_PATTERN, userDisplayIdPrefixes } from '../../types/users'
import { UserServiceError } from '../../types/users'
import type { HqAccount } from '../../types/auth'

const stores: StoreOption[] = [
  { storeId: 'shop-1', number: 'NO.001', name: '脑商训练营梧桐街店', active: true },
  { storeId: 'shop-2', number: 'NO.002', name: '脑商训练营桐柏路店', active: true },
  { storeId: 'shop-3', number: 'NO.003', name: '脑商训练营合肥店', active: true },
  { storeId: 'shop-closed', number: 'NO.004', name: '脑商训练营旧门店（已停业）', active: false },
]
const regions: RegionOption[] = [
  { value: '410000', label: '河南省', children: [{ value: '410100', label: '郑州市', children: [{ value: '410104', label: '管城回族区' }, { value: '410102', label: '中原区' }] }] },
  { value: '340000', label: '安徽省', children: [{ value: '340100', label: '合肥市', children: [{ value: '340104', label: '蜀山区' }] }] },
]
const names = ['林晓雅', '陈明', '王思雨', '李晨', '赵悦', '刘洋', '周宁']
const users: UserAccount[] = Array.from({ length: 28 }, (_, index) => {
  const n = index + 1
  const accountId = `account-${n}`
  const store = n === 7 ? stores[3] : n % 6 === 0 ? null : stores[index % 3]
  const businessContexts: BusinessIdentity[] = n % 3 === 0 ? [{ contextId: `partner:${accountId}`, module: 'partner', label: 'VIP 合伙人' }] : []
  if (n === 1) businessContexts.push(
    { contextId: `agency:${accountId}:county`, module: 'agency', label: '中原区代理', assignmentId: 'assignment-1' },
    { contextId: `agency:${accountId}:city`, module: 'agency', label: '郑州市代理', assignmentId: 'assignment-2' },
    { contextId: `costore:${accountId}`, module: 'costore', label: '梧桐街店合店老板', contractId: 'contract-1' },
  )
  return {
    accountId, displayId: `${userDisplayIdPrefixes[(n - 1) % 4]}${String(n).padStart(4, '0')}`, nickname: `${names[index % names.length]}${n > 7 ? n : ''}`,
    avatarUrl: null, phone: `1380000${String(n).padStart(4, '0')}`,
    regionCodes: index % 3 === 2 ? ['340000', '340100', '340104'] : ['410000', '410100', index % 2 ? '410102' : '410104'],
    regionNames: index % 3 === 2 ? ['安徽省', '合肥市', '蜀山区'] : ['河南省', '郑州市', index % 2 ? '中原区' : '管城回族区'],
    storeId: store?.storeId ?? null, storeName: store?.name ?? null,
    frozen: n % 5 === 0, version: 1, businessContexts,
    createdAt: `2026-10-${String(index % 24 + 1).padStart(2, '0')}T09:00:00+08:00`, passwordResetAt: null,
  }
})
const audit: UserAuditEntry[] = []
const operations = new Map<string, { fingerprint: string; result: UserMutationResult }>()
const copy = <T,>(value: T): T => structuredClone(value)
const fail = (code: ConstructorParameters<typeof UserServiceError>[0], message: string): never => { throw new UserServiceError(code, message) }
const findAccount = (id: string) => users.find(item => item.accountId === id) ?? fail('NOT_FOUND', '账号不存在，请刷新列表')

export function mockUserOptions(): UserFilterOptions { return copy({ stores, regions }) }

export function mockListUsers(query: UserListQuery): UserListResult {
  if (!Number.isInteger(query.page) || query.page < 1 || ![10, 20, 50].includes(query.pageSize)) fail('INVALID_INPUT', '分页参数无效')
  const keyword = query.keyword?.trim().toLocaleLowerCase() ?? ''
  const filtered = users.filter(item =>
    (!keyword || [item.nickname, item.displayId, item.phone].some(value => value.toLocaleLowerCase().includes(keyword))) &&
    (!query.status || item.frozen === (query.status === 'frozen')) &&
    (!query.storeId || (query.storeId === 'unbound' ? item.storeId === null : item.storeId === query.storeId)) &&
    (!query.regionCodes?.length || query.regionCodes.every((code, i) => item.regionCodes[i] === code)),
  )
  const start = (query.page - 1) * query.pageSize
  return copy({ items: filtered.slice(start, start + query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize })
}

export function mockUserDetail(id: string): UserDetail {
  return copy({ account: findAccount(id), audit: audit.filter(item => item.accountId === id).slice().reverse() })
}

export async function mockMutateUser(input: UserMutation, operator: HqAccount): Promise<UserMutationResult> {
  if (!input.idempotencyKey || !input.reason.trim() || input.reason.trim().length > 200) fail('INVALID_INPUT', '请填写1–200字操作原因和有效请求号')
  if (input.action === 'reset-password' && (input.newPassword.length < 6 || input.newPassword.length > 32 || /\s/.test(input.newPassword))) fail('INVALID_INPUT', '密码需为6–32位且不包含空格')
  // 摘要用于校验同一请求是否改变参数；不在 Mock 结果、操作历史或存储中保存明文密码。
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
  const fingerprint = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  const key = `${operator.accountId}:${input.idempotencyKey}`
  const previous = operations.get(key)
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', '请求号已用于其他操作，请关闭弹窗后重新操作')
    return copy(previous.result)
  }
  const account = findAccount(input.accountId)
  if (account.version !== input.version) fail('VERSION_CONFLICT', '账号资料已更新，请刷新后重新操作')
  let before = ''
  let after = ''
  if (input.action === 'freeze') {
    if (typeof input.frozen !== 'boolean') fail('INVALID_INPUT', '冻结状态参数无效')
    if (account.frozen === input.frozen) fail('INVALID_INPUT', '账号已处于目标状态，请刷新后重试')
    before = account.frozen ? '冻结' : '正常'
    after = input.frozen ? '冻结' : '正常'
    account.frozen = input.frozen
  } else if (input.action === 'change-store') {
    const store = stores.find(item => item.storeId === input.storeId && item.active) ?? fail('INVALID_INPUT', '请选择可用门店')
    if (account.storeId === store.storeId) fail('INVALID_INPUT', '目标门店与当前所属门店相同')
    before = account.storeName ?? '未绑定门店'
    after = store.name
    account.storeId = store.storeId
    account.storeName = store.name
  } else if (input.action === 'change-display-id') {
    if (!(userDisplayIdPrefixes as readonly string[]).includes(input.prefix)) fail('INVALID_INPUT', '编号前缀仅允许 VIP / TS / SD / LC')
    if (!/^\d{4}$/.test(input.serial)) fail('INVALID_INPUT', '编号序号须恰好为 4 位数字')
    const nextId = `${input.prefix}${input.serial}`
    if (!USER_DISPLAY_ID_PATTERN.test(nextId)) fail('INVALID_INPUT', '账号编号格式无效')
    if (nextId === account.displayId) fail('INVALID_INPUT', '新编号与当前编号相同')
    const conflict = users.find(item => item.accountId !== account.accountId && item.displayId === nextId)
    if (conflict) fail('INVALID_INPUT', `编号 ${nextId} 已被账号 ${conflict.accountId} 占用，未覆盖`)
    before = account.displayId
    after = nextId
    account.displayId = nextId
  } else if (input.action === 'reset-password') {
    before = account.passwordResetAt ? `上次模拟重置：${account.passwordResetAt}` : '未进行模拟重置'
    after = '已记录模拟重置（未修改真实密码）'
    account.passwordResetAt = new Date().toISOString()
  } else {
    fail('INVALID_INPUT', '不支持的用户操作')
  }
  account.version++
  const operation: UserAuditEntry = {
    operationId: crypto.randomUUID(), requestId: input.idempotencyKey, accountId: account.accountId, action: input.action,
    operatorId: operator.accountId, operatorName: operator.nickname, reason: input.reason.trim(), before, after, occurredAt: new Date().toISOString(),
  }
  audit.push(operation)
  const result: UserMutationResult = copy({ account, operation, mockOnly: true })
  operations.set(key, { fingerprint, result })
  return copy(result)
}
