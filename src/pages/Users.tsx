import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Cascader, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { usersService } from '../services/users'
import type { UserAccount, UserFilterOptions, UserFilters, UserListQuery, UserListResult } from '../types/users'
import UserActionModal, { type UserActionRequest } from '../components/UserActionModal'
import StoreBindingModal from '../components/StoreBindingModal'
import UserDetailDrawer from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'
import { downloadCsv } from '../utils/csv'

export default function Users() {
  const { session } = useAuth()
  const token = session!.token
  const account = session!.account
  const canOperate = (['users:freeze', 'users:reset-password', 'users:change-store'] as const).some(permission => hasPermission(account, permission))
  const [form] = Form.useForm<UserFilters>()
  const [query, setQuery] = useState<UserListQuery>({ page: 1, pageSize: 10 })
  const [result, setResult] = useState<UserListResult | null>(null)
  const [options, setOptions] = useState<UserFilterOptions>({ stores: [], regions: [], tiers: [] })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [action, setAction] = useState<UserActionRequest | null>(null)
  const [storeBindingAccount, setStoreBindingAccount] = useState<UserAccount | null>(null)
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
  const exportUsers = () => downloadCsv('用户账号列表', [
    ['账号 ID', '账号编号', '昵称', '手机号', '地区', '批发商身份', '状态', '所属门店', '注册时间'],
    ...(result?.items ?? []).map(user => [
      user.accountId, user.displayId, user.nickname, user.phone, (user.regionNames ?? []).join(' / '),
      user.tierLabel || (user.businessContexts ?? []).map(context => context.label).join('、'),
      user.frozen ? '冻结' : '正常', user.storeName || '未绑定门店', user.createdAt,
    ]),
  ])
  const actions = (user: UserAccount) => <Space size={0} wrap>
    <Button type="link" size="small" onClick={() => setDetailId(user.accountId)}>详情</Button>
    {hasPermission(account, 'users:freeze') && <Button type="link" size="small" danger={!user.frozen} onClick={() => setAction({ account: user, action: 'freeze' })}>{user.frozen ? '解冻' : '冻结'}</Button>}
    {hasPermission(account, 'users:reset-password') && <Button type="link" size="small" onClick={() => setAction({ account: user, action: 'reset-password' })}>重置密码</Button>}
    {hasPermission(account, 'users:change-store') && <Button type="link" size="small" onClick={() => setStoreBindingAccount(user)}>修改门店</Button>}
  </Space>
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>
    {contextHolder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>用户账号管理</Typography.Title><Typography.Text type="secondary">查询家长账号、查看经营身份与 VIP 等级，处理账号状态；所属门店见详情。</Typography.Text></div><Button onClick={reload} loading={busy}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="本模块使用内存 Mock：操作不会同步到小程序，刷新整个页面将恢复演示数据。" />
    {optionsError && <Alert type="error" message={`地区/VIP等级选项加载失败：${optionsError}`} action={<Button size="small" onClick={reload}>重试</Button>} />}
    <Card variant="borderless"><Form name="userFilters" form={form} layout="vertical" onFinish={values => setQuery({ ...values, keyword: values.keyword?.trim(), page: 1, pageSize: query.pageSize })}>
      <div className="user-filter-grid">
        <Form.Item name="keyword" label="账号搜索"><Input allowClear maxLength={64} placeholder="手机号 / 账号编号 / 昵称" /></Form.Item>
        <Form.Item name="regionCodes" label="账号地区"><Cascader options={options.regions} changeOnSelect allowClear placeholder="省 / 市 / 区县" disabled={!!optionsError} /></Form.Item>
        <Form.Item name="tier" label="VIP等级"><Select allowClear showSearch optionFilterProp="label" placeholder="全部等级" disabled={!!optionsError} options={options.tiers.map(tier => ({ value: tier.value, label: tier.label }))} /></Form.Item>
        <Form.Item name="status" label="账号状态"><Select allowClear placeholder="全部状态" options={[{ value: 'active', label: '正常' }, { value: 'frozen', label: '冻结' }]} /></Form.Item>
      </div><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { form.resetFields(); setQuery({ page: 1, pageSize: 10 }) }}>重置筛选</Button></Space>
    </Form></Card>
    <Card variant="borderless" title="账号列表" extra={<Space><Typography.Text type="secondary">{result ? `共 ${result.total} 个账号` : '—'}</Typography.Text><Button onClick={exportUsers} disabled={!result?.items.length}>导出当前表格</Button></Space>}>
      {error ? <Alert type="error" showIcon message={error} action={<Button onClick={reload}>重新加载</Button>} /> : <Table<UserAccount> rowKey="accountId" size="middle" loading={busy} dataSource={result?.items ?? []} scroll={{ x: canOperate ? 1170 : 985 }} locale={{ emptyText: '暂无符合条件的账号，请调整筛选条件' }} pagination={{ current: query.page, pageSize: query.pageSize, total: result?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `共 ${total} 个账号`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page: pageSize !== value.pageSize ? 1 : page, pageSize })) }} columns={[
        { title: '用户账号', key: 'account', width: 180, render: (_, user) => <Space><Avatar src={user.avatarUrl}>{(user.nickname || '?').slice(0, 1)}</Avatar><Button type="link" style={{ padding: 0 }} onClick={() => setDetailId(user.accountId)}>{user.nickname}</Button></Space> }, { title: '编号', dataIndex: 'displayId', width: 120 },
        { title: '手机号', dataIndex: 'phone', width: 135 },
        { title: '地区', key: 'region', width: 170, render: (_, user) => (user.regionNames ?? []).join(' / ') || '未设置' },
        { title: '批发商身份', key: 'identities', width: 190, render: (_, user) => {
          const tierLabel = user.tierLabel?.trim()
          if (tierLabel) return <Tag>{tierLabel}</Tag>
          const contexts = user.businessContexts ?? []
          if (contexts.length) return <Space size={[0, 4]} wrap>{contexts.map(context => <Tag key={context.contextId}>{context.label}</Tag>)}</Space>
          return <Typography.Text type="secondary">—</Typography.Text>
        } },
        { title: '绑定门店', key: 'store', width: 160, render: (_, user) => user.storeName || '未绑定' },
        { title: '状态', key: 'status', width: 80, render: (_, user) => <Tag color={user.frozen ? 'red' : 'green'}>{user.frozen ? '冻结' : '正常'}</Tag> },
        { title: '操作', key: 'actions', fixed: 'right', width: canOperate ? 265 : 80, render: (_, user) => actions(user) },
      ]} />}
    </Card>
    {detailId && <UserDetailDrawer accountId={detailId} token={token} refresh={refresh} onClose={() => setDetailId(null)} onMutated={reload} />}
    {storeBindingAccount && <StoreBindingModal
      accountId={storeBindingAccount.accountId}
      accountLabel={`${storeBindingAccount.nickname} · ${storeBindingAccount.phone}`}
      mode="bind"
      token={token}
      onClose={() => setStoreBindingAccount(null)}
      onDone={() => { setStoreBindingAccount(null); reload(); messageApi.success('门店绑定已更新') }}
    />}
    {action && <UserActionModal request={action} stores={options.stores} token={token} onClose={() => setAction(null)} onRefresh={reload} onDone={() => { const id = action.account.accountId; const reset = action.action === 'reset-password'; setAction(null); reload(); setDetailId(id); messageApi.success(reset ? '模拟重置已记录，未修改真实账号密码' : 'Mock 操作已完成，详情中可查看操作记录') }} />}
  </Space>
}
