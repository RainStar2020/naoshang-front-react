import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Descriptions, Drawer, Input, Modal, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { formatUserDate } from '../components/UserDetailDrawer'
import { staffService as service } from '../services/staff'
import {
  StaffError,
  storeCapabilityLabels,
  storeRoleLabels,
  storeRoles,
  type StaffAssignment,
  type StaffCatalog,
  type StaffDetail,
  type StaffList,
  type StaffMutation,
  type StaffQuery,
  type StaffStatus,
  type StoreCapability,
  type StoreRole,
  type StoreRoleDefinition,
} from '../types/staff'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

const statusLabels: Record<StaffStatus, string> = { ACTIVE: '在职', FROZEN: '冻结', LEFT: '离职' }
const statusColor: Record<StaffStatus, string> = { ACTIVE: 'green', FROZEN: 'orange', LEFT: 'default' }

export default function StaffRoles() {
  const { session } = useAuth()
  const { token, account } = session!
  const canRoles = hasPermission(account, 'staff:roles')
  const canManage = hasPermission(account, 'staff:manage')
  const [query, setQuery] = useState<StaffQuery>({ page: 1, pageSize: 10 })
  const [list, setList] = useState<StaffList | null>(null)
  const [catalog, setCatalog] = useState<StaffCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StaffDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [editingRole, setEditingRole] = useState<StoreRoleDefinition | null>(null)
  const [roleForm, setRoleForm] = useState<{ title: string; summary: string; capabilities: StoreCapability[]; allowCrossStore: boolean } | null>(null)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ storeId: undefined as string | undefined, displayName: '', loginAccount: '', roleCode: 'COACH' as StoreRole, linkedAccountId: '', allowCrossStore: false, markCredentialSet: false })
  const [editing, setEditing] = useState<StaffAssignment | null>(null)
  const [editForm, setEditForm] = useState({ displayName: '', loginAccount: '', roleCode: 'COACH' as StoreRole, linkedAccountId: '', allowCrossStore: false })
  const [statusTarget, setStatusTarget] = useState<{ row: StaffAssignment; status: StaffStatus } | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<StaffMutation | null>(null)
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

  const capabilityOptions = useMemo(() => (catalog?.capabilityDictionary ?? []).map(row => ({ label: `${row.label}（${row.code}）`, value: row.code })), [catalog])

  function openRole(role: StoreRoleDefinition) {
    setEditingRole(role)
    setRoleForm({ title: role.title, summary: role.summary, capabilities: [...role.capabilities], allowCrossStore: role.allowCrossStore })
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }
  function openCreate() {
    setCreating(true)
    setCreateForm({ storeId: undefined, displayName: '', loginAccount: '', roleCode: 'COACH', linkedAccountId: '', allowCrossStore: false, markCredentialSet: false })
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }
  function openEdit(row: StaffAssignment) {
    setEditing(row)
    setEditForm({ displayName: row.displayName, loginAccount: row.loginAccount, roleCode: row.roleCode, linkedAccountId: row.linkedAccountId ?? '', allowCrossStore: row.allowCrossStore })
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
  }
  function prepareRole() {
    if (!editingRole || !roleForm || !roleForm.title.trim() || !roleForm.summary.trim() || !roleForm.capabilities.length) {
      setSubmitError('请完善角色标题、说明、能力与原因'); return
    }
        if (!reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'save-role', roleCode: editingRole.roleCode, title: roleForm.title.trim(), summary: roleForm.summary.trim(),
      capabilities: roleForm.capabilities, allowCrossStore: roleForm.allowCrossStore, version: editingRole.version,
      reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareCreate() {
    if (!createForm.storeId || !createForm.displayName.trim() || !createForm.loginAccount.trim()) {
      setSubmitError('请选择门店并填写姓名、登录账号与原因'); return
    }
        if (!reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'create-assignment', storeId: createForm.storeId, displayName: createForm.displayName.trim(), loginAccount: createForm.loginAccount.trim(),
      roleCode: createForm.roleCode, linkedAccountId: createForm.linkedAccountId.trim() || null, allowCrossStore: createForm.allowCrossStore,
      markCredentialSet: createForm.markCredentialSet, version: 0, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareEdit() {
    if (!editing || !editForm.displayName.trim() || !editForm.loginAccount.trim()) {
      setSubmitError('请填写姓名、登录账号与原因'); return
    }
        if (!reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'update-assignment', assignmentId: editing.assignmentId, displayName: editForm.displayName.trim(), loginAccount: editForm.loginAccount.trim(),
      roleCode: editForm.roleCode, linkedAccountId: editForm.linkedAccountId.trim() || null, allowCrossStore: editForm.allowCrossStore,
      version: editing.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareStatus() {
    if (!statusTarget) { setSubmitError('无可提交操作'); return }
        if (!reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'set-status', assignmentId: statusTarget.row.assignmentId, status: statusTarget.status,
      version: statusTarget.row.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  async function submit() {
    if (!pending || busy || blocked) return
    setBusy(true); setSubmitError('')
    try {
      const result = await service.mutate(token, pending)
      if (pending.action === 'create-assignment' || pending.action === 'update-assignment' || pending.action === 'set-status' || pending.action === 'mark-credential-reset') {
        const detailResult = result as { detail?: StaffDetail }
        if (detailResult.detail) setDetailId(detailResult.detail.assignment.assignmentId)
      }
      setEditingRole(null); setCreating(false); setEditing(null); setStatusTarget(null); setPending(null)
      setRefresh(n => n + 1)
      api.success('Mock 操作已完成，密码不会回显；离职/冻结保留任职记录')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请沿用原请求重试')
      if (err instanceof StaffError) setBlocked(true)
    } finally { setBusy(false) }
  }
  function closeEditors() {
    if (busy) return
    setEditingRole(null); setCreating(false); setEditing(null); setStatusTarget(null); setPending(null); setSubmitError(''); setBlocked(false)
  }

  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>门店员工</Typography.Title>
        <Typography.Text type="secondary">配置门店角色能力字典，并监管员工任职。</Typography.Text>
      </div>
      <Space>
        {canManage && <Button type="primary" onClick={openCreate}>新增任职</Button>}
        <Button onClick={() => setRefresh(n => n + 1)}>刷新</Button>
      </Space>
    </Space>
    <HqDataSourceAlert mockMessage="内存 Mock：整页刷新恢复演示数据。密码永不回显，仅 credentialSet。正式改密/发码在服务端或门店侧完成。写操作须原因/版本/幂等/确认。" mockDescription="总部可配置门店经营能力，不可配置收益公式、提点或结算权限。离职/冻结保留记录；跨店须角色字典与任职同时开放。" />
    {catalogError && <Alert type="error" message={catalogError} />}
    <Tabs items={[
      {
        key: 'assignments', label: '员工任职',
        children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card><Space wrap>
            <Input aria-label="员工搜索" placeholder="姓名 / 登录账号 / 门店 / 任职编号" allowClear value={query.keyword} onChange={e => setQuery(v => ({ ...v, keyword: e.target.value, page: 1 }))} style={{ width: 280 }} />
            <Select aria-label="筛选门店" allowClear placeholder="全部门店" style={{ width: 220 }} value={query.storeId} onChange={storeId => setQuery(v => ({ ...v, storeId, page: 1 }))} options={(catalog?.stores ?? []).map(row => ({ value: row.storeId, label: row.name }))} />
            <Select aria-label="筛选角色" allowClear placeholder="全部角色" style={{ width: 160 }} value={query.roleCode} onChange={roleCode => setQuery(v => ({ ...v, roleCode, page: 1 }))} options={storeRoles.map(code => ({ value: code, label: storeRoleLabels[code] }))} />
            <Select aria-label="筛选任职状态" allowClear placeholder="全部状态" style={{ width: 140 }} value={query.status} onChange={status => setQuery(v => ({ ...v, status, page: 1 }))} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
            <Button onClick={() => setQuery({ page: 1, pageSize: 10 })}>重置筛选</Button>
          </Space></Card>
          {error && <Alert type="error" message={error} />}
          {list && <Space size={32}><Statistic title="筛选任职数" value={list.summary.assignments} /><Statistic title="在职" value={list.summary.active} /><Statistic title="冻结" value={list.summary.frozen} /><Statistic title="离职保留" value={list.summary.left} /><Statistic title="跨店开放" value={list.summary.crossStoreAllowed} /></Space>}
          <Card title="任职列表">
            <Table<StaffAssignment> rowKey="assignmentId" loading={loading} dataSource={list?.items ?? []} scroll={{ x: 1400 }}
              pagination={{ current: query.page, pageSize: query.pageSize, total: list?.total, showSizeChanger: true, pageSizeOptions: [5, 10, 20], showTotal: total => `共${total}条任职`, onChange: (page, pageSize) => setQuery(v => ({ ...v, page, pageSize })) }}
              columns={[
                { title: '员工', key: 'person', width: 140, render: (_, row) => <strong>{row.displayName}</strong> },
                { title: '门店', key: 'store', width: 180, render: (_, row) => <span>{row.storeName || '—'}</span> },
                { title: '角色', key: 'role', width: 120, render: (_, row) => <span>{row.roleTitle || '—'}</span> },
                { title: '手机号', key: 'phone', width: 140, render: (_, row) => <span>{row.phone?.trim() ? row.phone : '—'}</span> },
                { title: '加入时间', key: 'joined', width: 170, render: (_, row) => <span>{row.effectiveAt ? formatUserDate(row.effectiveAt) : '—'}</span> },
                { title: '最近登录时间', key: 'lastLogin', width: 170, render: (_, row) => <span>{row.lastLoginAt ? formatUserDate(row.lastLoginAt) : '—'}</span> },
                { title: '状态', key: 'status', width: 100, render: (_, row) => <Tag color={statusColor[row.status]}>{statusLabels[row.status]}</Tag> },
                { title: '操作', key: 'actions', fixed: 'right', width: 220, render: (_, row) => <Space wrap size={0}>
                  <Button type="link" size="small" onClick={() => setDetailId(row.assignmentId)}>详情</Button>
                  {canManage && row.status !== 'LEFT' && <Button type="link" size="small" onClick={() => openEdit(row)}>编辑</Button>}
                  {canManage && row.status === 'ACTIVE' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'FROZEN' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>冻结</Button>}
                  {canManage && row.status !== 'LEFT' && <Button type="link" size="small" danger onClick={() => { setStatusTarget({ row, status: 'LEFT' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>删除</Button>}
                </Space> },
              ]}
            />
          </Card>
        </Space>,
      },
      {
        key: 'roles', label: '角色能力字典',
        children: <Card title="门店角色（总部可配置经营能力，不可配置收益权限）">
          <Table<StoreRoleDefinition> rowKey="roleCode" dataSource={catalog?.roles ?? []} pagination={false}
            columns={[
              { title: '角色', dataIndex: 'title' }, { title: '角色编码', dataIndex: 'roleCode', width: 140 },
              { title: '说明', dataIndex: 'summary' },
              { title: '跨店默认', key: 'cross', width: 110, render: (_, row) => row.allowCrossStore ? <Tag color="blue">允许</Tag> : <Tag>禁止</Tag> },
              { title: '能力', key: 'caps', render: (_, row) => <Space wrap size={[4, 4]}>{(row.capabilities ?? []).map(code => <Tag key={code}>{storeCapabilityLabels[code]}</Tag>)}</Space> },
              
              { title: '操作', key: 'op', width: 120, render: (_, row) => canRoles ? <Button type="link" onClick={() => openRole(row)}>维护</Button> : <Typography.Text type="secondary">只读</Typography.Text> },
            ]}
          />
        </Card>,
      },
      {
        key: 'audit', label: `操作审计（${catalog?.audit.length ?? 0}）`,
        children: <Table rowKey="operationId" dataSource={catalog?.audit ?? []} scroll={{ x: 1000 }}
          columns={[
            { title: '操作', dataIndex: 'action' }, { title: '目标', dataIndex: 'targetId', width: 160 },
            { title: '变更前', dataIndex: 'before' }, { title: '变更后', dataIndex: 'after' }, { title: '变更前版本', key: 'bv', width: 100, render: (_, row) => `V${row.beforeVersion}` }, { title: '变更后版本', key: 'av', width: 100, render: (_, row) => `V${row.afterVersion}` },
            { title: '原因', dataIndex: 'reason' }, { title: '请求号', dataIndex: 'requestId', width: 160 },
            { title: '操作人', dataIndex: 'operatorName', width: 120 }, { title: '时间', key: 'time', width: 170, render: (_, row) => formatUserDate(row.occurredAt) },
          ]}
        />,
      },
    ]} />

    <Drawer title="任职详情" width={520} open={!!detailId} onClose={() => setDetailId(null)}>
      {detailError && <Alert type="error" message={detailError} />}
      {!detail && !detailError && <Typography.Text>正在加载…</Typography.Text>}
      {detail && <Descriptions bordered size="small" column={1} items={[
        { key: 'name', label: '姓名', children: detail.assignment.displayName?.trim() || '—' },
        { key: 'login', label: '登录账号', children: detail.assignment.loginAccount?.trim() || '—' },
        { key: 'phone', label: '手机号', children: detail.assignment.phone?.trim() || '—' },
        { key: 'store', label: '门店', children: detail.assignment.storeName?.trim() || '—' },
        { key: 'role', label: '角色', children: detail.assignment.roleTitle?.trim() || storeRoleLabels[detail.assignment.roleCode] || '—' },
        { key: 'status', label: '状态', children: <Tag color={statusColor[detail.assignment.status]}>{statusLabels[detail.assignment.status]}</Tag> },
        ...(detail.assignment.effectiveAt
          ? [{ key: 'joined', label: '加入时间', children: formatUserDate(detail.assignment.effectiveAt) }]
          : []),
      ]} />}
    </Drawer>

    <Modal title="维护门店角色能力" open={!!editingRole} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareRole}>核对变更</Button></Space>}>
      {editingRole && roleForm && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text>角色码：{editingRole.roleCode} · 当前 V{editingRole.version}</Typography.Text>
        <Input aria-label="角色标题" value={roleForm.title} maxLength={24} onChange={e => setRoleForm(v => v && ({ ...v, title: e.target.value }))} placeholder="角色标题" />
        <Input.TextArea aria-label="角色说明" value={roleForm.summary} maxLength={200} showCount onChange={e => setRoleForm(v => v && ({ ...v, summary: e.target.value }))} placeholder="角色说明" />
        <Checkbox.Group options={capabilityOptions} value={roleForm.capabilities} onChange={values => setRoleForm(v => v && ({ ...v, capabilities: values as StoreCapability[] }))} />
        <Space><span>角色默认允许跨店</span><Switch checked={roleForm.allowCrossStore} onChange={allowCrossStore => setRoleForm(v => v && ({ ...v, allowCrossStore }))} /></Space>
        <Input.TextArea aria-label="备注" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="请填写操作原因" />
        <Alert type="warning" message="不可配置收益/结算类权限；保存后任职生效能力随字典更新。" />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="新增员工任职" open={creating} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareCreate}>核对新建</Button></Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Select aria-label="选择门店" placeholder="选择可用门店" style={{ width: '100%' }} value={createForm.storeId} onChange={storeId => setCreateForm(v => ({ ...v, storeId }))} options={(catalog?.stores ?? []).map(row => ({ value: row.storeId, label: row.name }))} />
        <Select aria-label="选择角色" style={{ width: '100%' }} value={createForm.roleCode} onChange={roleCode => setCreateForm(v => ({ ...v, roleCode }))} options={storeRoles.map(code => ({ value: code, label: storeRoleLabels[code] }))} />
        <Input aria-label="员工姓名" placeholder="姓名 1—24 字" value={createForm.displayName} maxLength={24} onChange={e => setCreateForm(v => ({ ...v, displayName: e.target.value }))} />
        <Input aria-label="登录账号" placeholder="登录账号 4—32 位字母数字_-" value={createForm.loginAccount} maxLength={32} onChange={e => setCreateForm(v => ({ ...v, loginAccount: e.target.value }))} />
        <Input aria-label="关联家长账号" placeholder="可选关联家长账号 ID" value={createForm.linkedAccountId} onChange={e => setCreateForm(v => ({ ...v, linkedAccountId: e.target.value }))} />
        <Space><span>任职允许跨店</span><Switch checked={createForm.allowCrossStore} onChange={allowCrossStore => setCreateForm(v => ({ ...v, allowCrossStore }))} /></Space>
        <Space><span>标记已设凭证（不录入密码）</span><Switch checked={createForm.markCredentialSet} onChange={markCredentialSet => setCreateForm(v => ({ ...v, markCredentialSet }))} /></Space>
        <Input.TextArea aria-label="备注" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="请填写操作原因" />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>
    </Modal>

    <Modal title="编辑员工任职" open={!!editing} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareEdit}>核对编辑</Button></Space>}>
      {editing && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text>任职 {editing.assignmentId} · 门店 {editing.storeName} · V{editing.version}</Typography.Text>
        <Select aria-label="编辑角色" style={{ width: '100%' }} value={editForm.roleCode} onChange={roleCode => setEditForm(v => ({ ...v, roleCode }))} options={storeRoles.map(code => ({ value: code, label: storeRoleLabels[code] }))} />
        <Input aria-label="编辑姓名" value={editForm.displayName} maxLength={24} onChange={e => setEditForm(v => ({ ...v, displayName: e.target.value }))} />
        <Input aria-label="编辑登录账号" value={editForm.loginAccount} maxLength={32} onChange={e => setEditForm(v => ({ ...v, loginAccount: e.target.value }))} />
        <Input aria-label="编辑关联账号" value={editForm.linkedAccountId} onChange={e => setEditForm(v => ({ ...v, linkedAccountId: e.target.value }))} />
        <Space><span>任职允许跨店</span><Switch checked={editForm.allowCrossStore} onChange={allowCrossStore => setEditForm(v => ({ ...v, allowCrossStore }))} /></Space>
        <Input.TextArea aria-label="备注" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title={statusTarget ? `确认${statusTarget.status === 'LEFT' ? '删除' : statusLabels[statusTarget.status]}` : '状态变更'} open={!!statusTarget && !pending} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareStatus}>核对状态变更</Button></Space>}>
      {statusTarget && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>对象：{statusTarget.row.displayName} / {statusTarget.row.loginAccount}<br />当前：{statusLabels[statusTarget.row.status]} → 目标：{statusLabels[statusTarget.status]}<br />冻结保留任职与审计；删除对应离职（set-status LEFT），保留记录，不物理删除。</Typography.Paragraph>
        <Input.TextArea aria-label="备注" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="确认提交" open={!!pending} okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认 Mock 提交'} confirmLoading={busy} okButtonProps={{ disabled: blocked }} cancelButtonProps={{ disabled: busy || !!submitError && !blocked }} cancelText={blocked ? '关闭并刷新' : '返回修改'} closable={!busy && (!submitError || blocked)} maskClosable={false}
      onCancel={() => { if (!busy && (!submitError || blocked)) { if (blocked) { closeEditors(); setRefresh(n => n + 1) }; setPending(null); setSubmitError('') } }}
      onOk={submit}>
      {pending && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>操作：{pending.action}<br />备注：{pending.reason || '（无）'}<br />请求号：{pending.idempotencyKey}<br />版本：{pending.version}</Typography.Paragraph>
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>
  </Space>
}
