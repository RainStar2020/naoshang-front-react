import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  width?: number
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ open, title, width = 560, onClose, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-panel" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
