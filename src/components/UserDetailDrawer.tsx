import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Descriptions, Drawer, Empty, Space, Spin, Table, Tag, Typography } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { usersService } from '../services/users'
import type { UserDetail } from '../types/users'
import UserActionModal, { type UserActionRequest } from './UserActionModal'
import StoreBindingModal from './StoreBindingModal'
import { downloadCsv } from '../utils/csv'
import { displayValue } from '../services/real/users'

export const formatUserDate = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Shanghai', hour12: false }).format(new Date(value)) : '—'
const safeText = displayValue
const auditRowKey = (item: { operationId?: string; requestId?: string }, index?: number) => item.operationId || item.requestId || `audit-${index ?? 0}`
const actionLabels: Record<string, string> = { freeze: '冻结状态变更', unfreeze: '冻结状态变更', 'update-note': '备注变更', 'change-store': '所属门店变更', 'reset-password': '模拟密码重置', 'change-display-id': '账号编号变更' }

export default function UserDetailDrawer({ accountId, token, refresh, onClose, onMutated }: { accountId: string; token: string; refresh: number; onClose: () => void; onMutated?: () => void }) {
  const { session } = useAuth()
  const canEditNumber = hasPermission(session!.account, 'users:edit-number')
  const canChangeStore = hasPermission(session!.account, 'users:change-store')
  const [data, setData] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [retry, setRetry] = useState(0)
  const [action, setAction] = useState<UserActionRequest | null>(null)
  const [storeBindingOpen, setStoreBindingOpen] = useState(false)
  useEffect(() => {
    let alive = true
    setBusy(true); setError(null); setData(null)
    usersService.detail(token, accountId).then(result => { if (alive) setData(result) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '加载失败') }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [accountId, token, refresh, retry])
  const account = data?.account
  return <Drawer title="用户账号详情" open onClose={onClose} width={780}>
    {busy && <Spin tip="加载账号详情"><div style={{ minHeight: 180 }} /></Spin>}
    {error && <Space direction="vertical"><Alert type="error" message={error} /><Button onClick={() => setRetry(value => value + 1)}>重试</Button></Space>}
    {account && <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Space wrap><Avatar src={account.avatarUrl}>{(account.nickname || '?').slice(0, 1)}</Avatar><Typography.Title level={4} style={{ margin: 0 }}>{account.nickname}</Typography.Title><Tag color={account.frozen ? 'red' : 'green'}>{account.frozen ? '冻结' : '正常'}</Tag>{canEditNumber && <Button size="small" onClick={() => setAction({ account, action: 'change-display-id' })}>修改编号</Button>}{canChangeStore && <Button size="small" onClick={() => setStoreBindingOpen(true)}>修改门店</Button>}</Space>
      <Descriptions bordered size="small" column={2} items={[
        { key: 'accountId', label: '账号 ID', children: account.accountId },
        { key: 'displayId', label: '账号编号', children: account.displayId },
        { key: 'phone', label: '手机号', children: account.phone, span: 2 },
        { key: 'region', label: '地区', children: (account.regionNames ?? []).join(' / ') || '未设置', span: 2 },
        { key: 'store', label: '所属门店', children: account.storeName ?? '未绑定门店', span: 2 },
        { key: 'createdAt', label: '注册时间', children: formatUserDate(account.createdAt), span: 2 },
      ]} />
      <div><Typography.Title level={5}>所拥有身份</Typography.Title>{(account.businessContexts ?? []).length ? <Space direction="vertical" style={{ width: '100%' }}>{(account.businessContexts ?? []).map(context => <div key={context.contextId} className="user-identity"><Tag color="blue">{context.label}</Tag><div>身份 ID：{context.contextId}</div>{context.assignmentId && <div>委任 ID：{context.assignmentId}</div>}{context.contractId && <div>合同 ID：{context.contractId}</div>}</div>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无经营身份，账号仍可作为家长使用" />}</div>
      <div><Space style={{ width: '100%', justifyContent: 'space-between' }}><Typography.Title level={5}>总部操作记录</Typography.Title><Button size="small" disabled={!(data.audit ?? []).length} onClick={() => downloadCsv('用户账号操作记录', [['时间', '操作', '变更前', '变更后', '备注', '请求号', '操作人', '操作人 ID'], ...(data.audit ?? []).map(item => [formatUserDate(item.occurredAt), actionLabels[item.action] ?? item.action ?? '总部操作', safeText(item.before), safeText(item.after), safeText(item.reason), safeText(item.requestId), safeText(item.operatorName), safeText(item.operatorId)])])}>导出当前表格</Button></Space><Table rowKey={auditRowKey} size="small" dataSource={data.audit ?? []} scroll={{ x: 650 }} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: '暂无总部操作记录' }} columns={[
        { title: '时间', key: 'time', width: 170, render: (_, item) => formatUserDate(item.occurredAt) }, { title: '操作', key: 'action', width: 120, render: (_, item) => <Tag>{actionLabels[item.action] ?? item.action ?? '总部操作'}</Tag> },
        { title: '变更前', key: 'before', render: (_, item) => safeText(item.before) }, { title: '变更后', key: 'after', render: (_, item) => safeText(item.after) }, { title: '备注', key: 'reason', render: (_, item) => safeText(item.reason) }, { title: '请求号', key: 'requestId', render: (_, item) => safeText(item.requestId) },
        { title: '操作人', key: 'operatorName', width: 120, render: (_, item) => safeText(item.operatorName) }, { title: '操作人ID', key: 'operatorId', width: 140, render: (_, item) => safeText(item.operatorId) },
      ]} /></div>
    </Space>}
    {storeBindingOpen && account && <StoreBindingModal accountId={account.accountId} accountLabel={`${account.nickname} · ${account.phone}`} mode="bind" token={token} onClose={() => setStoreBindingOpen(false)} onDone={() => { setStoreBindingOpen(false); setRetry(v => v + 1); onMutated?.() }} />}
    {action && <UserActionModal request={action} stores={[]} token={token} onClose={() => setAction(null)} onRefresh={() => { setAction(null); setRetry(v => v + 1); onMutated?.() }} onDone={() => { setAction(null); setRetry(v => v + 1); onMutated?.() }} />}
  </Drawer>
}
