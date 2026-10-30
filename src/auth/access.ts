import type { HqAccount, HqPermission } from '../types/auth'

/** 导航图标键：分组与叶子菜单各用唯一键，由 AdminLayout 映射到 @ant-design/icons */
export type AdminNavIconKey =
  | 'group-account'
  | 'group-learning'
  | 'group-codes'
  | 'group-commerce'
  | 'group-materials'
  | 'group-partner'
  | 'group-costore'
  | 'group-store'
  | 'group-revenue'
  | 'group-finance'
  | 'group-system'
  | 'users'
  | 'members'
  | 'course'
  | 'columns'
  | 'announcements'
  | 'materials'
  | 'activation-codes'
  | 'software-cards'
  | 'quotas'
  | 'products'
  | 'delivery'
  | 'orders'
  | 'coupons'
  | 'payments'
  | 'revenue'
  | 'revenue-partners'
  | 'revenue-stores'
  | 'revenue-agents'
  | 'revenue-settlement'
  | 'withdrawals'
  | 'staff-roles'
  | 'stores'
  | 'training'
  | 'transfers'
  | 'partners'
  | 'invitations'
  | 'costore'
  | 'support'
  | 'trace'
  | 'agents'

export interface AdminNavItem {
  path: string
  label: string
  permission: HqPermission
  icon: AdminNavIconKey
}

export interface AdminNavGroup {
  key: string
  label: string
  icon: AdminNavIconKey
  /** 为 true 时默认折叠（当前路由落在该组时仍会展开） */
  defaultCollapsed?: boolean
  children: AdminNavItem[]
}

