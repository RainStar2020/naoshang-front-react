import { useRef } from 'react'
import { formatSize, uid } from '../utils/file'

export interface FileItem {
  id: string
  name: string
  size: number
  mime: string
  url: string
}

interface FileListProps {
  items: FileItem[]
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
  accept?: string
  title?: string
  compact?: boolean
}

function extOf(name: string): string {
  const ext = name.split('.').pop() || ''
  return ext.slice(0, 4).toUpperCase()
}

function extClass(ext: string): string {
  if (['PDF'].includes(ext)) return 'red'
  if (['DOC', 'DOCX', 'WPS'].includes(ext)) return 'blue'
  if (['ZIP', 'RAR', '7Z'].includes(ext)) return 'yellow'
  if (['MP4', 'MOV', 'AVI', 'MKV'].includes(ext)) return 'purple'
  if (['MP3', 'WAV'].includes(ext)) return 'orange'
  return 'gray'
}

export default function FileList({ items, onAdd, onRemove, accept, title, compact }: FileListProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`file-list ${compact ? 'compact' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files)
          e.target.value = ''
        }}
      />
      <button type="button" className="file-add" onClick={() => inputRef.current?.click()}>
        <span className="plus">+</span>
        {title || '上传文件'}
      </button>
      {items.map((f) => (
        <div key={f.id} className="file-card">
          <span className={`file-ext ext-${extClass(extOf(f.name))}`}>{extOf(f.name)}</span>
          <div className="file-meta">
            <div className="file-name" title={f.name}>{f.name}</div>
            <div className="file-size">{formatSize(f.size)}</div>
          </div>
          <button type="button" className="file-remove" onClick={() => onRemove(f.id)} aria-label="删除文件">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export function makeFileItem(file: File, url: string): FileItem {
  return { id: uid(), name: file.name, size: file.size, mime: file.type, url }
}
