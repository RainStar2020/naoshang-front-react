import { Button, Result, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { hasPermission } from './access'
import type { HqPermission } from '../types/auth'

export function RequireSession() {
  const { session, loading, error, retry } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-loading"><Spin size="large" tip="正在验证总部会话"><div style={{ height: 60 }} /></Spin></div>
  if (error) return <Result status="warning" title="会话验证暂不可用" subTitle={error} extra={<Button onClick={() => void retry()}>重新验证</Button>} />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequirePermission({ permission, children }: { permission: HqPermission; children: React.ReactNode }) {
  const { session } = useAuth()
  return hasPermission(session?.account ?? null, permission) ? <>{children}</> : <Navigate to="/forbidden" replace />
}
