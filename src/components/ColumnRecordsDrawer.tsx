import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Select, Space, Spin, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnCatalog, ColumnRecords, ManagedColumn } from '../types/columns'
import { columnsService } from '../services/columns'
import { formatUserDate } from './UserDetailDrawer'

export default function ColumnRecordsDrawer({ column, catalog, token, onClose }: { column: ManagedColumn; catalog: ColumnCatalog; token: string; onClose: () => void }) {
  const [accountId, setAccountId] = useState<string | undefined>()
  const [records, setRecords] = useState<ColumnRecords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => { let alive = true; setRecords(null); setError(null); columnsService.records(token, column.draft.columnId, accountId).then(value => { if (alive) setRecords(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '记录加载失败') }); return () => { alive = false } }, [token, column.draft.columnId, accountId, retry])
  return <Drawer open width={1050} title={`${column.draft.title} · 账号与学习记录`} onClose={onClose}><Space direction="vertical" size={20} style={{ width: '100%' }}>
    <Alert type="info" showIcon message="专栏权益属于账号。已激活仍可再次购买；购买不自动授权，重复购买不重置已有进度。以下均为Mock记录，无总部代购买、强制激活或进度修改操作。" />
    <Select aria-label="筛选专栏账号" allowClear showSearch optionFilterProp="label" placeholder="按账号昵称 / 手机号查询" style={{ width: '100%' }} value={accountId} onChange={setAccountId} options={catalog.accounts.map(account => ({ value: account.accountId, label: `${account.nickname} · ${account.phone} · ${account.accountId}` }))} />
    {error ? <Alert type="error" message={error} action={<Button onClick={() => setRetry(value => value + 1)}>重试</Button>} /> : !records ? <Spin><div style={{ height: 120 }} /></Spin> : <Tabs items={[
      { key: 'accounts', label: '账号授权与购买次数', children: <Table rowKey="accountId" size="small" dataSource={records.accounts} pagination={{ pageSize: 10 }} scroll={{ x: 750 }} columns={[
        { title: '账号', key: 'account', render: (_, row) => <>{row.nickname}<br />{row.phone}<br /><Typography.Text type="secondary">{row.accountId}</Typography.Text></> },
        { title: '已付款购买次数', dataIndex: 'purchaseCount' }, { title: '待付款订单数', dataIndex: 'pendingPurchaseCount' },
        { title: '专栏授权', key: 'grant', render: (_, row) => row.grant ? <><Tag color="green">已激活 · 永久</Tag><div>{formatUserDate(row.grant.activatedAt)}</div><Typography.Text type="secondary">{row.grant.sourceCodeId ?? '预置演示授权'}</Typography.Text></> : <Tag>未激活</Tag> },
      ]} /> },
      { key: 'progress', label: '章节进度与续播', children: <Table rowKey={row => `${row.accountId}:${row.columnId}:${row.chapterId}`} size="small" dataSource={records.accounts.flatMap(row => row.progress)} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} locale={{ emptyText: '暂无学习进度' }} columns={[
        { title: '账号', dataIndex: 'accountId' }, { title: '章节', key: 'chapter', render: (_, row) => <>{column.publication?.column.chapters.find(chapter => chapter.id === row.chapterId)?.title ?? '历史章节（当前版本已移除）'}<br /><Typography.Text type="secondary">{row.chapterId}</Typography.Text></> },
        { title: '续播 / 时长', key: 'position', render: (_, row) => `${row.positionSeconds}s / ${row.durationSeconds}s` }, { title: '进度', key: 'percent', render: (_, row) => `${row.percent}%` }, { title: '完成', key: 'complete', render: (_, row) => <Tag color={row.completed ? 'green' : 'default'}>{row.completed ? '已完成' : '学习中'}</Tag> }, { title: '最近学习', key: 'date', render: (_, row) => formatUserDate(row.lastStudiedAt) },
      ]} /> },
      { key: 'orders', label: `购买订单（${records.orders.length}）`, children: <Table rowKey="orderId" size="small" dataSource={records.orders} pagination={{ pageSize: 10 }} scroll={{ x: 850 }} columns={[
        { title: '订单号 / 购买账号', key: 'order', render: (_, order) => <>{order.orderNo}<br />{order.accountId}</> }, { title: '商品快照ID', dataIndex: 'productId' }, { title: '实付（元）', dataIndex: 'payableAmount', render: amount => (amount / 100).toFixed(2) }, { title: '付款 / 交付', key: 'status', render: (_, order) => <>{order.paymentStatus === 'PAID' ? '演示已付款' : '演示待付款'}<br />{order.fulfillmentStatus === 'DELIVERED' ? '演示已交付' : '演示待交付'}</> }, { title: '时间', key: 'date', render: (_, order) => formatUserDate(order.createdAt) },
      ]} /> },
    ]} />}
  </Space></Drawer>
}
