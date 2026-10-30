import { useCallback, useState } from 'react'

export interface ToastItem {
  id: number
  text: string
  type: 'success' | 'info' | 'error'
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const push = useCallback((text: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, text, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2200)
  }, [])
  return { toasts, push }
}

export function ToastHost({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
