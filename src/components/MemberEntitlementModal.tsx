import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Space, Tag, Typography } from 'antd'
import { membersService } from '../services/members'
import { MemberServiceError, type EntitlementAction, type MemberProfile, type MembershipTier } from '../types/members'

export const entitlementActions = { grant: '人工开通', revoke: '撤销权益', restore: '补发：恢复已撤销权益' }
export interface EntitlementRequest { member: MemberProfile; tier: MembershipTier; action: EntitlementAction }
export default function MemberEntitlementModal({ request: { member, tier, action }, token, onClose, onDone, onRefresh }: { request: EntitlementRequest; token: string; onClose: () => void; onDone: () => void; onRefresh: () => void }) {
  const [form] = Form.useForm<{ reason: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const submit = async () => {
    let values: { reason: string }
    try { values = await form.validateFields() } catch { return }
    setBusy(true); setError(null)
    try {
      await membersService.mutate(token, { memberId: member.memberId, accountId: member.accountId, contextId: member.contextId, membershipTierId: tier.membershipTierId, action, version: member.version, reason: values.reason.trim(), idempotencyKey: requestId })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '结果未知，请保留原请求号重试')
      setConflict(err instanceof MemberServiceError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE'].includes(err.code))
    } finally { setBusy(false) }
  }
  return <Modal open title={entitlementActions[action]} onCancel={() => { if (!busy) onClose() }} onOk={() => void submit()} okText="确认处理权益" cancelText="取消" confirmLoading={busy} maskClosable={false} closable={!busy} cancelButtonProps={{ disabled: busy }} okButtonProps={{ disabled: conflict, danger: action === 'revoke' }}>
    <Typography.Paragraph>受益学员：<strong>{member.name}</strong>（{member.displayId}）<br />所属家长：{member.parentName} · {member.accountId}<br />目标会员等级：<strong>{tier.name}</strong></Typography.Paragraph>
    <Alert showIcon type={action === 'revoke' ? 'warning' : 'info'} message={action === 'revoke' ? '撤销该等级全部学习权限，保留已有学习进度与历史记录。' : '该会员等级包含的学习等级全部解锁，永久有效；不自动开通其他会员等级。'} />
    <Typography.Paragraph style={{ marginTop: 16 }}>涉及学习等级：</Typography.Paragraph><Space size={[0, 8]} wrap>{tier.levels.map(level => <Tag key={level.levelId}>{level.name}</Tag>)}</Space>
    {error && <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}><Alert type="error" message={error} role="alert" />{conflict && <Button onClick={() => { onClose(); onRefresh() }}>刷新权益并关闭</Button>}</Space>}
    <Form name="memberEntitlementAction" form={form} layout="vertical" requiredMark={false} disabled={busy || conflict} style={{ marginTop: 20 }}><Form.Item name="reason" label="处理原因" rules={[{ required: true, whitespace: true, message: '请填写处理原因' }, { max: 200, message: '处理原因不能超过200字' }]}><Input.TextArea maxLength={200} showCount rows={3} placeholder="请说明本次开通、撤销或恢复的原因" /></Form.Item></Form>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Mock 操作 · 请求号：{requestId}</Typography.Text>
  </Modal>
}
