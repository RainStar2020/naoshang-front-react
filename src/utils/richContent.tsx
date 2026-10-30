import type { ContentNode, RichContent, RichTag } from '../types/cms'

export const emptyContent = (): RichContent => ({ version: 1, format: 'nodes', nodes: [] })
export const isMediaUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/[^\s<>"'\\]+$/i.test(value)
/** 课程允许 video；商品详情另用 assertProductContentAllowsSave 在保存前拒绝 video。 */
const tags = new Set<RichTag>(['p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img', 'video'])
const typography: Partial<Record<RichTag, string>> = {
  p: 'margin:0 0 16px;line-height:1.8;word-break:break-word;',
  h2: 'font-size:20px;line-height:1.5;margin:20px 0 12px;',
  h3: 'font-size:17px;line-height:1.6;margin:16px 0 10px;',
  img: 'display:block;max-width:100%;height:auto;margin:12px auto;',
  video: 'display:block;max-width:100%;height:auto;margin:12px auto;',
  blockquote: 'margin:12px 0;padding-left:12px;border-left:3px solid #8793b0;',
}

/** 与小程序白名单一致；真实后端仍须再次清洗并校验资源权限。script/iframe 等不在白名单，normalize 会剥离；课程保存另有 assertCourseContentAllowsSave 显式拒绝。 */
export function normalizeContent(input: unknown): RichContent {
  if (input == null) return emptyContent()
  const value = input as Partial<RichContent>
  if (value.version !== 1 || value.format !== 'nodes' || !Array.isArray(value.nodes)) throw new Error('正文必须是 version=1、format=nodes 格式')
  let count = 0
  function clean(nodes: unknown[], depth = 0): ContentNode[] {
    if (depth > 16) throw new Error('正文层级不能超过16层')
    return nodes.flatMap((raw): ContentNode[] => {
      if (++count > 2000) throw new Error('正文节点不能超过2000个')
      if (!raw || typeof raw !== 'object') return []
      const node = raw as Record<string, unknown>
      if (node.type === 'text') return typeof node.text === 'string' ? [{ type: 'text', text: node.text }] : []
      const name = node.name as RichTag
      if (!tags.has(name)) return []
      const attrs = (node.attrs ?? {}) as Record<string, unknown>
      if ((name === 'img' || name === 'video') && !isMediaUrl(attrs.src)) return []
      const mediaAttrs =
        name === 'img'
          ? { src: attrs.src as string, alt: String(attrs.alt ?? '') }
          : name === 'video'
            ? {
                src: attrs.src as string,
                ...(isMediaUrl(attrs.poster) ? { poster: attrs.poster as string } : {}),
                controls: 'true',
              }
            : {}
      return [{
        name,
        attrs: { style: typography[name] ?? 'word-break:break-word;', ...mediaAttrs },
        children: clean(Array.isArray(node.children) ? node.children : [], depth + 1),
      }]
    })
  }
  return { version: 1, format: 'nodes', nodes: clean(value.nodes) }
}
export const nodeText = (node: ContentNode): string => ('type' in node ? node.text : node.children.map(nodeText).join(''))
export const hasContent = (value: RichContent): boolean =>
  value.nodes.some((node) => {
    if ('type' in node) return !!node.text.trim()
    if (node.name === 'img' || node.name === 'video') return isMediaUrl(node.attrs.src)
    return hasContent({ ...value, nodes: node.children })
  })


export function ContentPreview({ value, resolveUrl = (url) => url }: { value: RichContent; resolveUrl?: (url: string) => string }) {
  function render(node: ContentNode, key: number): React.ReactNode {
    if ('type' in node) return node.text
    if (node.name === 'img') {
      return <img key={key} src={resolveUrl(node.attrs.src!)} alt={node.attrs.alt ?? ''} style={{ maxWidth: '100%', display: 'block', margin: '12px auto' }} />
    }
    if (node.name === 'video') {
      return (
        <video
          key={key}
          controls
          src={resolveUrl(node.attrs.src!)}
          poster={node.attrs.poster ? resolveUrl(node.attrs.poster) : undefined}
          style={{ maxWidth: '100%', display: 'block', margin: '12px auto' }}
        />
      )
    }
    const Tag = node.name
    if (Tag === 'br') return <br key={key} />
    return <Tag key={key}>{node.children.map(render)}</Tag>
  }
  return <div className="cms-rich-preview">{normalizeContent(value).nodes.map(render)}</div>
}