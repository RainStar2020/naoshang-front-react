import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd'
import { softwareCardsService } from '../services/softwareCards'
import { SoftwareCardError, type SoftwareCard, type SoftwareCardType, type SoftwareCatalog, type SoftwareMutation, type SoftwareMutationResult } from '../types/softwareCards'

export const softwareActionNames = { 'save-type': '保存软件卡类型', import: '录入演示批次', assign: '分配软件卡', deliver: '记录Mock交付', retire: '库存停发', replace: '从库存补发', export: '导出完整演示软件卡' }
export type SoftwareModalAction = SoftwareMutation['action'] | 'export'
interface Values { businessCode: string; name: string; termLabel: string; systemLabel: string; description: string; active: boolean; typeId: string; source: 'supplier' | 'hq' | 'mock'; sourceName: string; referenceNo: string; codesText: string; demoQuantity: number; claimValidity: 'none' | 'until'; claimLocal: string; accountId: string; sourceOrderId?: string; deliveryMode: 'hq' | 'store'; deliveryStoreId?: string; replacementCardId: string; reason: string }
export default function SoftwareCardModal({ action, selected, type, catalog, token, onClose, onDone, onRefresh }: { action: SoftwareModalAction; selected: SoftwareCard[]; type?: SoftwareCardType; catalog: SoftwareCatalog; token: string; onClose: () => void; onDone: (result: SoftwareMutationResult | null) => void; onRefresh: () => void }) {
  const [form] = Form.useForm<Values>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const [candidates, setCandidates] = useState<SoftwareCard[]>([])
  const [candidatesBusy, setCandidatesBusy] = useState(false)
  const accountId = Form.useWatch('accountId', form), orderId = Form.useWatch('sourceOrderId', form), mode = Form.useWatch('deliveryMode', form), validity = Form.useWatch('claimValidity', form)
  useEffect(() => {
    if (action !== 'replace') return
    let alive = true; setCandidatesBusy(true)
    softwareCardsService.replacements(token, selected[0].cardId).then(rows => { if (alive) setCandidates(rows) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '候选库存加载失败') }).finally(() => { if (alive) setCandidatesBusy(false) })
    return () => { alive = false }
  }, [action, token, selected])
  const submit = async () => {
    let values: Values
    try { values = await form.validateFields() } catch { return }
    setBusy(true); setError(null)
    try {
      const base = { reason: values.reason.trim(), idempotencyKey: requestId }
      const cards = selected.map(card => ({ cardId: card.cardId, version: card.version }))
      if (action === 'export') {
        const result = await softwareCardsService.export(token, { ...base, cards })
        const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8;' }))
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        onDone(null)
      } else {
        let input: SoftwareMutation
        if (action === 'save-type') input = { ...base, action, typeId: type?.typeId ?? '', version: type?.version ?? 0, value: { businessCode: values.businessCode, name: values.name, termLabel: values.termLabel, systemLabel: values.systemLabel, description: values.description, active: values.active } }
        else if (action === 'import') {
          const local = values.claimLocal ?? ''
          input = { ...base, action, name: values.name, typeId: values.typeId, source: values.source, sourceName: values.sourceName, referenceNo: values.referenceNo, codes: values.codesText.split(/\r?\n/).map(code => code.trim()).filter(Boolean), claimDeadline: values.claimValidity === 'until' ? new Date(`${local}${local.length === 16 ? ':00' : ''}+08:00`).toISOString() : null }
        } else if (action === 'assign') input = { ...base, action, cards, accountId: values.accountId, sourceOrderId: values.sourceOrderId ?? null, deliveryMode: values.deliveryMode, deliveryStoreId: values.deliveryMode === 'store' ? values.deliveryStoreId! : null }
        else if (action === 'replace') {
          const replacement = candidates.find(card => card.cardId === values.replacementCardId)
          if (!replacement) throw new SoftwareCardError('INVALID_INPUT', '请选择同类型候选库存')
          input = { ...base, action, oldCard: cards[0], replacementCard: { cardId: replacement.cardId, version: replacement.version } }
        } else input = { ...base, action, cards }
        onDone(await softwareCardsService.mutate(token, input))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '结果未知，请沿用原请求号重试')
      setBlocked(err instanceof SoftwareCardError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE', 'EXTERNAL_VERIFICATION_REQUIRED'].includes(err.code))
    } finally { setBusy(false) }
  }
  return <Modal open width={730} title={softwareActionNames[action]} onCancel={() => { if (!busy) onClose() }} onOk={() => void submit()} confirmLoading={busy} okText={action === 'export' ? '确认导出演示软件卡' : '确认操作'} cancelText="取消" maskClosable={false} closable={!busy} cancelButtonProps={{ disabled: busy }} okButtonProps={{ disabled: blocked || candidatesBusy, danger: action === 'retire' }}>
    <Alert showIcon type="info" message={action === 'replace' ? '只允许为尚未交付、未导出完整码的已分配卡，选用同类型可用库存补发。旧卡仅在总部库存停发，不代表供应商作废。' : action === 'export' ? '完整码导出会标记已披露，后续补发需供应商核验。本次只导出演示码，不提供真实外部激活。' : action === 'deliver' ? '只记录总部Mock交付结果，不会发送短信、修改订单付款状态或开通学习会员权益；外部激活状态保持待核验。' : action === 'retire' ? '库存停发仅阻止总部再次分配，不会向供应商发送作废指令。' : '软件卡与会员/专栏码完全独立；有效期与激活行为由外部供应商定义。'} />
    {selected.length > 0 && <Typography.Paragraph style={{ marginTop: 12 }}>已选 {selected.length} 张卡：{[...new Set(selected.map(card => card.typeName))].join('、')}</Typography.Paragraph>}
    {error && <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}><Alert type="error" message={error} role="alert" />{blocked && <Button onClick={() => { onClose(); onRefresh() }}>关闭并刷新</Button>}</Space>}
    <Form name="softwareCardOperation" form={form} layout="vertical" requiredMark={false} disabled={busy || blocked} initialValues={{ businessCode: '', name: '', termLabel: '供应商定义，待接入', systemLabel: '外部软件系统（待对接）', description: '', active: true, source: 'mock', sourceName: 'Mock供应商', referenceNo: '', demoQuantity: 2, ...type }} style={{ marginTop: 20 }}>
      {action === 'save-type' && <><Form.Item name="businessCode" label="稳定业务编码" rules={[{ required: true, pattern: /^[A-Z][A-Z0-9_]{1,30}$/, message: '使用2–31位大写字母、数字和下划线，首位为字母' }]}><Input disabled={!!type} maxLength={31} /></Form.Item><Form.Item name="name" label="软件卡类型名称" rules={[{ required: true, whitespace: true, max: 60 }]}><Input maxLength={60} /></Form.Item><Form.Item name="termLabel" label="有效期规则说明（仅展示，不计算月卡计时）" rules={[{ required: true, whitespace: true, max: 100 }]}><Input maxLength={100} /></Form.Item><Form.Item name="systemLabel" label="外部系统说明"><Input maxLength={100} /></Form.Item><Form.Item name="description" label="类型说明"><Input.TextArea maxLength={500} rows={2} /></Form.Item><Form.Item name="active" label="允许新增录入与分配" valuePropName="checked"><Switch /></Form.Item></>}
      {action === 'import' && <><Form.Item name="name" label="批次名称" rules={[{ required: true, whitespace: true, max: 60 }]}><Input maxLength={60} /></Form.Item><Form.Item name="typeId" label="软件卡类型" rules={[{ required: true, message: '请选择启用类型' }]}><Select options={catalog.types.filter(type => type.active).map(type => ({ value: type.typeId, label: type.name }))} /></Form.Item><Form.Item name="source" label="发码来源（演示记录）" rules={[{ required: true }]}><Select options={[{ value: 'mock', label: 'Mock演示来源' }, { value: 'supplier', label: '供应商来源（仅演示登记）' }, { value: 'hq', label: '总部录入（仅演示登记）' }]} /></Form.Item><Form.Item name="sourceName" label="来源名称" rules={[{ required: true, whitespace: true, max: 100 }]}><Input maxLength={100} /></Form.Item><Form.Item name="referenceNo" label="来源参考编号（不代表真实收货凭证）"><Input maxLength={100} /></Form.Item><Space style={{ marginBottom: 12 }}><Form.Item name="demoQuantity" label={`填充数量（Mock上限${catalog.options.maxImportSize}）`} style={{ marginBottom: 0 }}><InputNumber min={1} max={catalog.options.maxImportSize} precision={0} /></Form.Item><Button onClick={() => { const quantity = form.getFieldValue('demoQuantity'); if (!Number.isInteger(quantity) || quantity < 1 || quantity > catalog.options.maxImportSize) return; form.setFieldValue('codesText', Array.from({ length: quantity }, () => `DEMO-SW-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`).join('\n')) }}>填充演示码</Button></Space><Form.Item name="codesText" label="演示软件卡号（每行一个，仅接受DEMO-SW-前缀）" rules={[{ required: true, whitespace: true, message: '请输入演示码或点击填充演示码' }]}><Input.TextArea rows={5} placeholder="禁止输入真实供应商卡号或会员/专栏码" /></Form.Item><Form.Item name="claimValidity" label="领用截止策略（不等于外部激活有效期）" rules={[{ required: true, message: '请选择领用策略' }]}><Select options={[{ value: 'none', label: '不设领用截止时间' }, { value: 'until', label: '指定领用截止时间（UTC+8）' }]} /></Form.Item>{validity === 'until' && <Form.Item name="claimLocal" label="领用截止时间（北京时间）" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item>}</>}
      {action === 'assign' && <><Alert style={{ marginBottom: 16 }} type="warning" message="仅有演示订单；订单关联须匹配付款、账号、卡类型和交付快照。无订单的总部人工分配也不会修改任何订单状态。" /><Form.Item name="accountId" label="购买账号 / 交付账号" rules={[{ required: true, message: '请选择账号' }]}><Select showSearch optionFilterProp="label" options={catalog.options.accounts.map(account => ({ value: account.accountId, label: `${account.name} · ${account.phone} · ${account.accountId}` }))} onChange={id => { const account = catalog.options.accounts.find(item => item.accountId === id); form.setFieldsValue({ sourceOrderId: undefined, deliveryMode: account?.storeId ? 'store' : undefined, deliveryStoreId: account?.storeId ?? undefined }) }} /></Form.Item><Form.Item name="sourceOrderId" label="关联演示软件卡订单（可选）"><Select allowClear disabled={!accountId} placeholder="不关联订单，由总部填写原因" options={catalog.options.orders.filter(order => order.accountId === accountId && selected.every(card => card.typeId === order.typeId)).map(order => ({ value: order.orderId, label: `${order.orderNo} · ${order.status === 'PAID' ? '演示已付款' : '演示待付款'} · 可分配${order.remainingQuantity}张`, disabled: order.status !== 'PAID' || order.remainingQuantity < selected.length }))} onChange={id => { const order = catalog.options.orders.find(item => item.orderId === id); if (order) form.setFieldsValue({ deliveryMode: order.deliveryMode, deliveryStoreId: order.deliveryStoreId ?? undefined }) }} /></Form.Item><Form.Item name="deliveryMode" label="交付方" rules={[{ required: true, message: '请选择交付方' }]}><Select disabled={!!orderId} options={[{ value: 'hq', label: '总部交付' }, { value: 'store', label: '门店交付' }]} onChange={value => { if (value === 'hq') form.setFieldValue('deliveryStoreId', undefined) }} /></Form.Item>{mode === 'store' && <Form.Item name="deliveryStoreId" label="交付门店" rules={[{ required: true, message: '请选择门店' }]}><Select disabled={!!orderId} options={catalog.options.stores.filter(store => store.active).map(store => ({ value: store.storeId, label: store.name }))} /></Form.Item>}</>}
      {action === 'replace' && <><Typography.Paragraph type="secondary">原卡：{selected[0].cardId}。新卡继承账号、订单和交付方，仍为待交付。</Typography.Paragraph><Form.Item name="replacementCardId" label="同类型替代库存" rules={[{ required: true, message: '请选择有效的同类型库存' }]}><Select loading={candidatesBusy} showSearch optionFilterProp="label" placeholder="选择未导出、未过领用期的可用库存" options={candidates.map(card => ({ value: card.cardId, label: `${card.maskedCode} · ${card.cardId}` }))} /></Form.Item>{!candidatesBusy && !candidates.length && <Alert type="warning" message="没有符合条件的替代库存，请先录入同类型演示卡。" />}</>}
      <Form.Item name="reason" label="操作原因" rules={[{ required: true, whitespace: true, message: '请填写操作原因' }, { max: 200 }]}><Input.TextArea rows={3} maxLength={200} showCount /></Form.Item>
    </Form><Typography.Text type="secondary" style={{ fontSize: 12 }}>请求号：{requestId}</Typography.Text>
  </Modal>
}
