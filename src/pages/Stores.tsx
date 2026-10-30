import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Cascader, Descriptions, Drawer, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { formatUserDate } from '../components/UserDetailDrawer'
import { storeService as service } from '../services/stores'
import {
  StoreError,
  storeStatusLabels,
  type StoreCatalog,
  type StoreCoach,
  type StoreDetail,
  type StoreList,
  type StoreMutation,
  type StoreProfile,
  type StoreQuery,
  type StoreStaffBrief,
  type StoreStatus,
} from '../types/stores'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

const money = (n: number) => `￥${(n / 100).toFixed(2)}`
const statusColor: Record<StoreStatus, string> = { ACTIVE: 'green', FROZEN: 'orange', CLOSED: 'default' }

type ProfileForm = {
  name: string
  managerName: string
  contact: string
  address: string
  regionCodes: string[]
  regionNames: string[]
  feeAmount: number
  minimumFeeAmount: number
  storefrontAssetId: string
  storefrontUrl: string
  agentId: string | undefined
}

export default function Stores() {
  const { session } = useAuth()
  const { token, account } = session!
  const canManage = hasPermission(account, 'stores:manage')
  const [query, setQuery] = useState<StoreQuery>({ page: 1, pageSize: 10 })
  const [list, setList] = useState<StoreList | null>(null)
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StoreDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [editing, setEditing] = useState<StoreProfile | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ row: StoreProfile; status: StoreStatus } | null>(null)
  const [coachStatus, setCoachStatus] = useState<{ coach: StoreCoach; status: 'ACTIVE' | 'FROZEN' } | null>(null)
  const [coachReset, setCoachReset] = useState<StoreCoach | null>(null)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', storeId: '', code: '', address: '', managerName: '', managerPhone: '', ownerAccountId: '' })
  const [ownerTarget, setOwnerTarget] = useState<StoreProfile | null>(null)
  const [ownerAccountId, setOwnerAccountId] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<StoreMutation | null>(null)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [api, holder] = message.useMessage()

  useEffect(() => {
    let alive = true
    setCatalog(null); setCatalogError('')
    service.catalog(token).then(value => { if (alive) setCatalog(value) }).catch(err => { if (alive) setCatalogError(err.message) })
    return () => { alive = false }
  }, [token, refresh])

  useEffect(() => {
    let alive = true
    setList(null); setError(''); setLoading(true)
    service.list(token, query).then(value => { if (alive) setList(value) }).catch(err => { if (alive) setError(err.message) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token, query, refresh])

  useEffect(() => {
    let alive = true
    setDetail(null); setDetailError('')
    if (detailId) service.detail(token, detailId).then(value => { if (alive) setDetail(value) }).catch(err => { if (alive) setDetailError(err.message) })
    return () => { alive = false }
  }, [token, detailId, refresh])

  const regionOptions = useMemo(() => catalog?.regionOptions ?? [], [catalog])

  function codesToNames(codes: string[]): string[] {
    const names: string[] = []
    let level = regionOptions
    for (const code of codes) {
      const hit = level.find(item => item.value === code)
      if (!hit) return []
      names.push(hit.label)
      level = hit.children ?? []
    }
    return names
  }

  function openEdit(row: StoreProfile) {
    setEditing(row)
    setForm({
      name: row.name, managerName: row.managerName, contact: row.contact, address: row.address,
      regionCodes: [...row.regionCodes], regionNames: [...row.regionNames],
      feeAmount: row.feeAmount, minimumFeeAmount: row.minimumFeeAmount,
      storefrontAssetId: row.storefrontAssetId ?? '', storefrontUrl: row.storefrontUrl ?? '',
      agentId: row.agentId ?? undefined,
    })
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }

  function openCreate() {
    setCreating(true)
    setCreateForm({ name: '', storeId: '', code: '', address: '', managerName: '', managerPhone: '', ownerAccountId: '' })
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }

  function openChangeOwner(row: StoreProfile) {
    setOwnerTarget(row)
    setOwnerAccountId(row.ownerAccountId ?? '')
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }

  function prepareCreate() {
    if (!createForm.name.trim() || !reason.trim()) { setSubmitError('请填写门店名称与原因'); return }
    setSubmitError('')
    setPending({
      action: 'create',
      name: createForm.name.trim(),
      ...(createForm.storeId.trim() ? { storeId: createForm.storeId.trim() } : {}),
      ...(createForm.code.trim() ? { code: createForm.code.trim() } : {}),
      ...(createForm.address.trim() ? { address: createForm.address.trim() } : {}),
      ...(createForm.managerName.trim() ? { managerName: createForm.managerName.trim() } : {}),
      ...(createForm.managerPhone.trim() ? { managerPhone: createForm.managerPhone.trim() } : {}),
      ...(createForm.ownerAccountId.trim() ? { ownerAccountId: createForm.ownerAccountId.trim() } : {}),
      version: 0, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  function prepareChangeOwner() {
    if (!ownerTarget || !ownerAccountId.trim() || !reason.trim()) { setSubmitError('请填写店主账号 ID 与原因'); return }
    setSubmitError('')
    setPending({
      action: 'change-owner', storeId: ownerTarget.storeId, ownerAccountId: ownerAccountId.trim(),
      version: ownerTarget.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  function prepareProfile() {
    if (!editing || !form || !reason.trim()) { setSubmitError('请完善资料并填写原因'); return }
    const names = (form.regionNames ?? []).length === 3 ? form.regionNames : codesToNames(form.regionCodes)
    if (form.regionCodes.length !== 3 || names.length !== 3) { setSubmitError('请选择完整省市区'); return }
    const asset = form.storefrontAssetId.trim() || null
    const url = form.storefrontUrl.trim() || null
    setSubmitError('')
    setPending({
      action: 'save-profile', storeId: editing.storeId, name: form.name.trim(), managerName: form.managerName.trim(),
      contact: form.contact.trim(), address: form.address.trim(),
      regionCodes: form.regionCodes as [string, string, string], regionNames: names as [string, string, string],
      feeAmount: form.feeAmount, minimumFeeAmount: form.minimumFeeAmount,
      storefrontAssetId: asset, storefrontUrl: url, agentId: form.agentId ?? null,
      version: editing.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  function prepareStatus() {
    if (!statusTarget || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'set-status', storeId: statusTarget.row.storeId, status: statusTarget.status,
      version: statusTarget.row.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  function prepareCoachStatus() {
    if (!coachStatus || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'set-coach-status', storeId: coachStatus.coach.storeId, coachId: coachStatus.coach.coachId,
      status: coachStatus.status, version: coachStatus.coach.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  function prepareCoachReset() {
    if (!coachReset || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'mark-coach-credential-reset', storeId: coachReset.storeId, coachId: coachReset.coachId,
      version: coachReset.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }

  async function submit() {
    if (!pending || busy || blocked) return
    setBusy(true); setSubmitError('')
    try {
      const result = await service.mutate(token, pending) as { detail?: StoreDetail; store?: StoreProfile }
      const createdId = result.detail?.store?.storeId ?? result.store?.storeId
      if (createdId) setDetailId(createdId)
      setEditing(null); setCreating(false); setOwnerTarget(null); setStatusTarget(null); setCoachStatus(null); setCoachReset(null); setPending(null)
      setRefresh(n => n + 1)
      api.success(pending.action === 'create' ? '门店已创建' : pending.action === 'change-owner' ? '店主已更换' : '操作已完成')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请沿用原请求重试')
      if (err instanceof StoreError) setBlocked(true)
    } finally { setBusy(false) }
  }

  function closeEditors() {
    if (busy) return
    setEditing(null); setCreating(false); setOwnerTarget(null); setStatusTarget(null); setCoachStatus(null); setCoachReset(null); setPending(null); setSubmitError(''); setBlocked(false)
  }

  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>门店主档与健脑官监管</Typography.Title>
        <Typography.Text type="secondary">HQ-19：监管门店主档与健脑官异常干预；任职/角色字典见「员工与门店角色」（非 HQ-18 区域代理）。</Typography.Text>
      </div>
      <Space>
        {canManage && <Button type="primary" onClick={openCreate}>新增门店</Button>}
        <Button onClick={() => setRefresh(n => n + 1)}>刷新</Button>
      </Space>
    </Space>
    <HqDataSourceAlert
      mockMessage="内存 Mock，整页刷新恢复种子。金额界面按元展示（存分）；密码永不回显。监管写须原因/版本/幂等/确认；不替代小程序/门店日常开店流。"
      mockDescription={<span>完整员工角色与任职 CRUD 见 <Link to="/staff-roles">员工与门店角色</Link>。本页任职列表只读。健脑官创建/改密由门店小程序完成，总部仅监管。</span>}
    />
    {catalogError && <Alert type="error" message={catalogError} />}
    <Card>
      <Space wrap>
        <Input aria-label="门店搜索" placeholder="名称 / 编号 / 负责人 / 电话 / 地址" allowClear value={query.keyword}
          onChange={e => setQuery(v => ({ ...v, keyword: e.target.value, page: 1 }))} style={{ width: 280 }} />
        <Select aria-label="筛选营业状态" allowClear placeholder="全部状态" style={{ width: 140 }} value={query.status}
          onChange={status => setQuery(v => ({ ...v, status, page: 1 }))}
          options={Object.entries(storeStatusLabels).map(([value, label]) => ({ value, label }))} />
        <Select aria-label="筛选归属代理" allowClear placeholder="全部代理" style={{ width: 220 }} value={query.agentId}
          onChange={agentId => setQuery(v => ({ ...v, agentId, page: 1 }))}
          options={(catalog?.agents ?? []).map(row => ({ value: row.agentId, label: row.name }))} />
        <Button onClick={() => setQuery({ page: 1, pageSize: 10 })}>重置筛选</Button>
      </Space>
    </Card>
    {error && <Alert type="error" message={error} />}
    {list && <Space size={32} wrap>
      <Statistic title="筛选门店" value={list.summary.stores} />
      <Statistic title="营业中" value={list.summary.active} />
      <Statistic title="冻结" value={list.summary.frozen} />
      <Statistic title="停业" value={list.summary.closed} />
      <Statistic title="在职健脑官（筛选内）" value={list.summary.coachesActive} />
    </Space>}
    <Card title="门店主档">
      <Table<StoreProfile> rowKey="storeId" loading={loading} dataSource={list?.items ?? []} scroll={{ x: 1400 }}
        pagination={{
          current: query.page, pageSize: query.pageSize, total: list?.total, showSizeChanger: true, pageSizeOptions: [5, 10, 20],
          showTotal: total => `共${total}家门店`, onChange: (page, pageSize) => setQuery(v => ({ ...v, page, pageSize })),
        }}
        columns={[
          { title: '门店', key: 's', width: 260, render: (_, row) => <Space direction="vertical" size={0}><strong>{row.name}</strong><span>{row.number} · {row.storeId}</span><Tag color={statusColor[row.status]}>{storeStatusLabels[row.status]}</Tag></Space> },
          { title: '地区 / 地址', key: 'a', width: 260, render: (_, row) => <Space direction="vertical" size={0}><span>{(row.regionNames ?? []).filter(Boolean).join(' / ') || '未设置'}</span><span>{row.address}</span></Space> },
          { title: '负责人', key: 'm', width: 150, render: (_, row) => <Space direction="vertical" size={0}><span>{row.managerName}</span><span>{row.contact}</span></Space> },
          { title: '合店费用', key: 'f', width: 160, render: (_, row) => <Space direction="vertical" size={0}><span>{money(row.feeAmount)}（{row.feeAmount} 分）</span><span>下限 {money(row.minimumFeeAmount)}</span></Space> },
          { title: '归属代理', key: 'ag', width: 160, render: (_, row) => row.agentName ?? '未绑定' },
          { title: '健脑官 / 任职', key: 'c', width: 120, render: (_, row) => <Space direction="vertical" size={0}><span>在职 {row.coachActive} / 冻结 {row.coachFrozen}</span><span>任职 {row.staffTotal}</span></Space> },
          { title: '版本', dataIndex: 'version', width: 70 },
          { title: '操作', key: 'op', fixed: 'right', width: 320, render: (_, row) => <Space wrap size={0}>
            <Button type="link" size="small" onClick={() => setDetailId(row.storeId)}>详情</Button>
            {canManage && row.status !== 'CLOSED' && <Button type="link" size="small" onClick={() => openEdit(row)}>编辑主档</Button>}
            {canManage && row.status !== 'CLOSED' && <Button type="link" size="small" onClick={() => openChangeOwner(row)}>更换店主</Button>}
            {canManage && row.status === 'ACTIVE' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'FROZEN' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>冻结</Button>}
            {canManage && row.status === 'FROZEN' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'ACTIVE' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>解冻</Button>}
            {canManage && row.status !== 'CLOSED' && <Button type="link" size="small" danger onClick={() => { setStatusTarget({ row, status: 'CLOSED' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>停业</Button>}
            {canManage && row.status === 'CLOSED' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'ACTIVE' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>复业</Button>}
          </Space> },
        ]}
      />
    </Card>

    <Drawer title="门店详情" width={920} open={!!detailId} onClose={() => setDetailId(null)}>
      {detailError && <Alert type="error" message={detailError} />}
      {!detail && !detailError && <Typography.Text>正在加载…</Typography.Text>}
      {detail && <Tabs items={[
        {
          key: 'profile', label: '主档',
          children: <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered size="small" column={1} items={[
              { key: 'n', label: '名称 / 编号', children: `${detail.store.name} / ${detail.store.number}` },
              { key: 'st', label: '状态', children: storeStatusLabels[detail.store.status] },
              { key: 'm', label: '负责人 / 电话', children: `${detail.store.managerName} / ${detail.store.contact}` },
              { key: 'r', label: '地区 / 地址', children: `${(detail.store.regionNames ?? []).filter(Boolean).join(' / ') || '未设置'} · ${detail.store.address}` },
              { key: 'f', label: '合店费用', children: `${money(detail.store.feeAmount)}（${detail.store.feeAmount} 分），下限 ${money(detail.store.minimumFeeAmount)}` },
              { key: 'sf', label: '门头照', children: detail.store.storefrontUrl ? <a href={detail.store.storefrontUrl} target="_blank" rel="noreferrer">{detail.store.storefrontAssetId}</a> : '未上传' },
              { key: 'ag', label: '归属代理', children: detail.store.agentName ?? '未绑定' },
              { key: 'o', label: '合店老板数 / 版本 / 开业', children: `${detail.store.ownerCount} / V${detail.store.version} / ${formatUserDate(detail.store.openedAt)}` },
              { key: 'oa', label: '店主账号', children: detail.store.ownerAccountId ?? '未设置' },
            ]} />
            {canManage && detail.store.status !== 'CLOSED' && <Space>
              <Button type="primary" onClick={() => openEdit(detail.store)}>编辑主档</Button>
              <Button onClick={() => openChangeOwner(detail.store)}>更换店主</Button>
            </Space>}
          </Space>,
        },
        {
          key: 'coaches', label: `健脑官监管（${detail.coaches.length}）`,
          children: <Table<StoreCoach> rowKey="coachId" dataSource={detail.coaches} pagination={false}
            columns={[
              { title: '姓名 / 账号', key: 'p', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.displayName}</strong><span>{row.loginAccount}</span></Space> },
              { title: '状态', key: 's', render: (_, row) => <Tag>{row.status}</Tag> },
              { title: '凭证 / 邀请', key: 'c', render: (_, row) => <span>{row.credentialSet ? '已设凭证' : '未设凭证'} / {row.invitationStatus}</span> },
              { title: '版本', dataIndex: 'version', width: 70 },
              { title: '操作', key: 'op', render: (_, row) => <Space wrap size={0}>
                {canManage && detail.store.status !== 'CLOSED' && row.status === 'ACTIVE' && <Button type="link" size="small" onClick={() => { setCoachStatus({ coach: row, status: 'FROZEN' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>冻结</Button>}
                {canManage && detail.store.status !== 'CLOSED' && row.status === 'FROZEN' && <Button type="link" size="small" onClick={() => { setCoachStatus({ coach: row, status: 'ACTIVE' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>解冻</Button>}
                {canManage && detail.store.status !== 'CLOSED' && row.status !== 'LEFT' && row.credentialSet && <Button type="link" size="small" onClick={() => { setCoachReset(row); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>标记重置凭证</Button>}
              </Space> },
            ]}
          />,
        },
        {
          key: 'staff', label: `任职摘要（${detail.staff.length}）`,
          children: <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="只读摘要" description={<span>新建/改角色/离职等请前往 <Link to="/staff-roles">员工与门店角色</Link>。</span>} />
            <Table<StoreStaffBrief> rowKey="assignmentId" dataSource={detail.staff} pagination={false}
              columns={[
                { title: '姓名', dataIndex: 'displayName' },
                { title: '登录账号', dataIndex: 'loginAccount' },
                { title: '角色', dataIndex: 'roleTitle' },
                { title: '状态', dataIndex: 'status' },
                { title: '凭证', key: 'c', render: (_, row) => row.credentialSet ? '已设' : '未设' },
                { title: '版本', dataIndex: 'version', width: 70 },
              ]}
            />
          </Space>,
        },
        {
          key: 'audit', label: `本店审计（${detail.audit.length}）`,
          children: <Table rowKey="operationId" dataSource={detail.audit} pagination={{ pageSize: 8 }}
            columns={[
              { title: '操作', dataIndex: 'action' },
              { title: '变更', key: 'c', render: (_, row) => `${row.before} → ${row.after}` },
              { title: '原因', dataIndex: 'reason' },
              { title: '时间', key: 't', render: (_, row) => formatUserDate(row.occurredAt) },
            ]}
          />,
        },
      ]} />}
    </Drawer>

    <Modal title="编辑门店主档" open={!!editing} onCancel={closeEditors} width={720}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareProfile}>核对变更</Button></Space>}>
      {editing && form && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text>{editing.storeId} · 当前 V{editing.version}</Typography.Text>
        <Input aria-label="门店名称" value={form.name} maxLength={60} onChange={e => setForm(v => v && ({ ...v, name: e.target.value }))} placeholder="门店名称" />
        <Input aria-label="负责人" value={form.managerName} maxLength={30} onChange={e => setForm(v => v && ({ ...v, managerName: e.target.value }))} placeholder="负责人姓名" />
        <Input aria-label="联系手机" value={form.contact} maxLength={11} onChange={e => setForm(v => v && ({ ...v, contact: e.target.value }))} placeholder="11 位手机号" />
        <Cascader aria-label="门店地区" style={{ width: '100%' }} options={regionOptions} value={form.regionCodes}
          fieldNames={{ label: 'label', value: 'value', children: 'children' }}
          onChange={(codes, selected) => setForm(v => v && ({
            ...v,
            regionCodes: (codes as string[]) ?? [],
            regionNames: (selected ?? []).map(item => String(item.label)),
          }))}
          placeholder="省 / 市 / 区" />
        <Input.TextArea aria-label="门店地址" value={form.address} maxLength={200} showCount onChange={e => setForm(v => v && ({ ...v, address: e.target.value }))} />
        <Space wrap>
          <span>合店费用（分）</span>
          <InputNumber aria-label="合店费用分" min={0} value={form.feeAmount} onChange={feeAmount => setForm(v => v && ({ ...v, feeAmount: Number(feeAmount || 0) }))} />
          <span>下限边界（分）</span>
          <InputNumber aria-label="费用下限分" min={0} value={form.minimumFeeAmount} onChange={minimumFeeAmount => setForm(v => v && ({ ...v, minimumFeeAmount: Number(minimumFeeAmount || 0) }))} />
          <Typography.Text type="secondary">{money(form.feeAmount)} / 下限 {money(form.minimumFeeAmount)}</Typography.Text>
        </Space>
        <Input aria-label="门头照资源编号" value={form.storefrontAssetId} onChange={e => setForm(v => v && ({ ...v, storefrontAssetId: e.target.value }))} placeholder="门头照资源 ID（可空）" />
        <Input aria-label="门头照地址" value={form.storefrontUrl} onChange={e => setForm(v => v && ({ ...v, storefrontUrl: e.target.value }))} placeholder="门头照 Mock URL（与资源 ID 成对）" />
        <Select aria-label="归属代理" allowClear placeholder="归属代理" style={{ width: '100%' }} value={form.agentId}
          onChange={agentId => setForm(v => v && ({ ...v, agentId }))}
          options={(catalog?.agents ?? []).map(row => ({ value: row.agentId, label: row.name }))} />
        <Input.TextArea aria-label="主档维护原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写原因" />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title={statusTarget ? `确认${storeStatusLabels[statusTarget.status]}` : '状态变更'} open={!!statusTarget && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareStatus}>核对状态变更</Button></Space>}>
      {statusTarget && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>门店：{statusTarget.row.name}<br />{storeStatusLabels[statusTarget.row.status]} → {storeStatusLabels[statusTarget.status]}</Typography.Paragraph>
        <Input.TextArea aria-label="门店状态原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title={coachStatus ? `健脑官${coachStatus.status === 'FROZEN' ? '冻结' : '解冻'}` : '健脑官状态'} open={!!coachStatus && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareCoachStatus}>核对变更</Button></Space>}>
      {coachStatus && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>{coachStatus.coach.displayName} / {coachStatus.coach.loginAccount}<br />将同步更新员工模块中的同一任职记录。</Typography.Paragraph>
        <Input.TextArea aria-label="健脑官状态原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="标记重置健脑官凭证" open={!!coachReset && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareCoachReset}>核对重置标记</Button></Space>}>
      {coachReset && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>将 {coachReset.displayName} 的 credentialSet 置为未设置，不展示明文密码。正式改密由门店侧完成。</Typography.Paragraph>
        <Input.TextArea aria-label="健脑官重置原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="新增门店" open={creating && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareCreate}>核对新建</Button></Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Input aria-label="新门店名称" placeholder="门店名称（必填）" maxLength={60} value={createForm.name} onChange={e => setCreateForm(v => ({ ...v, name: e.target.value }))} />
        <Input aria-label="新门店编号" placeholder="门店编号 code（可选）" value={createForm.code} onChange={e => setCreateForm(v => ({ ...v, code: e.target.value }))} />
        <Input aria-label="新门店ID" placeholder="门店 ID storeId（可选，留空由后端生成）" value={createForm.storeId} onChange={e => setCreateForm(v => ({ ...v, storeId: e.target.value }))} />
        <Input aria-label="新门店负责人" placeholder="负责人姓名（可选）" maxLength={30} value={createForm.managerName} onChange={e => setCreateForm(v => ({ ...v, managerName: e.target.value }))} />
        <Input aria-label="新门店手机" placeholder="负责人手机（可选）" maxLength={11} value={createForm.managerPhone} onChange={e => setCreateForm(v => ({ ...v, managerPhone: e.target.value }))} />
        <Input.TextArea aria-label="新门店地址" placeholder="地址（可选）" maxLength={200} showCount value={createForm.address} onChange={e => setCreateForm(v => ({ ...v, address: e.target.value }))} />
        <Input aria-label="新门店店主账号" placeholder="店主账号 ID ownerAccountId（可选）" value={createForm.ownerAccountId} onChange={e => setCreateForm(v => ({ ...v, ownerAccountId: e.target.value }))} />
        <Input.TextArea aria-label="新建门店原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写原因（必填）" />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>
    </Modal>

    <Modal title="更换店主" open={!!ownerTarget && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareChangeOwner}>核对更换</Button></Space>}>
      {ownerTarget && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Paragraph>门店：{ownerTarget.name}（{ownerTarget.storeId}）· 当前 V{ownerTarget.version}<br />当前店主：{ownerTarget.ownerAccountId ?? '未设置'}</Typography.Paragraph>
        <Input aria-label="店主账号ID" placeholder="新店主账号 ID" value={ownerAccountId} onChange={e => setOwnerAccountId(e.target.value)} />
        <Input.TextArea aria-label="更换店主原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写原因（必填）" />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="确认提交" open={!!pending}
      okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认提交'}
      confirmLoading={busy} okButtonProps={{ disabled: blocked }}
      cancelButtonProps={{ disabled: busy || !!submitError && !blocked }}
      cancelText={blocked ? '关闭并刷新' : '返回修改'}
      closable={!busy && (!submitError || blocked)} maskClosable={false}
      onCancel={() => { if (!busy && (!submitError || blocked)) { if (blocked) { closeEditors(); setRefresh(n => n + 1) }; setPending(null); setSubmitError('') } }}
      onOk={submit}>
      {pending && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>操作：{pending.action}<br />原因：{pending.reason}<br />请求号：{pending.idempotencyKey}<br />版本：{'version' in pending ? pending.version : '—'}</Typography.Paragraph>
        <Alert type="info" message="服务将再次校验权限、版本与幂等；失败时可沿用原请求号重试。" />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>
  </Space>
}
