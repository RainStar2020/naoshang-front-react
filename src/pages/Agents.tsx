import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { isMockAuth } from '../services/auth'
import { regionalAgencyApi as api } from '../api/regionalAgency'
import type { PageData } from '../types/hq/common'
import type { AgencyQuery, ApplicationQuery, Assignment, AgencyApplication, AgencyDetail, Brief, RegionType, AppointmentInput, DecisionInput, AppointmentResult, DecisionResult, CostoreChild } from '../types/regionalAgency'

const regionLabels: Record<RegionType, string> = { province: '省级代理', city: '市级代理', district: '区县代理', store: '单店代理' }
const tierLabels: Record<string, string> = { none: '普通用户', vip: 'VIP', angel: '天使', private: '私董', cofounder: '联创' }
const reviewLabels = { PENDING_REVIEW: '待审核', APPROVED: '通过', REJECTED: '拒绝' }
const regionOptions = Object.entries(regionLabels).map(([value, label]) => ({ value, label }))
const money = (n: number) => `¥${n.toFixed(2)}`
const date = (s: string | null) => s && Number.isFinite(Date.parse(s)) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Shanghai', hour12: false }).format(new Date(s)) : '—'
const person = (p: Brief | null) => p ? <Space direction="vertical" size={0}><span>{p.name || '未填写姓名'}</span><Typography.Text type="secondary">{p.phone || '—'} · {tierLabels[p.tier] || '未知等级'}</Typography.Text></Space> : '—'
const messageOf = (e: unknown) => e instanceof Error ? e.message : '请求失败，请刷新后核对结果'
type Review = { kind: 'appoint'; input: AppointmentInput; key: string } | { kind: 'decision'; id: string; name: string; input: DecisionInput; key: string }

