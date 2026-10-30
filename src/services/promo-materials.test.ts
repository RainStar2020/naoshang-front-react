import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PromoMaterialMutation } from '../types/promo-materials'
import { emptyContent } from '../utils/richContent'

let service: typeof import('./promo-materials')['promoMaterialService']
let auth: typeof import('./auth')['authService']
let reset: typeof import('./mock/promo-materials')['__resetPromoMaterialsMockForTests']
let token: string

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T10:00:00+08:00'))
  vi.resetModules()
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
    removeItem: (k: string) => { storage.delete(k) },
  })
  service = (await import('./promo-materials')).promoMaterialService
  auth = (await import('./auth')).authService
  reset = (await import('./mock/promo-materials')).__resetPromoMaterialsMockForTests
  reset()
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('目录含合图与视频 H5 缺口；列表覆盖图文视频与缺区草稿；禁止合图字段', async () => {
  const catalog = await service.catalog(token)
  expect(catalog.mockOnly).toBe(true)
  expect(catalog.pendingPolicy.clientSideComposeForbidden).toBe(true)
  expect(catalog.pendingPolicy.dedicatedWebViewRoutePending).toBe(true)
  expect(catalog.composeGapNote).toMatch(/服务端/)
  expect(catalog.videoH5GapNote).toMatch(/H5/)
  const list = await service.list(token, { page: 1, pageSize: 20 })
  expect(list.total).toBeGreaterThanOrEqual(7)
  expect(list.summary.missingQrRegion).toBeGreaterThanOrEqual(1)
  expect(list.summary.videoH5).toBeGreaterThanOrEqual(1)
  expect(list.items.every((row) => row.composedAssetForbidden && row.mockOnly)).toBe(true)
  expect(list.items.filter((r) => r.type === 'video').every((r) => r.videoDeliveryMode === 'INTERACTIVE_H5' && r.h5RouteReady === false && r.qrRegion === null)).toBe(true)
  const articlePub = list.items.find((r) => r.materialId === 'pm-article-1')
  expect(articlePub?.qrSlotAtEnd).toBe(true)
  expect(articlePub?.qrRegion).toBeNull()
})

it('查询账号不可编辑；详情不含伪终图与密码', async () => {
  const viewer = (await auth.login({ loginAccount: 'hq-materials-viewer', password: 'Demo@123456' })).token
  const draft: PromoMaterialMutation = {
    action: 'publish',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '试发布',
    idempotencyKey: crypto.randomUUID(),
  }
  await expect(service.mutate(viewer, draft)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  const detail = await service.detail(viewer, 'pm-image-poster-1')
  expect(detail.composeGapNote).toMatch(/禁止/)
  expect(detail.template.qrRegion).toEqual({ x: 0.7, y: 0.75, width: 0.2, height: 0.2 })
  expect(JSON.stringify(detail)).not.toMatch(/password|Demo@|composedUrl|finalImage/i)
  token = (await auth.login({ loginAccount: 'hq-admin', password: 'Demo@123456' })).token
})

it('图片无二维码区不可发布；非正方形拒绝；框选后可发布；幂等可重放', async () => {
  await expect(service.mutate(token, {
    action: 'publish',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '未框选就发',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'QR_REGION_REQUIRED' })

  await expect(service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '非正方形',
    idempotencyKey: crypto.randomUUID(),
    qrRegion: { x: 0.7, y: 0.7, width: 0.2, height: 0.15 },
  })).rejects.toMatchObject({ code: 'QR_REGION_INVALID' })

  const keyRegion = crypto.randomUUID()
  const regioned = await service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '框选右下角唯一正方形区',
    idempotencyKey: keyRegion,
    qrRegion: { x: 0.7, y: 0.7, width: 0.2, height: 0.2 },
  })
  expect(regioned.template.qrRegion).toEqual({ x: 0.7, y: 0.7, width: 0.2, height: 0.2 })
  expect(await service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '框选右下角唯一正方形区',
    idempotencyKey: keyRegion,
    qrRegion: { x: 0.7, y: 0.7, width: 0.2, height: 0.2 },
  })).toEqual(regioned)

  const keyPub = crypto.randomUUID()
  const published = await service.mutate(token, {
    action: 'publish',
    materialId: 'pm-image-draft-1',
    version: regioned.template.version,
    reason: '区域已就绪发布',
    idempotencyKey: keyPub,
  })
  expect(published.template.status).toBe('PUBLISHED')
  expect(published.template.partnerOperations).toEqual(expect.arrayContaining(['upload-qr', 'render', 'download']))
  expect(published.message).toMatch(/不生成合成终图/)
})

