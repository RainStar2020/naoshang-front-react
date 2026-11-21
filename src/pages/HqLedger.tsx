import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import SummaryTable from '../components/SummaryTable'
import { pagePagination } from '../utils/pagination'
import { describeHqLedgerError, hqLedgerService } from '../services/hqLedger'
import type { HqLedgerCatalog, HqLedgerDetail, HqLedgerListItem, HqLedgerSummary } from '../types/hqLedger'
import {
  ASSEMBLED_BOOK_HINT,
  buildHqLedgerListQuery,
  describeIncludedInSummary,
  formatBalanceAfter,
  formatCounterparty,
  formatOccurredAt,
  formatYuan,
  pickHeaderSummary,
} from './hqLedgerQuery'

export default function HqLedger() {
  const [catalog, setCatalog] = useState<HqLedgerCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [items, setItems] = useState<HqLedgerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [listSummary, setListSummary] = useState<HqLedgerSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [direction, setDirection] = useState<string>()
  const [type, setType] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<HqLedgerDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const from = range?.[0] ? range[0].format('YYYY-MM-DD') : undefined
  const to = range?.[1] ? range[1].format('YYYY-MM-DD') : undefined
  const filters = useMemo(
    () => ({ from, to, direction, type, status, keyword }),
    [from, to, direction, type, status, keyword],
  )

  const loadCatalog = useCallback(async () => {
    try {
      const data = await hqLedgerService.catalog({ from, to })
      setCatalog(data)
      setCatalogError(null)
    } catch (error) {
      setCatalog(null)
      setCatalogError(describeHqLedgerError(error))
    }
  }, [from, to])

  const loadList = useCallback(async (nextPage = page, nextSize = pageSize) => {
    setLoading(true)
    try {
      const data = await hqLedgerService.list(
        buildHqLedgerListQuery({ ...filters, page: nextPage, pageSize: nextSize }),
      )
      setItems(data.items)
      setTotal(data.total)
      setListSummary(data.summary)
      setPage(data.page || nextPage)
      setPageSize(data.pageSize || nextSize)
    } catch (error) {
      setItems([])
      setTotal(0)
      setListSummary(null)
      message.error(describeHqLedgerError(error))
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { void loadList(1, pageSize) }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const headerSummary = pickHeaderSummary({
    catalogSummary: catalog?.summary,
    listSummary,
    filters,
  })

  const typeOptions = useMemo(() => {
    const all = catalog?.types ?? []
    if (!direction) return all
    return all.filter((item) => !item.direction || item.direction === direction)
  }, [catalog, direction])

  const openDetail = useCallback(async (ledgerId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const data = await hqLedgerService.detail(ledgerId)
      setDetail(data)
    } catch (error) {
      setDetail(null)
      setDetailError(describeHqLedgerError(error))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const columns: ColumnsType<HqLedgerListItem> = [
    {
      title: '时间',
      dataIndex: 'occurredAt',
      width: 160,
      render: (value: string, row) => (
        <span>
          {formatOccurredAt(value)}
          {row.period ? <div style={{ color: '#888', fontSize: 12 }}>{row.period}</div> : null}
        </span>
      ),
    },
    {
      title: '方向',
      dataIndex: 'directionLabel',
      width: 80,
      render: (value: string, row) => (
        <Tag color={row.direction === 'expense' ? 'red' : 'green'}>{value || row.direction}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'typeLabel',
      width: 200,
      render: (value: string, row) => value || row.type,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (value: number, row) => (
        <Typography.Text type={row.direction === 'expense' ? 'danger' : 'success'}>
          {formatYuan(value)}
        </Typography.Text>
      ),
    },
    {
      title: '对象',
      dataIndex: 'counterparty',
      width: 180,
      render: (_, row) => formatCounterparty(row.counterparty),
    },
    {
      title: '关联单号',
      dataIndex: 'relatedNo',
      width: 160,
      render: (value: string | null, row) => value || row.relatedId || '—',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (value: string | null) => value || '—',
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      width: 100,
      render: (value: string, row) => {
        const color = row.status === 'posted' ? 'success' : row.status === 'pending' ? 'processing' : 'default'
        return <Tag color={color}>{value || row.status}</Tag>
      },
    },
    {
      title: '账面资格',
      dataIndex: 'includedInSummary',
      width: 220,
      render: (_value: boolean, row) => {
        const mark = describeIncludedInSummary(row)
        return (
          <div>
            <Tag color={mark.color}>{mark.text}</Tag>
            {mark.note ? (
              <div style={{ color: '#888', fontSize: 12, marginTop: 4, whiteSpace: 'normal' }}>{mark.note}</div>
            ) : null}
          </div>
        )
      },
    },
    {
      title: '结余',
      dataIndex: 'balanceAfter',
      width: 120,
      align: 'right',
      render: (value: number | null) => formatBalanceAfter(value),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>总部分红</Typography.Title>
      {catalogError ? <Alert type="warning" showIcon message={catalogError} /> : null}
      <Card>
        <SummaryTable
          items={[
            { key: 'incomeTotal', label: '收入合计', value: formatYuan(headerSummary?.incomeTotal) },
            { key: 'expenseTotal', label: '支出合计', value: formatYuan(headerSummary?.expenseTotal) },
            { key: 'netAmount', label: '净额', value: formatYuan(headerSummary?.netAmount) },
            { key: 'availableBalance', label: '组装账面余额', value: formatYuan(catalog?.balance.availableBalance) },
            { key: 'frozenBalance', label: '冻结（组装账面）', value: formatYuan(catalog?.balance.frozenBalance) },
          ]}
        />
        <Alert type="info" showIcon style={{ marginTop: 12 }} message="组装账面余额" description={ASSEMBLED_BOOK_HINT} />
      </Card>
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <DatePicker.RangePicker
            allowClear
            value={range}
            onChange={(value) => {
              setPage(1)
              setRange(value)
            }}
          />
          <Select
            allowClear
            placeholder="收支方向"
            style={{ width: 140 }}
            options={(catalog?.directions ?? []).map((item) => ({ value: item.value, label: item.label }))}
            value={direction}
            onChange={(value) => {
              setPage(1)
              setDirection(value)
              if (type) {
                const nextTypes = (catalog?.types ?? []).filter((item) => !value || !item.direction || item.direction === value)
                if (!nextTypes.some((item) => item.value === type)) setType(undefined)
              }
            }}
          />
          <Select
            allowClear
            placeholder="类型"
            style={{ width: 260 }}
            options={typeOptions.map((item) => ({ value: item.value, label: item.label }))}
            value={type}
            onChange={(value) => {
              setPage(1)
              setType(value)
            }}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            options={(catalog?.statuses ?? []).map((item) => ({ value: item.value, label: item.label }))}
            value={status}
            onChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          />
          <Input.Search
            allowClear
            placeholder="单号 / 对象 / 备注 / 流水号"
            style={{ width: 280 }}
            onSearch={(value) => {
              setPage(1)
              setKeyword(value)
            }}
          />
        </Space>
        <Table
          rowKey="ledgerId"
          loading={loading}
          columns={columns}
          dataSource={items}
          scroll={{ x: 1600 }}
          onRow={(row) => ({
            style: { cursor: 'pointer' },
            onClick: () => { void openDetail(row.ledgerId) },
          })}
          pagination={pagePagination({
            page,
            pageSize,
            total,
            showTotal: (value) => `共 ${value} 笔`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage)
              setPageSize(nextSize)
              void loadList(nextPage, nextSize)
            },
          })}
        />
      </Card>
      <Drawer
        title={detail ? `流水详情 ${detail.ledgerId}` : '流水详情'}
        open={detailOpen}
        width={720}
        onClose={() => {
          setDetailOpen(false)
          setDetail(null)
          setDetailError(null)
        }}
      >
        {detailError ? <Alert type="warning" showIcon message={detailError} style={{ marginBottom: 16 }} /> : null}
        {detailLoading && !detail ? <Typography.Paragraph>正在加载详情…</Typography.Paragraph> : null}
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="流水号" span={2}>{detail.ledgerId}</Descriptions.Item>
              <Descriptions.Item label="业务键" span={2}>{detail.businessKey || '—'}</Descriptions.Item>
              <Descriptions.Item label="时间">{formatOccurredAt(detail.occurredAt)}</Descriptions.Item>
              <Descriptions.Item label="账期">{detail.period || '—'}</Descriptions.Item>
              <Descriptions.Item label="方向">{detail.directionLabel || detail.direction}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail.typeLabel || detail.type}</Descriptions.Item>
              <Descriptions.Item label="金额">{formatYuan(detail.amount)}</Descriptions.Item>
              <Descriptions.Item label="状态">{detail.statusLabel || detail.status}</Descriptions.Item>
              <Descriptions.Item label="账面资格" span={2}>
                {(() => {
                  const mark = describeIncludedInSummary(detail)
                  return (
                    <>
                      <Tag color={mark.color}>{mark.text}</Tag>
                      {mark.note ? <div style={{ marginTop: 4 }}>{mark.note}</div> : null}
                    </>
                  )
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="对象" span={2}>{formatCounterparty(detail.counterparty)}</Descriptions.Item>
              <Descriptions.Item label="关联单号">{detail.relatedNo || detail.relatedId || '—'}</Descriptions.Item>
              <Descriptions.Item label="关联类型">{detail.relatedTypeLabel || detail.relatedType || '—'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detail.remark || '—'}</Descriptions.Item>
              <Descriptions.Item label="入账时间">{formatOccurredAt(detail.bookedAt)}</Descriptions.Item>
              <Descriptions.Item label="结余">{formatBalanceAfter(detail.balanceAfter)}</Descriptions.Item>
              <Descriptions.Item label="来源模块">{detail.sourceModule || '—'}</Descriptions.Item>
              <Descriptions.Item label="来源">{detail.source || '—'}{detail.sourceId ? ` / ${detail.sourceId}` : ''}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="关联单据">
              <Table
                rowKey={(row, index) => `${row.type}:${row.id}:${index}`}
                size="small"
                pagination={false}
                dataSource={detail.relatedDocuments}
                locale={{ emptyText: '无关联单据' }}
                columns={[
                  { title: '类型', dataIndex: 'typeLabel', render: (value: string, row) => value || row.type },
                  { title: '单号', dataIndex: 'no', render: (value: string | null, row) => value || row.id || '—' },
                  { title: '标题', dataIndex: 'title', render: (value: string | null) => value || '—' },
                  { title: '状态', dataIndex: 'status', render: (value: string | null) => value || '—' },
                  { title: '金额', dataIndex: 'amount', align: 'right' as const, render: (value: number | null) => formatBalanceAfter(value) },
                ]}
              />
            </Card>
            <Card size="small" title="同一业务的其他流水">
              <Table
                rowKey="ledgerId"
                size="small"
                pagination={false}
                dataSource={detail.siblingEntries}
                locale={{ emptyText: '无其他流水' }}
                onRow={(row) => ({
                  style: { cursor: 'pointer' },
                  onClick: () => { void openDetail(row.ledgerId) },
                })}
                columns={[
                  { title: '流水号', dataIndex: 'ledgerId' },
                  { title: '类型', dataIndex: 'typeLabel', render: (value: string, row) => value || row.type },
                  { title: '方向', dataIndex: 'direction' },
                  { title: '金额', dataIndex: 'amount', align: 'right' as const, render: (value: number) => formatYuan(value) },
                  {
                    title: '账面资格',
                    dataIndex: 'includedInSummary',
                    render: (_value: boolean, row) => describeIncludedInSummary(row).text,
                  },
                  { title: '状态', dataIndex: 'status' },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  )
}
