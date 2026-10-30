import RichEditor from './RichEditor'
import { useState } from 'react'
import { Button, Input, Space, Upload, message } from 'antd'
import { cmsService } from '../services/cms'
import type { CmsAsset, ContentNode, RichContent, RichTag } from '../types/cms'
import { isMediaUrl } from '../utils/richContent'

export function CmsAssetInput({ value, onChange, token, kind = 'image', label, upload }: { value: string; onChange: (url: string) => void; token: string; kind?: 'image' | 'video'; label: string; upload?: (file: File) => Promise<CmsAsset> }) {
  const [busy, setBusy] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  return (
    <div>
      {contextHolder}
      <Space.Compact style={{ width: '100%' }}>
        <Input aria-label={label} placeholder="填写HTTPS资源地址，或使用Mock上传" value={value} onChange={(event) => onChange(event.target.value)} />
        <Upload
          showUploadList={false}
          accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4'}
          beforeUpload={(file) => {
            if (!file.type.startsWith(`${kind}/`)) {
              messageApi.error('文件类型与当前资源字段不符')
              return false
            }
            setBusy(true)
            const uploadRequest = upload ? upload(file) : cmsService.upload(token, file)
            uploadRequest
              .then((asset) => {
                onChange(asset.url)
                messageApi.success('已生成本页可用的Mock资源（等同 READY 引用），尚未上传至真实服务器')
              })
              .catch((err) => messageApi.error(err instanceof Error ? err.message : '上传失败'))
              .finally(() => setBusy(false))
            return false
          }}
        >
          <Button loading={busy}>Mock上传</Button>
        </Upload>
      </Space.Compact>
      {kind === 'image' && isMediaUrl(value) && <img className="cms-asset-thumb" src={cmsService.resolveAsset(value)} alt={label} />}
      {kind === 'video' && isMediaUrl(value) && <video className="cms-asset-thumb" controls src={cmsService.resolveAsset(value)} style={{ maxWidth: 320, marginTop: 8 }} />}
    </div>
  )
}

export default function CmsContentEditor({ value, onChange, token, label, upload, mediaPolicy = 'image-text' }: {
  value: RichContent
  onChange: (value: RichContent) => void
  token: string
  label: string
  upload?: (file: File) => Promise<CmsAsset>
  mediaPolicy?: 'image-text' | 'full'
}) {
  const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
  const render = (node: ContentNode): string => {
    if ('type' in node) return escape(node.text)
    const attrs = Object.entries(node.attrs).map(([key, val]) => ` ${key}="${escape(val ?? '')}"`).join('')
    return `<${node.name}${attrs}>${node.children.map(render).join('')}${node.name === 'img' || node.name === 'br' ? '' : `</${node.name}>`}`
  }
  const parse = (html: string): RichContent => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tags = new Set('p div span strong b em i u s br h2 h3 ul ol li blockquote img video'.split(' '))
    const walk = (nodes: NodeListOf<ChildNode>): ContentNode[] => Array.from(nodes).flatMap((node): ContentNode[] => {
      if (node.nodeType === 3) return [{ type: 'text', text: node.textContent ?? '' }]
      if (!(node instanceof Element)) return []
      const name = node.tagName.toLowerCase()
      if (['script', 'style', 'button', 'figcaption'].includes(name)) return []
      if (!tags.has(name)) return walk(node.childNodes)
      const attrs: Record<string, string> = {}
      for (const key of ['src', 'alt', 'poster', 'controls', 'style']) if (node.hasAttribute(key)) attrs[key] = node.getAttribute(key)!
      return [{ name: name as RichTag, attrs, children: walk(node.childNodes) }]
    })
    return { version: 1, format: 'nodes', nodes: walk(doc.body.childNodes) }
  }
  return <div aria-label={label}><RichEditor value={value.nodes.map(render).join('')} onChange={html => onChange(parse(html))}
    allowVideo={mediaPolicy === 'full'} allowAttachments={false}
    upload={async file => (await (upload ? upload(file) : cmsService.upload(token, file))).url}
    placeholder={mediaPolicy === 'full' ? '输入文字，可在光标位置插入图片和视频' : '输入文字，可在光标位置插入图片'} /></div>
}
