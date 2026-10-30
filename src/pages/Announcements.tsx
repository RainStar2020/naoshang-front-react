import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Drawer, Input, Modal, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { announcementsService as service } from '../services/announcements'
import { AnnouncementError, announcementRoles, type AnnouncementCatalog, type AnnouncementDraft, type AnnouncementMutation, type AnnouncementStats, type ManagedAnnouncement } from '../types/announcements'
import CmsContentEditor, { CmsAssetInput } from '../components/CmsContentEditor'
import { ContentPreview, emptyContent } from '../utils/richContent'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'
const roleLabels = { parent: '家长（有孩子档案）', coach: '健脑官（待账号API）', partner: '合伙人', agency: '代理', costore: '合店老板' }
const statusLabels = { draft: '草稿', published: '已发布', scheduled: '待定时发布', offline: '已下线' }
const actions = { save: '保存公告草稿', publish: '发布公告', offline: '下线公告' }
function Editor({ row, token, close, save }: { row: ManagedAnnouncement | null; token: string; close: () => void; save: (input: AnnouncementMutation) => void }) {
  const [draft, setDraft] = useState<AnnouncementDraft>(() => structuredClone(row?.draft ?? { id: '', title: '', summary: '', content: emptyContent(), coverUrl: '', pinned: false, audience: [], publishAt: null }))
  const [date, setDate] = useState(() => draft.publishAt ? new Date(Date.parse(draft.publishAt) + 8 * 3600000).toISOString().slice(0, 16) : '')
  const [error, setError] = useState('')
  const change = (value: Partial<AnnouncementDraft>) => setDraft(current => ({ ...current, ...value }))
  const submit = () => { if (!draft.title.trim()) { setError('请填写公告标题'); return } const time = date ? Date.parse(`${date}:00+08:00`) : null; if (time !== null && !Number.isFinite(time)) { setError('定时时间无效'); return } save({ action: 'save', id: draft.id, value: { ...draft, publishAt: time === null ? null : new Date(time).toISOString() }, version: row?.version ?? 0, reason: '', idempotencyKey: '' }) }
  const upload = (file: File) => service.upload(token, file)
  return <Modal open width={900} title={row ? '编辑公告草稿' : '新建公告'} onCancel={close} onOk={submit} okText="核对并保存" cancelText="取消" maskClosable={false}><Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Alert type="info" message="保存草稿后需要发布；空身份范围表示全部正常账号，多身份按账号去重。定时使用北京时间（UTC+8）。" />{error && <Alert type="error" message={error} />}
    <label>公告标题<Input aria-label="公告标题" maxLength={80} value={draft.title} onChange={event => change({ title: event.target.value })} /></label>
    <label>摘要<Input.TextArea aria-label="公告摘要" maxLength={300} value={draft.summary} onChange={event => change({ summary: event.target.value })} /></label>
    <Checkbox checked={draft.pinned} onChange={event => change({ pinned: event.target.checked })}>置顶公告</Checkbox>
    <Select aria-label="公告目标身份" mode="multiple" allowClear placeholder="全部正常账号；可选多个身份（满足任一）" style={{ width: '100%' }} value={draft.audience} onChange={audience => change({ audience })} options={announcementRoles.map(value => ({ value, label: roleLabels[value] }))} />
    <label>定时发布（北京时间；留空立即发布）<Input aria-label="公告定时发布时间" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label>
    <CmsAssetInput label="公告封面（可选）" value={draft.coverUrl} onChange={coverUrl => change({ coverUrl })} token={token} upload={upload} />
    <CmsContentEditor label="公告正文" token={token} upload={upload} value={draft.content} onChange={content => change({ content })} />
  </Space></Modal>
}
function Statistics({ row, token, close }: { row: ManagedAnnouncement; token: string; close: () => void }) {
  const [stats, setStats] = useState<AnnouncementStats | null>(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [filter, setFilter] = useState<string>('all'), [keyword, setKeyword] = useState('')
  useEffect(() => { let alive = true; setStats(null); setError(''); service.stats(token, row.draft.id).then(value => { if (alive) setStats(value) }).catch(err => { if (alive) setError(err.message) }); return () => { alive = false } }, [token, row.draft.id, refresh])
  return <Drawer open width={980} title={`${row.draft.title} · 已读统计`} onClose={close}><Space direction="vertical" size={20} style={{ width: '100%' }}>
    <Alert type="info" message="按发布快照的范围与当前正常账号身份计算，冻结账号不计入；去重人数来自完整人群，与当前页和筛选无关。范围可读取不代表已推送到设备；重新发布保留首次已读时间。" />
    <Button onClick={() => setRefresh(value => value + 1)}>刷新统计</Button>{error && <Alert type="error" message={error} />}
    {stats && <><Space size={48}><Statistic title="目标账号" value={stats.targetCount} /><Statistic title="已读人数" value={stats.readCount} /><Statistic title="未读人数" value={stats.unreadCount} /></Space>{!stats.available && <Alert type="warning" message="公告当前不可读取。未发布无目标统计；定时或下线公告显示目标范围及保留记录，不代表已经送达。" />}
      <Space><Input aria-label="搜索阅读账号" placeholder="昵称 / 手机号 / 账号ID" value={keyword} onChange={event => setKeyword(event.target.value)} /><Select aria-label="筛选阅读状态" value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部阅读状态' }, { value: 'read', label: '已读' }, { value: 'unread', label: '未读' }]} /></Space>
      <Table rowKey="accountId" size="small" pagination={{ pageSize: 10, showTotal: total => `筛选结果 ${total} 个账号` }} dataSource={stats.recipients.filter(item => `${item.nickname} ${item.phone} ${item.accountId}`.includes(keyword) && (filter === 'all' || (filter === 'read' ? !!item.firstReadAt : !item.firstReadAt)))} columns={[{ title: '账号', key: 'account', render: (_, item) => <>{item.nickname}<br />{item.phone}<br />{item.accountId}</> }, { title: '当前身份', key: 'roles', render: (_, item) => (item.roles ?? []).map(role => roleLabels[role]).join('、') || '普通账号' }, { title: '阅读状态', key: 'read', render: (_, item) => <Tag color={item.firstReadAt ? 'green' : 'default'}>{item.firstReadAt ? '已读' : '未读'}</Tag> }, { title: '首次阅读时间', key: 'time', render: (_, item) => item.firstReadAt ? formatUserDate(item.firstReadAt) : '—' }]} />
    </>}
  </Space></Drawer>
}
function Preview({ row, close }: { row: ManagedAnnouncement; close: () => void }) {
  const [published, setPublished] = useState(false); const value = published ? row.publication!.value : row.draft
  return <Modal open width={800} title="公告内容预览" footer={null} onCancel={close}><Space direction="vertical" style={{ width: '100%' }}><Space><Button onClick={() => setPublished(false)}>当前草稿</Button><Button disabled={!row.publication} onClick={() => setPublished(true)}>发布快照</Button></Space><Alert type="info" message={`${published ? '发布快照' : '当前草稿'}；总部预览不登记账号已读。`} /><Typography.Title level={3}>{value.title}</Typography.Title><p>{value.summary}</p>{value.coverUrl && <img alt="公告封面" src={service.resolveAsset(value.coverUrl)} style={{ maxWidth: '100%', maxHeight: 200 }} />}<ContentPreview value={value.content} resolveUrl={service.resolveAsset} /></Space></Modal>
}
export default function Announcements() {
  const { session } = useAuth(); const { token, account } = session!
  const edit = hasPermission(account, 'announcements:edit'), publish = hasPermission(account, 'announcements:publish')
  const [catalog, setCatalog] = useState<AnnouncementCatalog | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0)
  const [keyword, setKeyword] = useState(''), [status, setStatus] = useState<string | undefined>(), [editor, setEditor] = useState<ManagedAnnouncement | 'new' | null>(null), [preview, setPreview] = useState<ManagedAnnouncement | null>(null), [stats, setStats] = useState<ManagedAnnouncement | null>(null)
  const [pending, setPending] = useState<AnnouncementMutation | null>(null), [reason, setReason] = useState(''), [submitError, setSubmitError] = useState(''), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false)
  const [api, holder] = message.useMessage()
  useEffect(() => { const timer = setInterval(() => setRefresh(value => value + 1), 30000); return () => clearInterval(timer) }, [])
  useEffect(() => { let alive = true; setLoading(true); setError(''); service.catalog(token).then(value => { if (alive) setCatalog(value) }).catch(err => { if (alive) setError(err.message) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [token, refresh])
  const request = (value: AnnouncementMutation) => { setPending({ ...value, idempotencyKey: crypto.randomUUID() }); setReason(''); setSubmitError(''); setBlocked(false) }
  const confirm = async () => { if (!pending || !reason.trim()) { setSubmitError('请填写操作原因'); return } setBusy(true); try { await service.mutate(token, { ...pending, reason: reason.trim() }); setCatalog(await service.catalog(token)); setPending(null); setEditor(null); api.success('公告Mock操作已完成') } catch (err) { setSubmitError(err instanceof Error ? err.message : '结果未知，请保留请求号重试'); setBlocked(err instanceof AnnouncementError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code)) } finally { setBusy(false) } }
  const pendingDraft = pending?.action === 'save' ? pending.value : catalog?.items.find(row => row.draft.id === pending?.id)?.draft
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}<div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>公告发布与已读统计</Typography.Title><Typography.Text type="secondary">管理定向公告草稿/发布/下线，以及按账号去重的已读统计（首次阅读时间保留）。</Typography.Text></div><Button onClick={() => setRefresh(value => value + 1)} loading={loading}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据，尚未接通小程序公告API或消息推送；定时可见性按服务查询时间校验，列表每30秒刷新。" />{error && <Alert type="error" message={error} />}
    <Tabs items={[{ key: 'list', label: '公告管理', children: <Card loading={loading} title="公告目录" extra={edit && <Button type="primary" onClick={() => setEditor('new')}>新建公告</Button>}><Space style={{ marginBottom: 20 }}><Input aria-label="搜索公告" placeholder="搜索标题" value={keyword} onChange={event => setKeyword(event.target.value)} /><Select aria-label="筛选公告状态" allowClear placeholder="全部状态" style={{ width: 160 }} value={status} onChange={setStatus} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /></Space>
      <Table<ManagedAnnouncement> rowKey={row => row.draft.id} scroll={{ x: 1150 }} dataSource={catalog?.items.filter(row => row.draft.title.includes(keyword) && (!status || status === row.status))} columns={[
        { title: '公告标题', key: 'title', width: 240, render: (_, row) => <>{row.draft.pinned && <Tag color="blue">置顶</Tag>}<strong>{row.draft.title}</strong><br /><Typography.Text type="secondary">{row.draft.summary}</Typography.Text></> },
        { title: '发布范围（快照）', key: 'audience', width: 150, render: (_, row) => row.publication ? (row.publication.value.audience ?? []).map(role => roleLabels[role]).join('、') || '全部正常账号' : '尚未发布' },
        { title: '状态 / 版本', key: 'status', width: 180, render: (_, row) => <><Tag color={row.status === 'published' ? 'green' : row.status === 'scheduled' ? 'blue' : 'default'}>{statusLabels[row.status]}</Tag>V{row.version} / R{row.publication?.revision ?? 0}{row.publication && JSON.stringify(row.draft) !== JSON.stringify(row.publication.value) && <div><Tag color="orange">有未发布修改</Tag></div>}</> },
        { title: '发布时间（北京时间）', key: 'time', width: 180, render: (_, row) => row.publication ? formatUserDate(row.publication.publishedAt) : '—' },
        { title: '操作', key: 'actions', width: 370, render: (_, row) => <Space size={0} wrap><Button type="link" onClick={() => setPreview(row)}>预览</Button>{edit && <Button type="link" onClick={() => setEditor(row)}>编辑草稿</Button>}{publish && <><Button type="link" onClick={() => request({ action: 'publish', id: row.draft.id, version: row.version, reason: '', idempotencyKey: '' })}>发布</Button>{['published', 'scheduled'].includes(row.status) && <Button type="link" danger onClick={() => request({ action: 'offline', id: row.draft.id, version: row.version, reason: '', idempotencyKey: '' })}>下线</Button>}</>}{hasPermission(account, 'announcements:stats') && <Button type="link" onClick={() => setStats(row)}>已读统计</Button>}</Space> },
      ]} />
    </Card> }, { key: 'audit', label: `操作记录（${catalog?.audit.length ?? 0}）`, children: <Table rowKey="id" dataSource={catalog?.audit} columns={[{ title: '操作', key: 'action', render: (_, row) => actions[row.action] }, { title: '对象', dataIndex: 'announcementId' }, { title: '版本', key: 'version', render: (_, row) => `V${row.beforeVersion} → V${row.afterVersion}` }, { title: '原因 / 请求号', key: 'reason', render: (_, row) => <>{row.reason}<br />{row.requestId}</> }, { title: '操作人 / 时间', key: 'operator', render: (_, row) => <>{row.operatorName}<br />{formatUserDate(row.occurredAt)}</> }]} /> }]} />
    {editor && <Editor row={editor === 'new' ? null : editor} token={token} close={() => setEditor(null)} save={request} />}{preview && <Preview row={preview} close={() => setPreview(null)} />}{stats && <Statistics row={stats} token={token} close={() => setStats(null)} />}
    {pending && <Modal open title={actions[pending.action]} maskClosable={false} onCancel={() => { if (!busy) setPending(null) }} onOk={() => void confirm()} okText="确认操作" cancelText="返回修改" confirmLoading={busy} okButtonProps={{ disabled: blocked }} cancelButtonProps={{ disabled: busy }}><p>公告：{pending.action === 'save' ? pending.value.title : catalog?.items.find(row => row.draft.id === pending.id)?.draft.title}<br />版本：V{pending.version}</p>{pendingDraft && <p>目标范围：{(pendingDraft.audience ?? []).map(role => roleLabels[role]).join('、') || '全部正常账号'}<br />发布时间：{pendingDraft.publishAt ? formatUserDate(pendingDraft.publishAt) : '立即发布'}<br />置顶：{pendingDraft.pinned ? '是' : '否'}</p>}<Alert type="info" message={pending.action === 'save' ? '保存不影响发布快照。' : pending.action === 'offline' ? '立即停止列表与正文读取；保留已读记录。' : '发布当前草稿，定时公告到时才可读取；保留首次已读记录。'} />{submitError && <Alert type="error" message={submitError} />}{blocked && <Button onClick={() => { setPending(null); setEditor(null); setRefresh(value => value + 1) }}>关闭并刷新</Button>}<Input.TextArea aria-label="公告操作原因" rows={3} maxLength={200} showCount placeholder="填写操作原因" value={reason} disabled={busy || blocked} onChange={event => setReason(event.target.value)} style={{ marginTop: 16 }} /></Modal>}
  </Space>
}


