import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isMockAuth } from '../services/auth'
import { Alert, Button, Menu, Modal, Tag, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  AccountBookOutlined,
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BookOutlined,
  CarOutlined,
  ClusterOutlined,
  CreditCardOutlined,
  CrownOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FormOutlined,
  FundOutlined,
  GiftOutlined,
  HomeOutlined,
  IdcardOutlined,
  KeyOutlined,
  NotificationOutlined,
  PartitionOutlined,
  PayCircleOutlined,
  PictureOutlined,
  ProfileOutlined,
  ReadOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TagOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  adminModules,
  visibleNavGroups,
  type AdminNavIconKey,
} from '../auth/access'

/** 分组标题与二级菜单项一一对应、互不复用 */
const navIcons: Record<AdminNavIconKey, ReactNode> = {
  'group-account': <TeamOutlined />,
  'group-learning': <ReadOutlined />,
  'group-codes': <GiftOutlined />,
  'group-commerce': <ShoppingOutlined />,
  'group-materials': <PictureOutlined />,
  'group-partner': <ClusterOutlined />,
  'group-costore': <PartitionOutlined />,
  'group-store': <ShopOutlined />,
  'group-revenue': <FundOutlined />,
  'group-finance': <AccountBookOutlined />,
  'group-system': <SettingOutlined />,
  users: <UserOutlined />,
  members: <UsergroupAddOutlined />,
  course: <BookOutlined />,
  columns: <ProfileOutlined />,
  announcements: <NotificationOutlined />,
  materials: <PictureOutlined />,
  'activation-codes': <KeyOutlined />,
  'software-cards': <CreditCardOutlined />,
  quotas: <DatabaseOutlined />,
  products: <AppstoreOutlined />,
  delivery: <CarOutlined />,
  orders: <FileTextOutlined />,
  coupons: <TagOutlined />,
  payments: <PayCircleOutlined />,
  revenue: <FundOutlined />,
  'revenue-partners': <CrownOutlined />,
  'revenue-stores': <ShopOutlined />,
  'revenue-agents': <ApiOutlined />,
  'revenue-settlement': <AuditOutlined />,
  withdrawals: <WalletOutlined />,
  'staff-roles': <IdcardOutlined />,
  stores: <HomeOutlined />,
  training: <FormOutlined />,
  transfers: <SwapOutlined />,
  partners: <CrownOutlined />,
  invitations: <ShareAltOutlined />,
  costore: <PartitionOutlined />,
  support: <CustomerServiceOutlined />,
  trace: <AuditOutlined />,
  agents: <ApiOutlined />,
}

function initialOpenKeys(pathname: string, groups: { key: string; defaultCollapsed?: boolean; children: { path: string }[] }[]) {
  const active = groups.find((g) => g.children.some((c) => c.path === pathname))
  if (active) return [active.key]
  return groups.filter((g) => !g.defaultCollapsed).map((g) => g.key)
}

export default function AdminLayout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const account = session!.account
  const title = adminModules.find((item) => item.path === location.pathname)?.label ?? '访问权限'

  const groups = useMemo(() => visibleNavGroups(account), [account])

  const [openKeys, setOpenKeys] = useState<string[]>(() => initialOpenKeys(location.pathname, groups))

  useEffect(() => {
    const active = groups.find((g) => g.children.some((c) => c.path === location.pathname))
    if (!active) return
    setOpenKeys((prev) => (prev.includes(active.key) ? prev : [...prev, active.key]))
  }, [location.pathname, groups])

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      groups.map((group) => ({
        key: group.key,
        icon: navIcons[group.icon],
        label: group.label,
        children: group.children.map((item) => ({
          key: item.path,
          icon: navIcons[item.icon],
          label: item.label,
        })),
      })),
    [groups],
  )

  const onLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      messageApi.error('退出失败，请重试')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="admin-layout">
      {contextHolder}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">脑</div>
          <div>
            <div className="logo-name">脑商总部</div>
            <div className="logo-sub">总部管理后台</div>
          </div>
        </div>
        <nav className="side-nav" aria-label="总部模块导航">
          <Menu
            className="side-menu"
            mode="inline"
            theme="dark"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            onClick={({ key }) => {
              if (typeof key === 'string' && key.startsWith('/')) navigate(key)
            }}
            items={menuItems}
          />
        </nav>
        <div className="sidebar-footer">{isMockAuth ? '总部后台 · Mock 演示环境' : '总部后台 · 接口联调环境'}</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="breadcrumb">总部管理 / {title}</span>
          </div>
          <div className="topbar-right">
            <Tag color="blue">总部授权</Tag>
            <span className="avatar">{account.nickname.slice(0, 1)}</span>
            <span className="admin-name">{account.nickname}</span>
            {!isMockAuth && <Button onClick={() => navigate('/session')}>账号设置</Button>}
            <Button onClick={() => setConfirmOpen(true)}>退出登录</Button>
          </div>
        </header>
        <main className="content">
          <Alert
            className="hq-mock-banner"
            type="info"
            showIcon
            message={isMockAuth ? '当前为 Mock 演示，业务数据为本地模拟，不会写入真实总部。' : '已连接真实总部后台；专用业务页在非 Mock 模式下走正式 API（部分上传/导出/无后端对应能力仍会明确提示不可用）。'}
          />
          <Outlet />
        </main>
      </div>
      <Modal
        title="退出总部后台"
        open={confirmOpen}
        onCancel={() => {
          if (!loggingOut) setConfirmOpen(false)
        }}
        onOk={() => void onLogout()}
        confirmLoading={loggingOut}
        cancelButtonProps={{ disabled: loggingOut }}
        closable={!loggingOut}
        maskClosable={!loggingOut}
        okText="退出登录"
        cancelText="取消"
      >
        <p>退出后需要重新登录。请先保存当前页面中未提交的内容。</p>
      </Modal>
    </div>
  )
}