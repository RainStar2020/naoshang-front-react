import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import CmsContentEditor from '../components/CmsContentEditor'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { promoMaterialService } from '../services/promo-materials'
import {
  PromoMaterialError,
  type PromoMaterialAction,
  type PromoMaterialCatalog,
  type PromoMaterialDetail,
  type PromoMaterialMutation,
  type PromoMaterialStatus,
  type PromoMaterialTemplate,
  type PromoMaterialType,
  type QrFillRegion,
} from '../types/promo-materials'
import type { RichContent } from '../types/cms'
import { emptyContent } from '../utils/richContent'

const statusLabel: Record<PromoMaterialStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下线',
}
const statusColor: Record<PromoMaterialStatus, string> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  OFFLINE: 'warning',
}
const typeLabel: Record<PromoMaterialType, string> = {
  image: '图片',
  article: '图文',
  video: '视频',
}

function regionStyle(region: QrFillRegion): CSSProperties {
  return {
    position: 'absolute',
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
    border: '2px dashed #2f6bff',
    background: 'rgba(47,107,255,0.18)',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  }
}

function VideoH5Preview({ mediaUrl, posterUrl }: { mediaUrl: string; posterUrl?: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        border: '1px solid #e5eaf3',
        borderRadius: 10,
        padding: 12,
        background: '#f7f9fc',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, background: '#111', borderRadius: 8, overflow: 'hidden', minHeight: 160 }}>
        {mediaUrl ? (
          <video src={mediaUrl} poster={posterUrl || undefined} controls style={{ width: '100%', maxHeight: 220, display: 'block' }} />
        ) : (
          <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>中间视频区</div>
        )}
      </div>
      <div
        style={{
          width: 120,
          flexShrink: 0,
          border: '1px dashed #2f6bff',
          borderRadius: 8,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 8,
          textAlign: 'center',
        }}
      >
        <Button type="primary" size="small">聊天框</Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          点开展示用户二维码（非烧录进 MP4）
        </Typography.Text>
      </div>
    </div>
  )
}

function ArticleQrSlotPreview({ enabled }: { enabled: boolean }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 16,
        border: enabled ? '2px dashed #2f6bff' : '2px dashed #d0d7e5',
        borderRadius: 8,
        background: enabled ? 'rgba(47,107,255,0.06)' : '#fafafa',
        textAlign: 'center',
      }}
    >
      <Typography.Text type={enabled ? undefined : 'secondary'}>
        {enabled ? '末尾唯一二维码预留位（预览占位，非合成终图）' : '未启用末尾二维码预留位 — 不可发布'}
      </Typography.Text>
    </div>
  )
}

type ListSummary = {
  templates: number
  draft: number
  published: number
  offline: number
  imageWithRegion: number
  videoH5: number
  missingQrRegion: number
}

