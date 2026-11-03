import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  clearProductDraftCache,
  isLocalMediaUrl,
  loadProductDraftCache,
  productDraftCacheKey,
  saveProductDraftCache,
  uploadLocalUrlsInContent,
} from '../utils/productDraftCache'
import { emptyContent } from '../utils/richContent'
import type { ProductDraft } from '../types/products'

const draft = (): ProductDraft => ({
  productId: '',
  categoryId: 'physical',
  title: '缓存商品',
  summary: '简介',
  coverUrl: '',
  carouselUrls: ['data:image/png;base64,QQ=='],
  content: emptyContent(),
  fulfillmentType: 'PHYSICAL',
  costAmount: 0,
  requiresMember: false,
  pricePresentation: 'tiered',
  originalAmount: null,
  standardAmount: 0,
  activityAmount: null,
  memberPrices: [],
  rolePrices: [],
  specGroups: [],
  skus: [],
})

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
  })
})
afterEach(() => vi.restoreAllMocks())

it('product draft cache round-trip for new product', () => {
  expect(productDraftCacheKey('')).toBe('new')
  saveProductDraftCache({ draft: draft(), serverVersion: 0 })
  const loaded = loadProductDraftCache('new')
  expect(loaded?.draft.title).toBe('缓存商品')
  expect(loaded?.draft.carouselUrls[0]).toMatch(/^data:image/)
  clearProductDraftCache('new')
  expect(loadProductDraftCache('new')).toBeNull()
})

it('recognizes local media urls', () => {
  expect(isLocalMediaUrl('data:image/png;base64,x')).toBe(true)
  expect(isLocalMediaUrl('blob:http://localhost/1')).toBe(true)
  expect(isLocalMediaUrl('https://cdn.example/a.png')).toBe(false)
})


it('uploadLocalUrlsInContent replaces data: img with remote url', async () => {
  const content = {
    version: 1 as const,
    format: 'nodes' as const,
    nodes: [
      {
        name: 'img' as const,
        attrs: { src: 'data:image/png;base64,QQ==', alt: 'x' },
        children: [],
      },
      { type: 'text' as const, text: 'hi' },
    ],
  }
  const out = await uploadLocalUrlsInContent(content, async () => ({ url: 'https://cdn.example/up.png' }))
  const img = out.nodes.find((n) => !('type' in n) && (n as { name: string }).name === 'img') as { attrs: { src: string } }
  expect(img.attrs.src).toBe('https://cdn.example/up.png')
})
