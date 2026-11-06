import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Drawer, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { quotasService as service } from '../services/quotas'
import { QuotaError, type QuotaBalance, type QuotaDetail, type QuotaLedger, type QuotaOwner, type QuotaQuery, type QuotaRechargeInput, type QuotaType } from '../types/quotas'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'
import { isMockAuth } from '../services/auth'
const typeLabels = { STANDARD: '标准名额', ACTIVITY: '活动名额' }
const levelLabels = { 'DEMO-VIP': 'VIP', 'DEMO-ANGEL': '天使', 'DEMO-BOARD': '私董', 'DEMO-FOUNDER': '联创' }
const sourceLabels = { PURCHASE: '购买', ACTIVITY_GRANT: '活动发放', HQ_RECHARGE: '总部充值', TRANSFER: '标准划入' }
const kindLabels = { PURCHASE: '购买到账', ACTIVITY_GRANT: '活动发放', HQ_RECHARGE: '总部充值', RESERVE: '付款前占用', RELEASE: '未付取消释放', CONSUME: '支付后消耗', TRANSFER_OUT: '标准划出', TRANSFER_IN: '标准划入' }
const orderLabels = { UNPAID: '待支付', PAID: '支付成功', CANCELLED: '未付已取消' }
const money = (value: number) => `¥${(value / 100).toFixed(2)}`
function amounts(value: QuotaBalance) { return `可用${value.remaining} / 占用${value.reserved} / 已用${value.used} / 已划出${value.transferred}` }
function balanceColumns() { return [{ title: '类型', dataIndex: 'quotaType', render: (type: QuotaType) => <Tag color={type === 'ACTIVITY' ? 'purple' : 'blue'}>{typeLabels[type]}</Tag> }, { title: '累计入账', dataIndex: 'total' }, { title: '可用', dataIndex: 'remaining' }, { title: '占用', dataIndex: 'reserved' }, { title: '已消耗', dataIndex: 'used' }, { title: '已划出', dataIndex: 'transferred' }] }
export default function Quotas() {
  const { session } = useAuth(); const { token, account } = session!
  const canRecharge = hasPermission(account, 'quotas:recharge')
  const [query, setQuery] = useState<QuotaQuery>({ page: 1, pageSize: 10 }), [list, setList] = useState<Awaited<ReturnType<typeof service.list>> | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0)
  const [ownerId, setOwnerId] = useState<string | null>(null), [detail, setDetail] = useState<QuotaDetail | null>(null), [detailError, setDetailError] = useState(''), [quotaType, setQuotaType] = useState<QuotaType | undefined>(), [ledgerKind, setLedgerKind] = useState<QuotaLedger['kind'] | undefined>(), [recordKeyword, setRecordKeyword] = useState('')
  const [rechargeOwner, setRechargeOwner] = useState<QuotaOwner | null>(null), [type, setType] = useState<QuotaType | undefined>(), [quantity, setQuantity] = useState<number | null>(null), [reason, setReason] = useState(''), [pending, setPending] = useState<QuotaRechargeInput | null>(null), [busy, setBusy] = useState(false), [submitError, setSubmitError] = useState(''), [blocked, setBlocked] = useState(false)
  const [api, holder] = message.useMessage()
  useEffect(() => { let alive = true; setLoading(true); setList(null); setError(''); service.list(token, query).then(value => { if (alive) setList(value) }).catch(err => { if (alive) setError(err.message) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [token, query, refresh])
  useEffect(() => { let alive = true; setDetail(null); setDetailError(''); if (ownerId) service.detail(token, ownerId).then(value => { if (alive) setDetail(value) }).catch(err => { if (alive) setDetailError(err.message) }); return () => { alive = false } }, [token, ownerId, refresh])
  function openDetail(id: string) { setOwnerId(id); setQuotaType(undefined); setLedgerKind(undefined); setRecordKeyword('') }
  function openRecharge(row: QuotaOwner) { setRechargeOwner(row); setType(undefined); setQuantity(null); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }
  function prepare() {
    if (!rechargeOwner || !type || !quantity || !Number.isSafeInteger(quantity) || quantity < 1) { setSubmitError('请选择名额类型，并填写正整数数量'); return }
    if (quantity > rechargeOwner.eligibility.perOperationLimit || quantity > rechargeOwner.eligibility.remainingLimit) { setSubmitError('数量超过服务返回的单次或剩余授权限额'); return }
    if (!reason.trim()) { setSubmitError('请填写操作原因'); return } setSubmitError(''); setPending({ targetAccountId: rechargeOwner.ownerAccountId, quotaType: type, quantity, reason: reason.trim(), version: rechargeOwner.version, idempotencyKey: crypto.randomUUID() })
  }
  async function submit() {
    if (!pending || busy || blocked) return; setBusy(true); setSubmitError('')
    try { await service.recharge(token, pending); setRechargeOwner(null); setPending(null); setOwnerId(pending.targetAccountId); setRefresh(value => value + 1); api.success('Mock充值完成，批次与操作记录已保存') }
    catch (err) { setSubmitError(err instanceof Error ? err.message : '充值结果未知，请使用原请求重试'); if (err instanceof QuotaError) setBlocked(true) }
    finally { setBusy(false) }
  }
  const matches = (row: { quotaType: QuotaType; sourceOrderId?: string | null; batchId?: string | null; operationId?: string }) => (!quotaType || row.quotaType === quotaType) && (!recordKeyword.trim() || `${row.sourceOrderId ?? ''} ${row.batchId ?? ''} ${row.operationId ?? ''}`.toLowerCase().includes(recordKeyword.trim().toLowerCase()))
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}
    <Space style={{ width: '100%', justifyContent: 'space-between' }}><div><Typography.Title level={3} style={{ margin: 0 }}>VIP名额批次、流水与总部充值</Typography.Title><Typography.Text type="secondary">总部名额查询与受控充值（监管配置）；不替代小程序日常购买/划转申请。</Typography.Text></div><Button onClick={() => setRefresh(value => value + 1)}>刷新</Button></Space>
    <HqDataSourceAlert mockMessage="内存Mock，整页刷新恢复演示数据，尚未同步小程序。标准/活动名额均永久有效；活动名额不可转让、不可退款。充值须原因/版本/幂等/确认，禁止前端推导入账终态。" mockDescription="活动升级服务费按每个¥2,000.00的服务报价展示；付款前仅占用，成功后才消耗。总部不提供个人购买、划转、代付或退款操作。" />
    <Card><Space wrap><Input aria-label="名额所属账号搜索" placeholder="昵称 / 手机号 / 账号编号" allowClear value={query.keyword} onChange={event => setQuery(value => ({ ...value, keyword: event.target.value, page: 1 }))} style={{ width: 290 }} /><Select aria-label="筛选充值资格" allowClear placeholder="全部充值资格" value={query.eligibility} onChange={eligibility => setQuery(value => ({ ...value, eligibility, page: 1 }))} style={{ width: 220 }} options={[{ value: 'ALLOWED', label: '当前可总部充值' }, { value: 'DENIED', label: '当前不可总部充值' }]} /><Button onClick={() => setQuery({ page: 1, pageSize: 10 })}>重置筛选</Button></Space></Card>
    {error && <Alert type="error" showIcon message={error} />}
    {list && <Space wrap size={36}>{[{ title: '名额账户数', value: list.summary.owners }, { title: '总名额', value: list.summary.totalQuota }, { title: '冻结名额', value: list.summary.frozenQuota }, { title: '标准合计', value: list.summary.standardRemaining }, { title: '活动合计', value: list.summary.activityRemaining }, { title: '当前可充值', value: list.summary.rechargeable }].map(item => <Statistic key={item.title} {...item} />)}</Space>}
    <Card title="VIP名额账户"><Table<QuotaOwner> rowKey={(row) => row.quotaId || row.ownerAccountId} loading={loading} dataSource={list?.items ?? []} scroll={{ x: 1200 }} pagination={{ current: query.page, pageSize: query.pageSize, total: list?.total ?? 0, showSizeChanger: true, pageSizeOptions: [5, 10, 20], showTotal: total => `共${total}个账号`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page, pageSize })) }} columns={[
      { title: '账户姓名手机号', key: 'account', width: 160, render: (_, row) => <><div>{row.name || '—'}</div><Typography.Text type="secondary">{row.phone || '—'}</Typography.Text></> },
      { title: '用户ID', dataIndex: 'displayId', width: 140, render: (value: string) => value || '—' },
      { title: '总名额', dataIndex: 'quotaTotal', width: 100 },
      { title: 'VIP名额', dataIndex: 'standard', width: 100 },
      { title: '活动名额', dataIndex: 'activityTotal', width: 100 },
      { title: '已花费名额', dataIndex: 'spent', width: 110 },
      { title: '剩余有效名额', dataIndex: 'available', width: 120 },
      { title: '操作', key: 'action', fixed: 'right', width: 140, render: (_, row) => <Space direction="vertical"><Button size="small" onClick={() => openDetail(row.ownerAccountId || row.quotaId)}>VIP明细</Button>{canRecharge && (row.allowedActions?.includes('adjust') || row.eligibility.canRecharge) && <Button size="small" type="primary" onClick={() => openRecharge(row)}>充值</Button>}</Space> },
    ]} /></Card>
    <Drawer title="名额余额、批次与流水" width={1150} open={!!ownerId} onClose={() => setOwnerId(null)}>
      {detailError && <Alert type="error" message={detailError} />}{!detail && !detailError && <Typography.Text>正在加载名额档案…</Typography.Text>}
      {detail && <Space direction="vertical" size={18} style={{ width: '100%' }}>
        {canRecharge && detail.owner.eligibility.canRecharge && <Button type="primary" onClick={() => openRecharge(detail.owner)}>总部充值</Button>}
        <Descriptions bordered column={2} size="small" items={[{ key: 'owner', label: '所属账号', children: `${detail.owner.name} / ${detail.owner.ownerAccountId}` }, { key: 'phone', label: '手机号 / 编号', children: `${detail.owner.phone} / ${detail.owner.displayId}` }, { key: 'context', label: '经营身份', children: `${detail.owner.contextId} / ${levelLabels[detail.owner.partnerLevel]}` }, { key: 'qualification', label: '特定充值资格', children: detail.owner.eligibility.qualified ? '已获授权' : '未获授权' }, { key: 'allowed', label: '当前可充值', children: detail.owner.eligibility.canRecharge ? '是' : '否' }, { key: 'limit', label: '服务返回限额', span: 2, children: `单次${detail.owner.eligibility.perOperationLimit} / 授权剩余${detail.owner.eligibility.remainingLimit}；${detail.owner.eligibility.limitLabel}` }, { key: 'why', label: '资格说明', span: 2, children: detail.owner.eligibility.reason }]} />
        <Table<QuotaBalance> size="small" rowKey="quotaType" dataSource={detail.owner.balances} pagination={false} columns={balanceColumns()} />
        <Space wrap><Select aria-label="名额明细类型" allowClear placeholder="全部名额类型" value={quotaType} style={{ width: 180 }} onChange={setQuotaType} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /><Input aria-label="名额关联记录搜索" placeholder="批次号 / 订单号 / 操作号" allowClear value={recordKeyword} onChange={event => setRecordKeyword(event.target.value)} style={{ width: 280 }} /></Space>
        <Tabs items={[
          { key: 'batches', label: `批次（${detail.batches.length}）`, children: <Table size="small" rowKey="batchId" scroll={{ x: 1100 }} dataSource={detail.batches.filter(matches)} pagination={{ pageSize: 5, showSizeChanger: false }} columns={[
            { title: '批次标题', dataIndex: 'title', width: 140, ellipsis: true },
            { title: '批次ID', dataIndex: 'batchId', width: 160 },
            { title: '来源', key: 'source', width: 100, render: (_, row) => sourceLabels[row.source] },
            { title: '创建时间', key: 'createdAt', width: 160, render: (_, row) => formatUserDate(row.createdAt) },
            { title: '来源订单', key: 'sourceOrderId', width: 140, render: (_, row) => row.sourceOrderId ?? '—' },
            { title: '操作号', dataIndex: 'operationId', width: 140 },
            ...balanceColumns(),
            { title: '有效期', key: 'valid', width: 100, render: () => <Tag color="green">永久有效</Tag> },
            { title: '限制', key: 'limit', width: 180, render: (_, row) => row.transferable ? '标准名额可按API规则划转' : '不可转让、不可退款' },
          ]} /> },
          { key: 'ledger', label: `名额流水（${(detail.ledger ?? []).length}）`, children: <Space direction="vertical" style={{ width: '100%' }}><Select aria-label="筛选名额流水类型" allowClear placeholder="全部流水类型" style={{ width: 200 }} value={ledgerKind} onChange={setLedgerKind} options={Object.entries(kindLabels).map(([value, label]) => ({ value, label }))} /><Table<QuotaLedger> size="small" rowKey="ledgerId" scroll={{ x: 1800 }} dataSource={detail.ledger.filter(row => matches(row) && (!ledgerKind || row.kind === ledgerKind))} pagination={{ pageSize: 5, showSizeChanger: false }} columns={[
            { title: '业务', key: 'kind', width: 110, render: (_, row) => kindLabels[row.kind] },
            { title: '数量', dataIndex: 'quantity', width: 70 },
            { title: '名额类型', key: 'quotaType', width: 100, render: (_, row) => typeLabels[row.quotaType] },
            { title: '时间', key: 'createdAt', width: 160, render: (_, row) => formatUserDate(row.createdAt) },
            { title: '批次', dataIndex: 'batchId', width: 140 },
            { title: '操作号', dataIndex: 'operationId', width: 140 },
            { title: '请求号', dataIndex: 'requestId', width: 140 },
            { title: '订单', key: 'sourceOrderId', width: 140, render: (_, row) => row.sourceOrderId ?? '—' },
            { title: '对方账号', key: 'targetAccountId', width: 140, render: (_, row) => row.targetAccountId ?? '—' },
            { title: '变更前余额', key: 'before', width: 160, render: (_, row) => amounts(row.before) },
            { title: '变更后余额', key: 'after', width: 160, render: (_, row) => amounts(row.after) },
            { title: '操作人', dataIndex: 'operatorName', width: 100 },
            { title: '原因', dataIndex: 'reason', width: 160, ellipsis: true },
          ]} /></Space> },
          { key: 'orders', label: `购买与占用订单（${detail.orders.length}）`, children: <Table size="small" rowKey="orderId" scroll={{ x: 1000 }} dataSource={detail.orders.filter(row => matches({ ...row, sourceOrderId: row.orderId }))} pagination={{ pageSize: 5, showSizeChanger: false }} columns={[
            { title: '订单号', dataIndex: 'orderId', width: 180 },
            { title: '类型', key: 'kind', width: 140, render: (_, row) => row.kind === 'PURCHASE' ? '标准名额购买' : '活动升级服务费' },
            { title: '数量', dataIndex: 'quantity', width: 70 },
            { title: '备注', dataIndex: 'note', width: 140, ellipsis: true },
            { title: '支付状态', key: 'status', width: 110, render: (_, row) => <Tag color={row.status === 'PAID' ? 'green' : 'default'}>{orderLabels[row.status]}</Tag> },
            { title: '支付回执', key: 'receipt', width: 160, render: (_, row) => row.paymentReceiptId ?? '尚无支付成功回执' },
            { title: '单价', key: 'unit', width: 100, render: (_, row) => money(row.unitAmount) },
            { title: '应付', key: 'payable', width: 100, render: (_, row) => money(row.payableAmount) },
            { title: '目标账号', key: 'target', width: 140, render: (_, row) => row.targetAccountId ?? '—' },
            { title: '更新时间', dataIndex: 'updatedAt', render: formatUserDate },
          ]} /> },
          { key: 'recharges', label: `总部充值记录（${detail.recharges.length}）`, children: <Table size="small" rowKey="operationId" scroll={{ x: 1100 }} dataSource={detail.recharges.filter(matches)} pagination={{ pageSize: 5, showSizeChanger: false }} columns={[
            { title: '名额类型', key: 'quotaType', width: 100, render: (_, row) => typeLabels[row.quotaType] },
            { title: '数量', dataIndex: 'quantity', width: 70 },
            { title: '操作号', dataIndex: 'operationId', width: 140 },
            { title: '请求号', dataIndex: 'requestId', width: 140 },
            { title: '批次', dataIndex: 'batchId', width: 140 },
            { title: '对象账号', dataIndex: 'targetAccountId', width: 140 },
            { title: '变更前余额', key: 'before', width: 150, render: (_, row) => amounts(row.before) },
            { title: '变更前版本', key: 'beforeVersion', width: 100, render: (_, row) => `V${row.beforeVersion}` },
            { title: '变更后余额', key: 'after', width: 150, render: (_, row) => amounts(row.after) },
            { title: '变更后版本', key: 'afterVersion', width: 100, render: (_, row) => `V${row.afterVersion}` },
            { title: '操作人', dataIndex: 'operatorName', width: 100 },
            { title: '原因', dataIndex: 'reason', width: 140, ellipsis: true },
            { title: '时间', key: 'createdAt', width: 160, render: (_, row) => formatUserDate(row.createdAt) },
          ]} /> },
        ]} />
      </Space>}
    </Drawer>
    <Modal title="总部充值VIP名额" open={!!rechargeOwner} onCancel={() => { if (!busy) { setRechargeOwner(null); setPending(null) } }} footer={<Space><Button disabled={busy} onClick={() => { setRechargeOwner(null); setPending(null) }}>取消</Button><Button type="primary" onClick={prepare}>核对充值</Button></Space>}>
      {rechargeOwner && <Space direction="vertical" size={16} style={{ width: '100%' }}><Typography.Paragraph>{rechargeOwner.name} · {rechargeOwner.phone}<br />{rechargeOwner.ownerAccountId} / {rechargeOwner.contextId}<br />{levelLabels[rechargeOwner.partnerLevel]}</Typography.Paragraph><Alert type="info" message={`已获特定充值资格；单次上限${rechargeOwner.eligibility.perOperationLimit}，授权剩余${rechargeOwner.eligibility.remainingLimit}。`} description={rechargeOwner.eligibility.limitLabel} /><Select aria-label="充值名额类型" placeholder="明确选择标准或活动名额" value={type} style={{ width: '100%' }} onChange={setType} options={rechargeOwner.eligibility.allowedTypes.map(value => ({ value, label: typeLabels[value] }))} /><InputNumber aria-label="充值名额数量" placeholder="填写整数数量" min={1} max={Math.min(rechargeOwner.eligibility.perOperationLimit, rechargeOwner.eligibility.remainingLimit)} precision={0} value={quantity} onChange={setQuantity} style={{ width: '100%' }} /><Input.TextArea aria-label="名额充值原因" placeholder="填写总部充值原因" showCount maxLength={200} value={reason} onChange={event => setReason(event.target.value)} /><Typography.Text type="secondary">本次只调整名额，不修改合伙等级、年度期限、孩子权益或历史收益；所有类型永久有效，活动名额不可转让退款。</Typography.Text>{submitError && !pending && <Alert type="error" message={submitError} />}</Space>}
    </Modal>
    <Modal title="确认总部名额充值" open={!!pending} confirmLoading={busy} okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : (isMockAuth ? '确认Mock充值' : '确认充值')} okButtonProps={{ disabled: blocked }} cancelText={submitError ? '关闭并刷新' : '返回修改'} closable={!busy && (!submitError || blocked)} maskClosable={!busy && (!submitError || blocked)} cancelButtonProps={{ disabled: busy || !!submitError && !blocked }} onCancel={() => { if (!busy && (!submitError || blocked)) { if (submitError) { setRechargeOwner(null); setRefresh(value => value + 1) }; setPending(null); setSubmitError('') } }} onOk={submit}>
      {pending && <Space direction="vertical" style={{ width: '100%' }}><Typography.Paragraph>对象：{rechargeOwner?.name} / {pending.targetAccountId}<br />类型：{typeLabels[pending.quotaType]}<br />数量：{pending.quantity}个（永久有效）<br />备注：{pending.reason || '（无）'}</Typography.Paragraph><Typography.Text type="secondary">请求号：{pending.idempotencyKey}</Typography.Text>{submitError && <Alert type="error" message={submitError} />}</Space>}
    </Modal>
  </Space>
}
