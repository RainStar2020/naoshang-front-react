import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { softwareCardsService } from '../services/softwareCards'
import { softwareStockLabels, type SoftwareCard, type SoftwareCardType, type SoftwareCatalog, type SoftwareFilters, type SoftwareList, type SoftwareMutationResult, type SoftwareQuery } from '../types/softwareCards'
import SoftwareCardModal, { softwareActionNames, type SoftwareModalAction } from '../components/SoftwareCardModal'
import SoftwareCardDetail from '../components/SoftwareCardDetail'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

export default function SoftwareCards() {
  const { session } = useAuth()
  const { token, account } = session!
  const [form] = Form.useForm<SoftwareFilters>()
  const [catalog, setCatalog] = useState<SoftwareCatalog | null>(null)
  const [result, setResult] = useState<SoftwareList | null>(null)
  const [query, setQuery] = useState<SoftwareQuery>({ page: 1, pageSize: 10 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState('stock')
  const [selected, setSelected] = useState<SoftwareCard[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ action: SoftwareModalAction; selected: SoftwareCard[]; type?: SoftwareCardType } | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const reload = () => setRefresh(value => value + 1)
  useEffect(() => { let alive = true; setCatalogError(null); softwareCardsService.catalog(token).then(value => { if (alive) setCatalog(value) }).catch(err => { if (alive) { setCatalog(null); setCatalogError(err instanceof Error ? err.message : '配置加载失败') } }); return () => { alive = false } }, [token, refresh])
  useEffect(() => { let alive = true; setBusy(true); setError(null); setResult(null); setSelected([]); softwareCardsService.list(token, query).then(value => { if (alive) setResult(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '库存加载失败') }).finally(() => { if (alive) setBusy(false) }); return () => { alive = false } }, [token, query, refresh])
  const permissions: Record<SoftwareModalAction, HqPermission> = { 'save-type': 'software:types', import: 'software:import', assign: 'software:assign', deliver: 'software:deliver', retire: 'software:retire', replace: 'software:replace', export: 'software:export' }
  const actions = (['assign', 'deliver', 'retire', 'replace', 'export'] as const).filter(action => hasPermission(account, permissions[action]))
  const eligible = (action: SoftwareModalAction) => selected.length > 0 && selected.length <= (catalog?.options.maxSelectionSize ?? 0) && selected.every(card => {
    if (action === 'export') return true
    if (action === 'replace') return selected.length === 1 && card.status === 'assigned' && !card.secretExportedAt && card.externalStatus === 'unknown' && catalog?.types.some(type => type.typeId === card.typeId && type.active)
    if (action === 'assign') return card.status === 'available' && !card.claimExpired && catalog?.types.some(type => type.typeId === card.typeId && type.active)
    if (action === 'deliver') return card.status === 'assigned' && !card.claimExpired
    return ['available', 'assigned'].includes(card.status)
  })
  const done = (value: SoftwareMutationResult | null) => {
    const action = modal?.action
    setModal(null); setSelected([]); reload()
    if (value?.batchId && action === 'import') { form.resetFields(); form.setFieldValue('batchId', value.batchId); setQuery({ batchId: value.batchId, page: 1, pageSize: 10 }); setTab('stock') }
    messageApi.success(action === 'export' ? '完整演示软件卡已导出，已记录披露状态' : 'Mock操作已记录；未改变外部激活或学习权益')
  }
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{contextHolder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>软件卡发码管理</Typography.Title><Typography.Text type="secondary">独立软件卡系统：管理来源、库存与交付；不复用会员/专栏激活码，不开通学习权益，禁止与激活码串权。</Typography.Text></div><Space><Button loading={busy} onClick={reload}>刷新</Button>{hasPermission(account, 'software:import') && <Button type="primary" disabled={!catalog} onClick={() => setModal({ action: 'import', selected: [] })}>录入演示批次</Button>}</Space></div>
    <HqDataSourceAlert mockMessage="内存Mock：仅接受DEMO-SW演示码，整页刷新恢复数据。交付≠外部激活、停发≠供应商作废；不可当作会员/专栏激活码使用。外部激活、月卡计时和真实订单均未接通。" />
    {catalogError && <Alert type="error" message={catalogError} action={<Button onClick={reload}>重试配置</Button>} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: 'stock', label: '软件卡库存', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card variant="borderless"><Form form={form} name="softwareFilters" layout="vertical" onFinish={values => setQuery({ ...values, keyword: values.keyword?.trim(), page: 1, pageSize: query.pageSize })}><div className="user-filter-grid">
          <Form.Item name="keyword" label="库存搜索"><Input allowClear placeholder="库存ID / 脱敏码 / 账号昵称 / 订单ID" /></Form.Item>
          <Form.Item name="typeId" label="软件卡类型"><Select allowClear placeholder="全部类型" options={(catalog?.types ?? []).map(type => ({ value: type.typeId, label: type.name }))} /></Form.Item>
          <Form.Item name="batchId" label="批次"><Select allowClear showSearch optionFilterProp="label" placeholder="全部批次" options={(catalog?.batches ?? []).map(batch => ({ value: batch.batchId, label: batch.name }))} /></Form.Item>
          <Form.Item name="status" label="库存状态"><Select allowClear placeholder="全部状态" options={Object.entries(softwareStockLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="accountId" label="交付账号"><Select allowClear showSearch optionFilterProp="label" placeholder="全部账号" options={(catalog?.options?.accounts ?? []).map(account => ({ value: account.accountId, label: `${account.name} · ${account.accountId}` }))} /></Form.Item>
          <Form.Item name="deliveryMode" label="交付方"><Select allowClear placeholder="全部交付方" options={[{ value: 'hq', label: '总部' }, { value: 'store', label: '门店' }]} /></Form.Item>
          <Form.Item name="storeId" label="交付门店"><Select allowClear placeholder="全部门店" options={(catalog?.options?.stores ?? []).map(store => ({ value: store.storeId, label: store.name }))} /></Form.Item>
          <Form.Item name="claimState" label="领用期限"><Select allowClear placeholder="全部期限" options={[{ value: 'expired', label: '领用已到期' }, { value: 'valid', label: '未到期或不适用' }]} /></Form.Item>
        </div><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { form.resetFields(); setQuery({ page: 1, pageSize: 10 }) }}>重置筛选</Button></Space></Form></Card>
        <Card variant="borderless" title="软件卡库存" extra={<Typography.Text type="secondary">{result ? `共 ${result.total} 张卡` : '—'}</Typography.Text>}>
          {actions.length > 0 && <Space wrap style={{ marginBottom: 16 }}><Typography.Text>当前页已选 {selected.length} 张</Typography.Text>{actions.map(action => <Button key={action} disabled={!catalog || !eligible(action)} danger={action === 'retire'} onClick={() => setModal({ action, selected: structuredClone(selected) })}>{softwareActionNames[action]}</Button>)}</Space>}
          {error ? <Alert type="error" message={error} action={<Button onClick={reload}>重新加载</Button>} /> : <Table<SoftwareCard> rowKey="cardId" size="middle" loading={busy} dataSource={result?.items ?? []} scroll={{ x: 1300 }} rowSelection={actions.length ? { selectedRowKeys: selected.map(card => card.cardId), onChange: (_, rows) => setSelected(rows) } : undefined} locale={{ emptyText: '暂无符合条件的软件卡' }} pagination={{ current: query.page, pageSize: query.pageSize, total: result?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `共 ${total} 张卡`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page: pageSize === value.pageSize ? page : 1, pageSize })) }} columns={[
            { title: '脱敏码 / 库存ID', key: 'card', width: 220, render: (_, card) => <>{card.maskedCode}<br /><Typography.Text type="secondary">{card.cardId}</Typography.Text></> },
            { title: '软件卡类型', dataIndex: 'typeName', width: 140 },
            { title: '库存 / 披露状态', key: 'status', width: 180, render: (_, card) => <Space wrap size={[0, 4]}><Tag color={card.status === 'delivered' ? 'green' : 'blue'}>{softwareStockLabels[card.status]}</Tag>{card.claimExpired && <Tag color="red">领用已到期</Tag>}{card.secretExportedAt && <Tag color="orange">完整码已导出</Tag>}</Space> },
            { title: '外部激活状态', key: 'external', width: 140, render: () => <Typography.Text type="secondary">待供应商核验</Typography.Text> },
            { title: '账号 / 订单', key: 'account', width: 200, render: (_, card) => <>{card.accountName ?? '未分配'}<br /><Typography.Text type="secondary">{card.sourceOrderId ?? '未关联订单'}</Typography.Text></> },
            { title: '交付方', key: 'delivery', width: 160, render: (_, card) => card.deliveryMode === 'hq' ? '总部交付' : card.deliveryMode === 'store' ? (catalog?.options?.stores ?? []).find(store => store.storeId === card.deliveryStoreId)?.name ?? card.deliveryStoreId : '未配置' },
            { title: '领用截止', key: 'claim', width: 160, render: (_, card) => card.claimDeadline ? formatUserDate(card.claimDeadline) : '不设截止时间' },
            { title: '操作', key: 'action', fixed: 'right', width: 90, render: (_, card) => <Button type="link" size="small" onClick={() => setDetailId(card.cardId)}>详情</Button> },
          ]} />}
        </Card>
      </Space> },
      { key: 'types', label: `软件卡类型（${catalog?.types.length ?? 0}）`, children: <Card variant="borderless" title="软件卡类型" extra={hasPermission(account, 'software:types') && <Button type="primary" disabled={!catalog} onClick={() => setModal({ action: 'save-type', selected: [] })}>新建软件卡类型</Button>}><Table<SoftwareCardType> rowKey="typeId" dataSource={catalog?.types ?? []} pagination={false} scroll={{ x: 900 }} columns={[
        { title: '类型 / 编码', key: 'type', render: (_, type) => <>{type.name}<br /><Typography.Text type="secondary">{type.businessCode}</Typography.Text></> }, { title: '外部有效期说明', dataIndex: 'termLabel' }, { title: '外部系统说明', dataIndex: 'systemLabel' }, { title: '状态', key: 'active', render: (_, type) => <Tag color={type.active ? 'green' : 'default'}>{type.active ? '可新增录入/分配' : '已停用新分配'}</Tag> }, { title: '操作', key: 'action', render: (_, type) => hasPermission(account, 'software:types') ? <Button type="link" onClick={() => setModal({ action: 'save-type', selected: [], type })}>编辑</Button> : '只读' },
      ]} /></Card> },
      { key: 'batches', label: `批次与来源（${catalog?.batches.length ?? 0}）`, children: <Table rowKey="batchId" dataSource={catalog?.batches ?? []} scroll={{ x: 1000 }} pagination={{ pageSize: 10 }} columns={[
        { title: '批次', key: 'batch', render: (_, batch) => <>{batch.name}<br /><Typography.Text type="secondary">{batch.batchId}</Typography.Text></> }, { title: '导入时类型', dataIndex: 'typeName' }, { title: '来源 / 参考编号', key: 'source', render: (_, batch) => <>{batch.sourceName}<br />{batch.referenceNo || '未填写'}</> }, { title: '录入数量', dataIndex: 'quantity' }, { title: '领用截止', key: 'claim', render: (_, batch) => batch.claimDeadline ? formatUserDate(batch.claimDeadline) : '不设截止时间' }, { title: '录入人 / 时间', key: 'creator', render: (_, batch) => <>{batch.createdBy}<br />{formatUserDate(batch.createdAt)}</> }, { title: '操作', key: 'action', render: (_, batch) => <Button type="link" onClick={() => { form.resetFields(); form.setFieldValue('batchId', batch.batchId); setQuery({ batchId: batch.batchId, page: 1, pageSize: 10 }); setTab('stock') }}>查看库存</Button> },
      ]} /> },
      { key: 'audit', label: `操作记录（${catalog?.audit.length ?? 0}）`, children: <Table rowKey="operationId" size="small" dataSource={catalog?.audit ?? []} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} columns={[
        { title: '操作 / 时间', key: 'action', render: (_, entry) => <>{softwareActionNames[entry.action]}<br />{formatUserDate(entry.occurredAt)}</> }, { title: '涉及卡数', key: 'count', render: (_, entry) => entry.cardIds.length }, { title: '变更 / 原因', key: 'change', render: (_, entry) => <><div>{entry.before} → {entry.after}</div><div>{entry.reason}</div><Typography.Text type="secondary">请求号：{entry.requestId}</Typography.Text></> }, { title: '总部操作人', key: 'operator', render: (_, entry) => <>{entry.operatorName}<br />{entry.operatorId}</> },
      ]} /> },
    ]} />
    {detailId && <SoftwareCardDetail cardId={detailId} token={token} refresh={refresh} onClose={() => setDetailId(null)} />}
    {modal && catalog && <SoftwareCardModal action={modal.action} selected={modal.selected} type={modal.type} catalog={catalog} token={token} onClose={() => setModal(null)} onRefresh={reload} onDone={done} />}
  </Space>
}
