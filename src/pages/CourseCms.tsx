import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Modal, Select, Space, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { cmsService } from '../services/cms'
import { CmsError, type CmsCatalog, type CmsCourse, type CmsMutation, type CmsTier } from '../types/cms'
import { ContentPreview } from '../utils/richContent'
import { CmsCourseEditor, CmsTierEditor } from '../components/CmsEditors'
import { formatUserDate } from '../components/UserDetailDrawer'
import HqDataSourceAlert from '../components/HqDataSourceAlert'

const labels = { 'save-tier': '保存会员等级配置', 'save-course': '保存课程草稿', publish: '发布课程', offline: '下线课程' }
function CoursePreview({ course, onClose }: { course: CmsCourse; onClose: () => void }) {
  const [source, setSource] = useState('draft')
  const draft = source === 'draft' ? course.draft : course.publication!.course
  return <Modal open width={850} title="小程序内容预览" footer={null} onCancel={onClose}>
    <Space direction="vertical" size={20} style={{ width: '100%' }}><Select aria-label="预览版本" value={source} onChange={setSource} options={[{ value: 'draft', label: '当前草稿' }, { value: 'published', label: course.status === 'offline' ? '历史发布版本（已下线）' : '已发布版本', disabled: !course.publication }]} />
      <Alert type="info" message={`当前查看${source === 'draft' ? '草稿，保存后仍需发布' : `发布快照 R${course.publication!.revision}`}。此为内容预览，实际学习权限由API验证。`} />
      <Typography.Title level={3}>{draft.name}</Typography.Title><Typography.Paragraph>{draft.summary}</Typography.Paragraph>
      {draft.covers.map((url, i) => <img key={i} src={cmsService.resolveAsset(url)} alt={`课程封面${i + 1}`} style={{ maxWidth: '100%', maxHeight: 240 }} />)}
      <ContentPreview value={draft.content} resolveUrl={cmsService.resolveAsset} />
      <Tabs items={draft.chapters.map((chapter, index) => ({ key: chapter.id, label: `${index + 1}. ${chapter.title || '未命名章节'}`, children: chapter.type === 'article' ? <ContentPreview value={chapter.content} resolveUrl={cmsService.resolveAsset} /> : <video controls src={cmsService.resolveAsset(chapter.videoUrl)} poster={cmsService.resolveAsset(chapter.posterUrl)} style={{ maxWidth: '100%' }} /> }))} />
    </Space>
  </Modal>
}
export default function CourseCms() {
  const { session } = useAuth()
  const { token, account } = session!
  const edit = hasPermission(account, 'course:edit')
  const publish = hasPermission(account, 'course:publish')
  const [catalog, setCatalog] = useState<CmsCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [tierFilter, setTierFilter] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [tierEditor, setTierEditor] = useState<CmsTier | 'new' | null>(null)
  const [courseEditor, setCourseEditor] = useState<CmsCourse | 'new' | null>(null)
  const [preview, setPreview] = useState<CmsCourse | null>(null)
  const [tierPreview, setTierPreview] = useState<CmsTier | null>(null)
  const [pending, setPending] = useState<CmsMutation | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    cmsService.catalog(token).then(value => { if (alive) setCatalog(value) }).catch(err => { if (alive) setError(err instanceof Error ? err.message : 'CMS加载失败') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token, refresh])
  const request = (input: CmsMutation) => { setPending({ ...input, idempotencyKey: crypto.randomUUID() }); setReason(''); setSubmitError(null); setBlocked(false) }
  const confirm = async () => {
    if (!pending || !reason.trim()) { setSubmitError('请填写操作原因'); return }
    setSubmitting(true); setSubmitError(null)
    try {
      await cmsService.mutate(token, { ...pending, reason: reason.trim() })
      setCatalog(await cmsService.catalog(token))
      setPending(null); setCourseEditor(null); setTierEditor(null)
      messageApi.success('Mock操作已完成，操作记录已保存；尚未接通真实小程序API')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '结果未知，请保留原请求号重试')
      setBlocked(err instanceof CmsError && ['VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(err.code))
    } finally { setSubmitting(false) }
  }
  const rows = catalog?.courses.filter(course => (!keyword || course.draft.name.includes(keyword) || String(course.draft.number) === keyword.trim()) && (!tierFilter || course.draft.membershipTierId === tierFilter) && (!status || course.status === status)) ?? []
  const pendingCourse = pending?.action === 'save-course' ? pending.value : catalog?.courses.find(course => course.draft.levelId === pending?.targetId)?.draft
  return <Space direction="vertical" size={20} style={{ width: '100%' }}>{contextHolder}
    <div className="user-page-heading"><div><Typography.Title level={3} style={{ margin: 0 }}>会员等级与课程 CMS</Typography.Title><Typography.Text type="secondary">配置等级归属；章节支持贴吧式文字/图片/视频交错；草稿→发布→下线。</Typography.Text></div><Button loading={loading} onClick={() => setRefresh(value => value + 1)}>刷新</Button></div>
    <HqDataSourceAlert mockMessage="内存Mock环境：整页刷新会恢复数据。上传仅生成本页预览和 mock-assets.invalid 虚拟地址，不会传输至真实服务器；发布不会同步到小程序。" />
    {error ? <Alert type="error" message={error} action={<Button onClick={() => setRefresh(value => value + 1)}>重试</Button>} /> : loading ? <Spin><div style={{ minHeight: 120 }} /></Spin> : catalog && <Tabs items={[
      { key: 'courses', label: '学习等级与课程', children: <Card variant="borderless" title="课程目录" extra={edit && <Button type="primary" onClick={() => setCourseEditor('new')}>新建学习等级</Button>}>
        <Space wrap style={{ marginBottom: 20 }}><Input aria-label="搜索课程" placeholder="学习等级名称 / 编号" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /><Select aria-label="筛选会员归属" allowClear placeholder="全部会员等级" style={{ width: 190 }} value={tierFilter} onChange={setTierFilter} options={catalog.tiers.map(tier => ({ value: tier.membershipTierId, label: tier.name }))} /><Select aria-label="筛选发布状态" allowClear placeholder="全部状态" style={{ width: 140 }} value={status} onChange={setStatus} options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '已发布' }, { value: 'offline', label: '已下线' }]} /></Space>
        <Table<CmsCourse> rowKey={course => course.draft.levelId} size="middle" dataSource={rows} scroll={{ x: 1000 }} pagination={{ pageSize: 10, showTotal: total => `共 ${total} 个学习等级` }} columns={[
          { title: '编号 / 名称', key: 'name', width: 160, render: (_, course) => <>{course.draft.number} · {course.draft.name}</> },
          { title: '会员归属（草稿）', key: 'tier', width: 160, render: (_, course) => catalog.tiers.find(tier => tier.membershipTierId === course.draft.membershipTierId)?.name },
          { title: '章节', key: 'chapters', width: 65, render: (_, course) => course.draft.chapters.length },
          { title: '状态 / 版本', key: 'status', width: 200, render: (_, course) => <Space size={[0, 4]} wrap><Tag color={course.status === 'published' ? 'green' : 'default'}>{{ published: '已发布', draft: '草稿', offline: '已下线' }[course.status]}</Tag><span>V{course.version} / {course.publication ? `R${course.publication.revision}` : '未发布'}</span>{course.publication && JSON.stringify(course.draft) !== JSON.stringify(course.publication.course) && <Tag color="orange">有未发布修改</Tag>}</Space> },
          { title: '操作', key: 'action', width: 300, fixed: 'right', render: (_, course) => <Space size={0} wrap><Button type="link" size="small" onClick={() => setPreview(course)}>预览</Button>{edit && <Button type="link" size="small" onClick={() => setCourseEditor(course)}>编辑草稿</Button>}{publish && <><Button type="link" size="small" onClick={() => request({ action: 'publish', targetId: course.draft.levelId, version: course.version, reason: '', idempotencyKey: '' })}>发布</Button>{course.status === 'published' && <Button type="link" danger size="small" onClick={() => request({ action: 'offline', targetId: course.draft.levelId, version: course.version, reason: '', idempotencyKey: '' })}>下线</Button>}</>}</Space> },
        ]} />
      </Card> },
      { key: 'tiers', label: '会员等级配置', children: <Card variant="borderless" title="会员等级" extra={edit && <Button type="primary" onClick={() => setTierEditor('new')}>新建会员等级</Button>}><Alert style={{ marginBottom: 16 }} type="info" message="会员等级配置独立保存；课程归属以已发布快照为准。总部人工权益仍绑定稳定ID，不因展示名称变化而重新发放。" /><Table<CmsTier> rowKey="membershipTierId" dataSource={catalog.tiers} pagination={false} scroll={{ x: 700 }} columns={[
        { title: '阶层', dataIndex: 'number', width: 70 }, { title: '名称 / ID', key: 'tier', render: (_, tier) => <>{tier.name}<br /><Typography.Text type="secondary">{tier.membershipTierId}</Typography.Text></> }, { title: '简介', dataIndex: 'summary' }, { title: '操作', key: 'actions', width: 160, render: (_, tier) => <Space size={0}><Button type="link" onClick={() => setTierPreview(tier)}>预览</Button>{edit && <Button type="link" onClick={() => setTierEditor(tier)}>编辑</Button>}</Space> },
      ]} /></Card> },
      { key: 'audit', label: `CMS操作记录（${catalog.audit.length}）`, children: <Table rowKey="operationId" size="small" dataSource={catalog.audit} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} columns={[
        { title: '操作 / 对象', key: 'action', render: (_, item) => <>{labels[item.action]}<br />{item.targetId}</> }, { title: '版本', key: 'version', render: (_, item) => `V${item.beforeVersion} → V${item.afterVersion}` }, { title: '原因 / 请求号', key: 'reason', render: (_, item) => <>{item.reason}<br />{item.requestId}</> }, { title: '操作人 / 时间', key: 'operator', render: (_, item) => <>{item.operatorName}<br />{formatUserDate(item.occurredAt)}</> },
      ]} /> },
    ]} />}
    {catalog && courseEditor && <CmsCourseEditor course={courseEditor === 'new' ? null : courseEditor} catalog={catalog} token={token} onClose={() => setCourseEditor(null)} onSave={request} />}
    {tierEditor && <CmsTierEditor tier={tierEditor === 'new' ? null : tierEditor} token={token} onClose={() => setTierEditor(null)} onSave={request} />}
    {preview && <CoursePreview course={preview} onClose={() => setPreview(null)} />}
    {tierPreview && <Modal open title={tierPreview.name} footer={null} onCancel={() => setTierPreview(null)}><Typography.Paragraph>{tierPreview.summary}</Typography.Paragraph>{tierPreview.coverUrl && <img src={cmsService.resolveAsset(tierPreview.coverUrl)} alt="会员等级封面" style={{ maxWidth: '100%' }} />}<ContentPreview value={tierPreview.benefits} resolveUrl={cmsService.resolveAsset} /></Modal>}
    {pending && <Modal open title={labels[pending.action]} onCancel={() => { if (!submitting) setPending(null) }} onOk={() => void confirm()} okText="确认操作" cancelText="返回修改" confirmLoading={submitting} closable={!submitting} maskClosable={false} cancelButtonProps={{ disabled: submitting }} okButtonProps={{ disabled: blocked }}>
      <Typography.Paragraph>对象：{pending.action === 'save-course' ? pending.value.name : pending.action === 'save-tier' ? pending.value.name : catalog?.courses.find(course => course.draft.levelId === pending.targetId)?.draft.name}<br />当前版本：V{pending.version}</Typography.Paragraph>
      {pendingCourse && <Typography.Paragraph>目标会员等级：{catalog?.tiers.find(tier => tier.membershipTierId === pendingCourse.membershipTierId)?.name}<br />章节数量：{pendingCourse.chapters.length}</Typography.Paragraph>}
      <Alert type={pending.action === 'offline' ? 'warning' : 'info'} message={pending.action === 'publish' ? '将当前草稿发布为新版本；等级归属变化会影响发布目录，请确认目标会员等级和章节内容。' : pending.action === 'offline' ? '下线后从可消费目录隐藏；保留历史发布快照、授权记录和学习进度。' : pending.action === 'save-course' ? '仅保存草稿，已发布版本保持不变。' : '保存会员等级展示配置，授权ID保持稳定。'} />
      {submitError && <Alert style={{ marginTop: 12 }} type="error" message={submitError} role="alert" />}
      {blocked && <Button onClick={() => { setPending(null); setCourseEditor(null); setTierEditor(null); setRefresh(value => value + 1) }}>关闭并刷新</Button>}
      <Input.TextArea aria-label="CMS操作原因" style={{ marginTop: 16 }} disabled={submitting || blocked} rows={3} maxLength={200} showCount placeholder="请填写操作原因" value={reason} onChange={event => setReason(event.target.value)} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求号：{pending.idempotencyKey}</Typography.Text>
    </Modal>}
  </Space>
}
