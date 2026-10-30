import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
} from 'react'
import { fileToBase64, formatSize, uid } from '../utils/file'

interface RichEditorProps {
  /** 初始 HTML（仅创建时读取一次） */
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  allowVideo?: boolean
  allowAttachments?: boolean
  upload?: (file: File) => Promise<string>
  height?: number
}

/* ---------- HTML 转义，防止文件名中的引号 / 尖括号破坏属性 ---------- */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[c]
  })
}

/* ---------- 格式工具栏命令 ---------- */
const formatButtons = [
  { label: '正文', cmd: 'formatBlock', arg: 'P' },
  { label: '标题 1', cmd: 'formatBlock', arg: 'H1' },
  { label: '标题 2', cmd: 'formatBlock', arg: 'H2' },
  { label: '标题 3', cmd: 'formatBlock', arg: 'H3' },
]

export default function RichEditor({ value, onChange, placeholder, height = 460, allowVideo = true, allowAttachments = true, upload }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const initializedRef = useRef(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEmpty, setIsEmpty] = useState<boolean>(!value || !value.trim())

  /* ---------- 空内容判断：无文本且无图片 / 视频 / 附件 ---------- */
  const computeEmpty = (el: HTMLElement): boolean =>
    !el.textContent?.trim() && !el.querySelector('img, video, a.rich-file')

  /* ---------- 初始化：仅挂载时写入一次，避免受控回写打断光标 ---------- */
  useEffect(() => {
    const el = editorRef.current
    if (el && !initializedRef.current) {
      initializedRef.current = true
      el.innerHTML = value || ''
      setIsEmpty(computeEmpty(el))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- 序列化：克隆 DOM，移除编辑器内部删除按钮后输出 HTML ---------- */
  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.media-remove').forEach((n) => n.remove())
    let html = clone.innerHTML.trim()
    if (html === '<br>' || html === '<br/>' || html === '<br />') html = ''
    onChange?.(html)
    setIsEmpty(computeEmpty(el))
  }, [onChange])

  /* ---------- 选区保存 / 恢复 ---------- */
  const saveRange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const sel = document.getSelection()
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0)
      if (el.contains(r.commonAncestorContainer)) savedRangeRef.current = r.cloneRange()
    }
  }, [])

  const restoreRange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = document.getSelection()
    const saved = savedRangeRef.current
    if (saved && el.contains(saved.commonAncestorContainer)) {
      sel?.removeAllRanges()
      sel?.addRange(saved)
    } else {
      const range = el.ownerDocument.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [])

  /* ---------- 在当前光标位置插入片段；块级媒体后补可编辑空段落并落光标 ---------- */
  const insertNodes = useCallback(
    (html: string) => {
      const el = editorRef.current
      if (!el) return
      restoreRange()
      const sel = document.getSelection()
      if (!sel) return

      let range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      if (!range || !el.contains(range.commonAncestorContainer)) {
        range = el.ownerDocument.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
      }
      range.deleteContents()

      const tmp = el.ownerDocument.createElement('div')
      tmp.innerHTML = html
      const nodes = Array.from(tmp.childNodes)
      if (!nodes.length) return

      range.insertNode(nodes[0])
      let anchor: Node = nodes[0]
      for (let i = 1; i < nodes.length; i++) {
        anchor.parentNode?.insertBefore(nodes[i], anchor.nextSibling)
        anchor = nodes[i]
      }

      // 媒体 / 附件之后补一个空段落，光标落入其中，用户可直接在下一行继续输入
      const doc = el.ownerDocument
      const spacer = doc.createElement('p')
      spacer.innerHTML = '<br>'
      anchor.parentNode?.insertBefore(spacer, anchor.nextSibling)

      const newRange = doc.createRange()
      newRange.setStart(spacer, 0)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      savedRangeRef.current = newRange.cloneRange()

      emitChange()
    },
    [restoreRange, emitChange]
  )

  /* ---------- 图片 / 视频 / 附件插入 ---------- */
  const insertImage = useCallback(
    async (file: File) => {
      const src = await (upload ? upload(file) : fileToBase64(file))
      const safeName = escapeHtml(file.name)
      insertNodes(
        `<figure class="rich-media rich-image" data-uid="${uid()}">` +
          `<img src="${src}" alt="${safeName}" />` +
          `<figcaption data-name="${safeName}"></figcaption>` +
          `<button type="button" class="media-remove" contenteditable="false" title="删除图片">×</button>` +
          `</figure>`
      )
    },
    [insertNodes, upload]
  )

  const insertVideo = useCallback(
    async (file: File) => {
      const src = await (upload ? upload(file) : fileToBase64(file))
      const safeName = escapeHtml(file.name)
      insertNodes(
        `<figure class="rich-media rich-video" data-uid="${uid()}">` +
          `<video src="${src}" controls playsinline preload="metadata"></video>` +
          `<figcaption data-name="${safeName}"></figcaption>` +
          `<button type="button" class="media-remove" contenteditable="false" title="删除视频">×</button>` +
          `</figure>`
      )
    },
    [insertNodes, upload]
  )

  const insertFile = useCallback(
    async (file: File) => {
      const src = await (upload ? upload(file) : fileToBase64(file))
      const safeName = escapeHtml(file.name)
      insertNodes(
        `<p><a class="rich-file" href="${src}" download="${safeName}">📎 ${safeName}（${formatSize(file.size)}）</a></p>`
      )
    },
    [insertNodes, upload]
  )

  /* ---------- 批量插入：按图片 / 视频 / 附件分类，串行保证顺序 ---------- */
  const insertFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) await insertImage(file)
        else if (file.type.startsWith('video/')) { if (allowVideo) await insertVideo(file) }
        else if (allowAttachments) await insertFile(file)
      }
    },
    [insertImage, insertVideo, insertFile, allowVideo, allowAttachments]
  )

  /* ---------- 工具栏格式命令 ---------- */
  const exec = useCallback(
    (cmd: string, arg?: string) => {
      restoreRange()
      document.execCommand(cmd, false, arg)
      emitChange()
    },
    [restoreRange, emitChange]
  )

  /* ---------- 点击删除按钮（事件委托；按钮不进入序列化输出） ---------- */
  const handleEditorClick = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.media-remove')
    if (btn) {
      e.preventDefault()
      const media = btn.closest('.rich-media')
      media?.parentNode?.removeChild(media)
      emitChange()
      return
    }
    saveRange()
  }

  /* ---------- 粘贴图片 ---------- */
  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.items)
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f)
    if (files.length) {
      e.preventDefault()
      void insertFiles(files)
    } else {
      e.preventDefault()
      restoreRange()
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      emitChange()
    }
  }

  /* ---------- 拖拽插入 ---------- */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    if (range && editorRef.current?.contains(range.startContainer)) {
      savedRangeRef.current = range
    }
    void insertFiles(files)
  }

  return (
    <div className="rich-editor" style={{ minHeight: height }}>
      {/* 文字格式工具栏 */}
      <div className="block-toolbar">
        {formatButtons.map((f) => (
          <button
            key={f.label}
            type="button"
            className="tool-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(f.cmd, f.arg)}
          >
            {f.label}
          </button>
        ))}
        <span className="tool-divider" />
        <button type="button" className="tool-btn tool-icon" title="加粗" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>B</button>
        <button type="button" className="tool-btn tool-icon italic" title="斜体" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>I</button>
        <button type="button" className="tool-btn tool-icon underline" title="下划线" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}>U</button>
        <span className="tool-divider" />
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>• 列表</button>
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}>1. 列表</button>
        <span className="tool-divider" />
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')}>左对齐</button>
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')}>居中</button>
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')}>右对齐</button>
        <span className="tool-divider" />
        <label className="tool-color" title="文字颜色">
          <span className="tool-icon" style={{ color: '#dc2626' }}>A</span>
          <input
            type="color"
            defaultValue="#1f2937"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => exec('foreColor', e.target.value)}
          />
        </label>
        <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('removeFormat')}>清除格式</button>
      </div>

      {/* 连续文档区：文字、图片、视频、附件在同一可编辑流内混排 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={`doc-body ${isEmpty ? 'is-empty' : ''}`}
        data-placeholder={placeholder || '输入文字；把光标放到任意位置即可插入图片、视频、附件，插入后可直接在下一行继续输入文字……'}
        onInput={emitChange}
        onKeyUp={saveRange}
        onMouseUp={saveRange}
        onClick={handleEditorClick}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />

      {/* 底部插入条：媒体插入到当前光标位置 */}
      <div className="block-add-bar">
        <button type="button" className="add-btn add-image" onMouseDown={(e) => e.preventDefault()} onClick={() => imageInputRef.current?.click()}>＋ 图片</button>
        {allowVideo && <button type="button" className="add-btn add-video" onMouseDown={(e) => e.preventDefault()} onClick={() => videoInputRef.current?.click()}>＋ 视频</button>}
        {allowAttachments && <button type="button" className="add-btn add-file" onMouseDown={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>＋ 附件</button>}
        <span className="quick-hint">媒体插入到光标所在位置，可继续在图片 / 视频下方输入文字；也支持直接粘贴、拖拽图片到正文。</span>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { if (e.target.files?.length) void insertFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => { if (e.target.files?.length) void insertFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.zip,.rar,.ppt,.pptx,.xlsx"
        multiple
        hidden
        onChange={(e) => { if (e.target.files?.length) void insertFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
