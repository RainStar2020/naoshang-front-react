import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { columnsService } from '../services/columns'
import { ColumnError, type ColumnCatalog, type ColumnMutation, type ManagedColumn } from '../types/columns'
import ColumnEditor from '../components/ColumnEditor'
import ColumnRecordsDrawer from '../components/ColumnRecordsDrawer'
import { ContentPreview } from '../utils/richContent'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'
const labels = { save: '保存专栏草稿', publish: '发布专栏', offline: '下线专栏' }
function Preview({ column, close }: { column: ManagedColumn; close: () => void }) {
  const [published, setPublished] = useState(false)
  const draft = published ? column.publication!.column : column.draft
  return <Modal open width={850} title="专栏内容预览" footer={null} onCancel={close}><Space direction="vertical" style={{ width: '100%' }}>
    <Space><Button onClick={() => setPublished(false)}>当前草稿</Button><Button disabled={!column.publication} onClick={() => setPublished(true)}>发布快照</Button></Space>
    <Alert type="info" message={`${published ? '发布快照' : '当前草稿'}：总部内容预览；账号学习端仍须校验发布状态与授权。`} />
    <Typography.Title level={3}>{draft.title}</Typography.Title><p>{draft.summary}</p>{draft.coverUrl && <img alt="专栏封面" src={columnsService.resolveAsset(draft.coverUrl)} style={{ maxWidth: '100%', maxHeight: 180 }} />}<ContentPreview value={draft.content} resolveUrl={columnsService.resolveAsset} />
    <Tabs items={(draft.chapters ?? []).map((chapter, index) => ({ key: chapter.id, label: `${index + 1}. ${chapter.title}`, children: chapter.type === 'article' ? <ContentPreview value={chapter.content} resolveUrl={columnsService.resolveAsset} /> : chapter.videoUrl === 'https://mock-assets.invalid/demo-column-video' || !chapter.videoUrl ? <Alert type="info" message="演示视频占位，配置真实视频后可预览。" /> : <video controls src={columnsService.resolveAsset(chapter.videoUrl)} poster={columnsService.resolveAsset(chapter.posterUrl)} style={{ maxWidth: '100%' }} /> }))} />
  </Space></Modal>
}
export default function Columns() {
  const { session } = useAuth(); const { token, account } = session!
  const edit = hasPermission(account, 'columns:edit'), publish = hasPermission(account, 'columns:publish')
  const [catalog, setCatalog] = useState<ColumnCatalog | null>(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState(''), [editor, setEditor] = useState<ManagedColumn | 'new' | null>(null), [preview, setPreview] = useState<ManagedColumn | null>(null), [records, setRecords] = useState<ManagedColumn | null>(null)
  const [pending, setPending] = useState<ColumnMutation | null>(null), [reason, setReason] = useState(''), [submitError, setSubmitError] = useState(''), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false)
  const [api, holder] = message.useMessage()
  useEffect(() => { let alive = true; setLoading(true); setError(''); columnsService.catalog(token).then(value => { if (alive) setCatalog(value) }).catch(err => { if (alive) setError(err.message) }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [token, refresh])
  const request = (value: ColumnMutation) => { setPending({ ...value, idempotencyKey: crypto.randomUUID() }); setReason(''); setSubmitError(''); setBlocked(false) }
  const confirm = async () => {
    if (!pending || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setBusy(true)
    try { await columnsService.mutate(token, { ...pending, reason: reason.trim() }); setCatalog(await columnsService.catalog(token)); setPending(null); setEditor(null); api.success('专栏Mock操作已完成') }
    catch (err) { setSubmitError(err instanceof Error ? err.message : '结果未知，请保留请求号重试'); setBlocked(err instanceof ColumnError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code)) }
    finally { setBusy(false) }
  }
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{holder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>专栏与学习记录</Typography.Title><Typography.Text type="secondary">专栏商品、图文视频章节与账号学习记录；章节进度按账号隔离，可复购不重置进度。</Typography.Text></div><Button loading={loading} onClick={() => setRefresh(value => value + 1)}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据；上传仅本页预览，发布不会同步小程序。章节ID稳定、进度按账号隔离；可复购不重置授权/进度。商品和订单为演示关联。" />{error && <Alert type="error" message={error} />}
    <Tabs items={[{ key: 'catalog', label: '专栏目录', children: <Card loading={loading} title="专栏商品与章节" extra={edit && <Button type="primary" onClick={() => setEditor('new')}>新建专栏</Button>}>
      <Input aria-label="搜索专栏" placeholder="搜索专栏名称 / 商品ID" allowClear value={keyword} onChange={event => setKeyword(event.target.value)} style={{ width: 300, marginBottom: 20 }} />
      <Table<ManagedColumn> rowKey={row => row.draft.columnId} dataSource={catalog?.columns.filter(row => `${row.draft.title} ${row.draft.productId}`.includes(keyword))} scroll={{ x: 1050 }} pagination={{ pageSize: 10 }} columns={[
        { title: '专栏 / 商品', key: 'name', render: (_, row) => <><strong>{row.draft.title}</strong><br /><Typography.Text type="secondary">{row.draft.productId}</Typography.Text></> },
        { title: '章节数', key: 'chapters', width: 80, render: (_, row) => (row.draft.chapters ?? []).length },
        { title: '状态 / 版本', key: 'status', width: 230, render: (_, row) => <Space wrap><Tag color={row.status === 'published' ? 'green' : 'default'}>{{ published: '已发布', draft: '草稿', offline: '已下线' }[row.status]}</Tag>V{row.version} / R{row.publication?.revision ?? 0}{row.publication && JSON.stringify(row.draft) !== JSON.stringify(row.publication.column) && <Tag color="orange">有未发布修改</Tag>}</Space> },
        { title: '操作', key: 'action', width: 360, render: (_, row) => <Space size={0} wrap><Button type="link" onClick={() => setPreview(row)}>预览</Button>{edit && <Button type="link" onClick={() => setEditor(row)}>编辑草稿</Button>}{publish && <><Button type="link" onClick={() => request({ action: 'publish', columnId: row.draft.columnId, version: row.version, reason: '', idempotencyKey: '' })}>发布</Button>{row.status === 'published' && <Button type="link" danger onClick={() => request({ action: 'offline', columnId: row.draft.columnId, version: row.version, reason: '', idempotencyKey: '' })}>下线</Button>}</>}{hasPermission(account, 'columns:records') && <Button type="link" onClick={() => setRecords(row)}>账号与学习记录</Button>}</Space> },
      ]} />
    </Card> }, { key: 'audit', label: `操作记录（${catalog?.audit.length ?? 0}）`, children: <Table rowKey="operationId" dataSource={catalog?.audit} scroll={{ x: 850 }} columns={[{ title: '操作 / 专栏', key: 'action', render: (_, row) => <>{labels[row.action]}<br />{row.columnId}</> }, { title: '版本', key: 'version', render: (_, row) => `V${row.beforeVersion} → V${row.afterVersion}` }, { title: '原因 / 请求号', key: 'reason', render: (_, row) => <>{row.reason}<br />{row.requestId}</> }, { title: '操作人 / 时间', key: 'operator', render: (_, row) => <>{row.operatorName}<br />{formatUserDate(row.occurredAt)}</> }]} /> }]} />
    {catalog && editor && <ColumnEditor column={editor === 'new' ? null : editor} catalog={catalog} token={token} onClose={() => setEditor(null)} onSave={request} />}{preview && <Preview column={preview} close={() => setPreview(null)} />}{catalog && records && <ColumnRecordsDrawer column={records} catalog={catalog} token={token} onClose={() => setRecords(null)} />}
    {pending && <Modal open title={labels[pending.action]} onCancel={() => { if (!busy) setPending(null) }} onOk={() => void confirm()} confirmLoading={busy} okText="确认操作" cancelText="返回修改" maskClosable={false} cancelButtonProps={{ disabled: busy }} okButtonProps={{ disabled: blocked }}>
      <p>对象：{pending.action === 'save' ? pending.value.title : catalog?.columns.find(row => row.draft.columnId === pending.columnId)?.draft.title}<br />当前版本：V{pending.version}</p><Alert type={pending.action === 'offline' ? 'warning' : 'info'} message={pending.action === 'save' ? '仅保存草稿，发布后更新学习内容。' : pending.action === 'offline' ? '下线后停止读取内容，保留账号授权、订单与学习进度（不因下线清空）。' : '发布当前草稿；稳定章节ID对应的历史进度保留，复购不重置。'} />
      {submitError && <Alert type="error" message={submitError} />}{blocked && <Button onClick={() => { setPending(null); setEditor(null); setRefresh(value => value + 1) }}>关闭并刷新</Button>}<Input.TextArea aria-label="专栏操作原因" placeholder="请填写操作原因" rows={3} maxLength={200} showCount value={reason} disabled={busy || blocked} onChange={event => setReason(event.target.value)} style={{ marginTop: 16 }} />
    </Modal>}
  </Space>
}
