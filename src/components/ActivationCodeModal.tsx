import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd'
import { activationCodesService } from '../services/activationCodes'
import { ActivationError, type ActivationCode, type ActivationMutation, type ActivationMutationResult, type ActivationOptions } from '../types/activationCodes'

export const activationActionNames = { generate: '批量生成', issue: '分发', revoke: '撤销未用码', reissue: '补发新码', 'set-expiry': '调整有效期', export: '导出完整演示码', activate: '用户主动激活（Mock）' }
export type CodeModalAction = ActivationMutation['action'] | 'export'
interface Values { name?: string; codeType?: 'membership-tier' | 'column'; targetId?: string; quantity?: number; validity?: 'none' | 'until'; expiresAtLocal?: string; recipient?: 'account' | 'store'; accountId?: string; memberId?: string; storeId?: string; reason: string }
export default function ActivationCodeModal({ action, codes, options, token, onClose, onRefresh, onDone }: { action: CodeModalAction; codes: ActivationCode[]; options: ActivationOptions; token: string; onClose: () => void; onRefresh: () => void; onDone: (result: ActivationMutationResult | null) => void }) {
  const [form] = Form.useForm<Values>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const codeType = Form.useWatch('codeType', form)
  const accountId = Form.useWatch('accountId', form)
  const recipient = Form.useWatch('recipient', form)
  const validity = Form.useWatch('validity', form)
  const selection = codes.map(code => ({ codeId: code.codeId, version: code.version }))
  const submit = async () => {
    let values: Values
    try { values = await form.validateFields() } catch { return }
    setBusy(true); setError(null)
    try {
      const base = { reason: values.reason.trim(), idempotencyKey: requestId }
      if (action === 'export') {
        const result = await activationCodesService.export(token, { ...base, codes: selection })
        const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8;' }))
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.fileName
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        onDone(null)
      } else {
        const localTime = values.expiresAtLocal ?? ''
        const expiresAt = values.validity === 'until' ? new Date(`${localTime}${localTime.length === 16 ? ':00' : ''}+08:00`).toISOString() : null
        const input: ActivationMutation = action === 'generate' ? { ...base, action, name: values.name!, codeType: values.codeType!, targetId: values.targetId!, quantity: values.quantity!, expiresAt }
          : action === 'issue' ? { ...base, action, codes: selection, accountId: values.recipient === 'account' ? values.accountId! : null, memberId: values.recipient === 'account' ? values.memberId ?? null : null, storeId: values.storeId ?? null }
          : action === 'revoke' ? { ...base, action, codes: selection }
          : { ...base, action, codes: selection, expiresAt }
        onDone(await activationCodesService.mutate(token, input))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '结果未知，请沿用原请求号重试')
      setBlocked(err instanceof ActivationError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE'].includes(err.code))
    } finally { setBusy(false) }
  }
  return <Modal open width={650} title={activationActionNames[action]} onCancel={() => { if (!busy) onClose() }} onOk={() => void submit()} okText={action === 'export' ? '确认导出演示码' : '确认操作'} cancelText="取消" confirmLoading={busy} maskClosable={false} closable={!busy} cancelButtonProps={{ disabled: busy }} okButtonProps={{ disabled: blocked, danger: action === 'revoke' }}>
    <Alert type="info" showIcon message={action === 'reissue' ? '补发会作废旧码，新码继承原账号/学员/门店交付对象。已用码不能补发；恢复已撤销学习权益仍在HQ-03处理。' : action === 'export' ? `将导出所选 ${codes.length} 条完整演示码。仅Mock可用，导出会留下操作记录。` : '本模块仅管理学习会员/专栏码，不管理软件卡。分发不是激活，不会直接开通权益。'} />
    {action !== 'generate' && <Typography.Paragraph style={{ marginTop: 16 }}>已选 {codes.length} 个码，版本会在提交时重新校验。<br />目标：{[...new Set(codes.map(code => code.targetName))].join('、')}</Typography.Paragraph>}
    {error && <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}><Alert type="error" message={error} role="alert" />{blocked && <Button onClick={() => { onClose(); onRefresh() }}>关闭并刷新</Button>}</Space>}
    <Form name="activationOperation" form={form} layout="vertical" requiredMark={false} initialValues={{ codeType: 'membership-tier', quantity: 1, recipient: 'account' }} disabled={busy || blocked} style={{ marginTop: 20 }}>
      {action === 'generate' && <><Form.Item name="name" label="批次名称" rules={[{ required: true, whitespace: true, max: 60, message: '请输入1–60字批次名称' }]}><Input maxLength={60} /></Form.Item><Form.Item name="codeType" label="激活码类型" rules={[{ required: true }]}><Select onChange={() => form.setFieldValue('targetId', undefined)} options={[{ value: 'membership-tier', label: '会员等级激活码' }, { value: 'column', label: '专栏激活码（账号权益）' }]} /></Form.Item><Form.Item name="targetId" label="目标权益" rules={[{ required: true, message: '请选择目标会员等级或专栏' }]}><Select options={(options.targets ?? []).filter(target => target.codeType === codeType).map(target => ({ value: target.targetId, label: target.name }))} /></Form.Item><Form.Item name="quantity" label={`生成数量（Mock服务上限${options.maxBatchSize}）`} rules={[{ required: true }]}><InputNumber min={1} max={options.maxBatchSize} precision={0} /></Form.Item></>}
      {action === 'issue' && <><Alert style={{ marginBottom: 16 }} type="warning" message="以下绑定策略仅用于Mock验收，正式购买人绑定、指定孩子和转赠规则尚待确认。已绑定账号不可换绑；专栏只能绑定账号。" /><Form.Item name="recipient" label="分发对象类型" rules={[{ required: true }]}><Select options={[{ value: 'account', label: '账号（可指定该账号下的孩子）' }, { value: 'store', label: '门店库存（稍后分发到账号）' }]} /></Form.Item>{recipient === 'account' && <><Form.Item name="accountId" label="交付账号" rules={[{ required: true, message: '请选择交付账号' }]}><Select showSearch optionFilterProp="label" onChange={() => form.setFieldValue('memberId', undefined)} options={(options.accounts ?? []).map(account => ({ value: account.accountId, label: `${account.name} · ${account.phone} · ${account.accountId}` }))} /></Form.Item><Form.Item name="memberId" label="指定受益孩子（可选）"><Select allowClear showSearch optionFilterProp="label" disabled={!accountId || codes.some(code => code.codeType === 'column')} options={(options.members ?? []).filter(member => member.accountId === accountId).map(member => ({ value: member.memberId, label: `${member.name} · ${member.displayId}` }))} /></Form.Item></>}<Form.Item name="storeId" label={recipient === 'store' ? '交付门店' : '关联交付门店（可选，未填保留原门店）'} rules={recipient === 'store' ? [{ required: true, message: '请选择门店' }] : []}><Select allowClear showSearch optionFilterProp="label" options={(options.stores ?? []).filter(store => store.active).map(store => ({ value: store.storeId, label: store.name }))} /></Form.Item></>}
      {['generate', 'set-expiry', 'reissue'].includes(action) && <><Form.Item name="validity" label="码有效期（仅Mock设置，请明确选择）" rules={[{ required: true, message: '请选择码有效期策略' }]}><Select options={[{ value: 'none', label: '不设到期时间' }, { value: 'until', label: '指定到期时间（北京时间）' }]} /></Form.Item>{validity === 'until' && <Form.Item name="expiresAtLocal" label="到期时间（UTC+8）" rules={[{ required: true, message: '请选择未来的到期时间' }]}><Input type="datetime-local" /></Form.Item>}<Typography.Paragraph type="secondary">码到期不代表已开通的永久学习权益到期。</Typography.Paragraph></>}
      <Form.Item name="reason" label="操作原因" rules={[{ required: true, whitespace: true, message: '请填写操作原因' }, { max: 200 }]}><Input.TextArea rows={3} maxLength={200} showCount /></Form.Item>
    </Form><Typography.Text type="secondary" style={{ fontSize: 12 }}>请求号：{requestId}</Typography.Text>
  </Modal>
}
