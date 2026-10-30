import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Collapse, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Pagination, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import { liveModules } from '../services/real/registry'
import { buildMutationRequest, dataRows, parseObject, record, redactCredentials, rowIdentifier, runOperation, type DataRecord, type ModuleInput, type ModuleOperation } from '../services/real/modules'

import { actionLabel, displayText, fieldLabel } from '../i18n/hqLabels'

const label = (key: string) => fieldLabel(key)
const text = (value: unknown, field?: string) => displayText(value, field)

/** 全程按服务端元单位显示，不使用旧演示页面的“分转元”逻辑。 */
function Records({ rows, onSelect }: { rows: DataRecord[]; onSelect?: (row: DataRecord) => void }) {
  const preferred = ['displayId', 'nickname', 'name', 'title', 'orderNo', 'accountId', 'memberId', 'productId', 'orderId', 'codeId', 'quotaId', 'ownerType', 'ownerId', 'standard', 'activityTotal', 'traceId', 'module', 'action', 'phone', 'tierLabel', 'status', 'frozen', 'amount', 'balance', 'createdAt']
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !['draft', 'allowedActions'].includes(key))
  const visible = [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))].slice(0, 8)
  return <Table<DataRecord> size="small" scroll={{ x: 1000 }} dataSource={rows} rowKey={(row) => String(rows.indexOf(row))} pagination={false}
    columns={[...visible.map((key) => ({ title: label(key), key, ellipsis: true, render: (_: unknown, row: DataRecord) => text(row[key], key) })), {
      title: '操作', key: 'view', width: 100, fixed: 'right' as const,
      render: (_, row) => onSelect ? <Button size="small" type="link" onClick={() => onSelect(row)}>查看详情</Button> : <PopoverRecord row={row} />,
    }]} />
}

function PopoverRecord({ row }: { row: DataRecord }) {
  const [open, setOpen] = useState(false)
  return <><Button size="small" type="link" onClick={() => setOpen(true)}>展开</Button><Drawer title="记录明细" width={760} open={open} onClose={() => setOpen(false)}><DataView value={row} /></Drawer></>
}

function DataView({ value, field }: { value: unknown; field?: string }) {
  if (Array.isArray(value)) return value.length ? value.every((item) => item === null || typeof item !== 'object') ? <Space wrap>{value.map((item, index) => <Tag key={index}>{text(item, field)}</Tag>)}</Space> : <Records rows={dataRows(value)} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
  if (value === null || typeof value !== 'object') return <Typography.Text>{text(value)}</Typography.Text>
  const entries = Object.entries(record(value))
  const scalar = entries.filter(([, item]) => item === null || typeof item !== 'object')
  const complex = entries.filter(([, item]) => item !== null && typeof item === 'object')
  return <Space direction="vertical" style={{ width: '100%' }}>
    {!!scalar.length && <Descriptions bordered size="small" column={2} items={scalar.map(([key, item]) => ({ key, label: label(key), children: <Typography.Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text(item, key)}</Typography.Text> }))} />}
    {!!complex.length && <Collapse items={complex.map(([key, item]) => ({ key, label: `${label(key)}${Array.isArray(item) ? `（${item.length}）` : ''}`, children: <DataView value={item} field={key} /> }))} />}
    {!entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
  </Space>
}

export default function LiveModulePage() {
  const location = useLocation()
  const definition = liveModules.find((item) => item.route === location.pathname)
  if (!definition) return <Card><Empty description="后端文档尚未提供该模块的接口，暂不开放演示操作。" /></Card>
  return <LiveModuleContent key={definition.name} definition={definition} />
}

