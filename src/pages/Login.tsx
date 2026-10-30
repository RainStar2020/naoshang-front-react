import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { allowedReturnPath } from '../auth/access'
import type { HqLoginRequest } from '../types/auth'
import { isMockAuth } from '../services/auth'

export default function Login() {
  const { session, loading, login, notice, error: sessionError, retry } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const from: unknown = location.state?.from
  if (loading) return <div className="auth-loading">正在验证总部会话…</div>
  if (sessionError) return <div className="auth-loading"><Space direction="vertical"><Alert type="error" message={sessionError} /><Button onClick={() => void retry()}>重新验证</Button></Space></div>
  if (session) return <Navigate to={allowedReturnPath(from, session.account)} replace />

  const submit = async (values: HqLoginRequest) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await login({ ...values, loginAccount: values.loginAccount.trim() })
      navigate(allowedReturnPath(from, result.account), { replace: true })
    } catch (err) { setError(err instanceof Error ? err.message : '登录失败，请稍后重试') }
    finally { setSubmitting(false) }
  }
  return <div className="login-page"><div className="login-intro">
    <div className="login-brand">脑商 · 总部管理</div>
    <h1>内容与业务管理<br />从这里开始</h1>
    <p>统一管理课程、素材及业务数据。<br />仅限获得独立总部授权的内部人员使用。</p>
    <span className="login-mode">{isMockAuth ? '当前环境：本地 Mock 演示' : '当前环境：真实总部后台'}</span>
  </div><Card className="login-card" variant="borderless">
    <Typography.Title level={2}>总部登录</Typography.Title>
    <Typography.Paragraph type="secondary">请输入总部账号与密码</Typography.Paragraph>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {notice && <Alert type="warning" message={notice} showIcon />}
      {error && <Alert type="error" message={error} showIcon role="alert" />}
    </Space>
    <Form<HqLoginRequest> layout="vertical" onFinish={submit} requiredMark={false} className="login-form" disabled={submitting}>
      <Form.Item name="loginAccount" label="总部账号" rules={[{ required: true, whitespace: true, message: '请输入总部账号' }]}><Input autoComplete="username" size="large" maxLength={64} placeholder="请输入总部账号" /></Form.Item>
      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password autoComplete="current-password" size="large" maxLength={128} placeholder="请输入密码" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={submitting}>登录总部后台</Button>
    </Form>
    {isMockAuth && <Alert type="info" message="Mock 演示账号" description={<div>全部模块：hq-admin<br />课程编辑 / 推广素材编辑：hq-content<br />课程只读：hq-course-viewer<br />激活码只读（无导出权）：hq-codes-viewer<br />软件卡只读（无导出权）：hq-software-viewer<br />专栏编辑（无发布权）：hq-column-editor<br />专栏只读：hq-column-viewer<br />公告编辑（无发布权）：hq-announcement-editor<br />公告统计只读：hq-announcement-viewer<br />商品编辑（无上架权）：hq-product-editor<br />商品只读：hq-product-viewer<br />交付处理（无策略配置权）：hq-delivery-operator<br />交付只读：hq-delivery-viewer<br />订单履约：hq-order-operator<br />订单只读：hq-order-viewer<br />发券（无模板权）：hq-coupon-issuer<br />优惠券只读：hq-coupon-viewer<br />支付查单/对账（无补单权）：hq-payment-operator<br />支付只读：hq-payment-viewer<br />合伙人工升级（无说明编辑权）：hq-partner-operator<br />合伙档案只读：hq-partner-viewer<br />名额充值：hq-quota-operator<br />名额只读：hq-quota-viewer<br />邀请关系处理：hq-invitation-operator<br />邀请关系只读：hq-invitation-viewer<br />合店监管：hq-costore-operator<br />合店监管只读：hq-costore-viewer<br />门店主档只读：hq-stores-viewer<br />门店主档监管：hq-stores-manager<br />训练反馈只读：hq-training-viewer<br />训练反馈代写：hq-training-feedback<br />课时核销：hq-training-consumer<br />转店审核只读：hq-transfers-viewer<br />转店审核仲裁：hq-transfers-arbiter<br />收益查询：hq-revenue-viewer<br />收益结算监管：hq-revenue-manager<br />提现查询：hq-withdrawals-viewer<br />提现审核：hq-withdrawals-reviewer<br />推广素材只读：hq-materials-viewer<br />推广素材编辑：hq-materials-editor<br />协议客服只读：hq-support-viewer<br />协议客服管理：hq-support-manager<br />通用追溯只读：hq-trace-viewer<br />通用追溯管理：hq-trace-manager<br />员工任职只读：hq-staff-viewer<br />门店角色维护：hq-staff-role-editor<br />员工任职管理：hq-staff-manager<br />仅用户查询：hq-users-viewer<br />仅学员查询：hq-members-viewer<br />无模块权限：hq-empty · 冻结：hq-frozen<br />无总部资格：partner<br />统一密码：<code>Demo@123456</code><br />会话有效期 2 小时，关闭当前标签页后结束。以上账号仅用于本地演示。</div>} />}
  </Card></div>
}







