import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { withdrawalService } from '../services/withdrawals'
import {
  WithdrawalError,
  type WithdrawAccountType,
  type WithdrawModule,
  type WithdrawStatus,
  type WithdrawalApplication,
  type WithdrawalCatalog,
  type WithdrawalDetail,
  type WithdrawalMutation,
} from '../types/withdrawals'

function fen(n: number) {
  return `${(n / 100).toFixed(2)} 元`
}

const statusLabel: Record<WithdrawStatus, string> = {
  PENDING_REVIEW: '待审核',
  PROCESSING: '处理中',
  SUCCEEDED: '已完成',
  REJECTED: '未通过',
}
const statusColor: Record<WithdrawStatus, string> = {
  PENDING_REVIEW: 'processing',
  PROCESSING: 'warning',
  SUCCEEDED: 'success',
  REJECTED: 'error',
}
const moduleLabel: Record<WithdrawModule, string> = {
  wholesale: '合伙人',
  costore: '合店',
  agency: '代理',
}

export default function Withdrawals() {
  const { session } = useAuth()
  const token = session!.token
  const canReview = hasPermission(session!.account, 'withdrawals:review')

  const [catalog, setCatalog] = useState<WithdrawalCatalog | null>(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<WithdrawStatus>()
  const [module, setModule] = useState<WithdrawModule>()
  const [accountType, setAccountType] = useState<WithdrawAccountType>()
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<WithdrawalApplication[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({
    applications: 0,
    pendingReview: 0,
    processing: 0,
    succeeded: 0,
    rejected: 0,
    receiptFailed: 0,
    pendingAmount: 0,
    succeededAmount: 0,
  })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<WithdrawalDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const [pending, setPending] = useState<WithdrawalMutation | null>(null)
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState<'SUCCESS' | 'FAILED'>('SUCCESS')
  const [voucherUrl, setVoucherUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await withdrawalService.catalog(token))
    } catch (error) {
      message.error(error instanceof WithdrawalError ? error.message : '加载目录失败')
    }
  }, [token])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await withdrawalService.list(token, {
        page,
        pageSize: 10,
        keyword: keyword || undefined,
        status,
        module,
        accountType,
      })
      setRows(list.items)
      setTotal(list.total)
      setSummary(list.summary)
    } catch (error) {
      message.error(error instanceof WithdrawalError ? error.message : '加载列表失败')
    } finally {
      setLoading(false)
    }
  }, [token, page, keyword, status, module, accountType])

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await withdrawalService.detail(token, id))
      } catch (error) {
        message.error(error instanceof WithdrawalError ? error.message : '加载详情失败')
      }
    },
    [token],
  )

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])
  useEffect(() => {
    void loadList()
  }, [loadList])
  useEffect(() => {
    if (detailId) void loadDetail(detailId)
    else setDetail(null)
  }, [detailId, loadDetail])

  const openMutate = (row: WithdrawalApplication, action: WithdrawalMutation['action']) => {
    setSubmitError('')
    setReason('')
    setReceipt('SUCCESS')
    setVoucherUrl('')
    const base = {
      withdrawalId: row.withdrawalId,
      version: row.version,
      reason: '',
      idempotencyKey: crypto.randomUUID(),
    }
    if (action === 'register-receipt') setPending({ ...base, action, receipt: 'SUCCESS' })
    else setPending({ ...base, action })
  }

  const submit = async () => {
    if (!pending) return
    setBusy(true)
    setSubmitError('')
    try {
      let input: WithdrawalMutation
      if (pending.action === 'register-receipt') {
        input = {
          ...pending,
          receipt,
          voucherUrl: receipt === 'SUCCESS' ? voucherUrl.trim() || undefined : undefined,
          reason: reason.trim(),
        }
      } else {
        input = { ...pending, reason: reason.trim() }
      }
      const result = await withdrawalService.mutate(token, input)
      message.success(
        result.action === 'approve'
          ? '已同意，进入待打款回执（非银行已到账）'
          : result.action === 'reject'
            ? '已拒绝（余额退回由钱包服务处理）'
            : receipt === 'SUCCESS'
              ? '已登记成功回执'
              : '已登记失败回执，可再次登记',
      )
      setPending(null)
      await loadList()
      if (detailId) await loadDetail(detailId)
      await loadCatalog()
    } catch (error) {
      const msg = error instanceof WithdrawalError ? error.message : '提交失败'
      setSubmitError(msg)
      message.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        title: '申请单',
        dataIndex: 'withdrawalId',
        width: 150,
        render: (id: string, row: WithdrawalApplication) => (
          <Space direction="vertical" size={0}>
            <Typography.Link onClick={() => setDetailId(id)}>{id}</Typography.Link>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {moduleLabel[row.module]} · {row.identityLabel}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '申请人 / 收款',
        render: (_: unknown, row: WithdrawalApplication) => (
          <Space direction="vertical" size={0}>
            <span>
              {row.accountName} / {row.phone}
            </span>
            <Typography.Text type="secondary">
              {row.accountType === 'COMPANY' ? '公司' : '个人'} · {row.payeeName} · {row.bankName}/
              {row.maskedBankNumber}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '金额',
        width: 130,
        render: (_: unknown, row: WithdrawalApplication) => (
          <Space direction="vertical" size={0}>
            <span>{fen(row.amount)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              费 {fen(row.fee)} → 到账 {fen(row.netAmount)}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '状态',
        width: 120,
        render: (_: unknown, row: WithdrawalApplication) => (
          <Space direction="vertical" size={0}>
            <Tag color={statusColor[row.status]}>{statusLabel[row.status]}</Tag>
            {row.payoutReceiptStatus === 'FAILED' && <Tag color="error">回执失败</Tag>}
          </Space>
        ),
      },
      {
        title: '申请时间',
        dataIndex: 'createdAt',
        width: 180,
      },
      {
        title: '操作',
        width: 240,
        render: (_: unknown, row: WithdrawalApplication) => (
          <Space wrap>
            <Button size="small" onClick={() => setDetailId(row.withdrawalId)}>
              详情
            </Button>
            {canReview && row.allowedActions.includes('approve') && (
              <Button size="small" type="primary" onClick={() => openMutate(row, 'approve')}>
                同意
              </Button>
            )}
            {canReview && row.allowedActions.includes('reject') && (
              <Button size="small" danger onClick={() => openMutate(row, 'reject')}>
                拒绝
              </Button>
            )}
            {canReview && row.allowedActions.includes('register-receipt') && (
              <Button size="small" onClick={() => openMutate(row, 'register-receipt')}>
                登记回执
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [canReview],
  )

  const mutateTitle =
    pending?.action === 'approve'
      ? '同意提现（进入待打款回执）'
      : pending?.action === 'reject'
        ? '拒绝提现'
        : pending?.action === 'register-receipt'
          ? '登记打款回执（非前端执行打款）'
          : ''

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        提现审核与打款回执
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        message="HQ-23：与「查看收益」分开。审核同意后仅为处理中，须登记服务端/通道回执才到「已完成」；勿伪造打款渠道终态。费率/最低额/自动打款政策待定。拒绝不在本页改可提现余额；个人提现表单仍在小程序。"
      />
      {catalog && (
        <>
          <Alert type="warning" showIcon message={catalog.payoutGapNote || '打款由服务端/支付通道执行：总部仅审核与登记回执。'} />
          <Alert type="info" showIcon message={catalog.pendingPolicy?.note || '最低提现额、手续费费率、人工/自动打款层级尚待定。'} />
        </>
      )}

      <Card>
        <Space wrap size="large">
          <Statistic title="申请数" value={summary.applications} />
          <Statistic title="待审核" value={summary.pendingReview} />
          <Statistic title="处理中" value={summary.processing} />
          <Statistic title="已完成" value={summary.succeeded} />
          <Statistic title="未通过" value={summary.rejected} />
          <Statistic title="回执失败" value={summary.receiptFailed} />
          <Statistic title="在途金额" value={fen(summary.pendingAmount)} />
          <Statistic title="已完成金额" value={fen(summary.succeededAmount)} />
        </Space>
      </Card>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="单号 / 姓名 / 手机 / 收款户名 / 卡号"
            style={{ width: 300 }}
            onSearch={(v) => {
              setPage(1)
              setKeyword(v)
            }}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 160 }}
            options={(catalog?.statuses || []).map((s) => ({ value: s.value, label: s.label }))}
            value={status}
            onChange={(v) => {
              setPage(1)
              setStatus(v)
            }}
          />
          <Select
            allowClear
            placeholder="业务线"
            style={{ width: 120 }}
            options={(catalog?.modules || []).map((m) => ({ value: m.value, label: m.label }))}
            value={module}
            onChange={(v) => {
              setPage(1)
              setModule(v)
            }}
          />
          <Select
            allowClear
            placeholder="账户类型"
            style={{ width: 120 }}
            options={[
              { value: 'PERSONAL', label: '个人' },
              { value: 'COMPANY', label: '公司' },
            ]}
            value={accountType}
            onChange={(v) => {
              setPage(1)
              setAccountType(v)
            }}
          />
          <Button onClick={() => void loadList()}>刷新</Button>
        </Space>
        <Table
          rowKey="withdrawalId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {catalog && (catalog.audit ?? []).length > 0 && (
        <Card title="最近操作审计（Mock）" size="small">
          <Table
            size="small"
            rowKey="operationId"
            pagination={false}
            dataSource={(catalog.audit ?? []).slice(0, 8)}
            columns={[
              { title: '时间', dataIndex: 'occurredAt', width: 190 },
              { title: '操作', dataIndex: 'action', width: 140 },
              { title: '目标', dataIndex: 'targetId', width: 160 },
              { title: '操作人', dataIndex: 'operatorName', width: 120 },
              { title: '原因', dataIndex: 'reason' },
            ]}
          />
        </Card>
      )}

      <Drawer
        width={720}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail ? `提现详情 ${detail.application.withdrawalId}` : '提现详情'}
        extra={
          detail && canReview ? (
            <Space>
              {(detail.application.allowedActions ?? []).includes('approve') && (
                <Button type="primary" onClick={() => openMutate(detail.application, 'approve')}>
                  同意
                </Button>
              )}
              {(detail.application.allowedActions ?? []).includes('reject') && (
                <Button danger onClick={() => openMutate(detail.application, 'reject')}>
                  拒绝
                </Button>
              )}
              {(detail.application.allowedActions ?? []).includes('register-receipt') && (
                <Button onClick={() => openMutate(detail.application, 'register-receipt')}>登记回执</Button>
              )}
            </Space>
          ) : null
        }
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type="warning" showIcon message={detail.payoutGapNote} />
            <Alert type="info" showIcon message={detail.balanceNote} />
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="申请单号">{detail.application.withdrawalId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detail.application.status]}>
                  {statusLabel[detail.application.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="业务线">{moduleLabel[detail.application.module]}</Descriptions.Item>
              <Descriptions.Item label="身份">{detail.application.identityLabel}</Descriptions.Item>
              <Descriptions.Item label="申请人">
                {detail.application.accountName} / {detail.application.phone}
              </Descriptions.Item>
              <Descriptions.Item label="账户类型">
                {detail.application.accountType === 'COMPANY' ? '公司' : '个人'}
              </Descriptions.Item>
              <Descriptions.Item label="收款户名">{detail.application.payeeName}</Descriptions.Item>
              <Descriptions.Item label="银行">
                {detail.application.bankName} / {detail.application.maskedBankNumber}
              </Descriptions.Item>
              <Descriptions.Item label="申请金额">{fen(detail.application.amount)}</Descriptions.Item>
              <Descriptions.Item label="手续费 / 预计到账">
                {fen(detail.application.fee)} / {fen(detail.application.netAmount)}（快照，政策待定）
              </Descriptions.Item>
              <Descriptions.Item label="打款回执">
                {detail.application.payoutReceiptStatus}
                {detail.application.payoutFailureReason
                  ? ` · ${detail.application.payoutFailureReason}`
                  : ''}
              </Descriptions.Item>
              <Descriptions.Item label="凭证">
                {detail.application.voucherUrl || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="拒绝原因" span={2}>
                {detail.application.rejectionReason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联已结算流水（只读）" span={2}>
                {(detail.application.relatedIncomeEntryIds ?? []).length
                  ? (detail.application.relatedIncomeEntryIds ?? []).join('、')
                  : '无'}
                {' · '}
                <Link to="/revenue/settlement">打开收益模块</Link>
              </Descriptions.Item>
              <Descriptions.Item label="版本">{detail.application.version}</Descriptions.Item>
              <Descriptions.Item label="申请时间">{detail.application.createdAt}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{detail.application.reviewedAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="回执时间">{detail.application.receiptAt || '-'}</Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5}>审计</Typography.Title>
            {(detail.audit ?? []).length === 0 ? (
              <Typography.Text type="secondary">暂无操作记录</Typography.Text>
            ) : (
              <Table
                size="small"
                rowKey="operationId"
                pagination={false}
                dataSource={detail.audit ?? []}
                columns={[
                  { title: '时间', dataIndex: 'occurredAt' },
                  { title: '动作', dataIndex: 'action' },
                  {
                    title: '前后',
                    render: (_: unknown, r: { before: string; after: string }) => `${r.before} → ${r.after}`,
                  },
                  { title: '操作人', dataIndex: 'operatorName' },
                  { title: '原因', dataIndex: 'reason' },
                ]}
              />
            )}
          </Space>
        )}
      </Drawer>

      <Modal
        title={mutateTitle}
        open={!!pending}
        onCancel={() => !busy && setPending(null)}
        onOk={() => void submit()}
        confirmLoading={busy}
        okText="确认提交"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="写操作铁律：原因必填、版本与幂等；同意≠到账；成功回执仅登记服务端结果，前端不执行打款、不改余额。"
          />
          {pending?.action === 'register-receipt' && (
            <>
              <Radio.Group value={receipt} onChange={(e) => setReceipt(e.target.value)}>
                <Radio value="SUCCESS">成功回执</Radio>
                <Radio value="FAILED">失败回执</Radio>
              </Radio.Group>
              {receipt === 'SUCCESS' && (
                <Input
                  placeholder="凭证 URL（可空，将使用 Mock 占位）"
                  value={voucherUrl}
                  onChange={(e) => setVoucherUrl(e.target.value)}
                />
              )}
            </>
          )}
          <Input.TextArea
            rows={3}
            placeholder={pending?.action === 'reject' ? '拒绝原因（必填）' : '操作原因（必填）'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {submitError && <Alert type="error" message={submitError} />}
        </Space>
      </Modal>

      <Typography.Paragraph type="secondary">
        返回 <Link to="/">首页</Link> · 收益联查见 <Link to="/revenue/settlement">结算重算与冲正</Link>。金额界面按元展示（存分）；写操作须原因/版本/幂等/确认；费用快照非正式政策。
      </Typography.Paragraph>
    </Space>
  )
}
