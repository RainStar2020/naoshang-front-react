import { useEffect, useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Space, Spin, Table, Tag } from 'antd'
import { softwareCardsService } from '../services/softwareCards'
import { softwareStockLabels, type SoftwareDetail } from '../types/softwareCards'
import { formatUserDate } from './UserDetailDrawer'
import { softwareActionNames } from './SoftwareCardModal'

export default function SoftwareCardDetail({ cardId, token, refresh, onClose }: { cardId: string; token: string; refresh: number; onClose: () => void }) {
  const [data, setData] = useState<SoftwareDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => { let alive = true; setData(null); setError(null); softwareCardsService.detail(token, cardId).then(value => { if (alive) setData(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '详情加载失败') }); return () => { alive = false } }, [cardId, token, refresh, retry])
  const card = data?.card
  return <Drawer open width={900} title="软件卡详情与交付追溯" onClose={onClose}>{error ? <Alert type="error" message={error} action={<Button onClick={() => setRetry(value => value + 1)}>重试</Button>} /> : !card ? <Spin><div style={{ height: 150 }} /></Spin> : <Space direction="vertical" size={20} style={{ width: '100%' }}>
    <Alert showIcon type="info" message="完整软件卡号受独立导出权限保护。交付记录、库存停发均不等于供应商激活或作废；月卡计时必须由外部系统返回。" />
    <Descriptions bordered size="small" column={2} items={[
      { key: 'id', label: '库存ID', children: card.cardId, span: 2 }, { key: 'code', label: '脱敏码', children: card.maskedCode }, { key: 'status', label: '库存状态', children: <Tag>{softwareStockLabels[card.status]}</Tag> },
      { key: 'type', label: '类型 / 业务编码', children: `${card.typeName} / ${data!.type.businessCode}`, span: 2 }, { key: 'batch', label: '批次', children: `${data!.batch.name} · ${card.batchId}`, span: 2 },
      { key: 'source', label: '来源 / 参考编号', children: `${data!.batch.sourceName} / ${data!.batch.referenceNo || '未填写'}`, span: 2 },
      { key: 'claim', label: '领用截止', children: card.claimDeadline ? formatUserDate(card.claimDeadline) : '不设截止时间' }, { key: 'claimExpired', label: '领用是否到期', children: card.claimExpired ? '已到期，不能新分配/交付' : '未到期或不适用' },
      { key: 'external', label: '外部激活状态', children: '待供应商核验（Mock未接入）' }, { key: 'externalDate', label: '外部有效期', children: card.externalValidUntil ? formatUserDate(card.externalValidUntil) : '待外部系统返回' },
      { key: 'term', label: '有效期规则说明', children: data!.type.termLabel, span: 2 },
      { key: 'recipient', label: '交付账号', children: card.accountId ? `${card.accountName} / ${card.accountId}` : '未分配', span: 2 },
      { key: 'mode', label: '交付方', children: card.deliveryMode === 'hq' ? '总部交付' : card.deliveryMode === 'store' ? `门店 ${card.deliveryStoreId}` : '未配置' }, { key: 'order', label: '来源订单ID', children: card.sourceOrderId ?? '总部人工分配 / 未关联' },
      { key: 'assigned', label: '分配时间', children: formatUserDate(card.assignedAt) }, { key: 'delivered', label: '记录交付时间', children: formatUserDate(card.deliveredAt) },
      { key: 'exported', label: '首次完整码导出', children: formatUserDate(card.secretExportedAt) }, { key: 'version', label: '库存版本', children: card.version },
      { key: 'old', label: '替代旧卡ID', children: card.replacesCardId ?? '—', span: 2 }, { key: 'new', label: '补发新卡ID', children: card.replacementCardId ?? '—', span: 2 },
    ]} />
    <Table rowKey="operationId" size="small" dataSource={data!.audit} scroll={{ x: 750 }} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: '暂无本轮操作记录；预置卡请查看上方演示字段' }} columns={[
      { title: '操作 / 时间', key: 'action', render: (_, entry) => <>{softwareActionNames[entry.action]}<br />{formatUserDate(entry.occurredAt)}</> }, { title: '变更 / 原因', key: 'change', render: (_, entry) => <><div>{entry.before} → {entry.after}</div><div>{entry.reason}</div><div>请求号：{entry.requestId}</div></> }, { title: '操作人', key: 'operator', render: (_, entry) => <>{entry.operatorName}<br />{entry.operatorId}</> },
    ]} />
  </Space>}</Drawer>
}