export default function Agents() {
  const { session } = useAuth()
  const canManage = hasPermission(session!.account, 'agents:manage') && !isMockAuth
  const [tab, setTab] = useState('assignments')
  const [query, setQuery] = useState<AgencyQuery>({ page: 1, pageSize: 20 })
  const [appQuery, setAppQuery] = useState<ApplicationQuery>({ page: 1, pageSize: 20 })
  const [list, setList] = useState<PageData<Assignment>>()
  const [applications, setApplications] = useState<PageData<AgencyApplication>>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string>()
  const [detailPage, setDetailPage] = useState(1)
  const [detail, setDetail] = useState<AgencyDetail>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [decision, setDecision] = useState<{ row: AgencyApplication; decision: 'APPROVE' | 'REJECT' }>()
  const [review, setReview] = useState<Review>()
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [receipt, setReceipt] = useState<AppointmentResult | DecisionResult>()
  const [checkResult, setCheckResult] = useState<{ regionType: RegionType; regionCode: string; available: boolean }>()
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [appointmentForm] = Form.useForm<AppointmentInput & { received: boolean }>()
  const [decisionForm] = Form.useForm<DecisionInput & { received: boolean }>()
  const [filterForm] = Form.useForm()
  const [appFilterForm] = Form.useForm()
  const regionType = Form.useWatch('regionType', appointmentForm) as RegionType | undefined
  const regionCode = Form.useWatch('regionCode', appointmentForm) as string | undefined

  useEffect(() => {
    if (isMockAuth) return
    let alive = true
    setLoading(true); setError('')
    const request = tab === 'assignments' ? api.list(query).then(value => { if (alive) setList(value) }) : api.applications(appQuery).then(value => { if (alive) setApplications(value) })
    request.catch(e => { if (alive) setError(messageOf(e)) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tab, query, appQuery, refresh])
  useEffect(() => {
    if (!detailId || isMockAuth) return
    let alive = true
    setDetail(undefined); setDetailLoading(true); setDetailError('')
    api.detail(detailId, detailPage).then(value => { if (alive) setDetail(value) }).catch(e => { if (alive) setDetailError(messageOf(e)) }).finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [detailId, detailPage, refresh])
  const openDetail = (id: string) => { setDetailPage(1); setDetailId(id) }
  const assignmentColumns: ColumnsType<Assignment> = [
    { title: '代理人 / 手机号 / 等级', key: 'agent', width: 220, render: (_, r) => person(r.agent) },
    { title: '代理级别', dataIndex: 'regionType', width: 120, render: (v: RegionType) => regionLabels[v] || '未知级别' },
    { title: '代理区域', key: 'region', width: 180, render: (_, r) => r.regionName || r.regionCode },
    { title: '代理推荐人', key: 'referrer', width: 210, render: (_, r) => person(r.referrer) },
    { title: '合伙人上级', key: 'upline', width: 210, render: (_, r) => person(r.upline) },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v === 'ACTIVE' ? '有效' : v === 'DISABLED' ? '停用' : '未知状态'}</Tag> },
    { title: '成为代理时间', dataIndex: 'appointedAt', width: 180, render: date },
    { title: '最后登录时间', dataIndex: 'lastLoginAt', width: 180, render: date },
    { title: '操作', key: 'action', width: 90, fixed: 'right', render: (_, r) => <Button type="link" onClick={() => openDetail(r.assignmentId)}>详情</Button> },
  ]
  const check = async () => {
    try {
      const values = await appointmentForm.validateFields(['regionType', 'regionCode'])
      setChecking(true); setCheckResult(undefined); setCheckError('')
      setCheckResult(await api.check(values.regionType, values.regionCode.trim()))
    } catch (e) { if (e instanceof Error) setCheckError(messageOf(e)) }
    finally { setChecking(false) }
  }
  const prepareAppointment = async () => {
    try {
      const { received, ...values } = await appointmentForm.validateFields()
      if (!received) return
      const input: AppointmentInput = { ...values, partnerId: values.partnerId.trim(), regionCode: values.regionCode.trim(), reason: values.reason?.trim(), priceTier: values.regionType === 'city' ? values.priceTier ?? 0 : 0 }
      if (values.regionType !== 'store') { delete input.parentCode; delete input.storeName; delete input.storeAddress; delete input.storeContact }
      if (!input.promotionCode?.trim()) delete input.promotionCode
      else input.promotionCode = input.promotionCode.trim()
      setSubmitError(''); setUncertain(false); setReview({ kind: 'appoint', input, key: crypto.randomUUID() })
    } catch { /* Form shows field errors. */ }
  }
  const prepareDecision = async () => {
    if (!decision) return
    try {
      const values = await decisionForm.validateFields()
      const input: DecisionInput = { decision: decision.decision, version: decision.row.version, reason: values.reason.trim(), ...(decision.decision === 'APPROVE' && values.feeAmount != null ? { feeAmount: values.feeAmount } : {}) }
      setSubmitError(''); setUncertain(false); setReview({ kind: 'decision', id: decision.row.applicationId, name: decision.row.applicant?.name || '未填写姓名', input, key: crypto.randomUUID() })
    } catch { /* Form shows field errors. */ }
  }
  const submit = async () => {
    if (!review || busy) return
    setBusy(true); setSubmitError('')
    try {
      const result = review.kind === 'appoint' ? await api.appoint(review.input, review.key) : await api.decide(review.id, review.input, review.key)
      setReceipt(result); setReview(undefined); setAppointmentOpen(false); setDecision(undefined)
      setRefresh(v => v + 1); message.success('操作成功，已取得服务端回执')
    } catch (e) { setSubmitError(messageOf(e)); setUncertain(true) }
    finally { setBusy(false) }
  }
  const reasonRules = [{ required: true, whitespace: true, message: '请填写操作原因' }]
  const receivedRule = [{ validator: (_: unknown, value: boolean) => value ? Promise.resolve() : Promise.reject(new Error('请确认线下款项已实际到账')) }]
  const feeField = <Form.Item name="feeAmount" label="线下实际到账金额（元，选填）" rules={[{ validator: (_: unknown, v: number | null | undefined) => v == null || (v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 0.00001) ? Promise.resolve() : Promise.reject(new Error('请输入正数且最多两位小数')) }]}><InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="留空按现有价格表" /></Form.Item>
  const currentCheck = checkResult && checkResult.regionType === regionType && checkResult.regionCode === regionCode?.trim() ? checkResult : undefined
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Space style={{ width: '100%', justifyContent: 'space-between' }}><Typography.Title level={3} style={{ margin: 0 }}>区域代理</Typography.Title>{canManage && <Button type="primary" onClick={() => { appointmentForm.resetFields(); setCheckResult(undefined); setCheckError(''); setAppointmentOpen(true) }}>总部直接任命</Button>}</Space>
    <Alert type="info" showIcon message="同级同区域最多一名有效代理，父子区域互不排斥；同一人可拥有多份任命。" description="代理推荐人与合伙人上级独立展示。省、市代理只升不降赠联创，区县赠私董；单店至少天使，不额外赠级。" />
    {isMockAuth && <Alert type="warning" message="当前为演示登录，请切换真实 API 模式查看任命和申请；此页不生成虚构代理记录。" />}
    {error && <Alert type="error" message={error} action={<Button onClick={() => setRefresh(v => v + 1)}>重新加载</Button>} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: 'assignments', label: '代理任命', children: <Card>
        <Form form={filterForm} layout="inline" onFinish={v => setQuery({ page: 1, pageSize: query.pageSize, ...v })} style={{ marginBottom: 16, gap: 8 }}>
          <Form.Item name="regionType"><Select allowClear placeholder="全部代理级别" options={regionOptions} style={{ width: 150 }} /></Form.Item>
          <Form.Item name="regionCode"><Input allowClear placeholder="精确地区码 / 门店编号" /></Form.Item>
          <Form.Item name="name"><Input allowClear placeholder="代理人姓名" /></Form.Item><Form.Item name="phone"><Input allowClear placeholder="代理人手机号" /></Form.Item>
          <Button htmlType="submit" type="primary">查询</Button><Button onClick={() => { filterForm.resetFields(); setQuery({ page: 1, pageSize: 20 }) }}>重置</Button>
        </Form>
        <Table<Assignment> rowKey="assignmentId" loading={loading} dataSource={list?.items ?? []} columns={assignmentColumns} scroll={{ x: 1580 }} pagination={{ current: query.page, pageSize: query.pageSize, total: list?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], onChange: (page, pageSize) => setQuery(v => ({ ...v, page, pageSize })) }} />
      </Card> },
      { key: 'applications', label: '代理申请审核', children: <Card>
        <Form form={appFilterForm} layout="inline" onFinish={v => setAppQuery({ page: 1, pageSize: appQuery.pageSize, ...v })} style={{ marginBottom: 16, gap: 8 }}>
          <Form.Item name="status"><Select allowClear placeholder="全部审核状态" style={{ width: 150 }} options={Object.entries(reviewLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="regionType"><Select allowClear placeholder="全部代理级别" options={regionOptions} style={{ width: 150 }} /></Form.Item>
          <Form.Item name="name"><Input allowClear placeholder="申请人姓名" /></Form.Item><Form.Item name="phone"><Input allowClear placeholder="申请人手机号" /></Form.Item>
          <Button type="primary" htmlType="submit">查询</Button><Button onClick={() => { appFilterForm.resetFields(); setAppQuery({ page: 1, pageSize: 20 }) }}>重置</Button>
        </Form>
        <Table<AgencyApplication> rowKey="applicationId" loading={loading} dataSource={applications?.items ?? []} scroll={{ x: 1480 }} pagination={{ current: appQuery.page, pageSize: appQuery.pageSize, total: applications?.total ?? 0, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], onChange: (page, pageSize) => setAppQuery(v => ({ ...v, page, pageSize })) }} columns={[
          { title: '申请人 / 手机号 / 等级', key: 'person', width: 220, render: (_, r) => person(r.applicant) },
          { title: '代理级别', dataIndex: 'regionType', width: 120, render: (v: RegionType) => regionLabels[v] || '未知级别' },
          { title: '申请区域', key: 'region', width: 160, render: (_, r) => r.regionName || r.regionCode || '—' },
          { title: '代理推荐人', key: 'referrer', width: 210, render: (_, r) => person(r.referrer) },
          { title: '申请报价（元）', dataIndex: 'payableAmount', width: 140, render: money },
          { title: '审核状态', dataIndex: 'status', width: 110, render: (v: AgencyApplication['status']) => <Tag>{reviewLabels[v] || '未知状态'}</Tag> },
          { title: '申请时间', dataIndex: 'createdAt', width: 180, render: date },
          { title: '审核时间', dataIndex: 'reviewedAt', width: 180, render: date },
          { title: '拒绝原因', dataIndex: 'rejectionReason', width: 200, render: v => v || '—' },
          { title: '操作', key: 'actions', width: 160, fixed: 'right', render: (_, row) => canManage && row.status === 'PENDING_REVIEW' ? <Space>{(['APPROVE', 'REJECT'] as const).map(value => <Button key={value} type="link" danger={value === 'REJECT'} onClick={() => { decisionForm.resetFields(); setDecision({ row, decision: value }) }}>{value === 'APPROVE' ? '同意' : '拒绝'}</Button>)}</Space> : '—' },
        ]} />
      </Card> },
    ]} />
    <Drawer open={!!detailId} title="代理区域详情" width="85%" onClose={() => setDetailId(undefined)}>
      {detailError && <Alert type="error" message={detailError} action={<Button onClick={() => setRefresh(v => v + 1)}>重试</Button>} />}
      {detailLoading && <Typography.Text>正在加载详情…</Typography.Text>}
      {detail && <Space direction="vertical" style={{ width: '100%' }} size={20}>
        <Descriptions bordered column={2} items={[
          { key: 'agent', label: '代理人', children: person(detail.assignment.agent) }, { key: 'level', label: '代理级别', children: regionLabels[detail.assignment.regionType] },
          { key: 'region', label: '代理区域', children: `${detail.assignment.regionName || '—'}（${detail.assignment.regionCode}）` }, { key: 'status', label: '状态', children: detail.assignment.status === 'ACTIVE' ? '有效' : '停用' },
          { key: 'ref', label: '代理推荐人', children: person(detail.assignment.referrer) }, { key: 'up', label: '合伙人上级', children: person(detail.assignment.upline) },
          { key: 'time', label: '成为代理时间', children: date(detail.assignment.appointedAt) }, { key: 'login', label: '最后登录时间', children: date(detail.assignment.lastLoginAt) },
        ]} />
        <Typography.Title level={5}>同用户其他代理任命</Typography.Title><Table<Assignment> rowKey="assignmentId" dataSource={detail.otherAssignments} columns={assignmentColumns} scroll={{ x: 1580 }} pagination={false} />
        <Typography.Title level={5}>{detail.childType === 'costore' || detail.assignment.regionType === 'store' ? '直属合店老板' : `直属${regionLabels[detail.childType as RegionType] || '下级'}`}</Typography.Title>
        {detail.assignment.regionType === 'store' ? <Table<CostoreChild> rowKey="costoreId" dataSource={detail.items as CostoreChild[]} columns={[{ title: '合店老板', key: 'owner', render: (_, r) => person(r.owner) }, { title: '所属门店编号', dataIndex: 'storeId' }]} pagination={{ current: detail.page, pageSize: detail.pageSize, total: detail.total, showSizeChanger: false, onChange: setDetailPage }} /> : <Table<Assignment> rowKey="assignmentId" dataSource={detail.items as Assignment[]} columns={assignmentColumns} scroll={{ x: 1580 }} pagination={{ current: detail.page, pageSize: detail.pageSize, total: detail.total, showSizeChanger: false, onChange: setDetailPage }} />}
      </Space>}
    </Drawer>
    <Modal title="总部直接任命代理" open={appointmentOpen} onCancel={() => setAppointmentOpen(false)} onOk={prepareAppointment} okText="核对任命" width={640}>
      <Alert type="warning" showIcon message="提交即声明线下款项已到账，将立即任命、按规则赠级及记账。" />
      <Form form={appointmentForm} layout="vertical" initialValues={{ regionType: 'district', priceTier: 0 }} style={{ marginTop: 16 }}>
        <Form.Item name="partnerId" label="代理用户 ID" rules={[{ required: true, whitespace: true }]}><Input placeholder="输入已有用户 ID，按字符串处理" /></Form.Item>
        <Form.Item name="regionType" label="代理级别" rules={[{ required: true }]}><Select options={regionOptions} /></Form.Item>
        <Form.Item name="regionCode" label={regionType === 'store' ? '稳定门店编号' : '六位行政区划码'} rules={[{ required: true, whitespace: true }, { validator: (_: unknown, v: string) => regionType === 'store' || /^\d{6}$/.test(v?.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入六位行政区划码')) }]}><Input /></Form.Item>
        <Space style={{ marginBottom: 16 }}><Button loading={checking} onClick={check}>检验区域占用</Button>{currentCheck && <Tag color={currentCheck.available ? 'green' : 'red'}>{currentCheck.available ? '当前可任命' : '已有有效代理'}</Tag>}</Space>
        {checkError && <Alert type="error" message={checkError} />}
        <Typography.Paragraph type="secondary">占用检验仅作提示，提交时服务端会再次校验。</Typography.Paragraph>
        {regionType === 'city' && <Form.Item name="priceTier" label="市代价格档位"><Select options={[0, 1, 2].map(value => ({ value, label: `档位 ${value}` }))} /></Form.Item>}
        {regionType === 'store' && <><Form.Item name="parentCode" label="所属区县六位码" rules={[{ required: true }, { pattern: /^\d{6}$/, message: '请输入六位区县码' }]}><Input /></Form.Item><Form.Item name="storeName" label="门店名称"><Input /></Form.Item><Form.Item name="storeAddress" label="门店地址"><Input /></Form.Item><Form.Item name="storeContact" label="门店联系方式"><Input /></Form.Item></>}
        <Form.Item name="promotionCode" label="代理推荐码（选填）"><Input placeholder="有效代理推荐码；留空表示无推荐人" /></Form.Item>
        {feeField}<Form.Item name="reason" label="任命原因" rules={reasonRules}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="received" valuePropName="checked" rules={receivedRule}><Checkbox>我已确认线下款项实际到账</Checkbox></Form.Item>
      </Form>
    </Modal>
    <Modal title={decision?.decision === 'APPROVE' ? '同意代理申请' : '拒绝代理申请'} open={!!decision} onCancel={() => setDecision(undefined)} onOk={prepareDecision} okText="核对审核">
      {decision && <><p>申请人：{decision.row.applicant?.name || '—'}；区域：{decision.row.regionName || decision.row.regionCode || '—'}</p><Form form={decisionForm} layout="vertical">
        {decision.decision === 'APPROVE' && <><Alert type="warning" message="同意代表已确认线下到账，将立即执行真实任命、赠级及记账；申请报价不是支付凭证。" />{feeField}<Form.Item name="received" valuePropName="checked" rules={receivedRule}><Checkbox>我已确认线下款项实际到账</Checkbox></Form.Item></>}
        <Form.Item name="reason" label={decision.decision === 'REJECT' ? '拒绝原因' : '审核原因'} rules={reasonRules}><Input.TextArea rows={3} /></Form.Item>
      </Form></>}
    </Modal>
    <Modal title="确认提交" open={!!review} maskClosable={false} closable={!busy} confirmLoading={busy} cancelButtonProps={{ disabled: busy }} onCancel={() => setReview(undefined)} onOk={submit} okText={uncertain ? '使用原请求重试' : '确认提交'}>
      {review && <><p>{review.kind === 'appoint' ? `任命用户 ${review.input.partnerId} 至 ${regionLabels[review.input.regionType]} ${review.input.regionCode}` : `审核申请人 ${review.name}：${review.input.decision === 'APPROVE' ? '同意' : '拒绝'}`}</p><p>原因：{review.input.reason}</p>{(review.kind === 'appoint' || review.input.decision === 'APPROVE') && <Alert type="warning" message="已确认线下款项到账" description={`实际到账金额：${review.input.feeAmount == null ? '按现有价格表' : money(review.input.feeAmount)}；提交会产生真实任命和记账。`} />}<Typography.Paragraph type="secondary">请求号：{review.key}</Typography.Paragraph></>}
      {submitError && <Alert type="error" message={submitError} description="先刷新列表核对执行结果。重试沿用当前请求号和原始参数，勿直接新建请求绕过冲突。" />}
    </Modal>
    <Modal title="服务端操作回执" open={!!receipt} onCancel={() => setReceipt(undefined)} footer={<Button onClick={() => setReceipt(undefined)}>关闭</Button>} width={760}>
      {receipt && <Space direction="vertical" style={{ width: '100%' }}><p>审计编号：{receipt.operationId}</p>{receipt.assignment && <p>任命区域：{receipt.assignment.regionName || receipt.assignment.regionCode}；代理人：{receipt.assignment.agent?.name || '—'}</p>}{'fee' in receipt && <><p>本次记账收入：{money(receipt.fee.amount)}；任命时间：{date(receipt.fee.period)}；实际提升等级：{receipt.grantedTier ? tierLabels[receipt.grantedTier] || '未知等级' : '未提升'}</p><Table rowKey="id" dataSource={receipt.commissions} pagination={false} locale={{ emptyText: '本次无实际落账佣金' }} columns={[{ title: '技术费基数（元）', dataIndex: 'base_amount', render: money }, { title: '比例', dataIndex: 'rate', render: (v: number) => `${v * 100}%` }, { title: '佣金（元）', dataIndex: 'amount', render: money }, { title: '状态', dataIndex: 'status', render: (v: string) => v === 'pending' ? '待结算' : '未知状态' }, { title: '说明', dataIndex: 'note' }]} /></>}{'application' in receipt && <p>申请审核结果：{reviewLabels[receipt.application.status]}</p>}</Space>}
    </Modal>
  </Space>
}
