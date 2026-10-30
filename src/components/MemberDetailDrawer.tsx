import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Descriptions, Drawer, Input, Modal, Progress, Select, Space, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { hasPermission } from '../auth/access'
import type { HqAccount } from '../types/auth'
import { MemberServiceError, type MemberDetail, type MemberOptions, type MemberProfile, type MemberProfileMutation } from '../types/members'
import { membersService } from '../services/members'
import { formatUserDate } from './UserDetailDrawer'
import { entitlementActions, type EntitlementRequest } from './MemberEntitlementModal'

type ProfileMode = 'update-profile' | 'bind-store' | 'unbind-store' | 'set-status' | null

export default function MemberDetailDrawer({ memberId, token, operator, options, refresh, onClose, onAction, onRefresh }: {
  memberId: string; token: string; operator: HqAccount; options: MemberOptions | null; refresh: number
  onClose: () => void; onAction: (request: EntitlementRequest) => void; onRefresh?: () => void
}) {
  const [data, setData] = useState<MemberDetail | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [mode, setMode] = useState<ProfileMode>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<MemberProfileMutation | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [gradeCode, setGradeCode] = useState<string | undefined>()
  const [genderCode, setGenderCode] = useState<MemberProfile['genderCode']>('UNDISCLOSED')
  const [storeId, setStoreId] = useState<string | undefined>()
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [api, holder] = message.useMessage()
  const canManage = hasPermission(operator, 'members:access')

  useEffect(() => {
    let alive = true
    setBusy(true); setError(null); setData(null)
    membersService.detail(token, memberId).then(value => { if (alive) setData(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '详情加载失败') }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [memberId, token, refresh, retry])

  const member = data?.member

  function openMode(next: ProfileMode) {
    if (!member || !next) return
    setMode(next)
    setReason(''); setPending(null); setSubmitError(''); setBlocked(false)
    setName(member.name)
    setBirthday(member.birthday ?? '')
    setGradeCode(member.gradeCode || undefined)
    setGenderCode(member.genderCode)
    setStoreId(member.storeId ?? undefined)
    setStatus(member.status ?? 'ACTIVE')
  }

  function closeEditors() {
    if (submitting) return
    setMode(null); setPending(null); setSubmitError(''); setBlocked(false)
  }

  function prepare() {
    if (!member || !mode || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    const base = { memberId: member.memberId, version: member.version, reason: reason.trim(), idempotencyKey: crypto.randomUUID() }
    if (mode === 'update-profile') {
      const grade = (options?.grades ?? []).find(g => g.code === gradeCode)
      const genderLabel = genderCode === 'MALE' ? '男' : genderCode === 'FEMALE' ? '女' : '未披露'
      setPending({
        ...base, action: 'update-profile',
        name: name.trim(), birthday: birthday.trim() || null,
        ...(gradeCode ? { gradeCode, gradeLabel: grade?.label ?? gradeCode } : {}),
        genderCode, genderLabel,
      })
    } else if (mode === 'bind-store') {
      if (!storeId) { setSubmitError('请选择门店'); return }
      setPending({ ...base, action: 'bind-store', storeId })
    } else if (mode === 'unbind-store') {
      setPending({ ...base, action: 'unbind-store', storeId: member.storeId })
    } else {
      setPending({ ...base, action: 'set-status', status })
    }
    setSubmitError('')
  }

  async function submit() {
    if (!pending || submitting || blocked) return
    setSubmitting(true); setSubmitError('')
    try {
      await membersService.profileMutate(token, pending)
      setMode(null); setPending(null)
      setRetry(n => n + 1)
      onRefresh?.()
      api.success('会员档案已更新')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请沿用原请求重试')
      if (err instanceof MemberServiceError) setBlocked(true)
    } finally { setSubmitting(false) }
  }

  return <Drawer open title="孩子会员档案与权益" width={900} onClose={onClose}>{holder}
    {busy && <Spin tip="加载学员资料"><div style={{ minHeight: 160 }} /></Spin>}
    {error && <Alert type="error" message={error} action={<Button onClick={() => setRetry(value => value + 1)}>重试</Button>} />}
    {member && data && <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Space wrap>
        <Avatar src={member.avatar}>{member.name.slice(0, 1)}</Avatar>
        <Typography.Title level={4} style={{ margin: 0 }}>{member.name}</Typography.Title>
        <Tag>{member.displayId}</Tag>
        <Tag color={(member.status ?? 'ACTIVE') === 'ACTIVE' ? 'green' : 'default'}>{(member.status ?? 'ACTIVE') === 'ACTIVE' ? '有效' : '停用'}</Tag>
      </Space>
      <Descriptions size="small" bordered column={2} items={[
        { key: 'member', label: '学员 ID', children: member.memberId }, { key: 'account', label: '家长账号 ID', children: member.accountId },
        { key: 'context', label: '学习身份 ID', children: member.contextId, span: 2 },
        { key: 'grade', label: '年级 / 性别', children: `${member.gradeLabel} / ${member.genderLabel}` },
        { key: 'birthday', label: '生日', children: member.birthday ?? '未设置' },
        { key: 'version', label: '数据版本', children: member.version },
        { key: 'status', label: '档案状态', children: (member.status ?? 'ACTIVE') === 'ACTIVE' ? '有效' : '停用' },
        { key: 'parent', label: '所属家长', children: `${member.parentName} · ${member.parentPhone}`, span: 2 },
        { key: 'store', label: '学员所属门店', children: member.storeName ?? '未绑定门店', span: 2 },
      ]} />
      {canManage && <Space wrap>
        <Button size="small" onClick={() => openMode('update-profile')}>编辑资料</Button>
        <Button size="small" onClick={() => openMode('bind-store')}>绑定门店</Button>
        {member.storeId && <Button size="small" onClick={() => openMode('unbind-store')}>解绑门店</Button>}
        <Button size="small" onClick={() => openMode('set-status')}>设置状态</Button>
      </Space>}
      <Tabs items={[
        { key: 'entitlements', label: '会员权益与课程', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message="学习权益永久有效；三组等级归属为小程序现有演示配置，正式编码与包含关系待确认。" />
          {!options && <Alert type="warning" message="会员等级选项尚未加载，权益操作暂不可用；请关闭详情后刷新页面内列表。" />}
          {(options?.tiers ?? []).map(tier => {
            const grant = (member.entitlements ?? []).find(item => item.membershipTierId === tier.membershipTierId)
            const action = !grant ? 'grant' : grant.status === 'active' ? 'revoke' : 'restore'
            return <Card key={tier.membershipTierId} size="small" title={<Space wrap><span>{tier.name}</span><Tag color={grant?.status === 'active' ? 'green' : grant ? 'orange' : undefined}>{grant?.status === 'active' ? '已开通 · 永久' : grant ? '已撤销' : '未开通'}</Tag></Space>} extra={hasPermission(operator, `members:${action}`) ? <Button size="small" danger={action === 'revoke'} onClick={() => onAction({ member, tier, action })}>{entitlementActions[action]}</Button> : undefined}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {grant && <Typography.Text type="secondary">来源：{grant.source === 'hq-manual' ? '总部人工开通' : '激活码'} · 开通：{formatUserDate(grant.grantedAt)} · 最近处理：{formatUserDate(grant.lastChangedAt)}</Typography.Text>}
                {(data.levels ?? []).filter(level => level.membershipTierId === tier.membershipTierId).map(level => <div key={level.levelId} className="member-course-row"><span>{level.name}</span><Tag color={level.unlocked ? 'green' : undefined}>{level.unlocked ? '已解锁' : '未授权'}</Tag><Progress percent={level.percent} size="small" style={{ width: 130, marginInlineEnd: 10 }} /></div>)}
              </Space>
            </Card>
          })}
          <Alert type="info" message="恢复学习权益在本页处理；未用码补发请前往会员/专栏激活码管理。补发会作废旧码且不会直接开通权益，已用码不能直接补发新码。正式绑定/转赠规则仍待确认。" />
        </Space> },
        { key: 'orders', label: `关联订单（${(data.orders ?? []).length}）`, children: <><Alert style={{ marginBottom: 16 }} type="info" message="订单仅展示演示交易快照；付款主体是家长账号，付款不等于学习权益已激活。" /><Table rowKey="orderId" size="small" dataSource={data.orders ?? []} pagination={false} scroll={{ x: 650 }} locale={{ emptyText: '暂无关联订单' }} columns={[
          { title: '订单号 / 商品', key: 'order', render: (_, order) => <>{order.orderNo}<br />{order.title}</> },
          { title: '购买账号', dataIndex: 'accountId' }, { title: '实付（元）', dataIndex: 'payableAmount', render: value => (value / 100).toFixed(2) }, { title: '交易状态', dataIndex: 'statusLabel' },
        ]} /></> },
        { key: 'feedback', label: `训练反馈（${(data.feedback ?? []).length}）`, children: <><Alert style={{ marginBottom: 16 }} type="info" message="此处只读查询反馈摘要；反馈编辑、代写与课时核销将在 HQ-20 实现。" /><Table rowKey="feedbackId" size="small" dataSource={data.feedback ?? []} pagination={false} locale={{ emptyText: '暂无反馈记录' }} columns={[
          { title: '标题 / 摘要', key: 'content', render: (_, record) => <><strong>{record.title}</strong><p>{record.summary}</p></> }, { title: '类型', dataIndex: 'kind', render: kind => ({ training: '训练', 'self-study': '自学', camp: '集训' }[kind as 'training' | 'self-study' | 'camp']) }, { title: '作者 / 时间', key: 'author', render: (_, record) => <>{record.authorName}<br />{formatUserDate(record.createdAt)}</> },
        ]} /></> },
        { key: 'audit', label: `权益操作记录（${(data.audit ?? []).length}）`, children: <Table rowKey="operationId" size="small" dataSource={data.audit ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 720 }} locale={{ emptyText: '暂无总部权益操作记录' }} columns={[
          { title: '操作 / 等级', key: 'action', render: (_, item) => <>{item.origin === 'activation-code' ? '用户激活码开通（Mock）' : entitlementActions[item.action]}<br />{item.tierName}<br />{formatUserDate(item.occurredAt)}</> },
          { title: '变更 / 原因', key: 'change', render: (_, item) => <>{item.before} → {item.after}<p>{item.reason}</p><Typography.Text type="secondary">请求号：{item.requestId}</Typography.Text></> },
          { title: '总部操作人', key: 'operator', render: (_, item) => <>{item.operatorName}<br />{item.operatorId}</> },
        ]} /> },
      ]} />
    </Space>}

    <Modal title={mode === 'update-profile' ? '编辑学员资料' : mode === 'bind-store' ? '绑定门店' : mode === 'unbind-store' ? '解绑门店' : mode === 'set-status' ? '设置档案状态' : '档案操作'}
      open={!!mode && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepare}>核对变更</Button></Space>}>
      {member && mode && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text type="secondary">{member.name} · {member.memberId} · V{member.version}</Typography.Text>
        {mode === 'update-profile' && <>
          <Input aria-label="学员姓名" placeholder="姓名" maxLength={24} value={name} onChange={e => setName(e.target.value)} />
          <Input aria-label="学员生日" placeholder="生日 YYYY-MM-DD（可空）" value={birthday} onChange={e => setBirthday(e.target.value)} />
          <Select aria-label="学员年级" allowClear placeholder="年级" style={{ width: '100%' }} value={gradeCode} onChange={setGradeCode}
            options={(options?.grades ?? []).map(g => ({ value: g.code, label: g.label }))} />
          <Select aria-label="学员性别" style={{ width: '100%' }} value={genderCode} onChange={setGenderCode}
            options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '未披露' }]} />
        </>}
        {mode === 'bind-store' && (
          <Select aria-label="绑定门店" showSearch optionFilterProp="label" placeholder="选择门店" style={{ width: '100%' }} value={storeId} onChange={setStoreId}
            options={(options?.stores ?? []).filter(s => s.active !== false).map(s => ({ value: s.storeId, label: s.name }))} />
        )}
        {mode === 'unbind-store' && <Typography.Paragraph>将解除「{member.storeName ?? member.storeId}」绑定，学员变为未绑定门店。</Typography.Paragraph>}
        {mode === 'set-status' && (
          <Select aria-label="档案状态" style={{ width: '100%' }} value={status} onChange={setStatus}
            options={[{ value: 'ACTIVE', label: '有效 ACTIVE' }, { value: 'INACTIVE', label: '停用 INACTIVE' }]} />
        )}
        <Input.TextArea aria-label="档案操作原因" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="填写原因（必填）" />
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>

    <Modal title="确认提交" open={!!pending}
      okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认提交'}
      confirmLoading={submitting} okButtonProps={{ disabled: blocked }}
      cancelButtonProps={{ disabled: submitting || (!!submitError && !blocked) }}
      cancelText={blocked ? '关闭并刷新' : '返回修改'}
      closable={!submitting && (!submitError || blocked)} maskClosable={false}
      onCancel={() => { if (!submitting && (!submitError || blocked)) { if (blocked) { closeEditors(); setRetry(n => n + 1); onRefresh?.() }; setPending(null); setSubmitError('') } }}
      onOk={submit}>
      {pending && <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph>操作：{pending.action}<br />原因：{pending.reason}<br />请求号：{pending.idempotencyKey}<br />版本：{pending.version}</Typography.Paragraph>
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>
  </Drawer>
}
