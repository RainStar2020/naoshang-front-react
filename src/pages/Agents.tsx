import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { agentsService as service } from '../services/agents'
import { AgentError, type AgentCatalog, type AgentDetail, type AgentList, type AgentMutation, type AgentQuery, type AgentTerritory, type RegionAgent } from '../types/agents'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
const statusLabel = { ACTIVE: '在职生效', SUSPENDED: '监管暂停', EXITED: '已退出' } as const
const levelLabel = { PROVINCE: '省级', CITY: '地市', DISTRICT: '区县' } as const

type Pending =
  | { kind: 'suspend' | 'resume'; agent: RegionAgent }
  | { kind: 'set-exclusivity'; territory: AgentTerritory; exclusive: boolean }

export default function Agents() {
  const { session } = useAuth()
  const { token, account } = session!
  const canManage = hasPermission(account, 'agents:manage')
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null)
  const [list, setList] = useState<AgentList | null>(null)
  const [query, setQuery] = useState<AgentQuery>({ page: 1, pageSize: 10 })
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AgentDetail | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reason, setReason] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    let alive = true
    setBusy(true); setError(null)
    Promise.all([service.catalog(token), service.list(token, { ...query, keyword: keyword.trim() || undefined })])
      .then(([c, l]) => { if (alive) { setCatalog(c); setList(l) } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : '加载失败') })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [token, query, keyword, refresh])

  useEffect(() => {
    if (!detailId) { setDetail(null); return }
    let alive = true
    service.detail(token, detailId).then((d) => { if (alive) setDetail(d) }).catch((err) => { if (alive) messageApi.error(err instanceof Error ? err.message : '详情加载失败') })
    return () => { alive = false }
  }, [token, detailId, refresh, messageApi])

  const territoryName = useMemo(() => {
    const map = new Map((catalog?.territories ?? []).map((t) => [t.territoryId, t.name]))
    return (ids: string[]) => ids.map((id) => map.get(id) ?? id).join('、') || '—'
  }, [catalog])

  const openPending = (value: Pending) => {
    setPending(value)
    setReason('')
    setIdempotencyKey(crypto.randomUUID())
    setSubmitError(null)
    setBlocked(false)
  }

  const submit = async () => {
    if (!pending) return
    const trimmed = reason.trim()
    if (!trimmed) { setSubmitError('请填写操作原因'); return }
    let input: AgentMutation
    if (pending.kind === 'set-exclusivity') {
      input = { action: 'set-exclusivity', territoryId: pending.territory.territoryId, exclusive: pending.exclusive, reason: trimmed, version: pending.territory.version, idempotencyKey }
    } else {
      input = { action: pending.kind, agentId: pending.agent.agentId, reason: trimmed, version: pending.agent.version, idempotencyKey }
    }
    setBusy(true); setSubmitError(null)
    try {
      await service.mutate(token, input)
      messageApi.success('监管操作已提交，以服务回执为准')
      setPending(null)
      setRefresh((n) => n + 1)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请保留原请求号重试')
      setBlocked(err instanceof AgentError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'EXCLUSIVITY_CONFLICT'].includes(err.code))
    } finally { setBusy(false) }
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {contextHolder}
      <div className="user-page-heading">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>区域代理监管</Typography.Title>
          <Typography.Text type="secondary">HQ-18：监管区域独占与生效状态；不替代小程序日常申请，也不与「员工与门店角色」混用。</Typography.Text>
        </div>
        <Button loading={busy} onClick={() => setRefresh((n) => n + 1)}>刷新</Button>
      </div>
      <HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示数据。本页仅总部监管/配置，不替代小程序代理申请与签约流程。" mockDescription="累计佣金为演示快照，禁止前端推导结算或付款终态。写操作须原因、版本、幂等键与确认；结果未知请保留原请求号查询。" />
      {error && <Alert type="error" message={error} />}

      <Tabs items={[
        {
          key: 'agents',
          label: '代理档案',
          children: (
            <Card title="区域代理列表" extra={list && <Typography.Text type="secondary">在职 {list.summary.activeCount} · 暂停 {list.summary.suspendedCount} · 独占区域 {list.summary.exclusiveTerritoryCount}</Typography.Text>}>
              <Space wrap style={{ marginBottom: 16 }}>
                <Input aria-label="代理搜索" placeholder="姓名 / 手机 / 区域 / 编号" allowClear style={{ width: 260 }} value={keyword} onChange={(e) => { setKeyword(e.target.value); setQuery((q) => ({ ...q, page: 1 })) }} />
                <Select aria-label="代理状态" allowClear placeholder="全部状态" style={{ width: 160 }} value={query.status} onChange={(status) => setQuery((q) => ({ ...q, status, page: 1 }))} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />
                <Select aria-label="负责区域" allowClear showSearch optionFilterProp="label" placeholder="全部区域" style={{ width: 200 }} value={query.territoryId} onChange={(territoryId) => setQuery((q) => ({ ...q, territoryId, page: 1 }))} options={(catalog?.territories ?? []).map((t) => ({ value: t.territoryId, label: t.name }))} />
              </Space>
              <Table<RegionAgent>
                rowKey="agentId"
                loading={busy}
                dataSource={list?.items}
                scroll={{ x: 1100 }}
                pagination={{ current: query.page, pageSize: query.pageSize, total: list?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], onChange: (page, pageSize) => setQuery((q) => ({ ...q, page, pageSize })) }}
                columns={[
                  { title: '代理', key: 'agent', width: 200, render: (_, r) => <><strong>{r.name}</strong><br />{r.agentId} · {r.phone}</> },
                  { title: '所属合伙人', key: 'partner', width: 140, render: (_, r) => r.partnerName ?? '—' },
                  { title: '等级 / 区域', key: 'region', width: 220, render: (_, r) => <>{r.levelLabel}<br />{territoryName(r.territoryIds)}</> },
                  { title: '直属门店', dataIndex: 'storeCount', width: 90, align: 'center' },
                  { title: '佣金快照', key: 'fee', width: 120, align: 'right', render: (_, r) => money(r.commissionSnapshotCents) },
                  { title: '状态', key: 'status', width: 110, render: (_, r) => <Tag color={r.status === 'ACTIVE' ? 'green' : r.status === 'SUSPENDED' ? 'orange' : 'default'}>{statusLabel[r.status]}</Tag> },
                  {
                    title: '操作', key: 'actions', width: 220, fixed: 'right',
                    render: (_, r) => (
                      <Space wrap>
                        <Button type="link" onClick={() => setDetailId(r.agentId)}>详情</Button>
                        {canManage && r.allowedActions.includes('suspend') && <Button type="link" danger onClick={() => openPending({ kind: 'suspend', agent: r })}>暂停生效</Button>}
                        {canManage && r.allowedActions.includes('resume') && <Button type="link" onClick={() => openPending({ kind: 'resume', agent: r })}>恢复生效</Button>}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'territories',
          label: '区域独占',
          children: (
            <Card title="区域独占配置">
              <Alert type="info" showIcon style={{ marginBottom: 16 }} message="独占开启后，同区域仅允许一名在职代理；冲突由服务端校验。配置不代替签约申请。" />
              <Table<AgentTerritory>
                rowKey="territoryId"
                loading={busy}
                dataSource={catalog?.territories}
                pagination={false}
                columns={[
                  { title: '区域', key: 'name', render: (_, r) => <><strong>{r.name}</strong><br />{r.territoryId}</> },
                  { title: '层级', key: 'level', width: 100, render: (_, r) => levelLabel[r.level] },
                  { title: '独占', key: 'ex', width: 100, render: (_, r) => <Tag color={r.exclusive ? 'blue' : 'default'}>{r.exclusive ? '独占' : '非独占'}</Tag> },
                  { title: '当前在职持有', key: 'holder', width: 160, render: (_, r) => r.holderAgentId ?? '—' },
                  { title: '版本', dataIndex: 'version', width: 80 },
                  {
                    title: '操作', key: 'act', width: 160,
                    render: (_, r) => canManage ? (
                      <Button type="link" onClick={() => openPending({ kind: 'set-exclusivity', territory: r, exclusive: !r.exclusive })}>
                        {r.exclusive ? '关闭独占' : '开启独占'}
                      </Button>
                    ) : '—',
                  },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'plans',
          label: '方案参考',
          children: (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert type="info" showIcon message="以下费用与分成比例摘自方案附件，单位万元，仅供展示；不参与结算计算，也不作为打款回执。" />
              {(catalog?.planGroups ?? []).map((g) => (
                <Card key={g.id} title={g.label} size="small">
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 1200 }}
                    dataSource={g.rows}
                    columns={[
                      { title: '定位', dataIndex: 'positioning', width: 100 },
                      { title: '等级名称', dataIndex: 'name', width: 120 },
                      { title: '人口档位', dataIndex: 'population', width: 140, render: (v) => v || '—' },
                      { title: '技术费', dataIndex: ['fee', 'tech'], width: 80, align: 'right' },
                      { title: '设备费', dataIndex: ['fee', 'device'], width: 80, align: 'right' },
                      { title: '保证金', dataIndex: ['fee', 'deposit'], width: 80, align: 'right' },
                      { title: '合计', dataIndex: ['fee', 'total'], width: 80, align: 'right' },
                      { title: 'VIP合伙人(B端)', dataIndex: 'vipPartner', width: 120 },
                      { title: '区域代理(B端)', dataIndex: 'regionCommission', width: 140 },
                      { title: '虚拟产品(C端)', dataIndex: 'virtualProduct', width: 220 },
                      { title: '实物产品(C端)', dataIndex: 'physicalProduct', width: 120 },
                    ]}
                  />
                </Card>
              ))}
              <Card title="规则说明" size="small">
                {(catalog?.planNotes ?? []).map((g) => (
                  <div key={g.title} style={{ marginBottom: 12 }}>
                    <Typography.Text strong>{g.title}</Typography.Text>
                    <ul>{g.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                ))}
              </Card>
            </Space>
          ),
        },
      ]} />

      <Drawer open={!!detailId} width={560} title="区域代理详情" onClose={() => setDetailId(null)} destroyOnClose>
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="代理">{detail.agent.name}（{detail.agent.agentId}）</Descriptions.Item>
              <Descriptions.Item label="账号">{detail.agent.accountId}</Descriptions.Item>
              <Descriptions.Item label="合伙人">{detail.agent.partnerName ?? '—'} · {detail.agent.partnerAccountId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusLabel[detail.agent.status]} · V{detail.agent.version}</Descriptions.Item>
              <Descriptions.Item label="区域">{territoryName(detail.agent.territoryIds)}</Descriptions.Item>
              <Descriptions.Item label="佣金快照">{money(detail.agent.commissionSnapshotCents)}（演示，非结算终态）</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="关联区域">
              <Table size="small" rowKey="territoryId" pagination={false} dataSource={detail.territories} columns={[
                { title: '区域', dataIndex: 'name' },
                { title: '独占', render: (_, r) => (r.exclusive ? '是' : '否') },
                { title: '版本', dataIndex: 'version', width: 70 },
              ]} />
            </Card>
            <Card size="small" title="监管审计">
              <Table size="small" rowKey="operationId" pagination={false} dataSource={detail.audit} columns={[
                { title: '时间', width: 160, render: (_, r) => formatUserDate(r.occurredAt) },
                { title: '动作', dataIndex: 'action', width: 120 },
                { title: '操作者', dataIndex: 'operatorName', width: 100 },
                { title: '原因', dataIndex: 'reason' },
              ]} />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        open={!!pending}
        title={pending?.kind === 'set-exclusivity' ? (pending.exclusive ? '开启区域独占' : '关闭区域独占') : pending?.kind === 'suspend' ? '暂停区域代理生效' : '恢复区域代理生效'}
        onCancel={() => { if (!busy) setPending(null) }}
        onOk={() => void submit()}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={busy}
        maskClosable={false}
        closable={!busy}
        okButtonProps={{ disabled: blocked, danger: pending?.kind === 'suspend' }}
        cancelButtonProps={{ disabled: busy }}
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="监管写操作须填写原因；提交后以服务回执为准，禁止前端改写结算或签约终态。" />
        {pending && pending.kind !== 'set-exclusivity' && <Typography.Paragraph>对象：{pending.agent.name}（{pending.agent.agentId}）· 版本 V{pending.agent.version}</Typography.Paragraph>}
        {pending && pending.kind === 'set-exclusivity' && <Typography.Paragraph>区域：{pending.territory.name} · 版本 V{pending.territory.version} → {pending.exclusive ? '独占' : '非独占'}</Typography.Paragraph>}
        <Form layout="vertical">
          <Form.Item label="操作原因" required>
            <Input.TextArea rows={3} maxLength={200} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder="说明监管变更依据" />
          </Form.Item>
          <Form.Item label="幂等请求号">
            <Input value={idempotencyKey} readOnly />
          </Form.Item>
        </Form>
        {submitError && <Alert type="error" showIcon message={submitError} description={blocked ? '请刷新后使用新请求号，或保留原请求号查询未知结果' : undefined} />}
      </Modal>
    </Space>
  )
}
