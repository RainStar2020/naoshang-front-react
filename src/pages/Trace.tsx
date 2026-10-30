import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { traceService } from '../services/trace'
import {
  TraceError,
  type AssetStatus,
  type TraceCatalog,
  type TraceModule,
  type TraceMutation,
  type TraceTask,
  type TraceTaskKind,
  type TraceTaskStatus,
  type UnifiedAuditEntry,
  type UploadResource,
} from '../types/trace'

const assetStatusLabel: Record<AssetStatus, string> = {
  PENDING: '待完成',
  READY: '可用',
  FAILED: '失败',
  QUARANTINED: '已隔离',
}
const assetStatusColor: Record<AssetStatus, string> = {
  PENDING: 'processing',
  READY: 'success',
  FAILED: 'error',
  QUARANTINED: 'warning',
}
const taskStatusLabel: Record<TraceTaskStatus, string> = {
  PROCESSING: '处理中',
  SUCCEEDED: '成功',
  FAILED: '失败',
}
const taskKindLabel: Record<TraceTaskKind, string> = {
  UPLOAD_PROCESS: '上传处理',
  MATERIAL_COMPOSE: '素材合成',
  EXPORT: '导出',
  OTHER: '其他',
}
const moduleLabel: Record<TraceModule, string> = {
  users: '用户',
  members: '学员',
  materials: '素材',
  support: '协议客服',
  withdrawals: '提现',
  payments: '支付',
  orders: '订单',
  training: '训练',
  assets: '资源',
  other: '其他',
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return iso
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Trace() {
  const { session } = useAuth()
  const token = session?.token ?? ''
  const canManage = hasPermission(session?.account ?? null, 'trace:manage')

  const [catalog, setCatalog] = useState<TraceCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const [resources, setResources] = useState<UploadResource[]>([])
  const [resTotal, setResTotal] = useState(0)
  const [resPage, setResPage] = useState(1)
  const [resPageSize, setResPageSize] = useState(10)
  const [resKeyword, setResKeyword] = useState('')
  const [resStatus, setResStatus] = useState<AssetStatus | undefined>()

  const [tasks, setTasks] = useState<TraceTask[]>([])
  const [taskTotal, setTaskTotal] = useState(0)
  const [taskPage, setTaskPage] = useState(1)
  const [taskPageSize, setTaskPageSize] = useState(10)
  const [taskKeyword, setTaskKeyword] = useState('')
  const [taskStatus, setTaskStatus] = useState<TraceTaskStatus | undefined>()

  const [audits, setAudits] = useState<UnifiedAuditEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(10)
  const [auditKeyword, setAuditKeyword] = useState('')
  const [auditModule, setAuditModule] = useState<TraceModule | undefined>()

  const reload = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [cat, res, job, aud] = await Promise.all([
        traceService.catalog(token),
        traceService.resources(token, {
          page: resPage,
          pageSize: resPageSize,
          keyword: resKeyword || undefined,
          status: resStatus,
        }),
        traceService.tasks(token, {
          page: taskPage,
          pageSize: taskPageSize,
          keyword: taskKeyword || undefined,
          status: taskStatus,
        }),
        traceService.audits(token, {
          page: auditPage,
          pageSize: auditPageSize,
          keyword: auditKeyword || undefined,
          module: auditModule,
        }),
      ])
      setCatalog(cat)
      setResources(res.items)
      setResTotal(res.total)
      setTasks(job.items)
      setTaskTotal(job.total)
      setAudits(aud.items)
      setAuditTotal(aud.total)
    } catch (err) {
      message.error(err instanceof TraceError ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [
    token,
    resPage,
    resPageSize,
    resKeyword,
    resStatus,
    taskPage,
    taskPageSize,
    taskKeyword,
    taskStatus,
    auditPage,
    auditPageSize,
    auditKeyword,
    auditModule,
  ])

  useEffect(() => { void reload() }, [reload])

  function runMutate(input: TraceMutation, title: string, content: string) {
    if (!canManage) {
      message.error('没有通用资源与操作追溯管理权限')
      return Promise.reject(new Error('forbidden'))
    }
    return new Promise<void>((resolve, reject) => {
      let reason = ''
      Modal.confirm({
        title,
        content: (
          <Space direction="vertical" style={{ width: '100%' }}>
            <span>{content}</span>
            <Input.TextArea
              rows={2}
              placeholder="操作原因（必填）"
              onChange={(e) => { reason = e.target.value }}
            />
          </Space>
        ),
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          const trimmed = reason.trim()
          if (!trimmed) {
            message.error('请填写原因')
            throw new Error('need reason')
          }
          setBusy(true)
          try {
            const result = await traceService.mutate(token, { ...input, reason: trimmed })
            message.success(result.message)
            await reload()
            resolve()
          } catch (err) {
            if (err instanceof Error && err.message === 'need reason') throw err
            message.error(err instanceof TraceError ? err.message : '操作失败')
            reject(err)
            throw err
          } finally {
            setBusy(false)
          }
        },
        onCancel: () => reject(new Error('cancelled')),
      })
    })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>通用资源与操作追溯（HQ-26）</Typography.Title>
      <Alert type="warning" showIcon message="HQ-26：通用资源与操作审计聚合" description={catalog?.unifiedAuditGapNote} />
      <Alert type="info" showIcon message="上传契约" description={catalog?.uploadContractNote} />
      <Alert type="info" showIcon message="边界" description={catalog?.noTicketNote} />

      <Space size={32} wrap>
        <Statistic title="上传资源" value={catalog?.resourceSummary.total ?? 0} />
        <Statistic title="可用 READY" value={catalog?.resourceSummary.ready ?? 0} />
        <Statistic title="待完成" value={catalog?.resourceSummary.pending ?? 0} />
        <Statistic title="已隔离" value={catalog?.resourceSummary.quarantined ?? 0} />
        <Statistic title="失败任务" value={catalog?.taskSummary.failed ?? 0} />
        <Statistic title="审计条目" value={catalog?.auditSummary.total ?? 0} />
      </Space>

      <Tabs
        items={[
          {
            key: 'resources',
            label: '上传资源',
            children: (
              <Card loading={loading} title="通用上传资源（assetId = fileId）">
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input.Search
                    allowClear
                    placeholder="资源ID / 文件名 / 用途 / 账号"
                    style={{ width: 260 }}
                    onSearch={(v) => { setResKeyword(v); setResPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="状态"
                    style={{ width: 140 }}
                    value={resStatus}
                    onChange={(v) => { setResStatus(v); setResPage(1) }}
                    options={(Object.keys(assetStatusLabel) as AssetStatus[]).map((k) => ({
                      value: k,
                      label: assetStatusLabel[k],
                    }))}
                  />
                  <Button onClick={() => void reload()} loading={busy}>刷新</Button>
                </Space>
                <Table
                  rowKey="assetId"
                  size="middle"
                  dataSource={resources}
                  pagination={{
                    current: resPage,
                    pageSize: resPageSize,
                    total: resTotal,
                    showSizeChanger: true,
                    onChange: (p, ps) => { setResPage(p); setResPageSize(ps) },
                  }}
                  columns={[
                    { title: 'assetId / fileId', dataIndex: 'assetId', width: 160 },
                    { title: '用途', dataIndex: 'purpose', width: 140 },
                    { title: '文件', dataIndex: 'fileName' },
                    {
                      title: '大小',
                      dataIndex: 'sizeBytes',
                      width: 90,
                      render: (n: number) => formatSize(n),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (s: AssetStatus) => (
                        <Tag color={assetStatusColor[s]}>{assetStatusLabel[s]}</Tag>
                      ),
                    },
                    {
                      title: '归属',
                      key: 'owner',
                      render: (_, r: UploadResource) => (
                        <>
                          {r.ownerName}
                          <br />
                          <Typography.Text type="secondary">{r.ownerAccountId}</Typography.Text>
                        </>
                      ),
                    },
                    { title: '业务提示', dataIndex: 'boundHint', ellipsis: true },
                    {
                      title: '更新',
                      dataIndex: 'updatedAt',
                      width: 170,
                      render: (v: string) => formatTime(v),
                    },
                    {
                      title: '操作',
                      key: 'ops',
                      width: 120,
                      render: (_, row: UploadResource) => (
                        <Space wrap>
                          {canManage && (row.allowedActions ?? []).includes('quarantine-resource') && (
                            <Button
                              size="small"
                              danger
                              onClick={() =>
                                void runMutate(
                                  {
                                    action: 'quarantine-resource',
                                    assetId: row.assetId,
                                    version: row.version,
                                    reason: '',
                                    idempotencyKey: crypto.randomUUID(),
                                  },
                                  '隔离资源',
                                  '隔离后不可再绑定业务申请；仅 READY 可隔离。',
                                )
                              }
                            >
                              隔离
                            </Button>
                          )}
                          {canManage && (row.allowedActions ?? []).includes('restore-resource') && (
                            <Button
                              size="small"
                              type="primary"
                              onClick={() =>
                                void runMutate(
                                  {
                                    action: 'restore-resource',
                                    assetId: row.assetId,
                                    version: row.version,
                                    reason: '',
                                    idempotencyKey: crypto.randomUUID(),
                                  },
                                  '恢复资源',
                                  '将恢复为 READY，可再次被业务引用。',
                                )
                              }
                            >
                              恢复
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'tasks',
            label: '异步任务',
            children: (
              <Card loading={loading} title="异步任务（对齐 /jobs/{id}）">
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input.Search
                    allowClear
                    placeholder="任务ID / 标题 / 关联资源"
                    style={{ width: 260 }}
                    onSearch={(v) => { setTaskKeyword(v); setTaskPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="状态"
                    style={{ width: 140 }}
                    value={taskStatus}
                    onChange={(v) => { setTaskStatus(v); setTaskPage(1) }}
                    options={(Object.keys(taskStatusLabel) as TraceTaskStatus[]).map((k) => ({
                      value: k,
                      label: taskStatusLabel[k],
                    }))}
                  />
                  <Button onClick={() => void reload()} loading={busy}>刷新</Button>
                </Space>
                <Table
                  rowKey="jobId"
                  size="middle"
                  dataSource={tasks}
                  pagination={{
                    current: taskPage,
                    pageSize: taskPageSize,
                    total: taskTotal,
                    showSizeChanger: true,
                    onChange: (p, ps) => { setTaskPage(p); setTaskPageSize(ps) },
                  }}
                  columns={[
                    { title: 'jobId', dataIndex: 'jobId', width: 150 },
                    {
                      title: '类型',
                      dataIndex: 'kind',
                      width: 110,
                      render: (k: TraceTaskKind) => taskKindLabel[k],
                    },
                    { title: '标题', dataIndex: 'title' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (s: TraceTaskStatus) => (
                        <Tag color={s === 'FAILED' ? 'error' : s === 'SUCCEEDED' ? 'success' : 'processing'}>
                          {taskStatusLabel[s]}
                        </Tag>
                      ),
                    },
                    {
                      title: '关联模块',
                      dataIndex: 'relatedModule',
                      width: 100,
                      render: (m: TraceModule) => moduleLabel[m],
                    },
                    { title: '结果摘要', dataIndex: 'resultSummary', ellipsis: true },
                    {
                      title: '创建',
                      dataIndex: 'createdAt',
                      width: 170,
                      render: (v: string) => formatTime(v),
                    },
                    {
                      title: '操作',
                      key: 'ops',
                      width: 100,
                      render: (_, row: TraceTask) =>
                        canManage && (row.allowedActions ?? []).includes('retry-task') ? (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() =>
                              void runMutate(
                                {
                                  action: 'retry-task',
                                  jobId: row.jobId,
                                  version: row.version,
                                  reason: '',
                                  idempotencyKey: crypto.randomUUID(),
                                },
                                '重试失败任务',
                                '仅将任务重新置为处理中（Mock，不保证真实处理完成）。',
                              )
                            }
                          >
                            重试
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'audits',
            label: '统一审计',
            children: (
              <Card loading={loading} title="跨模块操作追溯（聚合 Mock 种子）">
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input.Search
                    allowClear
                    placeholder="目标 / 摘要 / 操作人 / 请求号"
                    style={{ width: 280 }}
                    onSearch={(v) => { setAuditKeyword(v); setAuditPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="模块"
                    style={{ width: 140 }}
                    value={auditModule}
                    onChange={(v) => { setAuditModule(v); setAuditPage(1) }}
                    options={(Object.keys(moduleLabel) as TraceModule[]).map((k) => ({
                      value: k,
                      label: moduleLabel[k],
                    }))}
                  />
                  <Button onClick={() => void reload()} loading={busy}>刷新</Button>
                </Space>
                <Table
                  rowKey="entryId"
                  size="middle"
                  dataSource={audits}
                  pagination={{
                    current: auditPage,
                    pageSize: auditPageSize,
                    total: auditTotal,
                    showSizeChanger: true,
                    onChange: (p, ps) => { setAuditPage(p); setAuditPageSize(ps) },
                  }}
                  columns={[
                    {
                      title: '时间',
                      dataIndex: 'occurredAt',
                      width: 170,
                      render: (v: string) => formatTime(v),
                    },
                    {
                      title: '模块',
                      dataIndex: 'module',
                      width: 100,
                      render: (m: TraceModule) => moduleLabel[m],
                    },
                    { title: '动作', dataIndex: 'action', width: 140 },
                    { title: '目标', dataIndex: 'targetId', width: 140 },
                    { title: '摘要', dataIndex: 'summary', ellipsis: true },
                    {
                      title: '前后',
                      key: 'ba',
                      width: 160,
                      render: (_, r: UnifiedAuditEntry) => (
                        <Typography.Text type="secondary">
                          {r.before || '—'} → {r.after || '—'}
                        </Typography.Text>
                      ),
                    },
                    { title: '操作人', dataIndex: 'operatorName', width: 140 },
                    { title: '原因', dataIndex: 'reason', ellipsis: true },
                    {
                      title: '来源',
                      dataIndex: 'source',
                      width: 130,
                      render: () => <Tag>AGGREGATED_MOCK</Tag>,
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
      <Typography.Paragraph type="secondary">
        HQ-26：上传三步（intent→字节→completion）仅 READY 可绑定；隔离/恢复须原因/版本/幂等/确认。本页非客服工单；审计为聚合只读视图。
      </Typography.Paragraph>
    </Space>
  )
}