export default function Materials() {
  const { session } = useAuth()
  const token = session?.token ?? ''
  const canEdit = hasPermission(session?.account ?? null, 'materials:edit')

  const [catalog, setCatalog] = useState<PromoMaterialCatalog | null>(null)
  const [items, setItems] = useState<PromoMaterialTemplate[]>([])
  const [summary, setSummary] = useState<ListSummary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<PromoMaterialType | undefined>()
  const [status, setStatus] = useState<PromoMaterialStatus | undefined>()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<PromoMaterialDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [createStep, setCreateStep] = useState<'pick-type' | 'form'>('form')
  const [editing, setEditing] = useState<PromoMaterialTemplate | null>(null)
  const [articleContent, setArticleContent] = useState<RichContent>(emptyContent())
  const [qrSlotAtEnd, setQrSlotAtEnd] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [regionTarget, setRegionTarget] = useState<PromoMaterialTemplate | null>(null)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm()
  const [regionForm] = Form.useForm()

  const loadList = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [cat, list] = await Promise.all([
        catalog ? Promise.resolve(catalog) : promoMaterialService.catalog(token),
        promoMaterialService.list(token, { page, pageSize, keyword: keyword || undefined, type, status }),
      ])
      if (!catalog) setCatalog(cat)
      setItems(list.items)
      setTotal(list.total)
      setSummary(list.summary)
    } catch (err) {
      message.error(err instanceof PromoMaterialError ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [token, page, pageSize, keyword, type, status, catalog])

  useEffect(() => { void loadList() }, [loadList])

  const watchedType = Form.useWatch('type', form) as PromoMaterialType | undefined
  const watchedMediaUrl = Form.useWatch('mediaUrl', form) as string | undefined
  const watchedPosterUrl = Form.useWatch('posterUrl', form) as string | undefined
  const categoriesForType = useMemo(() => {
    const t = watchedType || editing?.type || 'image'
    return (catalog?.categories ?? []).filter((c) => c.type === t)
  }, [catalog, watchedType, editing])

  const watchX = Form.useWatch('x', regionForm)
  const watchY = Form.useWatch('y', regionForm)
  const watchW = Form.useWatch('width', regionForm)

  async function openDetail(row: PromoMaterialTemplate) {
    try {
      const d = await promoMaterialService.detail(token, row.materialId)
      setDetail(d)
      setDetailOpen(true)
    } catch (err) {
      message.error(err instanceof PromoMaterialError ? err.message : '详情加载失败')
    }
  }

  function openCreateWizard() {
    setEditing(null)
    setCreateStep('pick-type')
    setArticleContent(emptyContent())
    setQrSlotAtEnd(false)
    form.resetFields()
    setEditOpen(true)
  }

  function startCreateWithType(t: PromoMaterialType) {
    const defaults: Record<PromoMaterialType, { w: number; h: number; media: string; cover: string }> = {
      image: { w: 800, h: 1200, media: 'https://picsum.photos/seed/new-image/800/1200', cover: 'https://picsum.photos/seed/new-image/400/400' },
      article: { w: 800, h: 600, media: 'https://picsum.photos/seed/new-article/800/600', cover: 'https://picsum.photos/seed/new-article/400/300' },
      video: { w: 1280, h: 720, media: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', cover: 'https://picsum.photos/seed/new-video/400/300' },
    }
    const d = defaults[t]
    form.setFieldsValue({
      title: '',
      type: t,
      categoryId: catalog?.categories.find((c) => c.type === t)?.categoryId,
      coverUrl: d.cover,
      mediaUrl: d.media,
      posterUrl: t === 'video' ? 'https://picsum.photos/seed/new-video-p/800/450' : '',
      summary: '',
      mediaWidth: d.w,
      mediaHeight: d.h,
      shareUrlTemplate: 'https://example.local/invite?code={inviteCode}',
      reason: '',
    })
    setArticleContent(emptyContent())
    setQrSlotAtEnd(t === 'article' ? false : false)
    setCreateStep('form')
  }

  function openEdit(row: PromoMaterialTemplate) {
    setEditing(row)
    setCreateStep('form')
    form.setFieldsValue({
      title: row.title,
      type: row.type,
      categoryId: row.categoryId,
      coverUrl: row.coverUrl,
      mediaUrl: row.mediaUrl,
      posterUrl: row.posterUrl ?? '',
      summary: row.summary,
      mediaWidth: row.mediaWidth,
      mediaHeight: row.mediaHeight,
      shareUrlTemplate: row.shareUrlTemplate,
      reason: '',
    })
    setArticleContent(row.type === 'article' ? (row.articleContent ?? emptyContent()) : emptyContent())
    setQrSlotAtEnd(row.type === 'article' ? !!row.qrSlotAtEnd : false)
    setEditOpen(true)
  }

  function openRegion(row: PromoMaterialTemplate) {
    if (row.type !== 'image') {
      message.warning(row.type === 'video' ? '视频走互动 H5，不设烧录区' : '图文请在编辑中启用末尾码位')
      return
    }
    const side = row.qrRegion?.width ?? 0.2
    setRegionTarget(row)
    regionForm.setFieldsValue({
      x: row.qrRegion?.x ?? 0.7,
      y: row.qrRegion?.y ?? 0.7,
      width: side,
      height: side,
      reason: '',
    })
    setRegionOpen(true)
  }

  async function runMutate(input: PromoMaterialMutation, confirmTitle: string, confirmContent: string) {
    if (!canEdit) {
      message.error('没有推广素材编辑权限')
      return
    }
    Modal.confirm({
      title: confirmTitle,
      content: confirmContent,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setBusy(true)
        try {
          const result = await promoMaterialService.mutate(token, input)
          message.success(result.message)
          setEditOpen(false)
          setRegionOpen(false)
          setCatalog(null)
          await loadList()
          if (detailOpen && detail?.template.materialId === result.template.materialId && input.action !== 'delete') {
            setDetail(await promoMaterialService.detail(token, result.template.materialId))
          }
          if (input.action === 'delete') setDetailOpen(false)
        } catch (err) {
          message.error(err instanceof PromoMaterialError ? err.message : '操作失败')
          throw err
        } finally {
          setBusy(false)
        }
      },
    })
  }

  async function submitSave() {
    const values = await form.validateFields()
    const t = (editing?.type || values.type) as PromoMaterialType
    if (t === 'article' && !qrSlotAtEnd) {
      // allow draft save without slot; publish will fail
    }
    const mutation: PromoMaterialMutation = editing
      ? {
          action: 'save',
          materialId: editing.materialId,
          version: editing.version,
          reason: values.reason,
          idempotencyKey: crypto.randomUUID(),
          title: values.title,
          type: editing.type,
          categoryId: values.categoryId,
          coverUrl: values.coverUrl,
          mediaUrl: values.mediaUrl,
          posterUrl: values.posterUrl || null,
          summary: values.summary ?? '',
          mediaWidth: values.mediaWidth,
          mediaHeight: values.mediaHeight,
          shareUrlTemplate: values.shareUrlTemplate,
          articleContent: t === 'article' ? articleContent : null,
          qrSlotAtEnd: t === 'article' ? qrSlotAtEnd : false,
        }
      : {
          action: 'save',
          version: 0,
          reason: values.reason,
          idempotencyKey: crypto.randomUUID(),
          title: values.title,
          type: values.type,
          categoryId: values.categoryId,
          coverUrl: values.coverUrl,
          mediaUrl: values.mediaUrl,
          posterUrl: values.posterUrl || null,
          summary: values.summary ?? '',
          mediaWidth: values.mediaWidth,
          mediaHeight: values.mediaHeight,
          shareUrlTemplate: values.shareUrlTemplate,
          articleContent: t === 'article' ? articleContent : null,
          qrSlotAtEnd: t === 'article' ? qrSlotAtEnd : false,
        }
    await runMutate(mutation, editing ? '保存模板' : '新建草稿', '确认提交？不会在前端合成最终带码图片。')
  }

  async function submitRegion() {
    if (!regionTarget) return
    const values = await regionForm.validateFields()
    const side = Number(values.width)
    await runMutate(
      {
        action: 'set-qr-region',
        materialId: regionTarget.materialId,
        version: regionTarget.version,
        reason: values.reason,
        idempotencyKey: crypto.randomUUID(),
        qrRegion: { x: values.x, y: values.y, width: side, height: side },
      },
      '设置唯一正方形二维码填充区',
      '每模板仅一区且须为正方形；用户侧只上传码，合图由服务端完成。前端不生成终图。',
    )
  }

  function publishHint(row: PromoMaterialTemplate) {
    if (row.type === 'image') return '图片须已框选唯一正方形二维码区。发布后合伙人可上传码并由服务端合成；本页不生成终图。'
    if (row.type === 'article') return '图文须已启用末尾唯一二维码预留位。发布后不在前端合成终图。'
    return '视频将以互动 H5 交付（不烧录二维码）；专用 web-view 路由仍为联调缺口，不降低模板配置完成度。'
  }

  function actionButton(row: PromoMaterialTemplate, action: PromoMaterialAction) {
    if (!(row.allowedActions ?? []).includes(action) || !canEdit) return null
    if (action === 'save') return <Button key="save" size="small" onClick={() => openEdit(row)}>编辑</Button>
    if (action === 'set-qr-region') return <Button key="region" size="small" onClick={() => openRegion(row)}>框选二维码区</Button>
    if (action === 'publish') {
      return (
        <Button
          key="publish"
          size="small"
          type="primary"
          onClick={() =>
            void runMutate(
              { action: 'publish', materialId: row.materialId, version: row.version, reason: '发布推广素材模板', idempotencyKey: crypto.randomUUID() },
              '发布模板',
              publishHint(row),
            )
          }
        >
          发布
        </Button>
      )
    }
    if (action === 'offline') {
      return (
        <Button
          key="offline"
          size="small"
          danger
          onClick={() =>
            void runMutate(
              { action: 'offline', materialId: row.materialId, version: row.version, reason: '下线推广素材模板', idempotencyKey: crypto.randomUUID() },
              '下线模板',
              '确认下线？下线后小程序侧不可再选用该模板。',
            )
          }
        >
          下线
        </Button>
      )
    }
    if (action === 'delete') {
      return (
        <Button
          key="delete"
          size="small"
          danger
          onClick={() =>
            void runMutate(
              { action: 'delete', materialId: row.materialId, version: row.version, reason: '删除草稿模板', idempotencyKey: crypto.randomUUID() },
              '删除草稿',
              '仅草稿可删，确认删除？',
            )
          }
        >
          删除
        </Button>
      )
    }
    return null
  }

  const liveRegion: QrFillRegion | null =
    regionOpen && Number.isFinite(watchX) && Number.isFinite(watchY) && Number.isFinite(watchW)
      ? { x: Number(watchX), y: Number(watchY), width: Number(watchW), height: Number(watchW) }
      : regionTarget?.qrRegion ?? null

  const activeType = (watchedType || editing?.type) as PromoMaterialType | undefined

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>推广素材与二维码模板</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          HQ-24 / PRD §5.3：按图片 / 图文 / 视频三类维护模板；禁止前端伪终图；图片正方形二维码区；图文末尾唯一码位；视频互动 H5（不烧录）。
        </Typography.Paragraph>
      </div>

      {catalog && (
        <Alert
          type="warning"
          showIcon
          message="合图与视频 H5 边界"
          description={
            <div>
              <div>{catalog.composeGapNote}</div>
              <div style={{ marginTop: 8 }}>{catalog.videoH5GapNote}</div>
            </div>
          }
        />
      )}

      {summary && (
        <Card size="small">
          <Space wrap size={24}>
            <Statistic title="模板数" value={summary.templates} />
            <Statistic title="草稿" value={summary.draft} />
            <Statistic title="已发布" value={summary.published} />
            <Statistic title="已下线" value={summary.offline} />
            <Statistic title="图片已框选区" value={summary.imageWithRegion} />
            <Statistic title="缺区/缺码位" value={summary.missingQrRegion} />
            <Statistic title="视频 H5" value={summary.videoH5} />
          </Space>
        </Card>
      )}

      <Card
        size="small"
        title="筛选"
        extra={
          canEdit ? (
            <Button type="primary" onClick={openCreateWizard}>新建模板</Button>
          ) : (
            <Typography.Text type="secondary">只读（需 materials:edit）</Typography.Text>
          )
        }
      >
        <Tabs
          activeKey={type ?? 'all'}
          onChange={(key) => {
            setPage(1)
            setType(key === 'all' ? undefined : (key as PromoMaterialType))
          }}
          items={[
            { key: 'all', label: '全部' },
            { key: 'image', label: '图片' },
            { key: 'article', label: '图文' },
            { key: 'video', label: '视频' },
          ]}
          style={{ marginBottom: 8 }}
        />
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="标题 / 摘要 / ID"
            style={{ width: 240 }}
            onSearch={(v) => { setPage(1); setKeyword(v.trim()) }}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            options={[
              { value: 'DRAFT', label: '草稿' },
              { value: 'PUBLISHED', label: '已发布' },
              { value: 'OFFLINE', label: '已下线' },
            ]}
            onChange={(v) => { setPage(1); setStatus(v) }}
          />
          <Button onClick={() => void loadList()}>刷新</Button>
        </Space>
      </Card>

      <Table
        rowKey="materialId"
        loading={loading}
        dataSource={items}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
        columns={[
          {
            title: '封面',
            dataIndex: 'coverUrl',
            width: 72,
            render: (url: string) => (
              <img src={url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
            ),
          },
          { title: '标题', dataIndex: 'title', ellipsis: true },
          {
            title: '类型',
            dataIndex: 'type',
            width: 80,
            render: (t: PromoMaterialType) => typeLabel[t],
          },
          { title: '分类', dataIndex: 'categoryName', width: 120 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (s: PromoMaterialStatus) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
          },
          {
            title: '码区/码位',
            width: 130,
            render: (_: unknown, row: PromoMaterialTemplate) => {
              if (row.type === 'video') return <Tag>H5 不烧录</Tag>
              if (row.type === 'article') return row.qrSlotAtEnd ? <Tag color="blue">末尾码位</Tag> : <Tag color="orange">无码位</Tag>
              return row.qrRegion ? <Tag color="blue">已框选</Tag> : <Tag color="orange">未框选</Tag>
            },
          },
          { title: '版本', dataIndex: 'version', width: 70 },
          {
            title: '操作',
            width: 280,
            render: (_: unknown, row: PromoMaterialTemplate) => (
              <Space wrap size={4}>
                <Button size="small" onClick={() => void openDetail(row)}>详情</Button>
                {(['save', 'set-qr-region', 'publish', 'offline', 'delete'] as PromoMaterialAction[]).map((a) => actionButton(row, a))}
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title="素材模板详情"
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={detail.composeGapNote} />
            {detail.template.type === 'video' && <Alert type="warning" showIcon message={detail.videoH5GapNote} />}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="ID">{detail.template.materialId}</Descriptions.Item>
              <Descriptions.Item label="标题">{detail.template.title}</Descriptions.Item>
              <Descriptions.Item label="类型">{typeLabel[detail.template.type]}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusLabel[detail.template.status]}</Descriptions.Item>
              <Descriptions.Item label="分类">{detail.template.categoryName}</Descriptions.Item>
              <Descriptions.Item label="摘要">{detail.template.summary || '—'}</Descriptions.Item>
              <Descriptions.Item label="分享模板">{detail.template.shareUrlTemplate}</Descriptions.Item>
              <Descriptions.Item label="合伙人操作">{(detail.template.partnerOperations ?? []).join(', ') || '（未发布）'}</Descriptions.Item>
              <Descriptions.Item label="合图禁止">{detail.template.composedAssetForbidden ? '是（仅服务端）' : '否'}</Descriptions.Item>
              {detail.template.type === 'article' && (
                <Descriptions.Item label="末尾码位">{detail.template.qrSlotAtEnd ? '已启用' : '未启用'}</Descriptions.Item>
              )}
              {detail.template.type === 'video' && (
                <>
                  <Descriptions.Item label="视频交付">{detail.template.videoDeliveryMode}</Descriptions.Item>
                  <Descriptions.Item label="H5 路由就绪">{detail.template.h5RouteReady ? '是' : '否（联调缺口，不降低配置完成度）'}</Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="版本">{detail.template.version}</Descriptions.Item>
            </Descriptions>

            {detail.template.type === 'image' && (
              <Card size="small" title="原图与唯一正方形二维码填充区（示意，非合成终图）">
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <img src={detail.template.mediaUrl} alt="原图" style={{ maxWidth: '100%', display: 'block', borderRadius: 8 }} />
                  {detail.template.qrRegion && <div style={regionStyle(detail.template.qrRegion)} />}
                </div>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {detail.template.qrRegion
                    ? `区：x=${detail.template.qrRegion.x}, y=${detail.template.qrRegion.y}, side=${detail.template.qrRegion.width}（归一化正方形）`
                    : '尚未框选二维码区'}
                </Typography.Paragraph>
              </Card>
            )}

            {detail.template.type === 'article' && (
              <Card size="small" title="图文预览（含末尾码位占位）">
                <Typography.Paragraph type="secondary">正文节点数：{detail.template.articleContent?.nodes?.length ?? 0}（默认不含视频块）</Typography.Paragraph>
                <ArticleQrSlotPreview enabled={!!detail.template.qrSlotAtEnd} />
              </Card>
            )}

            {detail.template.type === 'video' && (
              <Card size="small" title="互动 H5 模板布局预览（非烧录发布）">
                <VideoH5Preview mediaUrl={detail.template.mediaUrl} posterUrl={detail.template.posterUrl} />
              </Card>
            )}

            <Card size="small" title="审计（最近）">
              {(detail.audit.length ? detail.audit : []).map((a) => (
                <div key={a.operationId} style={{ marginBottom: 8, fontSize: 12 }}>
                  <div>{a.action} · {a.operatorName} · {new Date(a.occurredAt).toLocaleString('zh-CN', { hour12: false })}</div>
                  <div>{a.before} → {a.after}</div>
                  <div>原因：{a.reason}</div>
                </div>
              ))}
              {!detail.audit.length && <Typography.Text type="secondary">暂无审计</Typography.Text>}
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={editing ? '编辑模板' : createStep === 'pick-type' ? '新建模板 · 选择类型' : `新建${activeType ? typeLabel[activeType] : ''}草稿`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => {
          if (!editing && createStep === 'pick-type') return
          void submitSave()
        }}
        okButtonProps={{ style: !editing && createStep === 'pick-type' ? { display: 'none' } : undefined }}
        confirmLoading={busy}
        destroyOnClose
        width={720}
      >
        {!editing && createStep === 'pick-type' ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary">按产品三类分流创建，创建后类型不可改。</Typography.Paragraph>
            <Space wrap size={12}>
              <Button type="primary" onClick={() => startCreateWithType('image')}>图片：底图 + 正方形码区</Button>
              <Button type="primary" onClick={() => startCreateWithType('article')}>图文：富文本 + 末尾码位</Button>
              <Button type="primary" onClick={() => startCreateWithType('video')}>视频：互动 H5（不烧录）</Button>
            </Space>
          </Space>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请填写标题' }]}>
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select disabled options={[
                { value: 'image', label: '图片素材' },
                { value: 'article', label: '图文素材' },
                { value: 'video', label: '视频素材' },
              ]} />
            </Form.Item>
            <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
              <Select options={categoriesForType.map((c) => ({ value: c.categoryId, label: c.name }))} />
            </Form.Item>

            {activeType === 'image' && (
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message="上传底图后，请在列表中「框选二维码区」设置唯一正方形区域（归一化 0–1）；无框选不可发布。" />
            )}
            {activeType === 'video' && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="视频交付模式固定为 INTERACTIVE_H5，不提供烧录区/烧录发布选项。小程序 web-view 未就绪时仅标缺口，不降低配置完成度。" />
            )}

            <Form.Item
              name="mediaUrl"
              label={activeType === 'video' ? '视频 URL' : activeType === 'article' ? '封面图/头图 URL' : '底图 URL'}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input placeholder="Mock：粘贴可预览 URL；真实环境走上传契约" />
            </Form.Item>
            <Form.Item name="coverUrl" label="列表封面 URL">
              <Input />
            </Form.Item>
            {activeType === 'video' && (
              <Form.Item name="posterUrl" label="视频封面">
                <Input />
              </Form.Item>
            )}
            <Form.Item name="summary" label="摘要">
              <Input.TextArea rows={2} maxLength={200} />
            </Form.Item>
            <Space>
              <Form.Item name="mediaWidth" label="媒体宽" rules={[{ required: true }]}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="mediaHeight" label="媒体高" rules={[{ required: true }]}>
                <InputNumber min={1} />
              </Form.Item>
            </Space>
            <Form.Item name="shareUrlTemplate" label="分享链接模板">
              <Input />
            </Form.Item>

            {activeType === 'article' && (
              <div style={{ marginBottom: 16 }}>
                <CmsContentEditor
                  token={token}
                  label="图文正文（文字+图片；默认不含视频块）"
                  value={articleContent}
                  onChange={setArticleContent}
                  mediaPolicy="image-text"
                />
                <Checkbox checked={qrSlotAtEnd} onChange={(e) => setQrSlotAtEnd(e.target.checked)} style={{ marginTop: 12 }}>
                  启用末尾唯一二维码预留位（发布必选）
                </Checkbox>
                <ArticleQrSlotPreview enabled={qrSlotAtEnd} />
              </div>
            )}

            {activeType === 'video' && (
              <Card size="small" title="互动 H5 布局预览" style={{ marginBottom: 16 }}>
                <VideoH5Preview mediaUrl={watchedMediaUrl || ''} posterUrl={watchedPosterUrl} />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  中间视频区 + 右侧固定聊天框按钮；点开区域展示用户二维码，不烧录进 MP4。
                </Typography.Paragraph>
              </Card>
            )}

            <Form.Item name="reason" label="原因" rules={[{ required: true, whitespace: true, message: '请填写原因' }]}>
              <Input.TextArea rows={2} maxLength={200} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="框选唯一正方形二维码填充区"
        open={regionOpen}
        onCancel={() => setRegionOpen(false)}
        onOk={() => void submitRegion()}
        confirmLoading={busy}
        destroyOnClose
        width={640}
      >
        {regionTarget && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert type="info" showIcon message="归一化坐标 0–1；须为正方形（宽=高）；每模板唯一一区。保存区域不等于合成终图。" />
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img src={regionTarget.mediaUrl} alt="原图" style={{ maxWidth: '100%', display: 'block', borderRadius: 8 }} />
              {liveRegion && liveRegion.width > 0 && <div style={regionStyle(liveRegion)} />}
            </div>
            <Form form={regionForm} layout="inline">
              <Form.Item name="x" label="x" rules={[{ required: true }]}><InputNumber min={0} max={1} step={0.01} /></Form.Item>
              <Form.Item name="y" label="y" rules={[{ required: true }]}><InputNumber min={0} max={1} step={0.01} /></Form.Item>
              <Form.Item name="width" label="边长" rules={[{ required: true }]}>
                <InputNumber
                  min={0.01}
                  max={1}
                  step={0.01}
                  onChange={(v) => {
                    const side = Number(v) || 0.01
                    regionForm.setFieldsValue({ width: side, height: side })
                  }}
                />
              </Form.Item>
              <Form.Item name="height" hidden><InputNumber /></Form.Item>
            </Form>
            <Form form={regionForm} layout="vertical">
              <Form.Item name="reason" label="原因" rules={[{ required: true, whitespace: true }]}>
                <Input.TextArea rows={2} maxLength={200} />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </Space>
  )
}