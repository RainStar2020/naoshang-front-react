import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Drawer, Input, Modal, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { transferService } from '../services/transfers'
import {
  TransferError,
  type MigrationStatus,
  type TransferApplication,
  type TransferCatalog,
  type TransferDetail,
  type TransferMutation,
  type TransferOverallStatus,
} from '../types/transfers'

const statusLabel: Record<TransferOverallStatus, string> = {
  PENDING: '待双边审核',
  APPROVED: '双方已同意',
  REJECTED: '已拒绝',
}
const statusColor: Record<TransferOverallStatus, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}
const sideLabel: Record<string, string> = { PENDING: '待审', APPROVED: '同意', REJECTED: '拒绝' }
const migrationLabel: Record<MigrationStatus, string> = {
  NOT_STARTED: '未进入迁移',
  AWAITING_SERVER: '待服务端迁移',
  RECEIPTED_SUCCESS: '已登记成功回执',
  RECEIPTED_FAILED: '已登记失败回执',
}
const migrationColor: Record<MigrationStatus, string> = {
  NOT_STARTED: 'default',
  AWAITING_SERVER: 'warning',
  RECEIPTED_SUCCESS: 'success',
  RECEIPTED_FAILED: 'error',
}

export default function Transfers() {
  const { session } = useAuth()
  const token = session!.token
  const canArbitrate = hasPermission(session!.account, 'transfers:arbitrate')

  const [catalog, setCatalog] = useState<TransferCatalog | null>(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<TransferOverallStatus>()
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>()
  const [sourceStoreId, setSourceStoreId] = useState<string>()
  const [targetStoreId, setTargetStoreId] = useState<string>()
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<TransferApplication[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ applications: 0, pending: 0, bilateralApproved: 0, rejected: 0, awaitingMigration: 0, exceptions: 0 })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const [pending, setPending] = useState<TransferMutation | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [receipt, setReceipt] = useState<'SUCCESS' | 'FAILED'>('SUCCESS')
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await transferService.catalog(token))
    } catch (error) {
      message.error(error instanceof TransferError ? error.message : '加载目录失败')
    }
  }, [token])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await transferService.list(token, {
        page,
        pageSize: 10,
        keyword: keyword || undefined,
        status,
        migrationStatus,
        sourceStoreId,
        targetStoreId,
      })
      setRows(list.items)
      setTotal(list.total)
      setSummary(list.summary)
    } catch (error) {
      message.error(error instanceof TransferError ? error.message : '加载转店申请失败')
    } finally {
      setLoading(false)
    }
  }, [token, page, keyword, status, migrationStatus, sourceStoreId, targetStoreId])

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await transferService.detail(token, id))
    } catch (error) {
      message.error(error instanceof TransferError ? error.message : '加载详情失败')
    }
  }, [token])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { void loadList() }, [loadList])
  useEffect(() => {
    if (detailId) void loadDetail(detailId)
    else setDetail(null)
  }, [detailId, loadDetail])

  const request = (mutation: TransferMutation) => {
    setPending(mutation)
    setReason('')
    setNote(mutation.action === 'add-note' ? '' : note)
    setReceiptNote('')
    setReceipt('SUCCESS')
    setSubmitError('')
    setBlocked(false)
  }

  const confirm = async () => {
    if (!pending) return
    const text = reason.trim()
    if (!text || Array.from(text).length > 200) {
      setSubmitError('操作原因须填写 1—200 字')
      return
    }
    let payload: TransferMutation = { ...pending, reason: text }
    if (pending.action === 'add-note') {
      const n = note.trim()
      if (!n || Array.from(n).length > 200) {
        setSubmitError('监管备注须填写 1—200 字')
        return
      }
      payload = { ...pending, note: n, reason: text }
    }
    if (pending.action === 'record-migration-receipt') {
      const rn = receiptNote.trim()
      if (!rn || Array.from(rn).length > 200) {
        setSubmitError('回执说明须填写 1—200 字')
        return
      }
      payload = { ...pending, receipt, receiptNote: rn, reason: text }
    }
    setBusy(true)
    setSubmitError('')
    try {
      await transferService.mutate(token, payload)
      message.success('操作已记录（Mock）')
      setPending(null)
      await loadList()
      if (detailId) await loadDetail(detailId)
      await loadCatalog()
    } catch (error) {
      const err = error instanceof TransferError ? error : null
      if (err?.code === 'VERSION_CONFLICT') {
        setBlocked(true)
        setSubmitError(err.message)
      } else {
        setSubmitError(err?.message || '操作失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const actionTitle = (action: TransferMutation['action']) => ({
    'force-reject': '总部仲裁拒绝',
    'flag-exception': '标记异常',
    'clear-exception': '清除异常标记',
    'add-note': '添加监管备注',
    'record-migration-receipt': '登记服务端迁移回执',
  }[action])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>转店双边审核监管</Typography.Title>
      <Alert
        type="info"
        showIcon
        message="HQ-21：转店双边审核监管。双方同意后由服务端做归属迁移；本页只反映审批与回执，不伪造已迁移。不替代小程序发起转店。未用课时/订单/反馈/未结算收益迁移口径待定。"
      />
      {catalog && (
        <Alert
          type="warning"
          showIcon
          message="待定口径（映射文档 §7）"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>{catalog.pendingPolicy.unusedLessonsNote}</li>
              <li>{catalog.pendingPolicy.subsequentOrdersNote}</li>
              <li>{catalog.pendingPolicy.historicalFeedbackNote}</li>
              <li>{catalog.pendingPolicy.unsettledRevenueNote}</li>
            </ul>
          }
        />
      )}
      <Card>
        <Space wrap size={24}>
          <Statistic title="申请总数" value={summary.applications} />
          <Statistic title="待双边审核" value={summary.pending} />
          <Statistic title="双方已同意" value={summary.bilateralApproved} />
          <Statistic title="待服务端迁移" value={summary.awaitingMigration} />
          <Statistic title="已拒绝" value={summary.rejected} />
          <Statistic title="异常标记" value={summary.exceptions} />
        </Space>
      </Card>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="学员/申请人/门店/原因"
            style={{ width: 240 }}
            onSearch={v => { setKeyword(v); setPage(1) }}
          />
          <Select
            allowClear
            placeholder="综合状态"
            style={{ width: 140 }}
            options={(catalog?.statuses || []).map(s => ({ value: s.value, label: s.label }))}
            onChange={v => { setStatus(v); setPage(1) }}
          />
          <Select
            allowClear
            placeholder="迁移状态"
            style={{ width: 180 }}
            options={(catalog?.migrationStatuses || []).map(s => ({ value: s.value, label: s.label }))}
            onChange={v => { setMigrationStatus(v); setPage(1) }}
          />
          <Select
            allowClear
            placeholder="转出门店"
            style={{ width: 200 }}
            options={(catalog?.stores || []).map(s => ({ value: s.storeId, label: s.name }))}
            onChange={v => { setSourceStoreId(v); setPage(1) }}
          />
          <Select
            allowClear
            placeholder="转入门店"
            style={{ width: 200 }}
            options={(catalog?.stores || []).map(s => ({ value: s.storeId, label: s.name }))}
            onChange={v => { setTargetStoreId(v); setPage(1) }}
          />
          <Typography.Text type="secondary">
            学员主档见 <Link to="/members">孩子会员</Link>；门店主档见 <Link to="/stores">门店监管</Link>；课时/反馈见 <Link to="/training">训练核销</Link>
          </Typography.Text>
        </Space>
        <Table
          rowKey="applicationId"
          loading={loading}
          dataSource={rows}
          pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
          columns={[
            { title: '申请号', dataIndex: 'applicationId', width: 140 },
            { title: '学员', render: (_, r: TransferApplication) => `${r.memberName}（${r.displayId}）` },
            { title: '转出 → 转入', render: (_, r: TransferApplication) => `${r.sourceStoreName} → ${r.targetStoreName}` },
            {
              title: '转出审',
              dataIndex: 'sourceApprovalStatus',
              width: 80,
              render: (v: string) => <Tag>{sideLabel[v]}</Tag>,
            },
            {
              title: '转入审',
              dataIndex: 'targetApprovalStatus',
              width: 80,
              render: (v: string) => <Tag>{sideLabel[v]}</Tag>,
            },
            {
              title: '综合',
              dataIndex: 'status',
              width: 110,
              render: (v: TransferOverallStatus) => <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>,
            },
            {
              title: '迁移',
              dataIndex: 'migrationStatus',
              width: 140,
              render: (v: MigrationStatus) => <Tag color={migrationColor[v]}>{migrationLabel[v]}</Tag>,
            },
            {
              title: '异常',
              width: 70,
              render: (_, r: TransferApplication) => r.exceptionFlag === 'FLAGGED' ? <Tag color="orange">异常</Tag> : '—',
            },
            {
              title: '操作',
              width: 90,
              render: (_, r: TransferApplication) => (
                <Button type="link" onClick={() => setDetailId(r.applicationId)}>详情</Button>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        width={720}
        title="转店申请详情"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={detail.migrationHint} />
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="申请号">{detail.application.applicationId}</Descriptions.Item>
              <Descriptions.Item label="版本">v{detail.application.version}</Descriptions.Item>
              <Descriptions.Item label="学员">{detail.application.memberName}（{detail.application.displayId}）</Descriptions.Item>
              <Descriptions.Item label="申请人">{detail.application.applicantName}</Descriptions.Item>
              <Descriptions.Item label="转出门店">{detail.application.sourceStoreName}</Descriptions.Item>
              <Descriptions.Item label="转入门店">{detail.application.targetStoreName}</Descriptions.Item>
              <Descriptions.Item label="转出审核">
                <Tag>{sideLabel[detail.application.sourceApprovalStatus]}</Tag>
                {detail.application.sourceReviewedAt || ''}
              </Descriptions.Item>
              <Descriptions.Item label="转入审核">
                <Tag>{sideLabel[detail.application.targetApprovalStatus]}</Tag>
                {detail.application.targetReviewedAt || ''}
              </Descriptions.Item>
              <Descriptions.Item label="综合状态">
                <Tag color={statusColor[detail.application.status]}>{statusLabel[detail.application.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="迁移状态">
                <Tag color={migrationColor[detail.application.migrationStatus]}>{migrationLabel[detail.application.migrationStatus]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>{detail.application.reason}</Descriptions.Item>
              <Descriptions.Item label="拒绝原因" span={2}>{detail.application.rejectionReason || '—'}</Descriptions.Item>
              <Descriptions.Item label="未用陪练课时（快照）">{detail.application.unusedTrainingLessons}</Descriptions.Item>
              <Descriptions.Item label="未用专项课时（快照）">{detail.application.unusedSpecialLessons}</Descriptions.Item>
              <Descriptions.Item label="监管备注" span={2}>{detail.application.hqNote || '—'}</Descriptions.Item>
              <Descriptions.Item label="迁移回执" span={2}>
                {detail.application.migrationReceiptNote || '—'}
                {detail.application.migrationReceiptAt ? `（${detail.application.migrationReceiptAt}）` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="异常标记">{detail.application.exceptionFlag === 'FLAGGED' ? '已标记' : '无'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">{detail.application.appliedAt}</Descriptions.Item>
            </Descriptions>

            {canArbitrate && (
              <Space wrap>
                {detail.application.allowedActions.includes('force-reject') && (
                  <Button danger onClick={() => request({
                    action: 'force-reject',
                    applicationId: detail.application.applicationId,
                    version: detail.application.version,
                    reason: '',
                    idempotencyKey: crypto.randomUUID(),
                  })}>仲裁拒绝</Button>
                )}
                {detail.application.allowedActions.includes('flag-exception') && (
                  <Button onClick={() => request({
                    action: 'flag-exception',
                    applicationId: detail.application.applicationId,
                    version: detail.application.version,
                    reason: '',
                    idempotencyKey: crypto.randomUUID(),
                  })}>标记异常</Button>
                )}
                {detail.application.allowedActions.includes('clear-exception') && (
                  <Button onClick={() => request({
                    action: 'clear-exception',
                    applicationId: detail.application.applicationId,
                    version: detail.application.version,
                    reason: '',
                    idempotencyKey: crypto.randomUUID(),
                  })}>清除异常</Button>
                )}
                {detail.application.allowedActions.includes('add-note') && (
                  <Button onClick={() => request({
                    action: 'add-note',
                    applicationId: detail.application.applicationId,
                    version: detail.application.version,
                    note: '',
                    reason: '',
                    idempotencyKey: crypto.randomUUID(),
                  })}>监管备注</Button>
                )}
                {detail.application.allowedActions.includes('record-migration-receipt') && (
                  <Button type="primary" onClick={() => request({
                    action: 'record-migration-receipt',
                    applicationId: detail.application.applicationId,
                    version: detail.application.version,
                    receipt: 'SUCCESS',
                    receiptNote: '',
                    reason: '',
                    idempotencyKey: crypto.randomUUID(),
                  })}>登记迁移回执</Button>
                )}
              </Space>
            )}
            {!canArbitrate && <Alert type="warning" message="当前账号仅有查询权限，不能仲裁或登记回执。" />}

            <Typography.Title level={5}>操作审计</Typography.Title>
            <Table
              size="small"
              rowKey="operationId"
              pagination={false}
              dataSource={detail.audit}
              columns={[
                { title: '时间', dataIndex: 'occurredAt', width: 180 },
                { title: '动作', dataIndex: 'action', width: 160 },
                { title: '操作者', dataIndex: 'operatorName', width: 120 },
                { title: '原因', dataIndex: 'reason' },
                { title: '版本', render: (_, r) => `${r.beforeVersion}→${r.afterVersion}`, width: 80 },
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title={pending ? actionTitle(pending.action) : '确认'}
        open={!!pending}
        onCancel={() => !busy && setPending(null)}
        onOk={() => void confirm()}
        okButtonProps={{ disabled: blocked || busy, loading: busy }}
        cancelButtonProps={{ disabled: busy }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="warning" showIcon message="二次确认：写操作将记入审计；不会在前端改写学员门店归属。" />
          {pending?.action === 'add-note' && (
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="监管备注 1—200 字" value={note} onChange={e => setNote(e.target.value)} />
          )}
          {pending?.action === 'record-migration-receipt' && (
            <>
              <Select
                style={{ width: '100%' }}
                value={receipt}
                onChange={setReceipt}
                options={[
                  { value: 'SUCCESS', label: '登记：服务端迁移成功' },
                  { value: 'FAILED', label: '登记：服务端迁移失败' },
                ]}
              />
              <Input.TextArea rows={3} maxLength={200} showCount placeholder="回执说明 1—200 字" value={receiptNote} onChange={e => setReceiptNote(e.target.value)} />
            </>
          )}
          <Input.TextArea rows={3} maxLength={200} showCount placeholder="操作原因 1—200 字（必填）" value={reason} onChange={e => setReason(e.target.value)} />
          {submitError && <Alert type="error" message={submitError} />}
          {blocked && <Button onClick={() => { setPending(null); if (detailId) void loadDetail(detailId); void loadList() }}>刷新后重试</Button>}
        </Space>
      </Modal>
    </Space>
  )
}
