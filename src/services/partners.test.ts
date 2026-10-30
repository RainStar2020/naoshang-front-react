import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { PartnerMutation, PartnerLevel } from '../types/partners'
let service: typeof import('./partners')['partnersService']
let mock: typeof import('./mock/partners')
let auth: typeof import('./auth')['authService']
let token: string
const upgrade = (contextId = 'partner:account-3', targetLevel: PartnerLevel = 'DEMO-ANGEL', version = 1): Extract<PartnerMutation, { action: 'upgrade' }> => ({ action: 'upgrade', contextId, targetLevel, version, reason: '验收总部人工升级', idempotencyKey: crypto.randomUUID() })
const profile = (contextId = 'partner:account-3') => service.detail(token, contextId)
async function claim() { const value = (await profile('partner:account-6')).profile; return { accountId: value.accountId, contextId: value.contextId, taskId: value.task!.taskId, version: value.version, idempotencyKey: crypto.randomUUID() } }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T09:00:00+08:00')); vi.resetModules(); const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  service = (await import('./partners')).partnersService; mock = await import('./mock/partners'); auth = (await import('./auth')).authService
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('等级映射、名额占用和任务目标独立返回，联创无下一档', async () => {
  const levels = (await service.catalog(token)).levels
  expect(levels.map(row => row.quotaOccupancy)).toEqual([1, 3, 6, 24]); expect(levels.map(row => row.taskTarget)).toEqual([3, 9, 18, null]); expect(levels.map(row => row.wholesaleLabel)).toEqual(['小批', '中批', '大批', '总批'])
  expect((await profile('partner:account-24')).profile.task).toBeNull()
})
it('分页不改变全量筛选统计，只包含真实Mock经营身份', async () => {
  const one = await service.list(token, { page: 1, pageSize: 5 }), two = await service.list(token, { page: 2, pageSize: 5 })
  expect(one.total).toBe(9); expect(one.items).toHaveLength(5); expect(two.items).toHaveLength(4); expect(one.summary).toEqual(two.summary); expect(one.summary.active).toBe(6)
  await expect(profile('agency:account-1:county')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
it('按手机号、等级和状态筛选', async () => {
  const result = await service.list(token, { page: 1, pageSize: 10, keyword: '13800000006', partnerLevel: 'DEMO-ANGEL', partnerStatus: 'ACTIVE' }); expect(result.items.map(row => row.accountId)).toEqual(['account-6'])
})
it('介绍人只读且年度状态由服务返回', async () => {
  expect((await profile('partner:account-6')).profile.superior?.accountId).toBe('account-3')
  expect((await profile('partner:account-9')).profile).toMatchObject({ annualStatus: 'EXPIRED', frozen: true, partnerStatus: 'EXPIRED', allowedActions: [] })
  expect((await profile('partner:account-12')).profile).toMatchObject({ annualStatus: 'NOT_OPEN', annualValidUntil: null, partnerStatus: 'PENDING_ANNUAL' })
})
it('人工升级有前后等级、操作者、原因和回执', async () => {
  const result = await service.mutate(token, upgrade()), detail = await profile()
  expect(detail.profile.partnerLevel).toBe('DEMO-ANGEL'); expect(detail.profile.version).toBe(2)
  expect(detail.receipts[0]).toMatchObject({ receiptId: result.receiptId, source: 'HQ_MANUAL', beforeLevel: 'DEMO-VIP', targetLevel: 'DEMO-ANGEL', operatorName: '总部演示账号', reason: '验收总部人工升级', status: 'SUCCEEDED' })
  expect(detail.audit[0]).toMatchObject({ action: 'upgrade', before: 'VIP V1', after: '天使 V2' })
})
it('人工升级不续年度、不改孩子永久权益、历史订单或券', async () => {
  const before = (await profile()).profile, members = (await import('./members')).membersService, child = await members.detail(token, 'member-5'), orders = (await import('./orders')).ordersService, order = await orders.detail(token, 'delivery-demo-order-3')
  await service.mutate(token, upgrade()); expect((await profile()).profile.annualValidUntil).toBe(before.annualValidUntil); expect((await profile()).profile.annualFeeAmount).toBe(20000); expect(await members.detail(token, 'member-5')).toEqual(child); expect(await orders.detail(token, 'delivery-demo-order-3')).toEqual(order)
})
it('人工跨档升级归档旧任务，联创不再创建任务', async () => {
  const task = (await profile()).profile.task!; await service.mutate(token, upgrade('partner:account-3', 'DEMO-FOUNDER'))
  const detail = await profile(); expect(detail.profile.task).toBeNull(); expect(detail.taskHistory[0]).toMatchObject({ taskId: task.taskId, status: 'SUPERSEDED', progress: 1, target: 3 })
})
it.each(['partner:account-9', 'partner:account-12', 'partner:account-15', 'partner:account-24'])('不可操作状态或最高等级%s不允许人工升级', async contextId => { await expect(service.mutate(token, upgrade(contextId, 'DEMO-FOUNDER'))).rejects.toMatchObject({ code: 'INVALID_STATE' }) })
it('人工不能降级、同级或传入未允许编码', async () => {
  await expect(service.mutate(token, upgrade('partner:account-6', 'DEMO-VIP'))).rejects.toMatchObject({ code: 'INVALID_STATE' }); await expect(service.mutate(token, upgrade('partner:account-3', 'DEMO-VIP'))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('人工操作幂等，旧版本和同请求不同参数被拒绝', async () => {
  const request = upgrade(), result = await service.mutate(token, request); expect(await service.mutate(token, request)).toEqual(result); expect((await profile()).receipts).toHaveLength(1)
  await expect(service.mutate(token, { ...request, targetLevel: 'DEMO-BOARD' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' }); await expect(service.mutate(token, upgrade('partner:account-3', 'DEMO-FOUNDER'))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
it('任务达到数字目标但API资格未通过仍不可申请', async () => {
  const row = (await profile('partner:account-21')).profile; expect(row.task).toMatchObject({ progress: 18, target: 18, canClaim: false })
  expect(() => mock.mockClaimPartnerPromotion({ accountId: row.accountId, contextId: row.contextId, taskId: row.task!.taskId, version: row.version, idempotencyKey: 'claim' })).toThrow('未达资格')
})
it('加载达标档案不会自动晋升或创建回执', async () => {
  for (let i = 0; i < 3; i++) await profile('partner:account-6')
  expect((await profile('partner:account-6')).profile.partnerLevel).toBe('DEMO-ANGEL'); expect((await service.catalog(token)).receipts).toEqual([])
})
it('用户主动提交才开始晋升，先处理中再服务端完成', async () => {
  const input = await claim(), receipt = mock.mockClaimPartnerPromotion(input); expect(receipt.status).toBe('PROCESSING')
  expect((await profile(input.contextId)).profile).toMatchObject({ partnerLevel: 'DEMO-ANGEL', allowedActions: [] })
  vi.advanceTimersByTime(1100); const detail = await profile(input.contextId); expect(detail.profile.partnerLevel).toBe('DEMO-BOARD'); expect(detail.receipts[0].status).toBe('SUCCEEDED'); expect(detail.taskHistory[0]).toMatchObject({ status: 'COMPLETED', progress: 9, target: 9 }); expect(detail.profile.task).toMatchObject({ progress: 0, target: 18 })
})
it('用户请求幂等，超时沿用原请求号不重复晋升', async () => {
  const input = await claim(), receipt = mock.mockClaimPartnerPromotion(input); expect(mock.mockClaimPartnerPromotion(input).receiptId).toBe(receipt.receiptId)
  vi.advanceTimersByTime(1100); expect(mock.mockClaimPartnerPromotion(input)).toMatchObject({ receiptId: receipt.receiptId, status: 'SUCCEEDED' }); expect((await profile(input.contextId)).receipts).toHaveLength(1)
})
it('请求号不可更换任务且身份必须属于账号', async () => {
  const input = await claim(); expect(() => mock.mockClaimPartnerPromotion({ ...input, accountId: 'account-3' })).toThrow('不属于')
  mock.mockClaimPartnerPromotion(input); expect(() => mock.mockClaimPartnerPromotion({ ...input, taskId: 'different' })).toThrow('请求号')
})
it('任务未达标或已过期不能提交', async () => {
  for (const contextId of ['partner:account-3', 'partner:account-27']) { const row = (await profile(contextId)).profile; expect(row.task?.canClaim).toBe(false); expect(() => mock.mockClaimPartnerPromotion({ accountId: row.accountId, contextId, taskId: row.task!.taskId, version: row.version, idempotencyKey: crypto.randomUUID() })).toThrow('资格') }
})
it('待处理任务期间人工升级被拦截，避免竞争', async () => {
  const input = await claim(); mock.mockClaimPartnerPromotion(input); await expect(service.mutate(token, upgrade(input.contextId, 'DEMO-FOUNDER', 2))).rejects.toMatchObject({ code: 'INVALID_STATE' })
})
it('提交后账号被冻结，任务回执失败而不晋升', async () => {
  const input = await claim(); mock.mockClaimPartnerPromotion(input); const users = (await import('./users')).usersService
  await users.mutate(token, { action: 'freeze', accountId: 'account-6', version: 1, frozen: true, reason: '测试身份变化', idempotencyKey: crypto.randomUUID() })
  vi.advanceTimersByTime(1100); const detail = await profile(input.contextId); expect(detail.receipts[0].status).toBe('FAILED'); expect(detail.profile.partnerLevel).toBe('DEMO-ANGEL')
})
it('年度到期会阻止新操作，页面不自动续开年度', async () => {
  vi.setSystemTime(new Date('2028-01-01T00:00:00+08:00')); token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token; const detail = await profile(); expect(detail.profile).toMatchObject({ annualStatus: 'EXPIRED', frozen: true, allowedActions: [] })
})
it('权益说明可以编辑但不能改写固定规则', async () => {
  const level = (await service.catalog(token)).levels[0]; await service.mutate(token, { action: 'save-benefits', partnerLevel: level.partnerLevel, version: 1, summary: '新版等级权益说明', content: level.content, quotaOccupancy: 999, taskTarget: 999, reason: '验收说明维护', idempotencyKey: crypto.randomUUID() } as unknown as PartnerMutation)
  expect((await service.catalog(token)).levels[0]).toMatchObject({ summary: '新版等级权益说明', quotaOccupancy: 1, taskTarget: 3, version: 2 })
})
it('说明过滤脚本，空正文不能保存', async () => {
  const level = (await service.catalog(token)).levels[0]; level.content.nodes.push({ name: 'script', children: [{ type: 'text', text: 'evil()' }] } as never)
  await service.mutate(token, { action: 'save-benefits', partnerLevel: level.partnerLevel, version: 1, summary: '安全内容', content: level.content, reason: '测试富文本', idempotencyKey: crypto.randomUUID() }); expect(JSON.stringify((await service.catalog(token)).levels[0].content)).not.toContain('evil')
  await expect(service.mutate(token, { action: 'save-benefits', partnerLevel: level.partnerLevel, version: 2, summary: '安全内容', content: { version: 1, format: 'nodes', nodes: [] }, reason: '测试正文', idempotencyKey: crypto.randomUUID() })).rejects.toThrow('正文')
})
it('上传使用等级说明权限，不依赖课程编辑权', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo'); await expect(service.upload(token, new File(['x'], 'x.png', { type: 'image/png' }))).resolves.toMatchObject({ previewUrl: 'blob:demo' })
})
it('操作员可人工升级但不可维护说明，无总部代领任务服务', async () => {
  const operator = (await auth.login({ loginAccount: 'hq-partner-operator', password: 'Demo@123456' })).token
  await expect(service.mutate(operator, upgrade())).resolves.toBeDefined(); const level = (await service.catalog(operator)).levels[0]
  await expect(service.mutate(operator, { action: 'save-benefits', partnerLevel: level.partnerLevel, version: 1, summary: '越权', content: level.content, reason: '越权测试', idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(service).not.toHaveProperty('claim')
})
it('只读账号不能写入，退出后不能查询', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-partner-viewer', password: 'Demo@123456' })).token
  await expect(service.list(viewer, { page: 1, pageSize: 10 })).resolves.toBeDefined(); await expect(service.mutate(viewer, upgrade())).rejects.toMatchObject({ code: 'FORBIDDEN' }); await auth.logout(); await expect(service.catalog(viewer)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
})
it('空原因、非法分页和未注册操作被拒绝', async () => {
  await expect(service.mutate(token, { ...upgrade(), reason: '' })).rejects.toThrow('原因'); await expect(service.list(token, { page: 0, pageSize: 10 })).rejects.toThrow('分页'); await expect(service.mutate(token, { ...upgrade(), action: 'renew-annual' } as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
it('响应快照修改不污染服务端状态', async () => { const detail = await profile(); detail.profile.partnerLevel = 'DEMO-FOUNDER'; expect((await profile()).profile.partnerLevel).toBe('DEMO-VIP') })

it('等级展示名可配置并回读，不改编码与名额规则', async () => {
  const before = (await service.catalog(token)).levels
  expect(before.map(row => row.title)).toEqual(['VIP', '天使', '私董', '联创'])
  await service.mutate(token, {
    action: 'save-level-names',
    reason: '验收展示名配置',
    idempotencyKey: crypto.randomUUID(),
    names: before.map((row, index) => ({ partnerLevel: row.partnerLevel, title: ['金牌', '银牌', '铜牌', '创始'][index], version: row.version })),
  })
  const after = (await service.catalog(token)).levels
  expect(after.map(row => row.title)).toEqual(['金牌', '银牌', '铜牌', '创始'])
  expect(after.map(row => row.partnerLevel)).toEqual(before.map(row => row.partnerLevel))
  expect(after.map(row => row.quotaOccupancy)).toEqual(before.map(row => row.quotaOccupancy))
  expect(after.map(row => row.taskTarget)).toEqual(before.map(row => row.taskTarget))
  expect(after.every(row => row.version === 2)).toBe(true)
})

it('四档权益摘要与正文可分别保存回读', async () => {
  const levels = (await service.catalog(token)).levels
  for (const level of levels) {
    await service.mutate(token, {
      action: 'save-benefits',
      partnerLevel: level.partnerLevel,
      version: level.version,
      summary: `${level.title}-摘要定制`,
      content: { version: 1, format: 'nodes', nodes: [{ name: 'p', attrs: {}, children: [{ type: 'text', text: `${level.partnerLevel}-正文` }] }] },
      reason: '验收分档权益',
      idempotencyKey: crypto.randomUUID(),
    })
  }
  const after = (await service.catalog(token)).levels
  expect(after.map(row => row.summary)).toEqual(after.map(row => `${row.title}-摘要定制`))
  expect(after.every(row => row.content.nodes?.[0] && JSON.stringify(row.content).includes(row.partnerLevel))).toBe(true)
})

it('展示名空值、过长或版本冲突被拒绝', async () => {
  const levels = (await service.catalog(token)).levels
  const names = levels.map(row => ({ partnerLevel: row.partnerLevel, title: row.title, version: row.version }))
  await expect(service.mutate(token, { action: 'save-level-names', reason: '空名', idempotencyKey: crypto.randomUUID(), names: names.map((row, i) => i === 0 ? { ...row, title: '  ' } : row) })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  await expect(service.mutate(token, { action: 'save-level-names', reason: '旧版本', idempotencyKey: crypto.randomUUID(), names: names.map(row => ({ ...row, version: 0 })) })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
})
