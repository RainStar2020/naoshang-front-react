import { useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd'
import type { CmsCatalog, CmsCourse, CmsCourseDraft, CmsMutation, CmsTier } from '../types/cms'
import { emptyContent } from '../utils/richContent'
import CmsContentEditor, { CmsAssetInput } from './CmsContentEditor'

interface SharedProps { token: string; onClose: () => void; onSave: (input: CmsMutation) => void }
export function CmsTierEditor({ tier, token, onClose, onSave }: SharedProps & { tier: CmsTier | null }) {
  const [form] = Form.useForm()
  const [benefits, setBenefits] = useState(tier?.benefits ?? emptyContent())
  const [coverUrl, setCover] = useState(tier?.coverUrl ?? '')
  const submit = async () => {
    try { const values = await form.validateFields(); onSave({ action: 'save-tier', targetId: tier?.membershipTierId ?? '', version: tier?.version ?? 0, value: { ...values, benefits, coverUrl }, reason: '', idempotencyKey: '' }) } catch { /* 表单内展示校验 */ }
  }
  return <Modal open width={850} title={tier ? '编辑会员等级' : '新建会员等级'} onCancel={onClose} onOk={() => void submit()} okText="核对并保存配置" cancelText="取消" maskClosable={false}>
    <Alert type="info" message="会员等级配置保存后在Mock目录生效；不会自动赠送其他等级。课程归属以课程发布版本为准。" />
    <Form form={form} name="cmsTier" layout="vertical" initialValues={tier ?? { number: 4, name: '', summary: '' }} style={{ marginTop: 16 }}>
      <Form.Item name="name" label="会员等级名称" rules={[{ required: true, whitespace: true, max: 60 }]}><Input maxLength={60} /></Form.Item>
      <Form.Item name="number" label="阶层编号" rules={[{ required: true }]}><InputNumber min={1} precision={0} /></Form.Item>
      <Form.Item name="summary" label="权益简介"><Input.TextArea maxLength={500} rows={2} /></Form.Item>
      <Typography.Paragraph>会员等级封面</Typography.Paragraph><CmsAssetInput token={token} label="会员等级封面" value={coverUrl} onChange={setCover} />
      <Typography.Title level={5}>权益介绍</Typography.Title><CmsContentEditor token={token} label="权益介绍" value={benefits} onChange={setBenefits} />
    </Form>
  </Modal>
}

export function CmsCourseEditor({ course, catalog, token, onClose, onSave }: SharedProps & { course: CmsCourse | null; catalog: CmsCatalog }) {
  const [draft, setDraft] = useState<CmsCourseDraft>(() => structuredClone(course?.draft ?? { levelId: '', membershipTierId: catalog.tiers[0]?.membershipTierId ?? '', number: Math.max(0, ...catalog.courses.map(item => item.draft.number)) + 1, name: '', summary: '', covers: [], content: emptyContent(), chapters: [] }))
  const [error, setError] = useState<string | null>(null)
  const change = (value: Partial<CmsCourseDraft>) => setDraft(current => ({ ...current, ...value }))
  const updateChapter = (index: number, value: Partial<CmsCourseDraft['chapters'][number]>) => change({ chapters: draft.chapters.map((chapter, i) => i === index ? { ...chapter, ...value } : chapter) })
  const move = (index: number, delta: number) => { const chapters = [...draft.chapters]; [chapters[index], chapters[index + delta]] = [chapters[index + delta], chapters[index]]; change({ chapters }) }
  const save = () => {
    if (!draft.name.trim() || !draft.membershipTierId || !Number.isInteger(draft.number) || draft.number < 1) { setError('请填写学习等级名称、归属和有效编号'); return }
    onSave({ action: 'save-course', targetId: course?.draft.levelId ?? '', version: course?.version ?? 0, value: draft, reason: '', idempotencyKey: '' })
  }
  return <Modal open width={1100} title={course ? '编辑课程草稿' : '新建学习等级'} onCancel={onClose} onOk={save} okText="核对并保存草稿" cancelText="取消" maskClosable={false}>
    <Alert type="info" message="保存草稿不会更新已发布内容。所有章节固定由对应会员等级授权；调整归属不会迁移历史授权，需在发布前核对。" />
    {error && <Alert type="error" message={error} style={{ marginTop: 12 }} />}
    <div className="cms-form-grid" style={{ marginTop: 16 }}><label>学习等级名称<Input aria-label="学习等级名称" value={draft.name} maxLength={60} onChange={event => change({ name: event.target.value })} /></label><label>学习等级编号<InputNumber aria-label="学习等级编号" value={draft.number} min={1} max={999} precision={0} style={{ width: '100%' }} onChange={number => change({ number: number ?? 0 })} /></label><label>归属会员等级<Select aria-label="归属会员等级" style={{ width: '100%' }} value={draft.membershipTierId} options={catalog.tiers.map(tier => ({ value: tier.membershipTierId, label: tier.name }))} onChange={membershipTierId => change({ membershipTierId })} /></label></div>
    <Typography.Title level={5}>课程简介</Typography.Title><Input.TextArea aria-label="课程简介" rows={2} maxLength={500} value={draft.summary} onChange={event => change({ summary: event.target.value })} />
    <Typography.Title level={5}>课程封面（最多5张）</Typography.Title><Space direction="vertical" style={{ width: '100%' }}>{draft.covers.map((cover, i) => <div key={i}><CmsAssetInput label={`课程封面${i + 1}`} token={token} value={cover} onChange={url => change({ covers: draft.covers.map((item, n) => n === i ? url : item) })} /><Button size="small" danger onClick={() => change({ covers: draft.covers.filter((_, n) => n !== i) })}>移除此封面</Button></div>)}<Button disabled={draft.covers.length >= 5} onClick={() => change({ covers: [...draft.covers, ''] })}>添加封面</Button></Space>
    <Typography.Title level={5}>课程介绍正文</Typography.Title><CmsContentEditor token={token} label="课程介绍" mediaPolicy="full" value={draft.content} onChange={content => change({ content })} />
    <Typography.Title level={5}>章节目录</Typography.Title><Space direction="vertical" style={{ width: '100%' }}>{draft.chapters.map((chapter, index) => <Card key={chapter.id} size="small" title={`第 ${index + 1} 章`} extra={<Space><Button size="small" disabled={index === 0} onClick={() => move(index, -1)}>章节上移</Button><Button size="small" disabled={index === draft.chapters.length - 1} onClick={() => move(index, 1)}>章节下移</Button><Button size="small" danger onClick={() => change({ chapters: draft.chapters.filter((_, i) => i !== index) })}>删除章节</Button></Space>}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}><Input aria-label={`章节${index + 1}标题`} value={chapter.title} maxLength={80} placeholder="章节标题" onChange={event => updateChapter(index, { title: event.target.value })} /><Select aria-label={`章节${index + 1}类型`} style={{ width: 150 }} value={chapter.type} options={[{ value: 'article', label: '图文章节' }, { value: 'video', label: '视频章节' }]} onChange={type => updateChapter(index, { type })} /></Space.Compact>
      {chapter.type === 'article' ? <CmsContentEditor token={token} label={`章节${index + 1}正文`} mediaPolicy="full" value={chapter.content} onChange={content => updateChapter(index, { content })} /> : <Space direction="vertical" style={{ width: '100%' }}><CmsAssetInput kind="video" token={token} label={`章节${index + 1}视频`} value={chapter.videoUrl} onChange={videoUrl => updateChapter(index, { videoUrl })} /><CmsAssetInput token={token} label={`章节${index + 1}视频封面`} value={chapter.posterUrl} onChange={posterUrl => updateChapter(index, { posterUrl })} /></Space>}
    </Card>)}<Button onClick={() => change({ chapters: [...draft.chapters, { id: crypto.randomUUID(), title: '', type: 'article', order: draft.chapters.length + 1, accessibility: 'membership-required', content: emptyContent(), videoUrl: '', posterUrl: '' }] })}>添加章节</Button></Space>
  </Modal>
}
