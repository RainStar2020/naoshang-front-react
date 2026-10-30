import { AuthError, hqPermissions, type HqAccount, type HqLoginRequest, type HqSession } from '../../types/auth'

const SESSION_KEY = 'naoshang:hq:mock-session:v1'
const accounts: Record<string, HqAccount> = {
  'hq-admin': { accountId: 'HQ001', nickname: '总部演示账号', headquartersAuthorized: true, status: 'active', permissions: [...hqPermissions] },
  'hq-users-viewer': { accountId: 'HQ005', nickname: '用户查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['users:access'] },
  'hq-members-viewer': { accountId: 'HQ006', nickname: '学员查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['members:access'] },
  'hq-content': { accountId: 'HQ002', nickname: '内容权限演示账号', headquartersAuthorized: true, status: 'active', permissions: ['course:access', 'course:edit', 'materials:access', 'materials:edit'] },
  'hq-course-viewer': { accountId: 'HQ007', nickname: '课程查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['course:access'] },
  'hq-codes-viewer': { accountId: 'HQ008', nickname: '激活码查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['activation:access'] },
  'hq-software-viewer': { accountId: 'HQ009', nickname: '软件卡查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['software:access'] },
  'hq-column-editor': { accountId: 'HQ010', nickname: '专栏编辑演示账号', headquartersAuthorized: true, status: 'active', permissions: ['columns:access', 'columns:edit', 'columns:records'] },
  'hq-column-viewer': { accountId: 'HQ011', nickname: '专栏查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['columns:access', 'columns:records'] },
  'hq-announcement-editor': { accountId: 'HQ012', nickname: '公告编辑演示账号', headquartersAuthorized: true, status: 'active', permissions: ['announcements:access', 'announcements:edit'] },
  'hq-announcement-viewer': { accountId: 'HQ013', nickname: '公告统计演示账号', headquartersAuthorized: true, status: 'active', permissions: ['announcements:access', 'announcements:stats'] },
  'hq-product-editor': { accountId: 'HQ014', nickname: '商品编辑演示账号', headquartersAuthorized: true, status: 'active', permissions: ['products:access', 'products:edit'] },
  'hq-product-viewer': { accountId: 'HQ015', nickname: '商品查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['products:access'] },
  'hq-delivery-operator': { accountId: 'HQ016', nickname: '交付处理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['delivery:access', 'delivery:adjust', 'delivery:shipping'] },
  'hq-delivery-viewer': { accountId: 'HQ017', nickname: '交付查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['delivery:access'] },
  'hq-order-operator': { accountId: 'HQ018', nickname: '订单履约演示账号', headquartersAuthorized: true, status: 'active', permissions: ['orders:access', 'orders:shipping', 'orders:fulfill'] },
  'hq-order-viewer': { accountId: 'HQ019', nickname: '订单查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['orders:access'] },
  'hq-coupon-issuer': { accountId: 'HQ020', nickname: '发券演示账号', headquartersAuthorized: true, status: 'active', permissions: ['coupons:access', 'coupons:issue'] },
  'hq-coupon-viewer': { accountId: 'HQ021', nickname: '优惠券查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['coupons:access'] },
  'hq-payment-operator': { accountId: 'HQ022', nickname: '查单对账演示账号', headquartersAuthorized: true, status: 'active', permissions: ['payments:access', 'payments:query', 'payments:reconcile', 'payments:export'] },
  'hq-payment-viewer': { accountId: 'HQ023', nickname: '支付查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['payments:access'] },
  'hq-partner-operator': { accountId: 'HQ024', nickname: '合伙档案处理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['partners:access', 'partners:upgrade'] },
  'hq-partner-viewer': { accountId: 'HQ025', nickname: '合伙档案查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['partners:access'] },
  'hq-quota-operator': { accountId: 'HQ026', nickname: '名额充值演示账号', headquartersAuthorized: true, status: 'active', permissions: ['quotas:access', 'quotas:recharge'] },
  'hq-quota-viewer': { accountId: 'HQ027', nickname: '名额查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['quotas:access'] },
  'hq-invitation-operator': { accountId: 'HQ028', nickname: '邀请关系处理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['invitations:access', 'invitations:manage'] },
  'hq-invitation-viewer': { accountId: 'HQ029', nickname: '邀请关系查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['invitations:access'] },
  'hq-stores-viewer': { accountId: 'HQ035', nickname: '门店主档查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['stores:access'] },
  'hq-stores-manager': { accountId: 'HQ036', nickname: '门店主档监管演示账号', headquartersAuthorized: true, status: 'active', permissions: ['stores:access', 'stores:manage'] },
  'hq-training-viewer': { accountId: 'HQ037', nickname: '训练反馈查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['training:access'] },
  'hq-training-feedback': { accountId: 'HQ038', nickname: '训练反馈代写演示账号', headquartersAuthorized: true, status: 'active', permissions: ['training:access', 'training:feedback'] },
  'hq-training-consumer': { accountId: 'HQ039', nickname: '课时核销演示账号', headquartersAuthorized: true, status: 'active', permissions: ['training:access', 'training:consume'] },
  'hq-transfers-viewer': { accountId: 'HQ040', nickname: '转店审核查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['transfers:access'] },
  'hq-transfers-arbiter': { accountId: 'HQ041', nickname: '转店审核仲裁演示账号', headquartersAuthorized: true, status: 'active', permissions: ['transfers:access', 'transfers:arbitrate'] },
  'hq-staff-viewer': { accountId: 'HQ032', nickname: '员工任职查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['staff:access'] },
  'hq-staff-role-editor': { accountId: 'HQ033', nickname: '门店角色维护演示账号', headquartersAuthorized: true, status: 'active', permissions: ['staff:access', 'staff:roles'] },
  'hq-staff-manager': { accountId: 'HQ034', nickname: '员工任职管理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['staff:access', 'staff:manage'] },
  'hq-costore-operator': { accountId: 'HQ030', nickname: '合店监管演示账号', headquartersAuthorized: true, status: 'active', permissions: ['costore:access', 'costore:manage'] },
  'hq-costore-viewer': { accountId: 'HQ031', nickname: '合店查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['costore:access'] },
  'hq-revenue-viewer': { accountId: 'HQ042', nickname: '收益查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['revenue:access'] },
  'hq-revenue-manager': { accountId: 'HQ043', nickname: '收益结算监管演示账号', headquartersAuthorized: true, status: 'active', permissions: ['revenue:access', 'revenue:manage'] },
  'hq-withdrawals-viewer': { accountId: 'HQ044', nickname: '提现查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['withdrawals:access'] },
  'hq-withdrawals-reviewer': { accountId: 'HQ045', nickname: '提现审核演示账号', headquartersAuthorized: true, status: 'active', permissions: ['withdrawals:access', 'withdrawals:review'] },
  'hq-materials-viewer': { accountId: 'HQ046', nickname: '推广素材查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['materials:access'] },
  'hq-materials-editor': { accountId: 'HQ047', nickname: '推广素材编辑演示账号', headquartersAuthorized: true, status: 'active', permissions: ['materials:access', 'materials:edit'] },
  'hq-support-viewer': { accountId: 'HQ048', nickname: '协议客服查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['support:access'] },
  'hq-support-manager': { accountId: 'HQ049', nickname: '协议客服管理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['support:access', 'support:manage'] },
  'hq-trace-viewer': { accountId: 'HQ050', nickname: '通用追溯查询演示账号', headquartersAuthorized: true, status: 'active', permissions: ['trace:access'] },
  'hq-trace-manager': { accountId: 'HQ051', nickname: '通用追溯管理演示账号', headquartersAuthorized: true, status: 'active', permissions: ['trace:access', 'trace:manage'] },
  'hq-empty': { accountId: 'HQ003', nickname: '待授权总部账号', headquartersAuthorized: true, status: 'active', permissions: [] },
  'hq-frozen': { accountId: 'HQ004', nickname: '冻结总部账号', headquartersAuthorized: true, status: 'frozen', permissions: [] },
  partner: { accountId: 'PARTNER001', nickname: '普通合伙人', headquartersAuthorized: false, status: 'active', permissions: [] },
}

function readSession(): HqSession | null {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

function validateAccount(account: HqAccount) {
  if (!account.headquartersAuthorized) throw new AuthError('HQ_REQUIRED', '该账号没有总部授权，业务身份不能用于登录总部后台')
  if (account.status !== 'active') throw new AuthError('ACCOUNT_FROZEN', '该总部账号已冻结，请联系总部管理员')
}

export async function mockLogin(input: HqLoginRequest): Promise<HqSession> {
  const account = accounts[input.loginAccount]
  if (!account || input.password !== 'Demo@123456') throw new AuthError('INVALID_CREDENTIALS', '账号或密码不正确')
  validateAccount(account)
  const session: HqSession = { token: `mock-hq-${crypto.randomUUID()}`, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), account: { ...account, permissions: [...account.permissions] } }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export async function mockGetSession(token: string): Promise<HqSession> {
  const session = readSession()
  if (!session || session.token !== token || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
    throw new AuthError('SESSION_EXPIRED', '登录已失效，请重新登录')
  }
  // 权限从 Mock 账号目录重新取值，不信任缓存中的账号和权限字段。
  const account = Object.values(accounts).find(item => item.accountId === session.account?.accountId)
  if (!account) throw new AuthError('SESSION_EXPIRED', '登录已失效，请重新登录')
  validateAccount(account)
  return { ...session, account: { ...account, permissions: [...account.permissions] } }
}

export async function mockLogout() { sessionStorage.removeItem(SESSION_KEY) }