it('图文无末尾码位不可发布；启用后可发布；不可框选原图区', async () => {
  await expect(service.mutate(token, {
    action: 'publish',
    materialId: 'pm-article-draft-1',
    version: 1,
    reason: '无码位发布',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'QR_SLOT_REQUIRED' })

  await expect(service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-article-draft-1',
    version: 1,
    reason: '误框选',
    idempotencyKey: crypto.randomUUID(),
    qrRegion: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })

  const saved = await service.mutate(token, {
    action: 'save',
    materialId: 'pm-article-draft-1',
    version: 1,
    reason: '启用末尾码位',
    idempotencyKey: crypto.randomUUID(),
    title: '招商图文（草稿无码位）',
    type: 'article',
    categoryId: 'article-cat-2',
    coverUrl: 'https://picsum.photos/seed/pm-article-draft/400/300',
    mediaUrl: 'https://picsum.photos/seed/pm-article-draft/800/600',
    summary: '已启用码位',
    mediaWidth: 800,
    mediaHeight: 600,
    shareUrlTemplate: 'https://example.local/article/invite?code={inviteCode}',
    articleContent: emptyContent(),
    qrSlotAtEnd: true,
  })
  expect(saved.template.qrSlotAtEnd).toBe(true)
  expect(saved.template.qrRegion).toBeNull()

  const pub = await service.mutate(token, {
    action: 'publish',
    materialId: 'pm-article-draft-1',
    version: saved.template.version,
    reason: '码位就绪发布',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(pub.template.status).toBe('PUBLISHED')
  expect(pub.template.qrSlotAtEnd).toBe(true)
})

it('视频不可设烧录区；发布后仍为互动 H5 且无专用路由；无烧录发布选项', async () => {
  await expect(service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-video-draft-1',
    version: 1,
    reason: '误设视频区',
    idempotencyKey: crypto.randomUUID(),
    qrRegion: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  })).rejects.toMatchObject({ code: 'INVALID_STATE' })

  const pub = await service.mutate(token, {
    action: 'publish',
    materialId: 'pm-video-draft-1',
    version: 1,
    reason: '发布互动 H5 视频',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(pub.template).toMatchObject({
    status: 'PUBLISHED',
    videoDeliveryMode: 'INTERACTIVE_H5',
    h5RouteReady: false,
    qrRegion: null,
  })
  expect(pub.template.partnerOperations).toEqual(expect.arrayContaining(['upload-qr', 'copy-link']))
  expect(pub.template.partnerOperations).not.toContain('render')
  expect(pub.template.allowedActions).not.toContain('set-qr-region')
})

it('非法区域、版本冲突、原因必填、草稿删除与下线', async () => {
  await expect(service.mutate(token, {
    action: 'set-qr-region',
    materialId: 'pm-image-draft-1',
    version: 1,
    reason: '越界',
    idempotencyKey: crypto.randomUUID(),
    qrRegion: { x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
  })).rejects.toMatchObject({ code: 'QR_REGION_INVALID' })

  await expect(service.mutate(token, {
    action: 'save',
    materialId: 'pm-image-draft-1',
    version: 99,
    reason: '旧版本',
    idempotencyKey: crypto.randomUUID(),
    title: 'x',
    type: 'image',
    categoryId: 'image-cat-2',
    coverUrl: 'https://picsum.photos/seed/x/100/100',
    mediaUrl: 'https://picsum.photos/seed/x/100/100',
    summary: '',
    mediaWidth: 100,
    mediaHeight: 100,
    shareUrlTemplate: '',
  })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })

  await expect(service.mutate(token, {
    action: 'offline',
    materialId: 'pm-image-poster-1',
    version: 2,
    reason: '',
    idempotencyKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' })

  const off = await service.mutate(token, {
    action: 'offline',
    materialId: 'pm-image-poster-1',
    version: 2,
    reason: '活动结束下线',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(off.template.status).toBe('OFFLINE')

  const created = await service.mutate(token, {
    action: 'save',
    version: 0,
    reason: '新建草稿',
    idempotencyKey: crypto.randomUUID(),
    title: '临时草稿',
    type: 'image',
    categoryId: 'image-cat-1',
    coverUrl: 'https://picsum.photos/seed/tmp/100/100',
    mediaUrl: 'https://picsum.photos/seed/tmp/100/100',
    summary: 'tmp',
    mediaWidth: 100,
    mediaHeight: 100,
    shareUrlTemplate: 'https://example.local/x',
  })
  expect(created.template.status).toBe('DRAFT')
  const deleted = await service.mutate(token, {
    action: 'delete',
    materialId: created.template.materialId,
    version: created.template.version,
    reason: '误建删除',
    idempotencyKey: crypto.randomUUID(),
  })
  expect(deleted.action).toBe('delete')
  await expect(service.detail(token, created.template.materialId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

it('编辑账号可写；内容演示账号含素材编辑权；无权限账号拒绝目录', async () => {
  const editor = (await auth.login({ loginAccount: 'hq-materials-editor', password: 'Demo@123456' })).token
  const ok = await service.mutate(editor, {
    action: 'save',
    materialId: 'pm-article-1',
    version: 1,
    reason: '微调摘要',
    idempotencyKey: crypto.randomUUID(),
    title: '如何邀请下级合伙人',
    type: 'article',
    categoryId: 'article-cat-1',
    coverUrl: 'https://picsum.photos/seed/pm-article/400/300',
    mediaUrl: 'https://picsum.photos/seed/pm-article/800/600',
    summary: '更新摘要',
    mediaWidth: 800,
    mediaHeight: 600,
    shareUrlTemplate: 'https://example.local/article/invite?code={inviteCode}',
    articleContent: emptyContent(),
    qrSlotAtEnd: true,
  })
  expect(ok.template.summary).toBe('更新摘要')
  expect(ok.template.qrSlotAtEnd).toBe(true)

  const content = (await auth.login({ loginAccount: 'hq-content', password: 'Demo@123456' })).token
  const list = await service.list(content, { page: 1, pageSize: 5 })
  expect(list.total).toBeGreaterThan(0)

  const empty = (await auth.login({ loginAccount: 'hq-empty', password: 'Demo@123456' })).token
  await expect(service.catalog(empty)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})