function LiveModuleContent({ definition }: { definition: typeof liveModules[number] }) {
  const { session } = useAuth()
  const reads = definition.operations.filter((item) => item.method === 'GET')
  const writes = definition.operations.filter((item) => item.method === 'POST')
  const primary = reads.find((item) => !item.params.length && !item.path.endsWith('/catalog')) || reads[0]
  const [selected, setSelected] = useState(primary.key)
  const operation = reads.find((item) => item.key === selected)!
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [queryText, setQueryText] = useState('{}')
  const [query, setQuery] = useState<DataRecord>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{ title: string; data?: unknown; error?: string; busy?: boolean } | null>(null)
  const [write, setWrite] = useState<ModuleOperation | null>(null)
  const [writeBusy, setWriteBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [pending, setPending] = useState<ModuleInput | null>(null)
  const [form] = Form.useForm()
  const detailGeneration = useRef(0)
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${session!.token}` }), [session!.token])
  // 参数输入仅在查询时提交，避免输入半个 ID 就发送请求。
  const [submittedPaths, setSubmittedPaths] = useState<Record<string, string>>({})

  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    if (operation.params.some((key) => !submittedPaths[key])) { setBusy(false); return () => controller.abort() }
    setBusy(true)
    runOperation(operation, { path: submittedPaths, query: { ...query, page, pageSize }, options: { signal: controller.signal, headers: authHeaders } })
      .then((value) => { if (!controller.signal.aborted) setData(value) })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '请求失败') })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [operation, submittedPaths, query, page, pageSize, revision, authHeaders])

  const showRow = async (row: DataRecord) => {
    const generation = ++detailGeneration.current
    const endpoint = reads.find((item) => item.params.length && item.params.every((key) => rowIdentifier(row, key)) && !item.path.endsWith('/records') && !item.path.endsWith('/team'))
    if (!endpoint) { setDetail({ title: '记录明细', data: row }); return }
    setDetail({ title: endpoint.title, busy: true })
    const route = Object.fromEntries(endpoint.params.map((key) => [key, rowIdentifier(row, key)]))
    setPaths(route)
    try {
      const value = await runOperation(endpoint, { path: route, options: { headers: authHeaders } })
      if (generation === detailGeneration.current) setDetail({ title: endpoint.title, data: value })
    } catch (err) { if (generation === detailGeneration.current) setDetail({ title: endpoint.title, error: err instanceof Error ? err.message : '详情读取失败' }) }
  }

  const openWrite = (item: ModuleOperation) => {
    setWrite(item); setWriteError(''); setPending(null)
    form.resetFields()
    form.setFieldsValue({ ...paths, reason: '', idempotencyKey: crypto.randomUUID(), payload: '{}', action: item.actions[0] })
  }
  const prepareWrite = (values: DataRecord) => {
    if (!write) return
    try {
      const body = parseObject(String(values.payload || '{}'))
      const action = String(values.action || '')
      if (values.version !== undefined && values.version !== null) body.version = values.version
      const request = definition.name === 'auth' ? { body: { ...body, reason: String(values.reason || '') } } : buildMutationRequest(write, { ...body, action }, String(values.reason || ''), String(values.idempotencyKey || ''))
      const path = Object.fromEntries(write.params.map((key) => [key, String(values[key] || '').trim()]))
      for (const key of write.params) if (!path[key]) throw new Error(`请填写 ${label(key)}`)
      setPending({ path, request, options: { headers: authHeaders } }); setWriteError('')
    } catch (err) { setWriteError(err instanceof Error ? err.message : '参数无效') }
  }
  const submitWrite = async () => {
    if (!write || !pending || writeBusy) return
    setWriteBusy(true); setWriteError('')
    try {
      const receipt = await runOperation(write, pending)
      setWrite(null); setPending(null); form.resetFields(); setRevision((value) => value + 1)
      if (write.path === '/auth/password') {
        // 改密后服务端撤销旧会话，清理应用会话并回到登录页。
        sessionStorage.removeItem('naoshang:hq:token:v1')
        window.location.replace(`${window.location.pathname}${window.location.search}#/login`)
        window.location.reload()
        return
      }
      setDetail({ title: '操作完成 · 服务端回执', data: receipt })
    } catch (err) {
      setPending(null)
      setWriteError(err instanceof ApiError && err.code === 40901 ? `${err.message}；服务端当前版本 ${err.currentVersion ?? '未知'}，请重新读取详情后提交。` : err instanceof Error ? err.message : '提交失败')
      // 请求号保持不变，网络故障后重试可命中后端幂等。
    } finally { setWriteBusy(false) }
  }
  const object = record(data)
  const rows = dataRows(data)
  const isPage = Array.isArray(object.items) && typeof object.total === 'number'
  const groupedArrays = Object.entries(object).filter(([key, value]) => key !== 'items' && Array.isArray(value))

  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
      <div><Typography.Title level={3} style={{ margin: 0 }}>{definition.title}</Typography.Title><Typography.Text type="secondary">数据与操作均来自总部后台，金额单位为元。</Typography.Text></div>
      <Space wrap><Button onClick={() => setRevision((value) => value + 1)} loading={busy}>刷新</Button>{writes.map((item) => <Button key={item.key} onClick={() => openWrite(item)}>{item.title.split('：')[0].split('（')[0]}</Button>)}</Space>
    </Space>
    <Card size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Select aria-label="业务视图" style={{ minWidth: 290, maxWidth: '100%' }} value={selected} options={reads.map((item) => ({ value: item.key, label: item.title }))} onChange={(key) => { setSelected(key); setSubmittedPaths({}); setPage(1); setQuery({}); setQueryText('{}') }} />
          {operation.params.map((key) => <Input key={key} aria-label={key} placeholder={label(key)} value={paths[key] || ''} onChange={(event) => setPaths((value) => ({ ...value, [key]: event.target.value }))} style={{ width: 210 }} />)}
          <Button type="primary" onClick={() => { try { setQuery(parseObject(queryText)); setSubmittedPaths({ ...paths }); setPage(1); setError(''); setRevision((value) => value + 1) } catch (err) { setError(err instanceof Error ? err.message : '查询参数格式错误') } }}>查询</Button>
        </Space>
        <Collapse size="small" items={[{ key: 'query', label: '查询条件', children: <><Typography.Paragraph type="secondary">使用后端支持的筛选字段填写 JSON 对象，例如账号列表支持 keyword、frozen、tier；页码由下方分页管理。</Typography.Paragraph><Input.TextArea aria-label="查询参数" rows={3} value={queryText} onChange={(event) => setQueryText(event.target.value)} /></> }]} />
      </Space>
    </Card>
    {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => setRevision((value) => value + 1)}>重试</Button>} />}
    <Spin spinning={busy}>
      <Card title={operation.title} size="small" extra={isPage ? <Tag>共 {String(object.total)} 条</Tag> : undefined}>
        {data === null ? <Empty description={operation.params.length && !Object.keys(submittedPaths).length ? '请填写目标 ID 后查询' : error ? '请求失败，请重试' : '正在读取'} /> :
          isPage || Array.isArray(data) ? <><Records rows={rows} onSelect={(row) => void showRow(row)} />{!rows.length && <Typography.Paragraph type="secondary">后端当前未返回记录；这不代表接口异常。</Typography.Paragraph>}
            {isPage && <Pagination style={{ marginTop: 16 }} current={page} pageSize={pageSize} total={Number(object.total)} showSizeChanger pageSizeOptions={[10, 20, 50, 100]} showTotal={(total) => `共 ${total} 条`} onChange={(next, size) => { setPage(size === pageSize ? next : 1); setPageSize(size) }} />}
            {object.summary !== undefined && <Collapse size="small" items={[{ key: 'summary', label: '汇总', children: <DataView value={object.summary} /> }]} />}
          </> : groupedArrays.length ? <Space direction="vertical" style={{ width: '100%' }}>{groupedArrays.map(([key, value]) => <Card size="small" title={`${label(key)}（${(value as unknown[]).length}）`} key={key}>{(value as unknown[]).some((item) => typeof item === 'object' && item !== null) ? <Records rows={dataRows(value)} onSelect={(row) => void showRow(row)} /> : <DataView value={value} />}</Card>)}<DataView value={Object.fromEntries(Object.entries(object).filter(([, value]) => !Array.isArray(value)))} /></Space> : <DataView value={data} />}
        {typeof object.csv === 'string' && <Button onClick={() => {
          const url = URL.createObjectURL(new Blob(['\uFEFF', String(object.csv)], { type: 'text/csv;charset=utf-8' }))
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = String(object.fileName || 'payments.csv'); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>下载 CSV</Button>}
      </Card>
    </Spin>
    <Drawer title={detail?.title} width={800} open={!!detail} onClose={() => { detailGeneration.current++; setDetail(null) }}>
      {detail?.busy ? <Spin /> : detail?.error ? <Alert type="error" message={detail.error} /> : <DataView value={detail?.data} />}
    </Drawer>
    <Modal title={write?.title} open={!!write} width={720} onCancel={() => { if (!writeBusy) { setWrite(null); setPending(null); form.resetFields() } }} footer={null} maskClosable={false} closable={!writeBusy}>
      {writeError && <Alert type="error" showIcon message={writeError} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={prepareWrite} disabled={writeBusy}>
        {write?.params.map((key) => <Form.Item key={key} name={key} label={label(key)} rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>)}
        {definition.name !== 'auth' && <><Form.Item name="action" label="操作类型" rules={[{ required: true, whitespace: true }]}>{write?.actions.length ? <Select options={write.actions.map((action) => ({ value: action, label: `${actionLabel(action)}（${action}）` }))} /> : <Input placeholder="文档未单独定义此端点的操作类型，请按后端约定填写" />}</Form.Item>
        <Form.Item name="version" label="当前资源版本（请以详情返回为准）"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></>}
        <Form.Item name="payload" label="业务参数（JSON 对象）" extra="填写该操作所需字段；金额单位为元。操作类型、原因、版本及请求号由表单统一附加，不发送旧演示页面的字段。" rules={[{ required: true }]}><Input.TextArea rows={7} spellCheck={false} /></Form.Item>
        <Form.Item name="reason" label="操作原因" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={2} maxLength={512} /></Form.Item>
        {definition.name !== 'auth' && <Form.Item name="idempotencyKey" label="幂等请求号（失败重试保持原值）" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>}
        <Button type="primary" htmlType="submit" block>核对并提交</Button>
      </Form>
    </Modal>
    <Modal title="确认执行真实后台操作" open={!!pending} confirmLoading={writeBusy} onCancel={() => { if (!writeBusy) setPending(null) }} onOk={() => void submitWrite()} okText="确认提交" cancelText="取消" cancelButtonProps={{ disabled: writeBusy }} closable={!writeBusy} maskClosable={false}>
      <Typography.Paragraph>{write?.title}</Typography.Paragraph><DataView value={redactCredentials({ ...pending?.path, ...pending?.request?.body })} />
    </Modal>
  </Space>
}
