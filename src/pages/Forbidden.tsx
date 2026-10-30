import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { firstAllowedPath } from '../auth/access'

export default function Forbidden() {
  const { session } = useAuth()
  const home = firstAllowedPath(session?.account ?? null)
  return <Result status="403" title="暂无此模块的访问权限" subTitle="请联系总部管理员配置权限。业务身份不能替代总部授权。" extra={home !== '/forbidden' ? <Link to={home}><Button type="primary">返回可访问模块</Button></Link> : undefined} />
}
