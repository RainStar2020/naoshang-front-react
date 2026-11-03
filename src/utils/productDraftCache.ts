/** 商品编辑器本机草稿缓存：不写后端，仅 localStorage。 */
import type { ContentNode, RichContent } from '../types/cms'
import type { ProductDraft } from '../types/products'

const PREFIX = 'hq.product-editor.draft.v1:'

export type ProductDraftCacheRecord = {
  key: string
  updatedAt: string
  serverVersion: number
  draft: ProductDraft
}

export function productDraftCacheKey(productId?: string | null) {
  const id = (productId || '').trim()
  return id || 'new'
}

function storageKey(key: string) {
  return `${PREFIX}${key}`
}

export function loadProductDraftCache(productId?: string | null): ProductDraftCacheRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(productDraftCacheKey(productId)))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProductDraftCacheRecord
    if (!parsed?.draft || typeof parsed.draft !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveProductDraftCache(input: {
  productId?: string | null
  draft: ProductDraft
  serverVersion?: number
}) {
  const key = productDraftCacheKey(input.productId ?? input.draft.productId)
  const record: ProductDraftCacheRecord = {
    key,
    updatedAt: new Date().toISOString(),
    serverVersion: input.serverVersion ?? 0,
    draft: structuredClone(input.draft),
  }
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(record))
    return record
  } catch (error) {
    // 常见原因：轮播图 data URL 过大超出配额
    throw new Error(error instanceof Error ? `本机缓存失败：${error.message}` : '本机缓存失败（可能图片过大）')
  }
}

export function clearProductDraftCache(productId?: string | null) {
  try {
    localStorage.removeItem(storageKey(productDraftCacheKey(productId)))
  } catch {
    // ignore
  }
}

export function isLocalMediaUrl(url: string) {
  return typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:'))
}

/** 详情正文是否仍含未上传的本地图/视频。 */
export function contentHasLocalMedia(content: RichContent | null | undefined): boolean {
  const walk = (nodes: ContentNode[]): boolean => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      if ('type' in node) continue
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      if ((node.name === 'img' || node.name === 'video') && isLocalMediaUrl(src)) return true
      if (Array.isArray(node.children) && walk(node.children)) return true
    }
    return false
  }
  return walk(Array.isArray(content?.nodes) ? content!.nodes : [])
}


export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取本地图片失败'))
    reader.readAsDataURL(file)
  })
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const type = blob.type || 'image/png'
  const ext = type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png'
  return new File([blob], filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`, { type })
}


/** 提交前：把正文里的 data:/blob: 图片上传并替换为远端 URL。 */
export async function uploadLocalUrlsInContent(
  content: RichContent,
  uploadFile: (file: File) => Promise<{ url: string }>,
): Promise<RichContent> {
  let seq = 0
  const walk = async (nodes: ContentNode[]): Promise<ContentNode[]> => {
    const next: ContentNode[] = []
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      if ('type' in node) {
        next.push(node)
        continue
      }
      const attrs = { ...(node.attrs ?? {}) }
      const src = typeof attrs.src === 'string' ? attrs.src : ''
      if ((node.name === 'img' || node.name === 'video') && isLocalMediaUrl(src)) {
        seq += 1
        const file = await dataUrlToFile(src, `content-${seq}`)
        const asset = await uploadFile(file)
        attrs.src = asset.url
      }
      next.push({
        ...node,
        attrs,
        children: await walk(Array.isArray(node.children) ? node.children : []),
      })
    }
    return next
  }
  return {
    version: content.version ?? 1,
    format: 'nodes',
    nodes: await walk(Array.isArray(content.nodes) ? content.nodes : []),
  }
}
