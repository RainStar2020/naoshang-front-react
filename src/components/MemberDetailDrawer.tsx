import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Card, Descriptions, Drawer, Input, Modal, Progress, Select, Space, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { hasPermission } from '../auth/access'
import type { HqAccount } from '../types/auth'
import { MemberServiceError, type MemberDetail, type MemberOptions, type MemberProfile, type MemberProfileMutation } from '../types/members'
import { membersService } from '../services/members'
import { usersService } from '../services/users'
import { formatUserDate } from './UserDetailDrawer'
import { entitlementActions, type EntitlementRequest } from './MemberEntitlementModal'

type ProfileMode = 'update-profile' | 'set-status' | null

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
  const [accountBound, setAccountBound] = useState(false)
  const [accountStoreName, setAccountStoreName] = useState<string | null>(null)
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [api, holder] = message.useMessage()
  const canManage = hasPermission(operator, 'members:access')

  useEffect(() => {
    let alive = true
    setBusy(true); setError(null); setData(null)
    membersService.detail(token, memberId).then(async value => {
      if (!alive) return
      setData(value)
      try {
        const binding = await usersService.getStoreBinding(token, value.member.accountId)
        if (!alive) return
        setAccountBound(!!binding.binding.bound)
        setAccountStoreName(binding.binding.storeName)
      } catch {
        if (!alive) return
        setAccountBound(!!value.member.storeId)
        setAccountStoreName(value.member.storeName)
      }
    }).catch(err => { if (alive) setError(err instanceof Error ? err.message : '详情加载失败') }).finally(() => { if (alive) setBusy(false) })
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
    setStatus(member.status ?? 'ACTIVE')
  }

  function closeEditors() {
    if (submitting) return
    setMode(null); setPending(null); setSubmitError(''); setBlocked(false)
  }

  function prepare() {
    if (!member || !mode) { setSubmitError('无可提交操作'); return }
    if (!reason.trim()) { setSubmitError('请填写操作原因'); return }
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
      <div>
        <Typography.Title level={5}>学员</Typography.Title>
        <Descriptions size="small" bordered column={2} items={[
          { key: 'displayId', label: '编号', children: member.displayId },
          { key: 'displayName', label: '显示名称', children: member.name },
        ]} />
      </div>
      <Descriptions size="small" bordered column={2} items={[
        { key: 'account', label: '家长账号 ID', children: member.accountId },
        { key: 'context', label: '学习身份 ID', children: member.contextId },
        { key: 'grade', label: '年级 / 性别', children: `${member.gradeLabel} / ${member.genderLabel}` },
        { key: 'birthday', label: '生日', children: member.birthday ?? '未设置' },
        { key: 'status', label: '档案状态', children: (member.status ?? 'ACTIVE') === 'ACTIVE' ? '有效' : '停用' },
        { key: 'parent', label: '所属家长', children: `${member.parentName} · ${member.parentPhone}`, span: 2 },
        { key: 'store', label: '所属门店（跟随家长）', children: accountBound ? (accountStoreName ?? member.storeName ?? '已绑定') : (member.storeName ?? '未绑定门店'), span: 2 },
      ]} />
      {canManage && <Space wrap>
        <Button size="small" onClick={() => openMode('update-profile')}>编辑资料</Button>
        <Button size="small" onClick={() => openMode('set-status')}>设置状态</Button>
      </Space>}
      <Alert type="info" showIcon message="孩子门店跟随家长账号；请到「账号与会员 → 用户账号」修改门店绑定。" />
      <Tabs items={[
        { key: 'entitlements', label: '会员权益与课程', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
        </Space> },
        { key: 'orders', label: `关联订单（${(data.orders ?? []).length}）`, children: <><Table rowKey="orderId" size="small" dataSource={data.orders ?? []} pagination={false} scroll={{ x: 650 }} locale={{ emptyText: '暂无关联订单' }} columns={[
          { title: '订单号', dataIndex: 'orderNo' }, { title: '商品', dataIndex: 'title' },
          { title: '购买账号', dataIndex: 'accountId' }, { title: '实付（元）', dataIndex: 'payableAmount', render: value => (value / 100).toFixed(2) }, { title: '交易状态', dataIndex: 'statusLabel' },
        ]} /></> },
        { key: 'feedback', label: `训练反馈（${(data.feedback ?? []).length}）`, children: <><Table rowKey="feedbackId" size="small" dataSource={data.feedback ?? []} pagination={false} locale={{ emptyText: '暂无反馈记录' }} columns={[
          { title: '标题', dataIndex: 'title' }, { title: '摘要', dataIndex: 'summary', ellipsis: true }, { title: '类型', dataIndex: 'kind', render: kind => ({ training: '训练', 'self-study': '自学', camp: '集训' }[kind as 'training' | 'self-study' | 'camp']) }, { title: '作者', dataIndex: 'authorName' }, { title: '时间', key: 'createdAt', render: (_, record) => formatUserDate(record.createdAt) },
        ]} /></> },
        { key: 'audit', label: `权益操作记录（${(data.audit ?? []).length}）`, children: <Table rowKey="operationId" size="small" dataSource={data.audit ?? []} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 720 }} locale={{ emptyText: '暂无总部权益操作记录' }} columns={[
          { title: '操作', key: 'action', render: (_, item) => item.origin === 'activation-code' ? '用户激活码开通（Mock）' : entitlementActions[item.action] }, { title: '等级', dataIndex: 'tierName' }, { title: '时间', key: 'occurredAt', render: (_, item) => formatUserDate(item.occurredAt) },
          { title: '变更前', dataIndex: 'before' }, { title: '变更后', dataIndex: 'after' }, { title: '原因', dataIndex: 'reason' }, { title: '请求号', dataIndex: 'requestId' },
          { title: '操作人', dataIndex: 'operatorName' }, { title: '操作人ID', dataIndex: 'operatorId' },
        ]} /> },
      ]} />
    </Space>}

    <Modal title={mode === 'update-profile' ? '编辑学员资料' : mode === 'set-status' ? '设置档案状态' : '档案操作'}
      open={!!mode && !pending} onCancel={closeEditors}
      footer={<Space><Button onClick={closeEditors}>取消</Button><Button type="primary" onClick={prepare}>核对变更</Button></Space>}>
      {member && mode && <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Text type="secondary">{member.name} · {member.displayId}</Typography.Text>
        {mode === 'update-profile' && <>
          <Input aria-label="学员姓名" placeholder="姓名" maxLength={24} value={name} onChange={e => setName(e.target.value)} />
          <Input aria-label="学员生日" placeholder="生日 YYYY-MM-DD（可空）" value={birthday} onChange={e => setBirthday(e.target.value)} />
          <Select aria-label="学员年级" allowClear placeholder="年级" style={{ width: '100%' }} value={gradeCode} onChange={setGradeCode}
            options={(options?.grades ?? []).map(g => ({ value: g.code, label: g.label }))} />
          <Select aria-label="学员性别" style={{ width: '100%' }} value={genderCode} onChange={setGenderCode}
            options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '未披露' }]} />
        </>}
        
        {mode === 'set-status' && (
          <Select aria-label="档案状态" style={{ width: '100%' }} value={status} onChange={setStatus}
            options={[{ value: 'ACTIVE', label: '有效 ACTIVE' }, { value: 'INACTIVE', label: '停用 INACTIVE' }]} />
        )}
        <Input.TextArea aria-label="备注" value={reason} maxLength={200} showCount onChange={e => setReason(e.target.value)} placeholder="请填写操作原因" />
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
        <Typography.Paragraph>操作：{pending.action}<br />备注：{pending.reason || '（无）'}<br />请求号：{pending.idempotencyKey}<br />版本：{pending.version}</Typography.Paragraph>
        {submitError && <Alert type="error" message={submitError} />}
      </Space>}
    </Modal>
  
  </Drawer>
}
