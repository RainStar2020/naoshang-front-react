import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Cascader, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { usersService } from '../services/users'
import type { UserAccount, UserFilterOptions, UserFilters, UserListQuery, UserListResult } from '../types/users'
import UserActionModal, { type UserActionRequest } from '../components/UserActionModal'
import UserDetailDrawer from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

export default function Users() {
  const { session } = useAuth()
  const token = session!.token
  const account = session!.account
  const canOperate = (['users:freeze', 'users:reset-password', 'users:change-store'] as const).some(permission => hasPermission(account, permission))
  const [form] = Form.useForm<UserFilters>()
  const [query, setQuery] = useState<UserListQuery>({ page: 1, pageSize: 10 })
  const [result, setResult] = useState<UserListResult | null>(null)
  const [options, setOptions] = useState<UserFilterOptions>({ stores: [], regions: [] })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [action, setAction] = useState<UserActionRequest | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  useEffect(() => {
    let alive = true
    setOptionsError(null)
    usersService.options(token).then(data => { if (alive) setOptions(data) }).catch(err => { if (alive) setOptionsError(err instanceof Error ? err.message : '筛选选项加载失败') })
    return () => { alive = false }
  }, [token, refresh])
  useEffect(() => {
    let alive = true
    setBusy(true); setError(null); setResult(null)
    usersService.list(token, query).then(data => {
      if (!alive) return
      // 状态变更后可能让筛选结果的最后一页消失，回到真实末页重新查询。
      const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
      if (query.page > lastPage) setQuery(value => ({ ...value, page: lastPage }))
      else setResult(data)
    }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '账号列表加载失败') }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [query, refresh, token])
  const reload = () => setRefresh(value => value + 1)
  const actions = (user: UserAccount) => <Space size={0} wrap>
    <Button type="link" size="small" onClick={() => setDetailId(user.accountId)}>详情</Button>
    {hasPermission(account, 'users:freeze') && <Button type="link" size="small" danger={!user.frozen} onClick={() => setAction({ account: user, action: 'freeze' })}>{user.frozen ? '解冻' : '冻结'}</Button>}
    {hasPermission(account, 'users:reset-password') && <Button type="link" size="small" onClick={() => setAction({ account: user, action: 'reset-password' })}>重置密码</Button>}
    {hasPermission(account, 'users:change-store') && <Button type="link" size="small" disabled={!options.stores.length || !!optionsError} onClick={() => setAction({ account: user, action: 'change-store' })}>修改门店</Button>}
  </Space>
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>
    {contextHolder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>用户账号管理</Typography.Title><Typography.Text type="secondary">查询家长账号、查看经营身份，处理账号状态与所属门店。</Typography.Text></div><Button onClick={reload} loading={busy}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="本模块使用内存 Mock：操作不会同步到小程序，刷新整个页面将恢复演示数据。" />
    {optionsError && <Alert type="error" message={`地区/门店选项加载失败：${optionsError}`} action={<Button size="small" onClick={reload}>重试</Button>} />}
    <Card variant="borderless"><Form name="userFilters" form={form} layout="vertical" onFinish={values => setQuery({ ...values, keyword: values.keyword?.trim(), page: 1, pageSize: query.pageSize })}>
      <div className="user-filter-grid">
        <Form.Item name="keyword" label="账号搜索"><Input allowClear maxLength={64} placeholder="手机号 / 账号编号 / 昵称" /></Form.Item>
        <Form.Item name="regionCodes" label="账号地区"><Cascader options={options.regions} changeOnSelect allowClear placeholder="省 / 市 / 区县" disabled={!!optionsError} /></Form.Item>
        <Form.Item name="storeId" label="所属门店"><Select allowClear showSearch optionFilterProp="label" placeholder="全部门店" disabled={!!optionsError} options={[{ value: 'unbound', label: '未绑定门店' }, ...options.stores.map(store => ({ value: store.storeId, label: store.name }))]} /></Form.Item>
        <Form.Item name="status" label="账号状态"><Select allowClear placeholder="全部状态" options={[{ value: 'active', label: '正常' }, { value: 'frozen', label: '冻结' }]} /></Form.Item>
      </div><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { form.resetFields(); setQuery({ page: 1, pageSize: 10 }) }}>重置筛选</Button></Space>
    </Form></Card>
    <Card variant="borderless" title="账号列表" extra={<Typography.Text type="secondary">{result ? `共 ${result.total} 个账号` : '—'}</Typography.Text>}>
      {error ? <Alert type="error" showIcon message={error} action={<Button onClick={reload}>重新加载</Button>} /> : <Table<UserAccount> rowKey="accountId" size="middle" loading={busy} dataSource={result?.items ?? []} scroll={{ x: canOperate ? 1200 : 1015 }} locale={{ emptyText: '暂无符合条件的账号，请调整筛选条件' }} pagination={{ current: query.page, pageSize: query.pageSize, total: result?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `共 ${total} 个账号`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page: pageSize !== value.pageSize ? 1 : page, pageSize })) }} columns={[
        { title: '用户账号', key: 'account', width: 190, render: (_, user) => <Space><Avatar src={user.avatarUrl}>{(user.nickname || '?').slice(0, 1)}</Avatar><div><Button type="link" style={{ padding: 0 }} onClick={() => setDetailId(user.accountId)}>{user.nickname}</Button><div><Typography.Text type="secondary">{user.displayId}</Typography.Text></div></div></Space> },
        { title: '手机号', dataIndex: 'phone', width: 135 },
        { title: '地区', key: 'region', width: 170, render: (_, user) => (user.regionNames ?? []).join(' / ') || '未设置' },
        { title: '所属门店', dataIndex: 'storeName', width: 190, render: name => name ?? <Typography.Text type="secondary">未绑定</Typography.Text> },
        { title: '业务身份', key: 'identities', width: 170, render: (_, user) => (user.businessContexts ?? []).length ? <Space size={[0, 4]} wrap>{(user.businessContexts ?? []).map(context => <Tag key={context.contextId}>{context.label}</Tag>)}</Space> : <Typography.Text type="secondary">家长账号</Typography.Text> },
        { title: '状态', key: 'status', width: 80, render: (_, user) => <Tag color={user.frozen ? 'red' : 'green'}>{user.frozen ? '冻结' : '正常'}</Tag> },
        { title: '操作', key: 'actions', fixed: 'right', width: canOperate ? 265 : 80, render: (_, user) => actions(user) },
      ]} />}
    </Card>
    {detailId && <UserDetailDrawer accountId={detailId} token={token} refresh={refresh} onClose={() => setDetailId(null)} onMutated={reload} />}
    {action && <UserActionModal request={action} stores={options.stores} token={token} onClose={() => setAction(null)} onRefresh={reload} onDone={() => { const id = action.account.accountId; const reset = action.action === 'reset-password'; setAction(null); reload(); setDetailId(id); messageApi.success(reset ? '模拟重置已记录，未修改真实账号密码' : 'Mock 操作已完成，详情中可查看操作记录') }} />}
  </Space>
}
