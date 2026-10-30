import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivationCode, ActivationMutation, ActivationCodeType } from '../types/activationCodes'
import { csvCell } from '../utils/csv'

let service: typeof import('./activationCodes')['activationCodesService']
let auth: typeof import('./auth')['authService']
let members: typeof import('./members')['membersService']
let consumer: typeof import('./mock/activationCodes')
let token: string
beforeEach(async () => {
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./activationCodes')).activationCodesService
  auth = (await import('./auth')).authService
  members = (await import('./members')).membersService
  consumer = await import('./mock/activationCodes')
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => vi.useRealTimers())
const base = () => ({ reason: '测试总部激活码管理', idempotencyKey: crypto.randomUUID() })
const selection = (codes: ActivationCode[]) => codes.map(code => ({ codeId: code.codeId, version: code.version }))
const generate = (quantity = 1, codeType: ActivationCodeType = 'membership-tier', expiresAt: string | null = null): ActivationMutation => ({ ...base(), action: 'generate', name: '测试批次', codeType, targetId: codeType === 'membership-tier' ? 'demo-tier-1' : 'demo-column-memory', quantity, expiresAt })
async function created(quantity = 1, codeType: ActivationCodeType = 'membership-tier', expiresAt: string | null = null) {
  const result = await service.mutate(token, generate(quantity, codeType, expiresAt))
  return (await service.list(token, { page: 1, pageSize: 50, batchId: result.batchId! })).items
}
async function secret(code: ActivationCode) {
  const result = await service.export(token, { ...base(), codes: selection([code]) })
  return result.csv.split('\r\n').find(line => line.includes(code.codeId))!.match(/DEMO-(?:MEM|COL)-[A-F0-9]+/)![0]
}
async function issued(expiresAt: string | null = null) {
  const [code] = await created(1, 'membership-tier', expiresAt)
  await service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: 'member-2', storeId: 'shop-1' })
  const current = (await service.detail(token, code.codeId)).code
  return { code: current, value: await secret(current) }
}

