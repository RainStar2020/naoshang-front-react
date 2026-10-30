import { useRef } from 'react'
import { fileToBase64 } from '../utils/file'

interface ImageUploadProps {
  value: string
  onChange: (dataUrl: string) => void
  ratio?: '16:9' | '1:1' | '4:3'
  hint?: string
}

export default function ImageUpload({ value, onChange, ratio = '16:9', hint }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await fileToBase64(file)
    onChange(dataUrl)
  }

  return (
    <div className={`image-upload ratio-${ratio}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {value ? (
        <>
          <img src={value} alt="预览图" />
          <div className="image-upload-mask">
            <button type="button" onClick={() => inputRef.current?.click()}>替换</button>
            <button
              type="button"
              className="danger"
              onClick={() => onChange('')}
            >
              删除
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="image-upload-empty" onClick={() => inputRef.current?.click()}>
          <span className="plus">+</span>
          <span>{hint || '点击上传图片'}</span>
        </button>
      )}
    </div>
  )
}
