import { useState } from 'react'
import { Alert, Button, Card, Input, Modal, Select, Space, Typography } from 'antd'
import type { ColumnCatalog, ColumnDraft, ColumnMutation, ManagedColumn } from '../types/columns'
import { columnsService } from '../services/columns'
import { emptyContent } from '../utils/richContent'
import CmsContentEditor, { CmsAssetInput } from './CmsContentEditor'

export default function ColumnEditor({ column, catalog, token, onClose, onSave }: { column: ManagedColumn | null; catalog: ColumnCatalog; token: string; onClose: () => void; onSave: (request: ColumnMutation) => void }) {
  const [draft, setDraft] = useState<ColumnDraft>(() => structuredClone(column?.draft ?? { columnId: crypto.randomUUID(), productId: '', title: '', summary: '', coverUrl: '', content: emptyContent(), chapters: [] }))
  const [error, setError] = useState<string | null>(null)
  const change = (value: Partial<ColumnDraft>) => setDraft(current => ({ ...current, ...value }))
  const chapterChange = (index: number, value: Partial<ColumnDraft['chapters'][number]>) => change({ chapters: draft.chapters.map((chapter, i) => i === index ? { ...chapter, ...value } : chapter) })
  const move = (index: number, delta: number) => { const chapters = [...draft.chapters]; [chapters[index], chapters[index + delta]] = [chapters[index + delta], chapters[index]]; change({ chapters }) }
  const upload = (file: File) => columnsService.upload(token, file)
  const save = () => { if (!draft.title.trim() || !draft.productId) { setError('请填写专栏名称并选择关联商品'); return } onSave({ action: 'save', columnId: draft.columnId, version: column?.version ?? 1, value: draft, reason: '', idempotencyKey: '' }) }
  return <Modal open width={1100} title={column ? '编辑专栏草稿' : '新建专栏'} onCancel={onClose} onOk={save} okText="核对并保存专栏" cancelText="取消" maskClosable={false}>
    <Alert type="info" message="保存仅更新草稿。专栏绑定账号权益，不归属孩子会员等级；发布后的商品关联锁定，避免改写历史订单。" />
    {error && <Alert type="error" message={error} style={{ marginTop: 12 }} />}
    <div className="cms-form-grid" style={{ marginTop: 16 }}><label>专栏名称<Input aria-label="专栏名称" value={draft.title} maxLength={60} onChange={event => change({ title: event.target.value })} /></label><label style={{ gridColumn: 'span 2' }}>关联专栏商品<Select aria-label="关联专栏商品" disabled={!!column?.publication} value={draft.productId || undefined} placeholder="选择COLUMN_ACCESS类型演示商品" style={{ width: '100%' }} options={catalog.products.map(product => ({ value: product.productId, label: product.title, disabled: catalog.columns.some(item => item.draft.columnId !== draft.columnId && item.draft.productId === product.productId) }))} onChange={productId => change({ productId })} /></label></div>
    <Typography.Title level={5}>专栏简介</Typography.Title><Input.TextArea aria-label="专栏简介" value={draft.summary} maxLength={500} rows={2} onChange={event => change({ summary: event.target.value })} />
    <Typography.Title level={5}>专栏封面</Typography.Title><CmsAssetInput token={token} upload={upload} label="专栏封面" value={draft.coverUrl} onChange={coverUrl => change({ coverUrl })} />
    <Typography.Title level={5}>专栏介绍正文</Typography.Title><CmsContentEditor token={token} upload={upload} label="专栏介绍" value={draft.content} onChange={content => change({ content })} />
    <Typography.Title level={5}>章节目录</Typography.Title><Space direction="vertical" style={{ width: '100%' }}>{draft.chapters.map((chapter, index) => <Card key={chapter.id} size="small" title={`第 ${index + 1} 章`} extra={<Space><Button size="small" disabled={index === 0} onClick={() => move(index, -1)}>章节上移</Button><Button size="small" disabled={index === draft.chapters.length - 1} onClick={() => move(index, 1)}>章节下移</Button><Button size="small" danger onClick={() => change({ chapters: draft.chapters.filter((_, i) => i !== index) })}>删除章节</Button></Space>}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}><Input aria-label={`专栏章节${index + 1}标题`} maxLength={80} value={chapter.title} onChange={event => chapterChange(index, { title: event.target.value })} /><Select aria-label={`专栏章节${index + 1}类型`} style={{ width: 150 }} value={chapter.type} onChange={type => chapterChange(index, { type })} options={[{ value: 'article', label: '图文章节' }, { value: 'video', label: '视频章节' }]} /></Space.Compact>
      {chapter.type === 'article' ? <CmsContentEditor token={token} upload={upload} label={`专栏章节${index + 1}正文`} value={chapter.content} onChange={content => chapterChange(index, { content })} /> : <Space direction="vertical" style={{ width: '100%' }}><CmsAssetInput token={token} upload={upload} kind="video" label={`专栏章节${index + 1}视频`} value={chapter.videoUrl} onChange={videoUrl => chapterChange(index, { videoUrl })} /><CmsAssetInput token={token} upload={upload} label={`专栏章节${index + 1}视频封面`} value={chapter.posterUrl} onChange={posterUrl => chapterChange(index, { posterUrl })} /></Space>}
    </Card>)}<Button onClick={() => change({ chapters: [...draft.chapters, { id: crypto.randomUUID(), title: '', type: 'article', order: draft.chapters.length + 1, accessibility: 'column-required', content: emptyContent(), videoUrl: '', posterUrl: '' }] })}>添加专栏章节</Button></Space>
  </Modal>
}