/**
 * 一级分组 + 二级菜单。归属以产品需求文档 §4.3 为准。
 * App 路由仍扁平注册；权限与回跳继续走扁平 adminModules。
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    key: 'account',
    label: '账号与会员',
    icon: 'group-account',
    children: [
      { path: '/users', label: '用户账号', permission: 'users:access', icon: 'users' },
      { path: '/members', label: '孩子会员档案', permission: 'members:access', icon: 'members' },
    ],
  },
  {
    key: 'learning',
    label: '学习内容',
    icon: 'group-learning',
    children: [
      { path: '/course', label: '课程 CMS', permission: 'course:access', icon: 'course' },
      { path: '/columns', label: '专栏', permission: 'columns:access', icon: 'columns' },
      { path: '/announcements', label: '公告', permission: 'announcements:access', icon: 'announcements' },
    ],
  },
  {
    key: 'codes',
    label: '发码',
    icon: 'group-codes',
    children: [
      { path: '/activation-codes', label: '会员/专栏激活码', permission: 'activation:access', icon: 'activation-codes' },
      { path: '/software-cards', label: '软件卡发码', permission: 'software:access', icon: 'software-cards' },
    ],
  },
  {
    key: 'commerce',
    label: '商品与交易',
    icon: 'group-commerce',
    children: [
      { path: '/products', label: '商品中心', permission: 'products:access', icon: 'products' },
      { path: '/delivery', label: '交付配置', permission: 'delivery:access', icon: 'delivery' },
      { path: '/orders', label: '订单履约', permission: 'orders:access', icon: 'orders' },
      { path: '/coupons', label: '优惠券', permission: 'coupons:access', icon: 'coupons' },
      { path: '/payments', label: '支付与对账', permission: 'payments:access', icon: 'payments' },
    ],
  },
  {
    key: 'materials',
    label: '推广素材',
    icon: 'group-materials',
    children: [
      { path: '/materials', label: '素材库', permission: 'materials:access', icon: 'materials' },
    ],
  },
  {
    key: 'partner',
    label: '合伙体系',
    icon: 'group-partner',
    children: [
      { path: '/partners', label: '等级与权益', permission: 'partners:access', icon: 'partners' },
      { path: '/quotas', label: 'VIP名额与充值', permission: 'quotas:access', icon: 'quotas' },
      { path: '/invitations', label: '邀请关系与团队', permission: 'invitations:access', icon: 'invitations' },
    ],
  },
  {
    key: 'costore',
    label: '合店与代理',
    icon: 'group-costore',
    children: [
      { path: '/costore', label: '合店申请监管', permission: 'costore:access', icon: 'costore' },
      { path: '/agents', label: '区域代理监管', permission: 'agents:access', icon: 'agents' },
    ],
  },
  {
    key: 'store',
    label: '门店运营',
    icon: 'group-store',
    children: [
      { path: '/stores', label: '门店主档与健脑官', permission: 'stores:access', icon: 'stores' },
      { path: '/staff-roles', label: '员工与门店角色', permission: 'staff:access', icon: 'staff-roles' },
      { path: '/training', label: '训练反馈与课时', permission: 'training:access', icon: 'training' },
      { path: '/transfers', label: '转店双边审核', permission: 'transfers:access', icon: 'transfers' },
    ],
  },
  {
    key: 'revenue',
    label: '收益',
    icon: 'group-revenue',
    children: [
      { path: '/revenue/partners', label: '合伙人收益', permission: 'revenue:access', icon: 'revenue-partners' },
      { path: '/revenue/stores', label: '门店收益', permission: 'revenue:access', icon: 'revenue-stores' },
      { path: '/revenue/agents', label: '代理收益', permission: 'revenue:access', icon: 'revenue-agents' },
      { path: '/revenue/settlement', label: '结算重算与冲正', permission: 'revenue:access', icon: 'revenue-settlement' },
    ],
  },
  {
    key: 'finance',
    label: '资金结算',
    icon: 'group-finance',
    children: [
      { path: '/withdrawals', label: '提现审核与打款', permission: 'withdrawals:access', icon: 'withdrawals' },
    ],
  },
  {
    key: 'system',
    label: '系统支撑',
    icon: 'group-system',
    defaultCollapsed: true,
    children: [
      { path: '/support', label: '协议与客服预留', permission: 'support:access', icon: 'support' },
      { path: '/trace', label: '通用资源与操作追溯', permission: 'trace:access', icon: 'trace' },
    ],
  },
]

/** api 模式下仍必须走专用页、禁止 LiveModule 的路由（P0 + 收益拆页） */
export const dedicatedPagePaths: readonly string[] = [
  '/products',
  '/course',
  '/materials',
  '/partners',
  '/users',
  // P1 第一批：专栏 / 公告 / 发码
  '/columns',
  '/announcements',
  '/activation-codes',
  '/software-cards',
  // P1 第二批：订单履约 / 优惠券 / 支付查单补单
  '/orders',
  '/coupons',
  '/payments',
  // P1 第三批：名额 / 邀请 / 合店 / 区域代理 + HQ-03/10 Mock 拆出
  '/quotas',
  '/invitations',
  '/costore',
  '/agents',
  '/members',
  '/delivery',
  // P2 第一批：门店运营（HQ-19～21 + staff-roles）
  '/stores',
  '/staff-roles',
  '/training',
  '/transfers',
  // P2 第二批：收益四路径 + 提现（HQ-22～23）
  '/revenue/partners',
  '/revenue/stores',
  '/revenue/agents',
  '/revenue/settlement',
  '/withdrawals',
  // P2 第三批：协议客服预留 + 通用资源追溯（HQ-25～26）
  '/support',
  '/trace',
] as const

export function isDedicatedPagePath(path: string) {
  return (dedicatedPagePaths as readonly string[]).includes(path)
}

/** 扁平模块列表：供路由回跳、面包屑、权限探测；顺序与分组声明一致 */
export const adminModules: AdminNavItem[] = adminNavGroups.flatMap((group) => group.children)

export function hasPermission(account: HqAccount | null, permission: HqPermission) {
  return !!account?.headquartersAuthorized && account.status === 'active' && account.permissions.includes(permission)
}

export function firstAllowedPath(account: HqAccount | null) {
  return adminModules.find((item) => hasPermission(account, item.permission))?.path ?? '/forbidden'
}

export function allowedReturnPath(path: unknown, account: HqAccount) {
  // 只接受已登记且获授权的站内页面，避免开放重定向和登录回环。
  return adminModules.find((item) => item.path === path && hasPermission(account, item.permission))?.path ?? firstAllowedPath(account)
}

/** 可见分组：子项全部无权限时整组不出现 */
export function visibleNavGroups(account: HqAccount | null) {
  return adminNavGroups
    .map((group) => ({
      ...group,
      children: group.children.filter((item) => hasPermission(account, item.permission)),
    }))
    .filter((group) => group.children.length > 0)
}