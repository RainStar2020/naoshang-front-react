import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { activationCodesService } from '../services/activationCodes'
import type { HqPermission } from '../types/auth'
import type { ActivationAudit, ActivationBatch, ActivationCode, ActivationFilters, ActivationList, ActivationMutationResult, ActivationOptions, ActivationQuery } from '../types/activationCodes'
import ActivationCodeModal, { activationActionNames, type CodeModalAction } from '../components/ActivationCodeModal'
import ActivationCodeDetail, { codeStatusNames } from '../components/ActivationCodeDetail'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

export default function ActivationCodes() {
  const { session } = useAuth()
  const { token, account } = session!
  const [form] = Form.useForm<ActivationFilters>()
  const [query, setQuery] = useState<ActivationQuery>({ page: 1, pageSize: 10 })
  const [result, setResult] = useState<ActivationList | null>(null)
  const [options, setOptions] = useState<ActivationOptions | null>(null)
  const [batches, setBatches] = useState<ActivationBatch[]>([])
  const [audit, setAudit] = useState<ActivationAudit[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState('codes')
  const [selected, setSelected] = useState<ActivationCode[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ action: CodeModalAction; codes: ActivationCode[] } | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const reload = () => setRefresh(value => value + 1)
  useEffect(() => {
    let alive = true; setMetaError(null)
    Promise.all([activationCodesService.options(token), activationCodesService.batches(token), activationCodesService.audit(token)]).then(([a, b, c]) => { if (alive) { setOptions(a); setBatches(Array.isArray(b) ? b : []); setAudit(Array.isArray(c) ? c : []) } }).catch(err => { if (alive) { setOptions(null); setMetaError(err instanceof Error ? err.message : '选项加载失败') } })
    return () => { alive = false }
  }, [token, refresh])
  useEffect(() => {
    let alive = true; setBusy(true); setError(null); setResult(null); setSelected([])
    activationCodesService.list(token, query).then(value => { if (alive) setResult(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '加载失败') }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [token, query, refresh])
  const permissions: Record<CodeModalAction, HqPermission> = { generate: 'activation:generate', issue: 'activation:issue', revoke: 'activation:revoke', reissue: 'activation:reissue', 'set-expiry': 'activation:expiry', export: 'activation:export' }
  const canSelect = (['issue', 'revoke', 'reissue', 'set-expiry', 'export'] as const).some(action => hasPermission(account, permissions[action]))
  const eligible = (action: CodeModalAction) => selected.length > 0 && selected.length <= (options?.maxSelectionSize ?? 0) && selected.every(code => {
    if (action === 'export') return true
    if (action === 'reissue') return code.status !== 'used' && !code.replacementCodeId
    if (action === 'issue') return ['unused', 'issued'].includes(code.status) && !code.issuedToAccountId && !code.replacementCodeId
    return !['used', 'revoked'].includes(code.status)
  })
  const done = (value: ActivationMutationResult | null) => {
    const action = modal?.action
    setModal(null); setSelected([]); reload()
    if (value?.batchId && action === 'generate') { form.resetFields(); form.setFieldValue('batchId', value.batchId); setQuery({ batchId: value.batchId, page: 1, pageSize: 10 }); setTab('codes') }
    messageApi.success(action === 'export' ? '所选完整演示码已导出，操作记录已保存' : 'Mock操作已完成；分发/补发不会直接开通权益')
  }
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{contextHolder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>会员 / 专栏激活码</Typography.Title><Typography.Text type="secondary">管理会员/专栏激活码批次、分发、补发与使用追溯；与软件卡发码为两套独立系统，禁止串权。</Typography.Text></div><Space><Button onClick={reload} loading={busy}>刷新</Button>{hasPermission(account, 'activation:generate') && <Button type="primary" disabled={!options} onClick={() => setModal({ action: 'generate', codes: [] })}>批量生成</Button>}</Space></div>
    <HqDataSourceAlert mockMessage="内存Mock：DEMO码不能用于真实小程序，整页刷新会重置。本页仅会员/专栏激活码，不可录入或分发软件卡；没有替用户激活的操作。绑定/转赠与批量上限待正式API确认。" />
    {metaError && <Alert type="error" message={metaError} action={<Button onClick={reload}>重试选项</Button>} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: 'codes', label: '激活码列表', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card variant="borderless"><Form form={form} name="activationFilters" layout="vertical" onFinish={values => setQuery({ ...values, keyword: values.keyword?.trim(), page: 1, pageSize: query.pageSize })}><div className="user-filter-grid">
          <Form.Item name="keyword" label="码或交付对象"><Input allowClear placeholder="码ID / 脱敏码 / 交付对象 / 来源订单ID" /></Form.Item>
          <Form.Item name="batchId" label="批次"><Select allowClear showSearch optionFilterProp="label" placeholder="全部批次" options={(batches ?? []).map(batch => ({ value: batch.batchId, label: batch.name }))} /></Form.Item>
          <Form.Item name="codeType" label="类型"><Select allowClear placeholder="全部类型" options={[{ value: 'membership-tier', label: '会员等级码' }, { value: 'column', label: '专栏码' }]} /></Form.Item>
          <Form.Item name="status" label="状态"><Select allowClear placeholder="全部状态" options={Object.entries(codeStatusNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="targetId" label="目标权益"><Select allowClear showSearch optionFilterProp="label" placeholder="全部目标" options={(options?.targets ?? []).map(target => ({ value: target.targetId, label: target.name }))} /></Form.Item>
          <Form.Item name="storeId" label="交付门店"><Select allowClear placeholder="全部门店" options={(options?.stores ?? []).map(store => ({ value: store.storeId, label: store.name }))} /></Form.Item>
        </div><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { form.resetFields(); setQuery({ page: 1, pageSize: 10 }) }}>重置筛选</Button></Space></Form></Card>
        <Card variant="borderless" title="激活码列表" extra={<Typography.Text type="secondary">{result ? `共 ${result.total} 个码` : '—'}</Typography.Text>}>
          {canSelect && <Space wrap style={{ marginBottom: 16 }}><Typography.Text>当前页已选 {selected.length} 个</Typography.Text>{(['issue', 'set-expiry', 'revoke', 'reissue', 'export'] as const).filter(action => hasPermission(account, permissions[action])).map(action => <Button key={action} disabled={!options || !eligible(action)} danger={action === 'revoke'} onClick={() => setModal({ action, codes: structuredClone(selected) })}>{activationActionNames[action]}</Button>)}</Space>}
          {error ? <Alert type="error" message={error} action={<Button onClick={reload}>重新加载</Button>} /> : <Table<ActivationCode> rowKey="codeId" size="middle" dataSource={result?.items ?? []} loading={busy} scroll={{ x: 1200 }} rowSelection={canSelect ? { selectedRowKeys: selected.map(code => code.codeId), onChange: (_, rows) => setSelected(rows) } : undefined} pagination={{ current: query.page, pageSize: query.pageSize, total: result?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `共 ${total} 个码`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page: pageSize === value.pageSize ? page : 1, pageSize })) }} locale={{ emptyText: '暂无符合条件的激活码' }} columns={[
            { title: '脱敏码 / ID', key: 'code', width: 220, render: (_, code) => <>{code.maskedCode}<br /><Typography.Text type="secondary">{code.codeId}</Typography.Text></> },
            { title: '类型 / 目标', key: 'target', width: 190, render: (_, code) => <>{code.codeType === 'membership-tier' ? '会员等级码' : '专栏码'}<br />{code.targetName}</> },
            { title: '状态 / 版本', key: 'status', width: 120, render: (_, code) => <><Tag color={code.status === 'used' ? 'green' : code.status === 'revoked' || code.status === 'expired' ? 'red' : 'blue'}>{codeStatusNames[code.status]}</Tag><div>V{code.version}</div></> },
            { title: '交付对象', dataIndex: 'issuedTo', width: 180, render: value => value ?? '未分发' },
            { title: '码有效期', key: 'expires', width: 170, render: (_, code) => code.expiresAt ? formatUserDate(code.expiresAt) : '不设到期时间' },
            { title: '使用记录', key: 'used', width: 170, render: (_, code) => code.usedAt ? <>{code.usedByAccountId}<br />{code.usedByMemberId ?? '账号专栏'}<br />{formatUserDate(code.usedAt)}</> : '未使用' },
            { title: '操作', key: 'action', width: 90, fixed: 'right', render: (_, code) => <Button type="link" size="small" onClick={() => setDetailId(code.codeId)}>详情</Button> },
          ]} />}
        </Card>
      </Space> },
      { key: 'batches', label: `批次（${batches.length}）`, children: <Table rowKey="batchId" dataSource={batches} scroll={{ x: 900 }} pagination={{ pageSize: 10 }} columns={[
        { title: '批次 / ID', key: 'batch', render: (_, batch) => <>{batch.name}<br /><Typography.Text type="secondary">{batch.batchId}</Typography.Text></> }, { title: '目标', dataIndex: 'targetName' }, { title: '初始生成数量', dataIndex: 'quantity' }, { title: '批次有效期', key: 'expires', render: (_, batch) => batch.expiresAt ? formatUserDate(batch.expiresAt) : '不设到期时间' }, { title: '创建人 / 时间', key: 'creator', render: (_, batch) => <>{batch.createdBy}<br />{formatUserDate(batch.createdAt)}</> }, { title: '操作', key: 'action', render: (_, batch) => <Button type="link" onClick={() => { form.resetFields(); form.setFieldValue('batchId', batch.batchId); setQuery({ batchId: batch.batchId, page: 1, pageSize: 10 }); setTab('codes') }}>查看本批次码</Button> },
      ]} /> },
      { key: 'audit', label: `操作记录（${audit.length}）`, children: <Table rowKey="operationId" size="small" dataSource={audit} scroll={{ x: 1000 }} pagination={{ pageSize: 10 }} columns={[
        { title: '操作 / 时间', key: 'action', render: (_, item) => <>{activationActionNames[item.action]}<br />{formatUserDate(item.occurredAt)}</> }, { title: '涉及码数（含新旧码）', key: 'count', render: (_, item) => (item.codeIds ?? []).length }, { title: '变更 / 原因', key: 'change', render: (_, item) => <><div>{item.before} → {item.after}</div><div>{item.reason}</div><Typography.Text type="secondary">请求号：{item.requestId}</Typography.Text></> }, { title: '操作人', key: 'operator', render: (_, item) => <>{item.operatorName}<br />{item.operatorId}</> },
      ]} /> },
    ]} />
    {detailId && <ActivationCodeDetail codeId={detailId} token={token} refresh={refresh} onClose={() => setDetailId(null)} />}
    {modal && options && <ActivationCodeModal action={modal.action} codes={modal.codes} options={options} token={token} onClose={() => setModal(null)} onRefresh={reload} onDone={done} />}
  </Space>
}
