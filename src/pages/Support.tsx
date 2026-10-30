import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
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
import { supportService } from '../services/support'
import {
  SupportError,
  type AgreementStatus,
  type AgreementType,
  type FeedbackStatus,
  type LegalAgreement,
  type SupportCatalog,
  type SupportFeedbackItem,
  type SupportMutation,
} from '../types/support'
import { ContentPreview } from '../utils/richContent'

const statusLabel: Record<AgreementStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
}
const statusColor: Record<AgreementStatus, string> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  OFFLINE: 'warning',
}
const typeLabel: Record<AgreementType, string> = {
  user: '用户协议',
  privacy: '隐私政策',
}
const feedbackLabel: Record<FeedbackStatus, string> = {
  OPEN: '待处理',
  HANDLED: '已处理',
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  } catch {
    return iso
  }
}

export default function Support() {
  const { session } = useAuth()
  const token = session?.token ?? ''
  const canManage = hasPermission(session?.account ?? null, 'support:manage')

  const [catalog, setCatalog] = useState<SupportCatalog | null>(null)
  const [feedback, setFeedback] = useState<SupportFeedbackItem[]>([])
  const [fbTotal, setFbTotal] = useState(0)
  const [fbPage, setFbPage] = useState(1)
  const [fbPageSize, setFbPageSize] = useState(10)
  const [fbKeyword, setFbKeyword] = useState('')
  const [fbStatus, setFbStatus] = useState<FeedbackStatus | undefined>('OPEN')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<LegalAgreement | null>(null)
  const [preview, setPreview] = useState<LegalAgreement | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [handleOpen, setHandleOpen] = useState(false)
  const [handleTarget, setHandleTarget] = useState<SupportFeedbackItem | null>(null)

  const [agreeForm] = Form.useForm()
  const [configForm] = Form.useForm()
  const [handleForm] = Form.useForm()

  const reload = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [cat, list] = await Promise.all([
        supportService.catalog(token),
        supportService.feedbackList(token, {
          page: fbPage,
          pageSize: fbPageSize,
          keyword: fbKeyword || undefined,
          status: fbStatus,
        }),
      ])
      setCatalog(cat)
      setFeedback(list.items)
      setFbTotal(list.total)
    } catch (err) {
      message.error(err instanceof SupportError ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [token, fbPage, fbPageSize, fbKeyword, fbStatus])

  useEffect(() => { void reload() }, [reload])

  function runMutate(input: SupportMutation, title: string, content: string) {
    if (!canManage) {
      message.error('没有协议与客服管理权限')
      return Promise.reject(new Error('forbidden'))
    }
    return new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title,
        content,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          setBusy(true)
          try {
            const result = await supportService.mutate(token, input)
            message.success(result.message)
            setEditOpen(false)
            setConfigOpen(false)
            setHandleOpen(false)
            await reload()
            resolve()
          } catch (err) {
            message.error(err instanceof SupportError ? err.message : '操作失败')
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

  function openEdit(row: LegalAgreement) {
    setEditing(row)
    agreeForm.setFieldsValue({
      title: row.title,
      docVersion: row.docVersion,
      bodyText: row.bodyText,
      reason: '',
    })
    setEditOpen(true)
  }

  function openConfig() {
    if (!catalog) return
    configForm.setFieldsValue({
      phone: catalog.supportConfig.phone,
      description: catalog.supportConfig.description,
      feedbackMaxImages: catalog.supportConfig.feedbackMaxImages,
      reason: '',
    })
    setConfigOpen(true)
  }

  function openHandle(row: SupportFeedbackItem) {
    setHandleTarget(row)
    handleForm.setFieldsValue({ handleNote: '', reason: '' })
    setHandleOpen(true)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>协议与客服预留（HQ-25）</Typography.Title>
      <Alert
        type="warning"
        showIcon
        message="HQ-25：仅协议与反馈预留，不扩成完整客服工单"
        description={catalog?.fullCsGapNote ?? '总部仅配置联系电话与说明；小程序「联系客服」拨号或引导意见反馈。'}
      />
      <Alert type="info" showIcon message="协议口径" description={catalog?.agreementNote} />

      <Space size={48} wrap>
        <Statistic title="协议条数" value={catalog?.agreements.length ?? 0} />
        <Statistic title="待处理反馈" value={catalog?.feedbackSummary.open ?? 0} />
        <Statistic title="已处理反馈" value={catalog?.feedbackSummary.handled ?? 0} />
        <Statistic title="反馈图片上限" value={catalog?.supportConfig.feedbackMaxImages ?? '—'} />
      </Space>

      <Tabs
        items={[
          {
            key: 'agreements',
            label: '协议版本',
            children: (
              <Card
                loading={loading}
                title="用户协议 / 隐私政策"
                extra={
                  <Typography.Text type="secondary">
                    对齐小程序 settings/agreement?type=user|privacy
                  </Typography.Text>
                }
              >
                <Table
                  rowKey="agreementId"
                  size="middle"
                  dataSource={catalog?.agreements ?? []}
                  pagination={false}
                  columns={[
                    {
                      title: '类型',
                      dataIndex: 'type',
                      render: (t: AgreementType) => typeLabel[t],
                    },
                    { title: '标题', dataIndex: 'title' },
                    { title: '文案版本', dataIndex: 'docVersion' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (s: AgreementStatus) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
                    },
                    { title: '数据版本', dataIndex: 'version' },
                    {
                      title: '发布时间',
                      dataIndex: 'publishedAt',
                      render: (v: string | null) => formatTime(v),
                    },
                    {
                      title: '操作',
                      key: 'ops',
                      render: (_, row: LegalAgreement) => (
                        <Space wrap>
                          <Button size="small" onClick={() => setPreview(row)}>预览</Button>
                          {canManage && (row.allowedActions ?? []).includes('save-agreement') && (
                            <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
                          )}
                          {canManage && (row.allowedActions ?? []).includes('publish-agreement') && (
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => {
                                Modal.confirm({
                                  title: '发布协议',
                                  content: (
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                      <span>将发布「{row.title}」，同类型已发布版本会自动下线。</span>
                                      <Input.TextArea
                                        id="pub-reason"
                                        placeholder="操作原因"
                                        rows={2}
                                        onChange={(e) => { (window as unknown as { __pubReason?: string }).__pubReason = e.target.value }}
                                      />
                                    </Space>
                                  ),
                                  okText: '确认发布',
                                  onOk: async () => {
                                    const reason = ((window as unknown as { __pubReason?: string }).__pubReason ?? '').trim()
                                    if (!reason) {
                                      message.error('请填写原因')
                                      throw new Error('need reason')
                                    }
                                    setBusy(true)
                                    try {
                                      const result = await supportService.mutate(token, {
                                        action: 'publish-agreement',
                                        agreementId: row.agreementId,
                                        version: row.version,
                                        reason,
                                        idempotencyKey: crypto.randomUUID(),
                                      })
                                      message.success(result.message)
                                      await reload()
                                    } catch (err) {
                                      if (err instanceof Error && err.message === 'need reason') throw err
                                      message.error(err instanceof SupportError ? err.message : '发布失败')
                                      throw err
                                    } finally {
                                      setBusy(false)
                                      delete (window as unknown as { __pubReason?: string }).__pubReason
                                    }
                                  },
                                })
                              }}
                            >
                              发布
                            </Button>
                          )}
                          {canManage && (row.allowedActions ?? []).includes('offline-agreement') && (
                            <Button
                              size="small"
                              danger
                              onClick={() => {
                                Modal.confirm({
                                  title: '下线协议',
                                  content: (
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                      <span>下线后小程序应展示「内容暂未发布」。</span>
                                      <Input.TextArea
                                        id="off-reason"
                                        placeholder="操作原因"
                                        rows={2}
                                        onChange={(e) => { (window as unknown as { __offReason?: string }).__offReason = e.target.value }}
                                      />
                                    </Space>
                                  ),
                                  okText: '确认下线',
                                  onOk: async () => {
                                    const reason = ((window as unknown as { __offReason?: string }).__offReason ?? '').trim()
                                    if (!reason) {
                                      message.error('请填写原因')
                                      throw new Error('need reason')
                                    }
                                    setBusy(true)
                                    try {
                                      const result = await supportService.mutate(token, {
                                        action: 'offline-agreement',
                                        agreementId: row.agreementId,
                                        version: row.version,
                                        reason,
                                        idempotencyKey: crypto.randomUUID(),
                                      })
                                      message.success(result.message)
                                      await reload()
                                    } catch (err) {
                                      if (err instanceof Error && err.message === 'need reason') throw err
                                      message.error(err instanceof SupportError ? err.message : '下线失败')
                                      throw err
                                    } finally {
                                      setBusy(false)
                                      delete (window as unknown as { __offReason?: string }).__offReason
                                    }
                                  },
                                })
                              }}
                            >
                              下线
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
            key: 'config',
            label: '客服入口配置',
            children: (
              <Card
                loading={loading}
                title="联系客服入口（预留）"
                extra={canManage ? <Button type="primary" onClick={openConfig}>编辑配置</Button> : null}
              >
                {catalog && (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="客服电话">{catalog.supportConfig.phone || '（未配置，小程序可能仅引导反馈）'}</Descriptions.Item>
                    <Descriptions.Item label="说明文案">{catalog.supportConfig.description}</Descriptions.Item>
                    <Descriptions.Item label="反馈图片上限">{catalog.supportConfig.feedbackMaxImages}</Descriptions.Item>
                    <Descriptions.Item label="完整客服">
                      <Tag color="orange">未实现（fullCustomerServicePending）</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="数据版本">{catalog.supportConfig.version}</Descriptions.Item>
                    <Descriptions.Item label="更新时间">{formatTime(catalog.supportConfig.updatedAt)}</Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            ),
          },
          {
            key: 'feedback',
            label: '意见反馈',
            children: (
              <Card loading={loading} title="意见反馈查阅（非工单系统）">
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input.Search
                    allowClear
                    placeholder="关键词 / 手机 / 反馈ID"
                    style={{ width: 240 }}
                    onSearch={(v) => { setFbKeyword(v); setFbPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="状态"
                    style={{ width: 140 }}
                    value={fbStatus}
                    onChange={(v) => { setFbStatus(v); setFbPage(1) }}
                    options={[
                      { value: 'OPEN', label: '待处理' },
                      { value: 'HANDLED', label: '已处理' },
                    ]}
                  />
                  <Button onClick={() => void reload()}>刷新</Button>
                </Space>
                <Table
                  rowKey="feedbackId"
                  size="middle"
                  dataSource={feedback}
                  pagination={{
                    current: fbPage,
                    pageSize: fbPageSize,
                    total: fbTotal,
                    showSizeChanger: true,
                    onChange: (p, ps) => { setFbPage(p); setFbPageSize(ps) },
                  }}
                  columns={[
                    { title: '反馈ID', dataIndex: 'feedbackId', width: 140 },
                    {
                      title: '账号',
                      key: 'account',
                      render: (_, r: SupportFeedbackItem) => (
                        <>
                          {r.accountName}<br />
                          <Typography.Text type="secondary">{r.phone}</Typography.Text>
                        </>
                      ),
                    },
                    { title: '内容', dataIndex: 'content', ellipsis: true },
                    { title: '图片数', dataIndex: 'imageCount', width: 80 },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (s: FeedbackStatus) => (
                        <Tag color={s === 'OPEN' ? 'processing' : 'success'}>{feedbackLabel[s]}</Tag>
                      ),
                    },
                    {
                      title: '提交时间',
                      dataIndex: 'createdAt',
                      width: 170,
                      render: (v: string) => formatTime(v),
                    },
                    {
                      title: '操作',
                      key: 'ops',
                      width: 120,
                      render: (_, row: SupportFeedbackItem) =>
                        canManage && (row.allowedActions ?? []).includes('mark-feedback-handled') ? (
                          <Button size="small" type="primary" onClick={() => openHandle(row)}>标记处理</Button>
                        ) : (
                          <Typography.Text type="secondary">{row.handleNote || '—'}</Typography.Text>
                        ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        open={!!preview}
        title={preview ? `预览 · ${preview.title}` : '预览'}
        footer={null}
        onCancel={() => setPreview(null)}
        width={720}
      >
        {preview && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Tag color={statusColor[preview.status]}>{statusLabel[preview.status]}</Tag>
            <Typography.Text type="secondary">文案版本 {preview.docVersion}</Typography.Text>
            <ContentPreview value={preview.content} />
          </Space>
        )}
      </Modal>

      <Modal
        open={editOpen}
        title={editing ? `编辑协议 · ${typeLabel[editing.type]}` : '编辑协议'}
        onCancel={() => setEditOpen(false)}
        confirmLoading={busy}
        okText="保存"
        onOk={async () => {
          const values = await agreeForm.validateFields()
          await runMutate(
            {
              action: 'save-agreement',
              agreementId: editing!.agreementId,
              version: editing!.version,
              reason: values.reason,
              idempotencyKey: crypto.randomUUID(),
              title: values.title,
              docVersion: values.docVersion,
              bodyText: values.bodyText,
            },
            '保存协议',
            '将写入标题、文案版本与正文（纯文本转段落节点）。请确认原因已填写。',
          )
        }}
        width={720}
        destroyOnClose
      >
        <Form form={agreeForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item name="docVersion" label="协议文案版本" rules={[{ required: true, message: '请填写文案版本' }]}>
            <Input maxLength={40} placeholder="如 2026.10.28" />
          </Form.Item>
          <Form.Item name="bodyText" label="正文（纯文本，按空行分段）" rules={[{ required: true, message: '请填写正文' }]}>
            <Input.TextArea rows={10} />
          </Form.Item>
          <Form.Item name="reason" label="操作原因" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={configOpen}
        title="编辑客服入口配置"
        onCancel={() => setConfigOpen(false)}
        confirmLoading={busy}
        okText="保存"
        onOk={async () => {
          const values = await configForm.validateFields()
          await runMutate(
            {
              action: 'save-support-config',
              version: catalog!.supportConfig.version,
              reason: values.reason,
              idempotencyKey: crypto.randomUUID(),
              phone: values.phone ?? '',
              description: values.description,
              feedbackMaxImages: values.feedbackMaxImages,
            },
            '保存客服配置',
            '仅更新入口电话与说明，不会开通在线客服台。',
          )
        }}
        destroyOnClose
      >
        <Alert type="warning" style={{ marginBottom: 12 }} message="完整客服系统仍为缺口，本配置只服务小程序「联系客服」拨号与反馈上限。" />
        <Form form={configForm} layout="vertical">
          <Form.Item name="phone" label="客服电话（可留空；填写时用数字）">
            <Input maxLength={20} placeholder="如 4008001234" />
          </Form.Item>
          <Form.Item name="description" label="说明文案" rules={[{ required: true, message: '请填写说明' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="feedbackMaxImages"
            label="意见反馈图片上限（0–9）"
            rules={[{ required: true, message: '请填写上限' }]}
          >
            <InputNumber min={0} max={9} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="操作原因" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={handleOpen}
        title={handleTarget ? `标记处理 · ${handleTarget.feedbackId}` : '标记处理'}
        onCancel={() => setHandleOpen(false)}
        confirmLoading={busy}
        okText="标记完成"
        onOk={async () => {
          const values = await handleForm.validateFields()
          await runMutate(
            {
              action: 'mark-feedback-handled',
              feedbackId: handleTarget!.feedbackId,
              version: handleTarget!.version,
              reason: values.reason,
              idempotencyKey: crypto.randomUUID(),
              handleNote: values.handleNote,
            },
            '标记反馈已处理',
            '此操作不是客服工单系统结案，仅总部查阅标记。',
          )
        }}
        destroyOnClose
      >
        {handleTarget && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            message={`${handleTarget.accountName} ${handleTarget.phone}`}
            description={handleTarget.content}
          />
        )}
        <Form form={handleForm} layout="vertical">
          <Form.Item name="handleNote" label="处理说明" rules={[{ required: true, message: '请填写处理说明' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="reason" label="操作原因" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Typography.Paragraph type="secondary">
        HQ-25 边界：用户/隐私协议发布下线 + 联系客服入口配置 + 意见反馈查阅处理；非坐席工单/非 BI。写操作须原因/版本/幂等/确认。
      </Typography.Paragraph>
    </Space>
  )
}
