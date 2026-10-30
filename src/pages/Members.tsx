import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { membersService } from '../services/members'
import type { MemberFilters, MemberListResult, MemberOptions, MemberProfile, MemberQuery } from '../types/members'
import MemberDetailDrawer from '../components/MemberDetailDrawer'
import MemberEntitlementModal, { type EntitlementRequest } from '../components/MemberEntitlementModal'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

export default function Members() {
  const { session } = useAuth()
  const { token, account } = session!
  const [form] = Form.useForm<MemberFilters>()
  const [query, setQuery] = useState<MemberQuery>({ page: 1, pageSize: 10 })
  const [result, setResult] = useState<MemberListResult | null>(null)
  const [options, setOptions] = useState<MemberOptions | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [action, setAction] = useState<EntitlementRequest | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const reload = () => setRefresh(value => value + 1)
  useEffect(() => {
    let alive = true
    setOptionsError(null)
    membersService.options(token).then(value => { if (alive) setOptions(value) }).catch(err => { if (alive) { setOptions(null); setOptionsError(err instanceof Error ? err.message : '选项加载失败') } })
    return () => { alive = false }
  }, [token, refresh])
  useEffect(() => {
    let alive = true
    setBusy(true); setError(null); setResult(null)
    membersService.list(token, query).then(value => { if (alive) setResult(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '学员列表加载失败') }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [token, query, refresh])
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>
    {contextHolder}<div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>孩子会员档案</Typography.Title><Typography.Text type="secondary">HQ-03 孩子会员档案：人工开撤补学习权益；与激活码发码系统区分。</Typography.Text></div><Button loading={busy} onClick={reload}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="内存 Mock 演示：本模块操作不影响小程序；整页刷新会恢复学员及权益数据。权益写操作须原因/版本/幂等/确认，进度按孩子隔离。" />
    {optionsError && <Alert type="error" message={optionsError} action={<Button onClick={reload}>重试选项</Button>} />}
    <Card variant="borderless"><Form name="memberFilters" form={form} layout="vertical" onFinish={values => setQuery({ ...values, keyword: values.keyword?.trim(), page: 1, pageSize: query.pageSize })}>
      <div className="user-filter-grid">
        <Form.Item name="keyword" label="学员搜索"><Input allowClear maxLength={64} placeholder="学员编号 / 姓名" /></Form.Item>
        <Form.Item name="accountId" label="所属家长"><Select allowClear showSearch optionFilterProp="label" placeholder="家长昵称 / 手机号 / 账号" disabled={!options} options={(options?.parents ?? []).map(parent => ({ value: parent.accountId, label: `${parent.nickname} · ${parent.phone} · ${parent.accountId}` }))} /></Form.Item>
        <Form.Item name="gradeCode" label="年级"><Select allowClear placeholder="全部年级" disabled={!options} options={(options?.grades ?? []).map(grade => ({ value: grade.code, label: grade.label }))} /></Form.Item>
        <Form.Item name="storeId" label="学员所属门店"><Select allowClear showSearch optionFilterProp="label" placeholder="全部门店" disabled={!options} options={[{ value: 'unbound', label: '未绑定门店' }, ...((options?.stores ?? []).map(store => ({ value: store.storeId, label: store.name })) ?? [])]} /></Form.Item>
      </div><Space><Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { form.resetFields(); setQuery({ page: 1, pageSize: 10 }) }}>重置筛选</Button></Space>
    </Form></Card>
    <Card variant="borderless" title="学员列表" extra={<Typography.Text type="secondary">{result ? `共 ${result.total} 位学员` : '—'}</Typography.Text>}>
      {error ? <Alert type="error" message={error} action={<Button onClick={reload}>重新加载</Button>} /> : <Table<MemberProfile> rowKey="memberId" size="middle" loading={busy} dataSource={result?.items ?? []} scroll={{ x: 1000 }} locale={{ emptyText: '暂无符合条件的学员' }} pagination={{ current: query.page, pageSize: query.pageSize, total: result?.total ?? 0, pageSizeOptions: [10, 20, 50], showSizeChanger: true, showTotal: total => `共 ${total} 位学员`, onChange: (page, pageSize) => setQuery(value => ({ ...value, page: pageSize === value.pageSize ? page : 1, pageSize })) }} columns={[
        { title: '学员', key: 'member', width: 170, render: (_, member) => <Space><Avatar src={member.avatar}>{member.name.slice(0, 1)}</Avatar><div><strong>{member.name}</strong><div><Typography.Text type="secondary">{member.displayId}</Typography.Text></div></div></Space> },
        { title: '年级 / 性别', key: 'grade', width: 110, render: (_, member) => `${member.gradeLabel} / ${member.genderLabel}` },
        { title: '所属家长', key: 'parent', width: 170, render: (_, member) => <>{member.parentName}<br /><Typography.Text type="secondary">{member.parentPhone}</Typography.Text></> },
        { title: '学员所属门店', dataIndex: 'storeName', width: 190, render: name => name ?? '未绑定门店' },
        { title: '已开通会员权益', key: 'tiers', width: 200, render: (_, member) => (member.entitlements ?? []).some(grant => grant.status === 'active') ? <Space wrap size={[0, 4]}>{(member.entitlements ?? []).filter(grant => grant.status === 'active').map(grant => <Tag color="green" key={grant.grantId}>{(options?.tiers ?? []).find(tier => tier.membershipTierId === grant.membershipTierId)?.name ?? grant.membershipTierId}</Tag>)}</Space> : <Typography.Text type="secondary">暂无有效权益</Typography.Text> },
        { title: '操作', key: 'action', fixed: 'right', width: 140, render: (_, member) => <Button type="link" size="small" onClick={() => setMemberId(member.memberId)}>档案与权益</Button> },
      ]} />}
    </Card>
    {memberId && <MemberDetailDrawer memberId={memberId} token={token} operator={account} options={options} refresh={refresh} onClose={() => setMemberId(null)} onAction={setAction} onRefresh={reload} />}
    {action && <MemberEntitlementModal request={action} token={token} onClose={() => setAction(null)} onRefresh={reload} onDone={() => { setAction(null); reload(); messageApi.success('Mock 权益处理已完成，可在权益操作记录中追溯') }} />}
  </Space>
}
