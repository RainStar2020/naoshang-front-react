import { useEffect, useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Space, Spin, Table, Tag } from 'antd'
import { activationCodesService } from '../services/activationCodes'
import type { ActivationDetail, ActivationStatus } from '../types/activationCodes'
import { formatUserDate } from './UserDetailDrawer'
import { activationActionNames } from './ActivationCodeModal'

export const codeStatusNames: Record<ActivationStatus, string> = { unused: '未分发', issued: '已分发未用', used: '已使用', revoked: '已撤销', expired: '已过期' }
export default function ActivationCodeDetail({ codeId, token, refresh, onClose }: { codeId: string; token: string; refresh: number; onClose: () => void }) {
  const [data, setData] = useState<ActivationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true; setData(null); setError(null)
    activationCodesService.detail(token, codeId).then(result => { if (alive) setData(result) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '详情加载失败') })
    return () => { alive = false }
  }, [codeId, token, refresh, retry])
  const code = data?.code
  return <Drawer open width={850} title="激活码详情与追溯" onClose={onClose}>{error ? <Alert type="error" message={error} action={<Button onClick={() => setRetry(value => value + 1)}>重试</Button>} /> : !code ? <Spin><div style={{ height: 150 }} /></Spin> : <Space direction="vertical" size={20} style={{ width: '100%' }}>
    <Alert type="info" message="完整演示码仅能通过有权限的导出获取。领取/使用记录不代表真实API或支付已经接通。" />
    <Descriptions bordered size="small" column={2} items={[
      { key: 'id', label: '码ID', children: code.codeId, span: 2 }, { key: 'code', label: '脱敏码', children: code.maskedCode }, { key: 'status', label: '状态', children: <Tag>{codeStatusNames[code.status]}</Tag> },
      { key: 'batch', label: '批次', children: `${data!.batch.name} · ${code.batchId}`, span: 2 }, { key: 'type', label: '类型', children: code.codeType === 'membership-tier' ? '会员等级码' : '专栏码' }, { key: 'target', label: '目标', children: code.targetName },
      { key: 'expiry', label: '码有效期', children: code.expiresAt ? formatUserDate(code.expiresAt) : '不设到期时间' }, { key: 'version', label: '版本', children: code.version },
      { key: 'issued', label: '交付对象', children: code.issuedTo ?? '未分发', span: 2 }, { key: 'account', label: '绑定账号', children: code.issuedToAccountId ?? '未绑定' }, { key: 'member', label: '绑定孩子', children: code.issuedToMemberId ?? '未指定' },
      { key: 'store', label: '交付门店ID', children: code.storeId ?? '未关联' }, { key: 'issuedAt', label: '分发时间', children: formatUserDate(code.issuedAt) },
      { key: 'usedBy', label: '使用账号 / 学员', children: `${code.usedByAccountId ?? '—'} / ${code.usedByMemberId ?? '—'}`, span: 2 }, { key: 'usedAt', label: '使用时间', children: formatUserDate(code.usedAt) }, { key: 'order', label: '来源订单ID', children: code.sourceOrderId ?? '无订单关联' },
      { key: 'old', label: '替代旧码ID', children: code.replacesCodeId ?? '—', span: 2 }, { key: 'new', label: '补发新码ID', children: code.replacementCodeId ?? '—', span: 2 },
    ]} />
    <Table rowKey="operationId" size="small" dataSource={data!.audit} scroll={{ x: 700 }} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: '暂无本轮操作记录；预置演示码请查看上方交付/使用字段' }} columns={[
      { title: '操作 / 时间', key: 'action', render: (_, item) => <>{activationActionNames[item.action]}<br />{formatUserDate(item.occurredAt)}</> }, { title: '变更 / 原因', key: 'change', render: (_, item) => <><div>{item.before} → {item.after}</div><div>{item.reason}</div><div>请求号：{item.requestId}</div></> }, { title: '操作人', key: 'operator', render: (_, item) => <>{item.operatorName}<br />{item.operatorId}</> },
    ]} />
  </Space>}</Drawer>
}
