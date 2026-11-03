from pathlib import Path

# --- 1) CmsContentEditor: localMedia mode ---
cms_path = Path(r"E:\project\react-web\naoshang-front-react\src\components\CmsContentEditor.tsx")
cms = cms_path.read_text(encoding="utf-8")
old = """export default function CmsContentEditor({ value, onChange, token, label, upload, mediaPolicy = 'image-text' }: {
  value: RichContent
  onChange: (value: RichContent) => void
  token: string
  label: string
  upload?: (file: File) => Promise<CmsAsset>
  mediaPolicy?: 'image-text' | 'full'
}) {"""
new = """async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取本地图片失败'))
    reader.readAsDataURL(file)
  })
}

export default function CmsContentEditor({ value, onChange, token, label, upload, mediaPolicy = 'image-text', localMedia = false }: {
  value: RichContent
  onChange: (value: RichContent) => void
  token: string
  label: string
  upload?: (file: File) => Promise<CmsAsset>
  mediaPolicy?: 'image-text' | 'full'
  /** 为 true 时插图只用本地 data URL，不调用 upload / assets API */
  localMedia?: boolean
}) {"""
if old not in cms:
    raise SystemExit('CmsContentEditor signature not found')
cms = cms.replace(old, new, 1)

old_up = """  return <div aria-label={label}><RichEditor value={(safeValue.nodes ?? []).map(render).join('')} onChange={html => onChange(parse(html))}
    allowVideo={mediaPolicy === 'full'} allowAttachments={false}
    upload={async file => (await (upload ? upload(file) : cmsService.upload(token, file))).url}
    placeholder={mediaPolicy === 'full' ? '输入文字，可在光标位置插入图片和视频' : '输入文字，可在光标位置插入图片'} /></div>
}"""
new_up = """  const resolveUpload = async (file: File) => {
    if (localMedia) return fileToDataUrl(file)
    const asset = await (upload ? upload(file) : cmsService.upload(token, file))
    return asset.url
  }
  return <div aria-label={label}><RichEditor value={(safeValue.nodes ?? []).map(render).join('')} onChange={html => onChange(parse(html))}
    allowVideo={mediaPolicy === 'full'} allowAttachments={false}
    upload={resolveUpload}
    placeholder={mediaPolicy === 'full' ? '输入文字，可在光标位置插入图片和视频' : '输入文字，可在光标位置插入图片（商品编辑为本地预览）'} /></div>
}"""
if old_up not in cms:
    raise SystemExit('CmsContentEditor upload JSX not found')
cms = cms.replace(old_up, new_up, 1)
cms_path.write_text(cms, encoding="utf-8")
print("CmsContentEditor updated")

# --- 2) productDraftCache: helpers to upload content local media ---
cache_path = Path(r"E:\project\react-web\naoshang-front-react\src\utils\productDraftCache.ts")
cache = cache_path.read_text(encoding="utf-8")
if "uploadLocalUrlsInContent" not in cache:
    cache += r'''

import type { ContentNode, RichContent } from '../types/cms'

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
'''
    # move import to top properly - the added import mid-file is bad. Rewrite helper without mid import.
    cache = cache_path.read_text(encoding="utf-8")
    if "from '../types/cms'" not in cache:
        cache = cache.replace(
            "import type { ProductDraft } from '../types/products'\n",
            "import type { ContentNode, RichContent } from '../types/cms'\nimport type { ProductDraft } from '../types/products'\n",
            1,
        )
    if "uploadLocalUrlsInContent" not in cache:
        cache += '''

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
'''
    cache_path.write_text(cache, encoding="utf-8")
    print("productDraftCache helper added")
else:
    print("helper already present")
