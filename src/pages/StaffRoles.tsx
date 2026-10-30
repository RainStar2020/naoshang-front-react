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
  const [resetTarget, setResetTarget] = useState<StaffAssignment | null>(null)
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
    if (!editingRole || !roleForm || !reason.trim() || !roleForm.title.trim() || !roleForm.summary.trim() || !roleForm.capabilities.length) {
      setSubmitError('请完善角色标题、说明、能力与原因'); return
    }
    setSubmitError('')
    setPending({
      action: 'save-role', roleCode: editingRole.roleCode, title: roleForm.title.trim(), summary: roleForm.summary.trim(),
      capabilities: roleForm.capabilities, allowCrossStore: roleForm.allowCrossStore, version: editingRole.version,
      reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareCreate() {
    if (!createForm.storeId || !createForm.displayName.trim() || !createForm.loginAccount.trim() || !reason.trim()) {
      setSubmitError('请选择门店并填写姓名、登录账号与原因'); return
    }
    setSubmitError('')
    setPending({
      action: 'create-assignment', storeId: createForm.storeId, displayName: createForm.displayName.trim(), loginAccount: createForm.loginAccount.trim(),
      roleCode: createForm.roleCode, linkedAccountId: createForm.linkedAccountId.trim() || null, allowCrossStore: createForm.allowCrossStore,
      markCredentialSet: createForm.markCredentialSet, version: 0, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareEdit() {
    if (!editing || !editForm.displayName.trim() || !editForm.loginAccount.trim() || !reason.trim()) {
      setSubmitError('请填写姓名、登录账号与原因'); return
    }
    setSubmitError('')
    setPending({
      action: 'update-assignment', assignmentId: editing.assignmentId, displayName: editForm.displayName.trim(), loginAccount: editForm.loginAccount.trim(),
      roleCode: editForm.roleCode, linkedAccountId: editForm.linkedAccountId.trim() || null, allowCrossStore: editForm.allowCrossStore,
      version: editing.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareStatus() {
    if (!statusTarget || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'set-status', assignmentId: statusTarget.row.assignmentId, status: statusTarget.status,
      version: statusTarget.row.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
  }
  function prepareReset() {
    if (!resetTarget || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitError('')
    setPending({
      action: 'mark-credential-reset', assignmentId: resetTarget.assignmentId, version: resetTarget.version,
      reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
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
      setEditingRole(null); setCreating(false); setEditing(null); setStatusTarget(null); setResetTarget(null); setPending(null)
      setRefresh(n => n + 1)
      api.success('Mock 操作已完成，密码不会回显；离职/冻结保留任职记录')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请沿用原请求重试')
      if (err instanceof StaffError) setBlocked(true)
    } finally { setBusy(false) }
  }
  function closeEditors() {
    if (busy) return
    setEditingRole(null); setCreating(false); setEditing(null); setStatusTarget(null); setResetTarget(null); setPending(null); setSubmitError(''); setBlocked(false)
  }

  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>员工、门店角色与权限</Typography.Title>
        <Typography.Text type="secondary">员工与门店角色（非 HQ-18 区域代理）：配置角色能力字典并监管任职；不替代门店主档与训练模块，也不替代小程序日常排班。</Typography.Text>
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
            <Table<StaffAssignment> rowKey="assignmentId" loading={loading} dataSource={list?.items ?? []} scroll={{ x: 1300 }}
              pagination={{ current: query.page, pageSize: query.pageSize, total: list?.total, showSizeChanger: true, pageSizeOptions: [5, 10, 20], showTotal: total => `共${total}条任职`, onChange: (page, pageSize) => setQuery(v => ({ ...v, page, pageSize })) }}
              columns={[
                { title: '员工', key: 'person', width: 200, render: (_, row) => <Space direction="vertical" size={0}><strong>{row.displayName}</strong><span>{row.loginAccount}</span><Tag color={statusColor[row.status]}>{statusLabels[row.status]}</Tag></Space> },
                { title: '门店 / 角色', key: 'store', width: 240, render: (_, row) => <Space direction="vertical" size={0}><span>{row.storeName}</span><span>{row.roleTitle} · {row.storeNumber}</span></Space> },
                { title: '凭证 / 邀请', key: 'cred', width: 150, render: (_, row) => <Space direction="vertical" size={0}><span>{row.credentialSet ? '已设凭证' : '未设凭证'}</span><span>{row.invitationStatus}</span></Space> },
                { title: '跨店 / 能力数', key: 'caps', width: 140, render: (_, row) => <Space direction="vertical" size={0}><span>{row.allowCrossStore ? '任职允许跨店' : '仅本店'}</span><span>{row.effectiveCapabilities.length} 项能力</span></Space> },
                { title: '版本 / 生效', key: 'ver', width: 180, render: (_, row) => <Space direction="vertical" size={0}><span>V{row.version}</span><span>{formatUserDate(row.effectiveAt)}</span>{row.leftAt && <span>离职 {formatUserDate(row.leftAt)}</span>}</Space> },
                { title: '操作', key: 'actions', fixed: 'right', width: 280, render: (_, row) => <Space wrap size={0}>
                  <Button type="link" size="small" onClick={() => setDetailId(row.assignmentId)}>详情</Button>
                  {canManage && row.status !== 'LEFT' && <Button type="link" size="small" onClick={() => openEdit(row)}>编辑</Button>}
                  {canManage && row.status === 'ACTIVE' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'FROZEN' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>冻结</Button>}
                  {canManage && row.status === 'FROZEN' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'ACTIVE' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>解冻</Button>}
                  {canManage && row.status !== 'LEFT' && <Button type="link" size="small" danger onClick={() => { setStatusTarget({ row, status: 'LEFT' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>离职</Button>}
                  {canManage && row.status === 'LEFT' && <Button type="link" size="small" onClick={() => { setStatusTarget({ row, status: 'ACTIVE' }); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>复职</Button>}
                  {canManage && row.status !== 'LEFT' && row.credentialSet && <Button type="link" size="small" onClick={() => { setResetTarget(row); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>标记重置凭证</Button>}
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
              { title: '角色', key: 'role', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.title}</strong><span>{row.roleCode}</span></Space> },
              { title: '说明', dataIndex: 'summary' },
              { title: '跨店默认', key: 'cross', width: 110, render: (_, row) => row.allowCrossStore ? <Tag color="blue">允许</Tag> : <Tag>禁止</Tag> },
              { title: '能力', key: 'caps', render: (_, row) => <Space wrap size={[4, 4]}>{(row.capabilities ?? []).map(code => <Tag key={code}>{storeCapabilityLabels[code]}</Tag>)}</Space> },
              { title: '版本', dataIndex: 'version', width: 80 },
              { title: '操作', key: 'op', width: 120, render: (_, row) => canRoles ? <Button type="link" onClick={() => openRole(row)}>维护</Button> : <Typography.Text type="secondary">只读</Typography.Text> },
            ]}
          />
        </Card>,
      },
      {
        key: 'audit', label: `操作审计（${catalog?.audit.length ?? 0}）`,
        children: <Table rowKey="operationId" dataSource={catalog?.audit ?? []} scroll={{ x: 1000 }}
          columns={[
            { title: '操作 / 目标', key: 'a', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.action}</strong><span>{row.targetId}</span></Space> },
            { title: '变更', key: 'c', render: (_, row) => <Space direction="vertical" size={0}><span>前：{row.before}</span><span>后：{row.after}</span><span>V{row.beforeVersion} → V{row.afterVersion}</span></Space> },
            { title: '原因 / 请求号', key: 'r', render: (_, row) => <Space direction="vertical" size={0}><span>{row.reason}</span><span>{row.requestId}</span></Space> },
            { title: '操作人 / 时间', key: 'o', render: (_, row) => <Space direction="vertical" size={0}><span>{row.operatorName}</span><span>{formatUserDate(row.occurredAt)}</span></Space> },
          ]}
        />,
      },
    ]} />

    <Drawer title="任职详情" width={860} open={!!detailId} onClose={() => setDetailId(null)}>
      {detailError && <Alert type="error" message={detailError} />}
      {!detail && !detailError && <Typography.Text>正在加载…</Typography.Text>}
      {detail && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={1} items={[
          { key: 'name', label: '姓名 / 登录账号', children: `${detail.assignment.displayName} / ${detail.assignment.loginAccount}` },
          { key: 'store', label: '门店', children: `${detail.assignment.storeName}（${detail.assignment.storeNumber} / ${detail.assignment.storeId}）` },
          { key: 'role', label: '角色', children: `${detail.assignment.roleTitle}（${detail.assignment.roleCode}）` },
          { key: 'status', label: '状态', children: `${statusLabels[detail.assignment.status]} / 邀请 ${detail.assignment.invitationStatus}` },
          { key: 'cred', label: '凭证', children: detail.assignment.credentialSet ? '已设置（密码不回显）' : '未设置' },
          { key: 'cross', label: '跨店', children: detail.assignment.allowCrossStore ? '任职允许（仍须角色字典开放）' : '仅本店' },
          { key: 'link', label: '关联家长账号', children: detail.assignment.linkedAccountId ?? '无（健脑官不得从家长身份推导）' },
          { key: 'caps', label: '生效能力', children: (detail.assignment.effectiveCapabilities ?? []).map(code => storeCapabilityLabels[code]).join('、') || '无' },
          { key: 'ver', label: '版本 / 生效 / 离职', children: `V${detail.assignment.version} / ${formatUserDate(detail.assignment.effectiveAt)} / ${formatUserDate(detail.assignment.leftAt)}` },
        ]} />
        <Alert type="info" message="角色字典当前版本" description={`${detail.role.title} · 跨店默认${detail.role.allowCrossStore ? '允许' : '禁止'} · V${detail.role.version}`} />
        <Table rowKey="operationId" title={() => '相关审计'} dataSource={detail.audit} pagination={{ pageSize: 5 }}
          columns={[
            { title: '操作', dataIndex: 'action' },
            { title: '变更', key: 'c', render: (_, row) => `${row.before} → ${row.after}` },
            { title: '原因', dataIndex: 'reason' },
            { title: '时间', key: 't', render: (_, row) => formatUserDate(row.occurredAt) },
          ]}
        />
      </Space>}
    </Drawer>

    <Modal title="维护门店角色能力" open={!!editingRole} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareRole}>核对变更</Button></Space>}>
      {editingRole && roleForm && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text>角色码：{editingRole.roleCode} · 当前 V{editingRole.version}</Typography.Text>
        <Input aria-label="角色标题" value={roleForm.title} maxLength={24} onChange={e => setRoleForm(v => v && ({ ...v, title: e.target.value }))} placeholder="角色标题" />
        <Input.TextArea aria-label="角色说明" value={roleForm.summary} maxLength={200} showCount onChange={e => setRoleForm(v => v && ({ ...v, summary: e.target.value }))} placeholder="角色说明" />
        <Checkbox.Group options={capabilityOptions} value={roleForm.capabilities} onChange={values => setRoleForm(v => v && ({ ...v, capabilities: values as StoreCapability[] }))} />
        <Space><span>角色默认允许跨店</span><Switch checked={roleForm.allowCrossStore} onChange={allowCrossStore => setRoleForm(v => v && ({ ...v, allowCrossStore }))} /></Space>
        <Input.TextArea aria-label="角色维护原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写维护原因" />
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
        <Input.TextArea aria-label="新建任职原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写原因" />
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
        <Input.TextArea aria-label="编辑任职原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && !pending && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title={statusTarget ? `确认${statusLabels[statusTarget.status]}` : '状态变更'} open={!!statusTarget && !pending} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareStatus}>核对状态变更</Button></Space>}>
      {statusTarget && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>对象：{statusTarget.row.displayName} / {statusTarget.row.loginAccount}<br />当前：{statusLabels[statusTarget.row.status]} → 目标：{statusLabels[statusTarget.status]}<br />离职/冻结保留任职与审计，不物理删除。</Typography.Paragraph>
        <Input.TextArea aria-label="状态变更原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="标记重置登录凭证" open={!!resetTarget && !pending} onCancel={closeEditors} footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepareReset}>核对重置标记</Button></Space>}>
      {resetTarget && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>将 {resetTarget.displayName} 的 credentialSet 置为未设置。不会展示或生成明文密码；正式密码由门店侧/服务端处理。</Typography.Paragraph>
        <Input.TextArea aria-label="重置凭证原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="确认提交" open={!!pending} okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认 Mock 提交'} confirmLoading={busy} okButtonProps={{ disabled: blocked }} cancelButtonProps={{ disabled: busy || !!submitError && !blocked }} cancelText={blocked ? '关闭并刷新' : '返回修改'} closable={!busy && (!submitError || blocked)} maskClosable={false}
      onCancel={() => { if (!busy && (!submitError || blocked)) { if (blocked) { closeEditors(); setRefresh(n => n + 1) }; setPending(null); setSubmitError('') } }}
      onOk={submit}>
      {pending && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>操作：{pending.action}<br />原因：{pending.reason}<br />请求号：{pending.idempotencyKey}<br />版本：{pending.version}</Typography.Paragraph>
        <Alert type="info" message="服务将再次校验权限、版本与幂等；失败时可沿用原请求号重试。" />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>
  </Space>
}