describe('激活码目录、批次与完整码保护', () => {
  it('列表分页和组合筛选来自完整查询结果', async () => {
    const first = await service.list(token, { page: 1, pageSize: 10 })
    expect(first.total).toBe(12); expect(first.items).toHaveLength(10)
    expect((await service.list(token, { page: 2, pageSize: 10 })).items).toHaveLength(2)
    const filtered = await service.list(token, { page: 1, pageSize: 10, codeType: 'membership-tier', status: 'issued', storeId: 'shop-1' })
    expect(filtered.items.map(code => code.codeId)).toEqual(['demo-code-3'])
  })
  it('详情展示预置使用账号、孩子和订单，不返回完整码', async () => {
    const detail = await service.detail(token, 'demo-code-5')
    expect(detail.code).toMatchObject({ status: 'used', usedByAccountId: 'account-1', usedByMemberId: 'member-1', sourceOrderId: 'member-demo-order-1' })
    expect(detail.code).not.toHaveProperty('secret')
    expect(JSON.stringify(detail)).not.toMatch(/DEMO-MEM-[A-F0-9]{32}/)
  })
  it('批量生成的码唯一，数量受服务配置控制，生成不发学习权益', async () => {
    const before = await members.detail(token, 'member-2')
    const rows = await created(3)
    expect(new Set(rows.map(code => code.codeId)).size).toBe(3)
    expect(rows.every(code => code.status === 'unused')).toBe(true)
    expect(await members.detail(token, 'member-2')).toEqual(before)
    const max = (await service.options(token)).maxBatchSize
    await expect(service.mutate(token, generate(max + 1))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('拒绝软件卡类型、单学习等级ID、过期时间和空原因', async () => {
    await expect(service.mutate(token, { ...generate(), codeType: 'software' } as unknown as ActivationMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, { ...generate(), targetId: 'level-1' } as ActivationMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, generate(1, 'membership-tier', '2020-01-01T00:00:00Z'))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.mutate(token, { ...generate(), reason: ' ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(await service.batches(token)).toHaveLength(3)
  })
  it('同一生成请求并发重试只新增一个批次', async () => {
    const input = generate(2)
    const [a, b] = await Promise.all([service.mutate(token, input), service.mutate(token, input)])
    expect(a).toEqual(b); expect(await service.batches(token)).toHaveLength(4)
    await expect(service.mutate(token, { ...input, quantity: 3 } as ActivationMutation)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
})

describe('分发、撤销、有效期和补发', () => {
  it('门店库存可继续分发到账号，保留原门店且不自动开通权益', async () => {
    const code = (await service.detail(token, 'demo-code-3')).code
    const before = await members.detail(token, 'member-2')
    await service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: 'member-2', storeId: null })
    expect((await service.detail(token, code.codeId)).code).toMatchObject({ status: 'issued', issuedToAccountId: 'account-1', issuedToMemberId: 'member-2', storeId: 'shop-1' })
    expect(await members.detail(token, 'member-2')).toEqual(before)
  })
  it('拒绝账号和孩子不匹配，以及已绑定账号后的换绑', async () => {
    const [code] = await created()
    await expect(service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-2', memberId: 'member-2', storeId: null })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' })
    const data = await issued()
    await expect(service.mutate(token, { ...base(), action: 'issue', codes: selection([data.code]), accountId: 'account-2', memberId: null, storeId: null })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('批量先校验全部选择，不会部分撤销或接受重复码', async () => {
    const a = (await service.detail(token, 'demo-code-1')).code
    const b = (await service.detail(token, 'demo-code-5')).code
    await expect(service.mutate(token, { ...base(), action: 'revoke', codes: selection([a, b]) })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect((await service.detail(token, a.codeId)).code).toMatchObject({ status: 'unused', version: 1 })
    await expect(service.mutate(token, { ...base(), action: 'revoke', codes: selection([a, a]) })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('旧版本不能覆盖新的分发状态', async () => {
    const [code] = await created()
    await service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: null, storeId: null })
    await expect(service.mutate(token, { ...base(), action: 'revoke', codes: selection([code]) })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })
  it('补发作废旧码、新码继承绑定并双向关联，不能重复补发同一旧码', async () => {
    const data = await issued()
    const input: ActivationMutation = { ...base(), action: 'reissue', codes: selection([data.code]), expiresAt: null }
    const result = await service.mutate(token, input)
    const old = (await service.detail(token, data.code.codeId)).code
    const next = (await service.detail(token, old.replacementCodeId!)).code
    expect(old.status).toBe('revoked')
    expect(next).toMatchObject({ replacesCodeId: old.codeId, issuedToAccountId: 'account-1', issuedToMemberId: 'member-2', storeId: 'shop-1', status: 'issued' })
    expect(await service.mutate(token, input)).toEqual(result)
    await expect(service.mutate(token, { ...base(), action: 'reissue', codes: selection([old]), expiresAt: null })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    expect(() => consumer.previewMockActivation(data.value, 'account-1', 'member-2')).toThrow()
  })
  it('已用码不能撤销、补发或延期', async () => {
    const code = (await service.detail(token, 'demo-code-5')).code
    for (const action of ['revoke', 'reissue', 'set-expiry'] as const) {
      await expect(service.mutate(token, { ...base(), action, codes: selection([code]), expiresAt: null } as ActivationMutation)).rejects.toMatchObject({ code: 'INVALID_STATE' })
    }
  })
  it('过期未用码可明确调整为未来有效期，但已撤销码不能用延期恢复', async () => {
    const code = (await service.detail(token, 'demo-code-6')).code
    expect(code.status).toBe('expired')
    const expiredValue = await secret(code)
    expect(() => consumer.previewMockActivation(expiredValue, 'account-1', 'member-2')).toThrow('到期')
    await service.mutate(token, { ...base(), action: 'set-expiry', codes: selection([code]), expiresAt: '2100-01-01T00:00:00Z' })
    expect((await service.detail(token, code.codeId)).code.status).toBe('unused')
    const revoked = (await service.detail(token, 'demo-code-4')).code
    await expect(service.mutate(token, { ...base(), action: 'set-expiry', codes: selection([revoked]), expiresAt: null })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })
  it('专栏码只能绑定账号，不冒充已接通专栏消费或软件卡系统', async () => {
    const [code] = await created(1, 'column')
    await expect(service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: 'member-2', storeId: null })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: null, storeId: null })
    const current = (await service.detail(token, code.codeId)).code
    const value = await secret(current)
    expect(() => consumer.previewMockActivation(value, 'account-1', 'member-2')).toThrow('HQ-07')
    expect(() => consumer.previewMockActivation('SOFTWARE-CARD-001', 'account-1', 'member-2')).toThrow('不接受软件卡')
  })
})

describe('Mock用户预览确认与永久学习授权', () => {
  it('用户须先预览，消费只开通目标会员整组，码标记已用且权益来源可追溯', async () => {
    const data = await issued()
    expect(() => consumer.consumeMockActivation('fake-preview', 'key')).toThrow('先预览')
    const preview = consumer.previewMockActivation(data.value, 'account-1', 'member-2')
    expect(preview.unlockedLevelIds).toEqual(['level-1'])
    const result = consumer.consumeMockActivation(preview.previewToken, 'activation-1')
    expect(result.member.entitlements.find(item => item.membershipTierId === 'demo-tier-1')).toMatchObject({ source: 'activation-code', sourceCodeId: data.code.codeId, expiresAt: null })
    expect(result.levels.filter(level => level.unlocked).map(level => level.levelId)).toEqual(['level-1'])
    expect((await service.detail(token, data.code.codeId)).code).toMatchObject({ status: 'used', usedByAccountId: 'account-1', usedByMemberId: 'member-2' })
    expect(result.levels.find(level => level.levelId === 'level-6')?.percent).toBe(60)
  })
  it('不能将绑定给一个孩子的码用于兄弟姐妹或其他账号', async () => {
    const data = await issued()
    expect(() => consumer.previewMockActivation(data.value, 'account-1', 'member-1')).toThrow('不匹配')
    expect(() => consumer.previewMockActivation(data.value, 'account-2', 'member-2')).toThrow('不匹配')
  })
  it('重复提交和预览过期后的已成功请求重试不重复消耗或重复发权益', async () => {
    vi.useFakeTimers()
    const data = await issued()
    const preview = consumer.previewMockActivation(data.value, 'account-1', 'member-2')
    const result = consumer.consumeMockActivation(preview.previewToken, 'once')
    vi.advanceTimersByTime(6 * 60 * 1000)
    expect(consumer.consumeMockActivation(preview.previewToken, 'once')).toEqual(result)
    expect((await members.detail(token, 'member-2')).audit.filter(item => item.origin === 'activation-code')).toHaveLength(1)
    expect(() => consumer.consumeMockActivation(preview.previewToken, 'different')).toThrow()
  })
  it('码到期不会撤销已经开通的永久学习权益', async () => {
    vi.useFakeTimers()
    const data = await issued(new Date(Date.now() + 1000).toISOString())
    const preview = consumer.previewMockActivation(data.value, 'account-1', 'member-2')
    consumer.consumeMockActivation(preview.previewToken, 'permanent')
    vi.advanceTimersByTime(2000)
    expect((await service.detail(token, data.code.codeId)).code.status).toBe('used')
    expect((await members.detail(token, 'member-2')).member.entitlements.find(item => item.membershipTierId === 'demo-tier-1')).toMatchObject({ status: 'active', expiresAt: null })
  })
  it('码延期、学员资料变化或预览超时后都须重新预览', async () => {
    const data = await issued()
    const preview = consumer.previewMockActivation(data.value, 'account-1', 'member-2')
    await service.mutate(token, { ...base(), action: 'set-expiry', codes: selection([data.code]), expiresAt: '2100-01-01T00:00:00Z' })
    expect(() => consumer.consumeMockActivation(preview.previewToken, 'stale-code')).toThrow('重新预览')
    const next = consumer.previewMockActivation(data.value, 'account-1', 'member-2')
    await members.mutate(token, { action: 'grant', memberId: 'member-2', accountId: 'account-1', contextId: 'child:account-1:2', membershipTierId: 'demo-tier-2', version: 1, ...base() })
    expect(() => consumer.consumeMockActivation(next.previewToken, 'stale-member')).toThrow('重新预览')
    expect((await service.detail(token, data.code.codeId)).code.status).toBe('issued')
    const fresh = await issued()
    const timed = consumer.previewMockActivation(fresh.value, 'account-1', 'member-2')
    vi.useFakeTimers(); vi.advanceTimersByTime(5 * 60 * 1000)
    expect(() => consumer.consumeMockActivation(timed.previewToken, 'timed-out')).toThrow('预览已过期')
  })
  it('新请求不能消耗已有学习权益的码', async () => {
    const [code] = await created()
    await service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: 'member-1', storeId: null })
    const current = (await service.detail(token, code.codeId)).code
    const value = await secret(current)
    await members.mutate(token, { action: 'grant', memberId: 'member-1', accountId: 'account-1', contextId: 'child:account-1:1', membershipTierId: 'demo-tier-1', version: 1, ...base() })
    expect(() => consumer.previewMockActivation(value, 'account-1', 'member-1')).toThrow('已有权益')
    expect((await service.detail(token, code.codeId)).code.status).toBe('issued')
  })
})

describe('权限、导出与操作追溯', () => {
  it('只读账号可查询脱敏数据，但不能生成、分发或导出完整码', async () => {
    const code = (await service.detail(token, 'demo-code-1')).code
    token = (await auth.login({ loginAccount: 'hq-codes-viewer', password: 'Demo@123456' })).token
    expect((await service.list(token, { page: 1, pageSize: 10 })).total).toBe(12)
    await expect(service.mutate(token, generate())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.mutate(token, { ...base(), action: 'issue', codes: selection([code]), accountId: 'account-1', memberId: null, storeId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.export(token, { ...base(), codes: selection([code]) })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('会话失效或仅有课程权限不能访问激活码服务', async () => {
    token = (await auth.login({ loginAccount: 'hq-content', password: 'Demo@123456' })).token
    await expect(service.options(token)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await auth.logout()
    await expect(service.list(token, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('导出UTF-8 CSV包含所选完整演示码且重试不重复记录，查询永不返回secret', async () => {
    const rows = await created(2)
    const input = { ...base(), codes: selection(rows) }
    const result = await service.export(token, input)
    expect(result.csv.startsWith('\uFEFF')).toBe(true)
    expect(result.csv).toMatch(/^\uFEFF"环境","码ID"/)
    expect(result.csv.split('\r\n')).toHaveLength(3)
    expect(result.csv).toMatch(/DEMO-MEM-[A-F0-9]{32}/)
    expect(await service.export(token, input)).toEqual(result)
    expect((await service.audit(token)).filter(item => item.action === 'export')).toHaveLength(1)
    expect(rows.every(code => !('secret' in code))).toBe(true)
  })
  it('CSV转义引号、换行以及公式前缀', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvCell('a"b\nc')).toBe('"a""b\nc"')
    expect(csvCell(' @evil')).toBe('"\' @evil"')
  })
  it('记录总部操作者、原因、码ID与请求号，不将完整码写入日志', async () => {
    const result = await service.mutate(token, generate())
    expect(result.operation).toMatchObject({ operatorId: 'HQ001', action: 'generate', reason: '测试总部激活码管理' })
    expect(result.operation.codeIds).toEqual(result.affectedCodeIds)
    expect(JSON.stringify(await service.audit(token))).not.toMatch(/DEMO-MEM-[A-F0-9]{32}/)
  })
  it('未知操作类型不能降级为其他权限或产生变更', async () => {
    await expect(service.mutate(token, { ...generate(), action: 'unknown' } as unknown as ActivationMutation)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(await service.audit(token)).toHaveLength(0)
  })
})
