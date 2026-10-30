import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Space, Typography } from 'antd'
import { usersService } from '../services/users'
import { UserServiceError, userDisplayIdPrefixes, type StoreOption, type UserAccount, type UserDisplayIdPrefix, type UserMutation } from '../types/users'

export interface UserActionRequest { account: UserAccount; action: UserMutation['action'] }
interface Props { request: UserActionRequest; stores: StoreOption[]; token: string; onClose: () => void; onDone: () => void; onRefresh: () => void }
interface ActionValues { reason: string; storeId?: string; newPassword?: string; confirmation?: string; prefix?: UserDisplayIdPrefix; serial?: string; confirmDisplayId?: string }

export default function UserActionModal({ request: { account, action }, stores, token, onClose, onDone, onRefresh }: Props) {
  const [form] = Form.useForm<ActionValues>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const title = action === 'freeze' ? (account.frozen ? '解除账号冻结' : '冻结账号')
    : action === 'change-store' ? '修改所属门店'
    : action === 'change-display-id' ? '修改账号编号'
    : '重置账号密码'

  const submit = async () => {
    let values: ActionValues
    try { values = await form.validateFields() } catch { return }
    if (action === 'change-display-id') {
      const nextId = `${values.prefix}${values.serial}`
      const ok = await new Promise<boolean>(resolve => {
        Modal.confirm({
          title: '二次确认修改编号',
          content: `确认将 ${account.displayId} 改为 ${nextId}？冲突时不会覆盖他人编号。`,
          okText: '确认修改',
          cancelText: '返回',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    try {
      const base = { accountId: account.accountId, version: account.version, idempotencyKey: requestId, reason: values.reason.trim() }
      const input: UserMutation = action === 'freeze' ? { ...base, action, frozen: !account.frozen }
        : action === 'change-store' ? { ...base, action, storeId: values.storeId! }
        : action === 'change-display-id' ? { ...base, action, prefix: values.prefix!, serial: values.serial! }
        : { ...base, action, newPassword: values.newPassword! }
      await usersService.mutate(token, input)
      form.resetFields()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交结果未知，请保留此弹窗并沿用原请求重试')
      setConflict(err instanceof UserServiceError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code))
    } finally { setBusy(false) }
  }
  const prefix = Form.useWatch('prefix', form)
  const serial = Form.useWatch('serial', form)
  return <Modal open title={title} onCancel={() => { if (!busy) onClose() }} onOk={() => void submit()} confirmLoading={busy} okText="确认提交" cancelText="取消" okButtonProps={{ danger: action === 'freeze' && !account.frozen, disabled: conflict }} cancelButtonProps={{ disabled: busy }} closable={!busy} maskClosable={false}>
    <Typography.Paragraph>操作对象：<strong>{account.nickname}</strong>（{account.displayId}）</Typography.Paragraph>
    <Alert type="info" showIcon message={action === 'change-store' ? '仅变更账号所属门店；不改写历史订单交付方、历史收益或孩子的转店审批。' : action === 'reset-password' ? '此处仅演示密码重置流程，不修改真实密码，不发送短信，也不回显或保存输入的明文密码。' : action === 'change-display-id' ? '编号格式为前缀（VIP/TS/SD/LC）+ 恰好 4 位数字；全局唯一，冲突不会覆盖。不在此改密码或经营身份。' : '仅变更账号冻结状态；学习授权和经营权益的具体影响由真实 API 决定。'} />
    {error && <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}><Alert type="error" message={error} role="alert" />{conflict && <Button onClick={() => { onClose(); onRefresh() }}>刷新资料并关闭</Button>}</Space>}
    <Form name="userAction" form={form} layout="vertical" disabled={busy || conflict} requiredMark={false} style={{ marginTop: 20 }} initialValues={action === 'change-display-id' ? (() => { const match = account.displayId.match(/^(VIP|TS|SD|LC)(\d{4})$/); return match ? { prefix: match[1] as UserDisplayIdPrefix, serial: match[2] } : { prefix: 'VIP' as UserDisplayIdPrefix, serial: '' } })() : undefined}>
      {action === 'change-store' && <><Typography.Paragraph type="secondary">当前门店：{account.storeName ?? '未绑定门店'}</Typography.Paragraph><Form.Item name="storeId" label="新所属门店" rules={[{ required: true, message: '请选择新门店' }]}><Select showSearch optionFilterProp="label" placeholder="请选择可用门店" options={stores.filter(store => store.active && store.storeId !== account.storeId).map(store => ({ value: store.storeId, label: `${store.name} · ${store.number}` }))} /></Form.Item></>}
      {action === 'reset-password' && <><Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { pattern: /^\S{6,32}$/, message: '密码需为6–32位且不包含空格' }]}><Input.Password autoComplete="new-password" maxLength={32} placeholder="请输入6–32位无空格密码" /></Form.Item><Form.Item name="confirmation" label="确认新密码" dependencies={['newPassword']} rules={[{ required: true, message: '请再次输入新密码' }, ({ getFieldValue }) => ({ validator: (_, value) => !value || value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')) })]}><Input.Password autoComplete="new-password" maxLength={32} placeholder="请再次输入新密码" /></Form.Item></>}
      {action === 'change-display-id' && <>
        <Form.Item name="prefix" label="编号前缀" rules={[{ required: true, message: '请选择前缀' }]}><Select aria-label="账号编号前缀" options={userDisplayIdPrefixes.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="serial" label="4 位序号" rules={[{ required: true, message: '请输入序号' }, { pattern: /^\d{4}$/, message: '须恰好 4 位数字' }]}><Input aria-label="账号编号序号" maxLength={4} placeholder="0000–9999" /></Form.Item>
        <Typography.Paragraph type="secondary">预览新编号：<strong>{prefix && serial && /^\d{4}$/.test(serial) ? `${prefix}${serial}` : '—'}</strong></Typography.Paragraph>
      </>}
      <Form.Item name="reason" label="操作原因" rules={[{ required: true, whitespace: true, message: '请填写操作原因' }, { max: 200, message: '操作原因不能超过200字' }]}><Input.TextArea rows={3} showCount maxLength={200} placeholder="请填写原因，便于后续追溯" /></Form.Item>
    </Form>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求号：{requestId}</Typography.Text>
  </Modal>
}
