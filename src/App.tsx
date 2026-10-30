import { lazy, Suspense } from 'react'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { RequirePermission, RequireSession } from './auth/RouteGuards'
import { adminModules, firstAllowedPath, isDedicatedPagePath } from './auth/access'
import AdminLayout from './layouts/AdminLayout'
import CourseCms from './pages/CourseCms'
import Materials from './pages/Materials'
const Support = lazy(() => import('./pages/Support'))
const Trace = lazy(() => import('./pages/Trace'))
import Products from './pages/Products'
import Delivery from './pages/Delivery'
const Orders = lazy(() => import('./pages/Orders'))
const Coupons = lazy(() => import('./pages/Coupons'))
const Payments = lazy(() => import('./pages/Payments'))
import Revenue from './pages/Revenue'
import Stores from './pages/Stores'
const Training = lazy(() => import('./pages/Training'))
const Transfers = lazy(() => import('./pages/Transfers'))
const Withdrawals = lazy(() => import('./pages/Withdrawals'))
const StaffRoles = lazy(() => import('./pages/StaffRoles'))
const Costore = lazy(() => import('./pages/Costore'))
const Invitations = lazy(() => import('./pages/Invitations'))
const Quotas = lazy(() => import('./pages/Quotas'))
const Partners = lazy(() => import('./pages/Partners'))
import Agents from './pages/Agents'
import Login from './pages/Login'
import Forbidden from './pages/Forbidden'
import Users from './pages/Users'
import Members from './pages/Members'
import ActivationCodes from './pages/ActivationCodes'
import SoftwareCards from './pages/SoftwareCards'
import Columns from './pages/Columns'
import Announcements from './pages/Announcements'
import { isMockAuth } from './services/auth'
const LiveModulePage = lazy(() => import('./pages/LiveModule'))

const pages: Record<string, React.ComponentType> = {
  '/staff-roles': StaffRoles,
  '/costore': Costore,
  '/invitations': Invitations,
  '/quotas': Quotas,
  '/payments': Payments,
  '/coupons': Coupons,
  '/orders': Orders,
  '/delivery': Delivery,
  '/announcements': Announcements,
  '/columns': Columns,
  '/software-cards': SoftwareCards,
  '/activation-codes': ActivationCodes,
  '/members': Members,
  '/users': Users,
  '/course': CourseCms,
  '/materials': Materials,
  '/support': Support,
  '/trace': Trace,
  '/products': Products,
  '/revenue/partners': Revenue,
  '/revenue/stores': Revenue,
  '/revenue/agents': Revenue,
  '/revenue/settlement': Revenue,
  '/stores': Stores,
  '/training': Training,
  '/transfers': Transfers,
  '/withdrawals': Withdrawals,
  '/partners': Partners,
  '/agents': Agents,
}

function resolvePage(path: string): React.ComponentType {
  const dedicated = pages[path]
  // P0～P2 全量 HQ 专用页：mock/api 均走专用组件；未列入 dedicatedPagePaths 的路由仍可 mock 用专用页，api 模式走 LiveModule
  if (dedicated && (isMockAuth || isDedicatedPagePath(path))) return dedicated
  return LiveModulePage
}

function HomeRedirect() {
  const { session } = useAuth()
  return <Navigate to={firstAllowedPath(session?.account ?? null)} replace />
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#2f6bff', borderRadius: 10, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" } }}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireSession />}>
              <Route element={<AdminLayout />}>
                <Route index element={<HomeRedirect />} />
                {adminModules.map((item) => {
                  const Page = resolvePage(item.path)
                  return (
                    <Route
                      key={item.path}
                      path={item.path}
                      element={
                        <RequirePermission permission={item.permission}>
                          <Suspense fallback={<Spin tip="正在加载模块"><div style={{ minHeight: 160 }} /></Spin>}>
                            <Page />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                  )
                })}
                <Route path="/revenue" element={<Navigate to="/revenue/settlement" replace />} />
                <Route path="/session" element={<Suspense fallback={<Spin />}><LiveModulePage /></Suspense>} />
                <Route path="/pricing" element={<Navigate to="/products" replace />} />
                <Route path="/forbidden" element={<Forbidden />} />
                <Route path="*" element={<HomeRedirect />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}