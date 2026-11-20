import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { dividendAuditService } from '../services/dividendAudit'
import type { DividendAuditItem, DividendAuditOverview, DividendKind, DividendKindOption } from '../types/dividendAudit'
import SummaryTable from '../components/SummaryTable'
import { pagePagination } from '../utils/pagination'

const money = (value: number) => `¥${Number(value || 0).toFixed(2)}`
const percent = (value?: number | null) => value == null ? '-' : `${(value / 100).toFixed(2)}%`

export default function DividendAudit() {
  const [kinds, setKinds] = useState<DividendKindOption[]>([])
  const [kind, setKind] = useState<DividendKind>('memberCard')
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState<string>()
  const [data, setData] = useState<DividendAuditOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => { void dividendAuditService.kinds().then((value) => { setKinds(value); if (value[0]) setKind(value[0].kind) }).catch(() => message.error('加载分红类型失败')) }, [])
  useEffect(() => { void dividendAuditService.periods(kind).then((value) => { setPeriods(value.periods); setPeriod(value.currentPeriod) }).catch(() => message.error('加载可选月份失败')) }, [kind])
  const load = useCallback(async (page = 1, size = pageSize) => {
    if (!period) return
    setLoading(true)
    try { setData(await dividendAuditService.overview({ kind, period, page, pageSize: size })) }
    catch { message.error('加载分红明细失败') }
    finally { setLoading(false) }
  }, [kind, period, pageSize])
  useEffect(() => { void load() }, [load])

  const columns: ColumnsType<DividendAuditItem> = [
    { title: '人员', dataIndex: 'name', width: 110, render: (value: string | null, row) => value || row.accountId },
    { title: '手机号', dataIndex: 'phone', width: 130, render: (value) => value || '-' },
    { title: '分红权', dataIndex: 'eligible', width: 105, render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '有分红权' : '无分红权'}</Tag> },
    { title: '总分红', dataIndex: 'totalAmount', align: 'right' as const, render: money },
    ...(kind === 'founding' ? [] : [
      { title: '加权分红', dataIndex: 'weightedAmount', align: 'right' as const, render: money },
      { title: '业绩分红', dataIndex: 'performanceAmount', align: 'right' as const, render: money },
    ]),
    { title: kind === 'founding' ? '—' : '本人业绩', dataIndex: 'performanceValue', align: 'right' as const, render: (value: number | null) => value == null ? '-' : money(value) },
    ...(kind === 'global' ? [{ title: '业绩占比', dataIndex: 'performanceShareBps', align: 'right' as const, render: percent }] : []),
  ]
  return <div>
    <Card title="全员月度分红监管" extra={<div style={{ display: 'flex', gap: 8 }}><Select value={kind} onChange={setKind} options={kinds.map((item) => ({ value: item.kind, label: item.label }))} style={{ width: 160 }} /><Select value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: item }))} style={{ width: 130 }} /></div>}>
      <Alert type="info" showIcon message="当月数据为实时计算；历史月份按同一引擎重算。金额单位为元，全球奖业绩占比按万分比转换展示。" style={{ marginBottom: 16 }} />
      <SummaryTable items={[
        { key: 'pool', label: '奖池总额', value: money(data?.pool ?? 0) },
        { key: 'people', label: '参与人数', value: data?.summary.people ?? 0 },
        { key: 'totalAmount', label: '全员总分红', value: money(data?.summary.totalAmount ?? 0) },
        { key: 'isCurrentMonth', label: '当月状态', value: data?.isCurrentMonth ? '实时计算' : '历史重算' },
      ]} />
    </Card>
    <Card title="人员分红明细" style={{ marginTop: 16 }}>
      <Table rowKey="accountId" loading={loading} columns={columns} dataSource={data?.items ?? []} scroll={{ x: 950 }} pagination={pagePagination({
        page: data?.page ?? 1,
        pageSize: data?.pageSize ?? pageSize,
        total: data?.total ?? 0,
        showTotal: (total) => `共 ${total} 人`,
        onChange: (page, size) => { setPageSize(size); void load(page, size) },
      })} />
    </Card>
  </div>
}
