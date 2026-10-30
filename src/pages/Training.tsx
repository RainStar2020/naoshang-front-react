import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Descriptions, Drawer, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { trainingService } from '../services/training'
import { TrainingError, type FeedbackKind, type FeedbackStatus, type LessonBucket, type LessonConsumeRecord, type TrainingFeedback, type TrainingMemberBalance, type TrainingMemberDetail, type TrainingMutation } from '../types/training'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

const kindLabel: Record<FeedbackKind, string> = { training: '陪练', 'self-study': '智习', camp: '集训' }
const bucketLabel: Record<LessonBucket, string> = { training: '陪练课时', special: '专项课时' }

export default function Training() {
  const { session } = useAuth()
  const token = session!.token
  const canFeedback = hasPermission(session!.account, 'training:feedback')
  const canConsume = hasPermission(session!.account, 'training:consume')

  const [tab, setTab] = useState('balances')
  const [stores, setStores] = useState<{ storeId: string; name: string }[]>([])
  const [balanceKeyword, setBalanceKeyword] = useState('')
  const [balanceStoreId, setBalanceStoreId] = useState<string>()
  const [balancePage, setBalancePage] = useState(1)
  const [balances, setBalances] = useState<TrainingMemberBalance[]>([])
  const [balanceTotal, setBalanceTotal] = useState(0)
  const [balanceSummary, setBalanceSummary] = useState({ members: 0, trainingRemaining: 0, specialRemaining: 0, lowBalance: 0 })

  const [fbKeyword, setFbKeyword] = useState('')
  const [fbKind, setFbKind] = useState<FeedbackKind>()
  const [fbStatus, setFbStatus] = useState<FeedbackStatus>()
  const [fbPage, setFbPage] = useState(1)
  const [feedbackRows, setFeedbackRows] = useState<TrainingFeedback[]>([])
  const [fbTotal, setFbTotal] = useState(0)
  const [fbSummary, setFbSummary] = useState({ feedback: 0, published: 0, withdrawn: 0, hqProxy: 0 })

  const [detail, setDetail] = useState<TrainingMemberDetail | null>(null)
  const [fbDetail, setFbDetail] = useState<TrainingFeedback | null>(null)

  const [proxyOpen, setProxyOpen] = useState(false)
  const [proxyMemberId, setProxyMemberId] = useState<string>()
  const [proxyKind, setProxyKind] = useState<FeedbackKind>('training')
  const [proxyTitle, setProxyTitle] = useState('')
  const [proxyBody, setProxyBody] = useState('')

  const [consumeTarget, setConsumeTarget] = useState<TrainingMemberBalance | null>(null)
  const [consumeBucket, setConsumeBucket] = useState<LessonBucket>('training')
  const [consumeQty, setConsumeQty] = useState(1)

  const [withdrawTarget, setWithdrawTarget] = useState<TrainingFeedback | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<TrainingMutation | null>(null)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadCatalog = useCallback(async () => {
    const catalog = await trainingService.catalog(token)
    setStores(catalog.stores)
  }, [token])

  const loadBalances = useCallback(async () => {
    setLoading(true)
    try {
      const list = await trainingService.balances(token, { page: balancePage, pageSize: 10, keyword: balanceKeyword || undefined, storeId: balanceStoreId })
      setBalances(list.items); setBalanceTotal(list.total); setBalanceSummary(list.summary)
    } catch (error) {
      message.error(error instanceof TrainingError ? error.message : '加载课时失败')
    } finally { setLoading(false) }
  }, [token, balancePage, balanceKeyword, balanceStoreId])

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const list = await trainingService.feedbackList(token, {
        page: fbPage, pageSize: 10, keyword: fbKeyword || undefined, kind: fbKind, status: fbStatus,
      })
      setFeedbackRows(list.items); setFbTotal(list.total); setFbSummary(list.summary)
    } catch (error) {
      message.error(error instanceof TrainingError ? error.message : '加载反馈失败')
    } finally { setLoading(false) }
  }, [token, fbPage, fbKeyword, fbKind, fbStatus])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { if (tab === 'balances') void loadBalances() }, [tab, loadBalances])
  useEffect(() => { if (tab === 'feedback') void loadFeedback() }, [tab, loadFeedback])

  async function openMember(memberId: string) {
    try { setDetail(await trainingService.memberDetail(token, memberId)) }
    catch (error) { message.error(error instanceof TrainingError ? error.message : '加载学员课时详情失败') }
  }
  async function openFeedback(feedbackId: string) {
    try { setFbDetail(await trainingService.feedbackDetail(token, feedbackId)) }
    catch (error) { message.error(error instanceof TrainingError ? error.message : '加载反馈详情失败') }
  }

  function closeEditors() { if (busy) return; setProxyOpen(false); setConsumeTarget(null); setWithdrawTarget(null); setPending(null); setReason(''); setSubmitError(''); setBlocked(false) }

  function prepareProxy() {
    if (!proxyMemberId || !proxyTitle.trim() || !proxyBody.trim() || !reason.trim()) { message.warning('请填写学员、标题、正文与原因'); return }
    setPending({
      action: 'proxy-feedback', memberId: proxyMemberId, kind: proxyKind, title: proxyTitle.trim(), body: proxyBody.trim(),
      reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
    setSubmitError(''); setBlocked(false)
  }
  function prepareConsume() {
    if (!consumeTarget || !reason.trim() || !Number.isInteger(consumeQty) || consumeQty < 1) { message.warning('请填写核销数量与原因'); return }
    setPending({
      action: 'consume-lessons', memberId: consumeTarget.memberId, bucket: consumeBucket, quantity: consumeQty,
      version: consumeTarget.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
    setSubmitError(''); setBlocked(false)
  }
  function prepareWithdraw() {
    if (!withdrawTarget || !reason.trim()) { message.warning('请填写撤回原因'); return }
    setPending({
      action: 'withdraw-feedback', feedbackId: withdrawTarget.feedbackId, version: withdrawTarget.version,
      reason: reason.trim(), idempotencyKey: crypto.randomUUID(),
    })
    setSubmitError(''); setBlocked(false)
  }

  async function submit() {
    if (!pending || busy || blocked) return
    setBusy(true); setSubmitError('')
    try {
      await trainingService.mutate(token, pending)
      message.success('Mock 操作已记录（非真实课时/反馈结果）')
      closeEditors()
      await Promise.all([loadBalances(), loadFeedback()])
      if (detail) await openMember(detail.balance.memberId)
      if (fbDetail && pending.action === 'withdraw-feedback') await openFeedback(fbDetail.feedbackId)
    } catch (error) {
      const err = error instanceof TrainingError ? error : null
      setSubmitError(err?.message ?? '提交失败')
      if (err && (err.code === 'VERSION_CONFLICT' || err.code === 'IDEMPOTENCY_CONFLICT' || err.code === 'INVALID_STATE')) setBlocked(true)
    } finally { setBusy(false) }
  }

  const memberOptions = useMemo(() => balances.map(row => ({ value: row.memberId, label: `${row.memberName}（${row.displayId}）` })), [balances])
  const remainingForConsume = consumeTarget
    ? (consumeBucket === 'training' ? consumeTarget.trainingRemaining : consumeTarget.specialRemaining)
    : 0

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>训练反馈与课时核销</Typography.Title>
        <Typography.Text type="secondary">HQ-20：总部代写/撤回训练反馈与课时核销监管；禁止超余量与负库存；不替代门店日常训练录入。学员档案见 <Link to="/members">孩子会员档案</Link>，门店侧日常不在此替代。</Typography.Text>
      </div>
      <HqDataSourceAlert mockMessage="Mock 演示边界" mockDescription="成功仅表示内存 Mock 状态机通过：不代表真实课时扣减、家长可见反馈或附件已上传。附件仅保留审计字段。写操作须原因/版本/幂等；不伪造核销终态。" />

      <Tabs activeKey={tab} onChange={setTab} items={[
        {
          key: 'balances', label: '课时余额与核销',
          children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card><Space wrap size="large">
              <Statistic title="学员" value={balanceSummary.members} />
              <Statistic title="陪练剩余合计" value={balanceSummary.trainingRemaining} />
              <Statistic title="专项剩余合计" value={balanceSummary.specialRemaining} />
              <Statistic title="低余额（≤2）" value={balanceSummary.lowBalance} />
            </Space></Card>
            <Space wrap>
              <Input.Search allowClear placeholder="姓名 / 学号 / memberId" style={{ width: 260 }} onSearch={value => { setBalanceKeyword(value); setBalancePage(1) }} />
              <Select allowClear placeholder="门店" style={{ width: 220 }} options={stores.map(row => ({ value: row.storeId, label: row.name }))} value={balanceStoreId} onChange={value => { setBalanceStoreId(value); setBalancePage(1) }} />
              <Button onClick={() => void loadBalances()}>刷新</Button>
            </Space>
            <Table<TrainingMemberBalance> rowKey="memberId" loading={loading} dataSource={balances}
              pagination={{ current: balancePage, pageSize: 10, total: balanceTotal, onChange: setBalancePage }}
              columns={[
                { title: '学员', key: 'm', render: (_, row) => <Space direction="vertical" size={0}><strong>{row.memberName}</strong><span>{row.displayId}</span></Space> },
                { title: '门店', dataIndex: 'storeName', render: (value: string | null) => value || '—' },
                { title: '陪练（已用/总量）', key: 't', render: (_, row) => `${row.trainingUsed}/${row.trainingTotal}（剩 ${row.trainingRemaining}）` },
                { title: '专项（已用/总量）', key: 's', render: (_, row) => `${row.specialUsed}/${row.specialTotal}（剩 ${row.specialRemaining}）` },
                { title: '版本', dataIndex: 'version', width: 70 },
                { title: '操作', key: 'op', render: (_, row) => <Space wrap size={0}>
                  <Button type="link" size="small" onClick={() => void openMember(row.memberId)}>详情</Button>
                  {canConsume && <Button type="link" size="small" onClick={() => { setConsumeTarget(row); setConsumeBucket('training'); setConsumeQty(1); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>核销</Button>}
                </Space> },
              ]}
            />
          </Space>,
        },
        {
          key: 'feedback', label: '训练反馈',
          children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card><Space wrap size="large">
              <Statistic title="反馈" value={fbSummary.feedback} />
              <Statistic title="已发布" value={fbSummary.published} />
              <Statistic title="已撤回" value={fbSummary.withdrawn} />
              <Statistic title="总部代写" value={fbSummary.hqProxy} />
            </Space></Card>
            <Space wrap>
              <Input.Search allowClear placeholder="标题 / 学员 / 反馈号" style={{ width: 260 }} onSearch={value => { setFbKeyword(value); setFbPage(1) }} />
              <Select allowClear placeholder="类型" style={{ width: 140 }} options={Object.entries(kindLabel).map(([value, label]) => ({ value, label }))} value={fbKind} onChange={value => { setFbKind(value); setFbPage(1) }} />
              <Select allowClear placeholder="状态" style={{ width: 140 }} options={[{ value: 'PUBLISHED', label: '已发布' }, { value: 'WITHDRAWN', label: '已撤回' }]} value={fbStatus} onChange={value => { setFbStatus(value); setFbPage(1) }} />
              {canFeedback && <Button type="primary" onClick={() => { setProxyOpen(true); setProxyMemberId(undefined); setProxyKind('training'); setProxyTitle(''); setProxyBody(''); setReason(''); setPending(null); setSubmitError(''); setBlocked(false); void trainingService.balances(token, { page: 1, pageSize: 50 }).then(list => setBalances(list.items)).catch(() => undefined) }}>总部代写</Button>}
              <Button onClick={() => void loadFeedback()}>刷新</Button>
            </Space>
            <Table<TrainingFeedback> rowKey="feedbackId" loading={loading} dataSource={feedbackRows}
              pagination={{ current: fbPage, pageSize: 10, total: fbTotal, onChange: setFbPage }}
              columns={[
                { title: '标题', dataIndex: 'title' },
                { title: '学员', key: 'm', render: (_, row) => `${row.memberName}（${row.displayId}）` },
                { title: '类型', dataIndex: 'kind', render: (value: FeedbackKind) => kindLabel[value] },
                { title: '来源', key: 'o', render: (_, row) => <Tag color={row.origin === 'hq-proxy' ? 'blue' : 'default'}>{row.origin === 'hq-proxy' ? '总部代写' : '门店/健脑官'}</Tag> },
                { title: '状态', dataIndex: 'status', render: (value: FeedbackStatus) => <Tag color={value === 'PUBLISHED' ? 'green' : 'default'}>{value === 'PUBLISHED' ? '已发布' : '已撤回'}</Tag> },
                { title: '作者', dataIndex: 'coachName' },
                { title: '操作', key: 'op', render: (_, row) => <Space wrap size={0}>
                  <Button type="link" size="small" onClick={() => void openFeedback(row.feedbackId)}>详情</Button>
                  {canFeedback && row.status === 'PUBLISHED' && <Button type="link" size="small" danger onClick={() => { setWithdrawTarget(row); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>撤回</Button>}
                </Space> },
              ]}
            />
          </Space>,
        },
      ]} />

      <Drawer title="学员课时详情" width={720} open={!!detail} onClose={() => setDetail(null)}>
        {detail && <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="学员">{detail.balance.memberName}（{detail.balance.displayId}）</Descriptions.Item>
            <Descriptions.Item label="门店">{detail.balance.storeName || '—'}</Descriptions.Item>
            <Descriptions.Item label="陪练">{detail.balance.trainingUsed}/{detail.balance.trainingTotal}（剩 {detail.balance.trainingRemaining}）</Descriptions.Item>
            <Descriptions.Item label="专项">{detail.balance.specialUsed}/{detail.balance.specialTotal}（剩 {detail.balance.specialRemaining}）</Descriptions.Item>
            <Descriptions.Item label="版本">{detail.balance.version}</Descriptions.Item>
            <Descriptions.Item label="操作">{canConsume && <Button size="small" type="primary" onClick={() => { setConsumeTarget(detail.balance); setConsumeBucket('training'); setConsumeQty(1); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>核销课时</Button>}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5}>核销流水</Typography.Title>
          <Table<LessonConsumeRecord> rowKey="recordId" size="small" pagination={false} dataSource={detail.consumes}
            columns={[
              { title: '时间', dataIndex: 'occurredAt', width: 180 },
              { title: '类型', dataIndex: 'bucket', render: (value: LessonBucket) => bucketLabel[value] },
              { title: '数量', dataIndex: 'quantity' },
              { title: '剩余变化', key: 'r', render: (_, row) => `${row.beforeRemaining} → ${row.afterRemaining}` },
              { title: '原因', dataIndex: 'reason' },
              { title: '操作人', dataIndex: 'operatorName' },
            ]}
          />
          <Typography.Title level={5}>相关反馈</Typography.Title>
          <Table rowKey="feedbackId" size="small" pagination={false} dataSource={detail.feedback}
            columns={[
              { title: '标题', dataIndex: 'title' },
              { title: '类型', dataIndex: 'kind', render: (value: FeedbackKind) => kindLabel[value] },
              { title: '状态', dataIndex: 'status' },
              { title: '操作', key: 'op', render: (_, row: TrainingFeedback) => <Button type="link" size="small" onClick={() => void openFeedback(row.feedbackId)}>查看</Button> },
            ]}
          />
        </Space>}
      </Drawer>

      <Drawer title="反馈详情" width={640} open={!!fbDetail} onClose={() => setFbDetail(null)}>
        {fbDetail && <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="标题">{fbDetail.title}</Descriptions.Item>
            <Descriptions.Item label="学员">{fbDetail.memberName}（{fbDetail.displayId}）</Descriptions.Item>
            <Descriptions.Item label="类型">{kindLabel[fbDetail.kind]}</Descriptions.Item>
            <Descriptions.Item label="来源">{fbDetail.origin === 'hq-proxy' ? '总部代写' : '门店/健脑官'} · {fbDetail.coachName}</Descriptions.Item>
            <Descriptions.Item label="状态">{fbDetail.status === 'PUBLISHED' ? '已发布' : '已撤回'}{fbDetail.withdrawReason ? `（${fbDetail.withdrawReason}）` : ''}</Descriptions.Item>
            <Descriptions.Item label="正文"><Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{fbDetail.body}</Typography.Paragraph></Descriptions.Item>
            <Descriptions.Item label="附件">{fbDetail.attachments.length
              ? (fbDetail.attachments ?? []).map(item => <div key={item.assetId}>{item.kind} · {item.name}{item.sizeLabel ? ` · ${item.sizeLabel}` : ''}</div>)
              : '无'}</Descriptions.Item>
          </Descriptions>
          {canFeedback && fbDetail.status === 'PUBLISHED' && <Button danger onClick={() => { setWithdrawTarget(fbDetail); setReason(''); setPending(null); setSubmitError(''); setBlocked(false) }}>撤回反馈</Button>}
        </Space>}
      </Drawer>

      <Modal title="总部代写反馈" open={proxyOpen && !pending} onCancel={closeEditors}
        okText="下一步确认" onOk={prepareProxy} destroyOnClose>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select showSearch optionFilterProp="label" placeholder="选择学员（可先在课时页刷新列表）" style={{ width: '100%' }} options={memberOptions} value={proxyMemberId} onChange={setProxyMemberId} />
          <Select style={{ width: '100%' }} options={Object.entries(kindLabel).map(([value, label]) => ({ value, label }))} value={proxyKind} onChange={value => setProxyKind(value as FeedbackKind)} />
          <Input maxLength={80} placeholder="反馈标题" value={proxyTitle} onChange={event => setProxyTitle(event.target.value)} />
          <Input.TextArea rows={5} maxLength={3000} placeholder="反馈正文" value={proxyBody} onChange={event => setProxyBody(event.target.value)} />
          <Input.TextArea rows={2} maxLength={200} placeholder="操作原因（必填）" value={reason} onChange={event => setReason(event.target.value)} />
        </Space>
      </Modal>

      <Modal title="课时逐次核销" open={!!consumeTarget && !pending} onCancel={closeEditors}
        okText="下一步确认" onOk={prepareConsume} destroyOnClose>
        {consumeTarget && <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>学员：{consumeTarget.memberName}（{consumeTarget.displayId}） · 版本 {consumeTarget.version}</Typography.Paragraph>
          <Select style={{ width: '100%' }} options={Object.entries(bucketLabel).map(([value, label]) => ({ value, label }))} value={consumeBucket} onChange={value => setConsumeBucket(value as LessonBucket)} />
          <Typography.Text type="secondary">当前剩余：{remainingForConsume}</Typography.Text>
          <InputNumber min={1} max={Math.max(1, remainingForConsume)} precision={0} style={{ width: '100%' }} value={consumeQty} onChange={value => setConsumeQty(Number(value) || 1)} />
          <Input.TextArea rows={2} maxLength={200} placeholder="核销原因（必填）" value={reason} onChange={event => setReason(event.target.value)} />
        </Space>}
      </Modal>

      <Modal title="撤回训练反馈" open={!!withdrawTarget && !pending} onCancel={closeEditors}
        okText="下一步确认" onOk={prepareWithdraw} okButtonProps={{ danger: true }} destroyOnClose>
        {withdrawTarget && <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph>将撤回「{withdrawTarget.title}」（{withdrawTarget.memberName}）。撤回后家长/门店侧应按已撤回展示；Mock 不推送真实通知。</Typography.Paragraph>
          <Input.TextArea rows={3} maxLength={200} placeholder="撤回原因（必填）" value={reason} onChange={event => setReason(event.target.value)} />
        </Space>}
      </Modal>

      <Modal title="确认提交（二次确认）" open={!!pending} onCancel={closeEditors}
        okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认 Mock 提交'}
        confirmLoading={busy} okButtonProps={{ disabled: blocked }} onOk={() => void submit()}>
        {pending && <Space direction="vertical">
          <Typography.Paragraph>
            操作：{pending.action}<br />
            原因：{pending.reason}<br />
            请求号：{pending.idempotencyKey}
          </Typography.Paragraph>
          {submitError && <Alert type="error" showIcon message={submitError} />}
        </Space>}
      </Modal>
    </Space>
  )
}
